(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RequirementCollector = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const CATEGORY_PRIORITY = { all_required: 0, choose_group: 1, pick_one: 2, pick_n: 3 };

  function byDomain(requirementSet, domain) {
    return (requirementSet && Array.isArray(requirementSet.requirements) ? requirementSet.requirements : [])
      .filter(requirement => requirement.domain === domain);
  }

  function legacyCategoryFromRequirement(requirement) {
    if (requirement && requirement.original && typeof requirement.original === 'object') return requirement.original;
    const optionCourses = requirement && requirement.options && requirement.options[0]
      ? requirement.options[0].courses || []
      : [];
    return {
      id: requirement ? requirement.sourceId : undefined,
      name: requirement ? requirement.name : undefined,
      type: requirement ? requirement.type : undefined,
      courses: optionCourses.slice(),
      n: requirement ? requirement.minChoices : undefined
    };
  }

  function collectMajorCategories(requirementSet) {
    return byDomain(requirementSet, 'major')
      .map(legacyCategoryFromRequirement)
      .sort((a, b) => (CATEGORY_PRIORITY[a.type] ?? 3) - (CATEGORY_PRIORITY[b.type] ?? 3));
  }

  function collectChooseGroupCourses(majorCategories) {
    const courses = new Set();
    for (const category of majorCategories || []) {
      if (category.type !== 'choose_group') continue;
      for (const group of category.groups || []) {
        for (const course of group.courses || []) courses.add(course);
      }
    }
    return courses;
  }

  function collectDegreeTargets(requirementSet) {
    const targets = {};
    for (const requirement of byDomain(requirementSet, 'degree_progress')) {
      if (requirement.type === 'minimum_units') targets.totalUnitsRequired = requirement.minUnits;
      if (requirement.type === 'minimum_upper_division_units') targets.minUpperDivUnits = requirement.minUnits;
    }
    return targets;
  }

  function collectProfileConstraints(requirementSet) {
    const constraints = {
      completedCourses: [],
      avoidedCourses: [],
      preferredCourses: []
    };
    for (const requirement of byDomain(requirementSet, 'student_profile')) {
      if (requirement.type === 'completed_courses') constraints.completedCourses = (requirement.courses || []).slice();
      if (requirement.type === 'avoid_courses') constraints.avoidedCourses = (requirement.courses || []).slice();
      if (requirement.type === 'prefer_courses') constraints.preferredCourses = (requirement.courses || []).slice();
      if (requirement.type === 'quarter_unit_limit') {
        constraints.maxUnitsPerQuarter = requirement.maxUnitsPerQuarter;
        constraints.allowSummer = requirement.allowSummer;
      }
    }
    return constraints;
  }

  function collect(requirementSet) {
    const majorCategories = collectMajorCategories(requirementSet);
    return {
      version: 1,
      majorId: requirementSet && requirementSet.majorId,
      requirementSet,
      majorCategories,
      geRequirements: byDomain(requirementSet, 'ge'),
      ucRequirements: byDomain(requirementSet, 'uc'),
      degreeTargets: collectDegreeTargets(requirementSet),
      profileConstraints: collectProfileConstraints(requirementSet),
      chooseGroupCourses: collectChooseGroupCourses(majorCategories)
    };
  }

  function defaultRankByConcentration(pool) {
    return pool.slice();
  }

  function selectMajorCourses(collected, profile, helpers = {}) {
    const courses = helpers.courses || {};
    const rankByConcentration = helpers.rankByConcentration || defaultRankByConcentration;
    const completedSet = new Set((profile && profile.completedCourses) || []);
    const used = new Set(completedSet);
    const selected = [];
    const courseTypeMap = new Map();
    const rawChooseGroupCourses = collected && collected.chooseGroupCourses
      ? collected.chooseGroupCourses
      : collectChooseGroupCourses(collected ? collected.majorCategories : []);
    const chooseGroupCourses = rawChooseGroupCourses instanceof Set
      ? rawChooseGroupCourses
      : new Set(rawChooseGroupCourses || []);
    const concentration = (profile && profile.concentration) || null;
    const selectionProfile = profile || {};

    const pushTagged = (code, type) => {
      if (code && courses[code] && !used.has(code)) {
        selected.push(code);
        used.add(code);
        courseTypeMap.set(code, type);
      }
    };

    const walk = (category, virtuallyPresent) => {
      switch (category.type) {
        case 'all_required':
          (category.courses || [])
            .filter(code => !chooseGroupCourses.has(code))
            .forEach(code => pushTagged(code, 'major_core'));
          break;
        case 'choose_group': {
          const groups = category.groups || [];
          const best = groups.find(group => group.courses.some(code => completedSet.has(code)))
            || groups.find(group => /strongly preferred/i.test(group.label || '') && group.courses.every(code => courses[code]))
            || groups.find(group => group.courses.every(code => courses[code]))
            || groups[0];
          if (best) {
            best.courses
              .filter(code => courses[code] && !completedSet.has(code))
              .forEach(code => pushTagged(code, 'major_core'));
          }
          break;
        }
        case 'pick_one': {
          if ((category.courses || []).some(code => completedSet.has(code) || used.has(code))) break;
          const pool = (category.courses || []).filter(code => courses[code] && !completedSet.has(code));
          const ranked = rankByConcentration(pool, concentration, selectionProfile, used, virtuallyPresent || new Set());
          if (ranked[0]) pushTagged(ranked[0], 'major_core');
          break;
        }
        case 'pick_n': {
          const vp = virtuallyPresent || new Set();
          const pool = (category.courses || [])
            .filter(code => !used.has(code) && courses[code] && !completedSet.has(code) && !vp.has(code));
          const alreadySatisfied = (category.courses || [])
            .filter(code => completedSet.has(code) || used.has(code)).length;
          const needed = Math.max(0, (category.n || 1) - alreadySatisfied);
          if (needed === 0) break;
          rankByConcentration(pool, concentration, selectionProfile, used, vp)
            .slice(0, needed)
            .forEach(code => pushTagged(code, 'major_elective'));
          break;
        }
      }
    };

    const majorCategories = (collected && collected.majorCategories) || [];
    for (const category of majorCategories) {
      if (category.type !== 'pick_n') walk(category, null);
    }

    const virtuallyPresent = new Set();
    for (const category of majorCategories) {
      if (category.type === 'pick_one') {
        const selectedAlternative = (category.courses || []).find(code => used.has(code));
        if (selectedAlternative) {
          for (const alternative of category.courses) {
            if (alternative !== selectedAlternative) virtuallyPresent.add(alternative);
          }
        }
      }
      if (category.type === 'choose_group') {
        for (const group of (category.groups || [])) {
          if (group.courses.every(code => used.has(code) || completedSet.has(code))) {
            for (const other of (category.groups || [])) {
              if (other !== group) other.courses.forEach(code => virtuallyPresent.add(code));
            }
            break;
          }
        }
      }
    }

    for (const category of majorCategories) {
      if (category.type === 'pick_n') walk(category, virtuallyPresent);
    }

    return {
      selected,
      courseTypes: [...courseTypeMap.entries()],
      virtuallyPresent: [...virtuallyPresent].sort()
    };
  }

  function legacyRequirement(requirement) {
    return requirement && requirement.original && typeof requirement.original === 'object'
      ? requirement.original
      : requirement;
  }

  function selectGECourses(collected, profile, state = {}, helpers = {}) {
    const courses = helpers.courses || {};
    const geRequirements = (collected && collected.geRequirements || helpers.geRequirements || []).map(legacyRequirement);
    const ucRequirements = (collected && collected.ucRequirements || helpers.ucRequirements || []).map(legacyRequirement);
    const concentrations = helpers.concentrations || {};
    const used = state.used || new Set();
    const completedSet = state.completedSet || new Set((profile && profile.completedCourses) || []);
    const picks = [];
    const geConcentration = (profile && profile.geConcentration) || null;
    const geConc = geConcentration && concentrations && concentrations.ge
      ? concentrations.ge.find(group => group.id === geConcentration)
      : null;
    const geConcCourses = geConc ? new Set(geConc.courses) : null;

    const neededUC = new Map();
    for (const req of ucRequirements) {
      if (req.id === 'ELWR' && profile && profile.elwrSatisfied) continue;
      let satisfied = false;
      for (const code of used) {
        if ((req.courses || []).includes(code)) { satisfied = true; break; }
        const course = courses[code];
        if (course && course.alsoSatisfies && course.alsoSatisfies.includes(req.id)) { satisfied = true; break; }
      }
      if (!satisfied) neededUC.set(req.id, req);
    }

    for (const ge of geRequirements) {
      let satisfied = false;
      for (const code of used) {
        const course = courses[code];
        if (!course) continue;
        if (course.ge === ge.id) { satisfied = true; break; }
        if (ge.subcategories && ge.subcategories.includes(course.ge)) { satisfied = true; break; }
        if (ge.autoSatisfiedBy && ge.autoSatisfiedBy.includes(code)) { satisfied = true; break; }
      }
      if (satisfied) continue;

      const candidates = [];
      for (const [code, course] of Object.entries(courses)) {
        if (used.has(code) || completedSet.has(code)) continue;
        if (code.startsWith('FREE')) continue;
        if (course.ge === ge.id) { candidates.push(code); continue; }
        if (ge.subcategories && ge.subcategories.includes(course.ge)) candidates.push(code);
      }
      const fallback = (ge.courses || []).filter(code => !used.has(code) && courses[code] && !completedSet.has(code));
      const pool = candidates.length > 0 ? candidates : fallback;
      const scored = pool
        .map(code => {
          let score = 0;
          if (geConcCourses && geConcCourses.has(code)) score += 100;
          for (const [ucId, ucReq] of neededUC) {
            if ((ucReq.courses || []).includes(code)) score += 200;
            else if (courses[code] && courses[code].alsoSatisfies && courses[code].alsoSatisfies.includes(ucId)) score += 200;
          }
          const match = code.match(/(\d+)/);
          if (match) score -= Math.floor(parseInt(match[1], 10) / 100);
          score += (courses[code] && courses[code].rmpScore) || 0;
          return { code, score };
        })
        .sort((a, b) => b.score - a.score);

      if (scored.length > 0) {
        const picked = scored[0].code;
        picks.push(picked);
        used.add(picked);
        for (const [ucId, ucReq] of neededUC) {
          if ((ucReq.courses || []).includes(picked) ||
              (courses[picked] && courses[picked].alsoSatisfies && courses[picked].alsoSatisfies.includes(ucId))) {
            neededUC.delete(ucId);
          }
        }
      }
    }
    return picks;
  }

  function selectUCCourses(collected, profile, state = {}, helpers = {}) {
    const courses = helpers.courses || {};
    const ucRequirements = (collected && collected.ucRequirements || helpers.ucRequirements || []).map(legacyRequirement);
    const used = state.used || new Set();
    const picks = [];
    for (const req of ucRequirements) {
      if (req.id === 'ELWR' && profile && profile.elwrSatisfied) continue;
      let satisfied = false;
      for (const code of used) {
        if ((req.courses || []).includes(code)) { satisfied = true; break; }
        const course = courses[code];
        if (course && course.alsoSatisfies && course.alsoSatisfies.includes(req.id)) { satisfied = true; break; }
      }
      if (!satisfied) {
        for (const code of req.courses || []) {
          if (!used.has(code) && courses[code]) {
            picks.push(code);
            used.add(code);
            break;
          }
        }
      }
    }
    return picks;
  }

  function selectPrerequisiteCourses(collected, profile, state = {}, helpers = {}) {
    const courses = helpers.courses || {};
    const planCodes = state.planCodes || state.selected || [];
    const completedSet = state.completedSet || new Set((profile && profile.completedCourses) || []);
    const usedSet = state.used || new Set();
    const virtuallyPresent = state.virtuallyPresent || new Set();
    const allKnown = new Set([...planCodes, ...usedSet, ...completedSet]);
    const toAdd = [];
    for (let pass = 0; pass < 6; pass++) {
      let added = false;
      for (const code of [...allKnown]) {
        const course = courses[code];
        if (!course) continue;
        const labCode = course.labCoreq;
        if (labCode && courses[labCode] && !allKnown.has(labCode)) {
          toAdd.push(labCode); allKnown.add(labCode); added = true;
        }
        if (!course.prereqs) continue;
        for (const orGroup of course.prereqs) {
          if (orGroup.some(p => allKnown.has(p))) continue;
          const candidate = orGroup
            .filter(p => courses[p] && !allKnown.has(p))
            .sort((a, b) => (courses[a].division === "lower" ? 0 : 1) - (courses[b].division === "lower" ? 0 : 1))[0];
          if (candidate) { toAdd.push(candidate); allKnown.add(candidate); added = true; }
        }
      }
      if (!added) break;
    }
    return toAdd;
  }

  function defaultPrereqsMet(prereqs, context) {
    if (!prereqs || prereqs.length === 0) return true;
    return prereqs.every(orGroup => (orGroup || []).some(code => context.has(code)));
  }

  function selectUpperDivisionSupplement(collected, profile, state = {}, helpers = {}) {
    const courses = helpers.courses || {};
    const prereqsMet = helpers.prereqsMet || defaultPrereqsMet;
    const used = state.used || new Set();
    const completedSet = state.completedSet || new Set((profile && profile.completedCourses) || []);
    const virtuallyPresent = state.virtuallyPresent || new Set();
    const targets = (collected && collected.degreeTargets) || {};
    const minUD = targets.minUpperDivUnits || 60;
    const majorId = (collected && collected.majorId) || (profile && profile.major) || 'CS_BA';
    const DEPT_MAP = { AM: "AM", CE: "CE", CS: "CSE", EE: "ECE", CSGD: "CMPM", NDT: "GAME", BMEB: "BIOL", BIOTECH: "BIOL" };
    const majKey = majorId.split("_")[0];
    const deptPfx = DEPT_MAP[majKey] || majKey;

    let curUD = [...used, ...completedSet].reduce(
      (sum, code) => sum + (courses[code] && courses[code].division === "upper" ? courses[code].units : 0),
      0
    );
    if (curUD >= minUD) return [];

    const prereqContext = new Set([...used, ...completedSet]);
    const isSafeSupplement = code => courses[code]
      && courses[code].division === "upper"
      && !code.startsWith("FREE")
      && Array.isArray(courses[code].quarters)
      && courses[code].quarters.length > 0
      && !used.has(code)
      && !completedSet.has(code)
      && !virtuallyPresent.has(code)
      && prereqsMet(courses[code].prereqs, prereqContext);

    const udPool = Object.keys(courses)
      .filter(code => isSafeSupplement(code) && code.startsWith(deptPfx))
      .concat(Object.keys(courses).filter(code => isSafeSupplement(code) && !code.startsWith(deptPfx)));

    const picks = [];
    for (const code of udPool) {
      if (curUD >= minUD) break;
      picks.push(code);
      used.add(code);
      prereqContext.add(code);
      curUD += courses[code].units;
    }
    return picks;
  }

  function selectFreePaddingCourses(collected, profile, state = {}, helpers = {}) {
    const courses = helpers.courses || {};
    const countUnits = helpers.countUnits || ((selected, completedSet, countProfile) => {
      const completed = completedSet || new Set((countProfile && countProfile.completedCourses) || []);
      const selectedUnits = (selected || []).reduce((sum, code) => sum + (courses[code] ? courses[code].units : 0), 0);
      const completedUnits = [...completed].reduce((sum, code) => sum + (courses[code] ? courses[code].units : 0), 0);
      return selectedUnits + completedUnits + ((countProfile && countProfile.priorCredits) || 0);
    });
    const selected = state.selected || [];
    const completedSet = state.completedSet || new Set((profile && profile.completedCourses) || []);
    const used = state.used || new Set();
    const targets = (collected && collected.degreeTargets) || {};
    const targetUnits = targets.totalUnitsRequired || 180;
    let total = countUnits(selected, completedSet, profile);
    const picks = [];
    for (let i = 1; i <= 30 && total < targetUnits; i++) {
      const code = `FREE ${i}`;
      if (courses[code] && !used.has(code)) {
        picks.push(code);
        used.add(code);
        total += courses[code].units;
      }
    }
    return picks;
  }

  function buildFillerPool(collected, profile, state = {}, helpers = {}) {
    const courses = helpers.courses || {};
    const concentrations = helpers.concentrations || {};
    const usedSet = state.used || new Set();
    const virtuallyPresent = state.virtuallyPresent || new Set();
    const prereqFor = new Set();
    for (const code of usedSet) {
      const course = courses[code];
      if (!course || !course.prereqs) continue;
      for (const orGroup of course.prereqs) orGroup.forEach(prereq => prereqFor.add(prereq));
    }

    const concentration = (profile && profile.concentration) || null;
    const geConcentration = (profile && profile.geConcentration) || null;
    const geConcentrations = Array.isArray(concentrations.ge) ? concentrations.ge : [];
    const geConc = geConcentration ? geConcentrations.find(group => group.id === geConcentration) : null;
    const geConcSet = geConc ? new Set(geConc.courses) : null;

    const candidates = [];
    for (const [code, course] of Object.entries(courses)) {
      if (usedSet.has(code) || code.startsWith("FREE") || virtuallyPresent.has(code)) continue;
      if (course.units < 1 || course.units > 5) continue;
      if (!course.quarters || course.quarters.length === 0) continue;
      if (prereqFor.has(code)) continue;
      let score = 0;
      if (concentration && (course.concentrations || []).includes(concentration)) score += 50;
      if (geConcSet && geConcSet.has(code)) score += 30;
      if (course.ge) score += 20;
      score += (course.rmpScore || 0);
      if (course.division === "lower") score += 5;
      candidates.push({ code, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 60).map(candidate => candidate.code);
  }

  return {
    CATEGORY_PRIORITY,
    collect,
    collectMajorCategories,
    collectChooseGroupCourses,
    collectDegreeTargets,
    collectProfileConstraints,
    selectMajorCourses,
    selectGECourses,
    selectUCCourses,
    selectPrerequisiteCourses,
    selectUpperDivisionSupplement,
    selectFreePaddingCourses,
    buildFillerPool
  };
});
