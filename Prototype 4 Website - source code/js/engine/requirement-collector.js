(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.RequirementCollector = api;
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
          // If a course is explicitly listed in a pick_n pool, it can be chosen
          // as an additional elective even when it was also an unchosen
          // alternative in another category. CS_BS capstone alternatives are the
          // motivating case: the catalog allows capstones to count as one of the
          // UD electives, so excluding every non-selected capstone alternative
          // can force a later spring-only elective and create an avoidable idle
          // final Winter quarter.
          const pool = (category.courses || [])
            .filter(code => !used.has(code) && courses[code] && !completedSet.has(code));
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

  function planningQuarterWindow(profile) {
    if (!profile) return null;
    const includeSummer = !!profile.includeSummer;
    const currentTerm = profile.currentTerm || 'F';
    const currentYear = parseInt(profile.currentYear, 10) || new Date().getFullYear();
    const targetTerm = profile.targetGradTerm || 'S';
    const targetYear = parseInt(profile.targetGradYear, 10) || (currentYear + 4);
    const nextQuarter = (term, year) => {
      if (term === 'F') return { term: 'W', year: year + 1 };
      if (term === 'W') return { term: 'S', year };
      if (term === 'S' && includeSummer) return { term: 'SU', year };
      if (term === 'S') return { term: 'F', year };
      if (term === 'SU') return { term: 'F', year };
      return { term: 'F', year };
    };
    const gapKeys = new Set();
    if (profile.gapEnabled && profile.gapTerm && profile.gapYear) {
      const gapBaseYear = parseInt(profile.gapYear, 10);
      if (!Number.isNaN(gapBaseYear)) {
        const addGapQuarter = (term, year) => gapKeys.add(`${year}-${term}`);
        if (profile.gapType === 'year') {
          let gapCur = { term: profile.gapTerm, year: gapBaseYear };
          const gapCount = includeSummer ? 4 : 3;
          for (let i = 0; i < gapCount; i++) {
            addGapQuarter(gapCur.term, gapCur.year);
            gapCur = nextQuarter(gapCur.term, gapCur.year);
          }
        } else {
          addGapQuarter(profile.gapTerm, gapBaseYear);
        }
      }
    }

    const quarters = [];
    let cur = { term: currentTerm, year: currentYear };
    let reachedTarget = false;
    for (let guard = 0; guard < 40; guard++) {
      const key = `${cur.year}-${cur.term}`;
      if ((cur.term !== 'SU' || includeSummer) && !gapKeys.has(key)) quarters.push(cur.term);
      if (cur.term === targetTerm && cur.year === targetYear) {
        reachedTarget = true;
        break;
      }
      const next = nextQuarter(cur.term, cur.year);
      if (next.term === cur.term && next.year === cur.year) break;
      cur = next;
    }
    return reachedTarget && quarters.length > 0 ? quarters : null;
  }

  function availabilityScore(code, profile, courses) {
    const window = planningQuarterWindow(profile);
    const offered = courses[code] && courses[code].quarters;
    if (!window) return 0;
    if (!offered || offered.length === 0) return -20000;
    const firstIndex = window.findIndex(q => offered.includes(q));
    if (firstIndex === -1) return -10000;

    // Favor courses that are not just available soon, but also flexible later in
    // the student's remaining window. A high-RMP GE that is only offered in one
    // tight season can crowd out a required major course with the same season and
    // force an avoidable extra year; broad F/W/S options are safer schedule glue.
    const offeredSet = new Set(offered);
    const inWindowOfferings = window.filter(q => offeredSet.has(q)).length;
    const termFlexibility = new Set(offered.filter(q => window.includes(q))).size;
    return 1000 - (firstIndex * 2) + (inWindowOfferings * 0.05) + (termFlexibility * 0.25);
  }

  function estimateMissingPrereqBurden(code, knownSet, courses, visiting) {
    const course = courses[code];
    if (!course || !Array.isArray(course.prereqs) || course.prereqs.length === 0) return 0;
    const seen = visiting || new Set();
    if (seen.has(code)) return 0;
    seen.add(code);
    let burden = 0;
    for (const group of course.prereqs) {
      const options = Array.isArray(group) ? group.filter(p => courses[p]) : [];
      if (options.some(p => knownSet.has(p))) continue;
      if (options.length === 0) continue;
      const optionCosts = options.map(p => 1 + estimateMissingPrereqBurden(p, new Set([...knownSet, p]), courses, new Set(seen)));
      burden += Math.min(...optionCosts);
    }
    seen.delete(code);
    return burden;
  }

  function isUnrelatedLabScienceGE(code, ge, profile) {
    if (!ge || ge.id !== 'SI') return false;
    if (profile && profile.geConcentration === 'ge_natural_sciences') return false;
    if (profile && profile.geConcentration === 'ge_health_wellness') return false;
    return /^(CHEM|BIOL|BIOE|PHYS)\s/.test(code);
  }

  function profileGEInterests(profile) {
    const values = [];
    if (profile && Array.isArray(profile.geConcentrations)) values.push(...profile.geConcentrations);
    if (profile && profile.geConcentration) values.push(profile.geConcentration);
    return [...new Set(values.filter(Boolean))].slice(0, 2);
  }

  function profileElectiveInterests(profile) {
    const values = [];
    if (profile && Array.isArray(profile.electiveInterests)) values.push(...profile.electiveInterests);
    if (profile && profile.concentration) values.push(profile.concentration);
    return [...new Set(values.filter(Boolean))].slice(0, 2);
  }

  const DISTRIBUTION_REQUIREMENTS_CACHE = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function distributionRequirements(helpers) {
    const key = helpers || {};
    if (DISTRIBUTION_REQUIREMENTS_CACHE && DISTRIBUTION_REQUIREMENTS_CACHE.has(key)) return DISTRIBUTION_REQUIREMENTS_CACHE.get(key);
    const requirements = [
      ...((helpers && helpers.geRequirements) || []),
      ...((helpers && helpers.ucRequirements) || [])
    ].map(legacyRequirement);
    if (DISTRIBUTION_REQUIREMENTS_CACHE) DISTRIBUTION_REQUIREMENTS_CACHE.set(key, requirements);
    return requirements;
  }

  function requirementForFamily(familyId, helpers) {
    return distributionRequirements(helpers).find(req => req.id === familyId || (req.subcategories || []).includes(familyId));
  }

  function geFamilyOfCode(geCode, helpers) {
    if (!geCode) return null;
    const req = requirementForFamily(geCode, helpers);
    return req ? req.id : geCode;
  }

  function geFamiliesOfCourse(code, courses, helpers) {
    const course = courses[code];
    const families = new Set();
    if (!course) return families;
    if (course.ge) families.add(geFamilyOfCode(course.ge, helpers));
    for (const req of distributionRequirements(helpers)) {
      if ((req.courses || []).includes(code) || (req.autoSatisfiedBy || []).includes(code)) families.add(req.id);
      if (course.alsoSatisfies && course.alsoSatisfies.includes(req.id)) families.add(req.id);
      if (course.alsoSatisfies && (req.subcategories || []).some(sub => course.alsoSatisfies.includes(sub))) families.add(req.id);
    }
    families.delete(null);
    return families;
  }

  function courseSatisfiesGEFamily(code, familyId, courses, helpers) {
    return geFamiliesOfCourse(code, courses, helpers).has(geFamilyOfCode(familyId, helpers));
  }

  function stillNeededGEFamilies(plannedOrCompletedCourses, courses, helpers) {
    const satisfied = new Set();
    for (const code of plannedOrCompletedCourses || []) {
      for (const family of geFamiliesOfCourse(code, courses, helpers)) satisfied.add(family);
    }
    const needed = new Set();
    for (const req of distributionRequirements(helpers)) if (!satisfied.has(req.id)) needed.add(req.id);
    return needed;
  }

  function isMajorRequiredCourse(code, collected) {
    for (const cat of (collected && collected.majorCategories) || []) {
      if (cat.type === 'all_required' && (cat.courses || []).includes(code)) return true;
      if (cat.type === 'choose_group' && (cat.groups || []).some(group => (group.courses || []).includes(code))) return true;
    }
    return false;
  }

  function isRedundantGE(code, plannedOrCompletedCourses, collected, courses, helpers) {
    const families = geFamiliesOfCourse(code, courses, helpers);
    if (families.size === 0) return false;
    if (isMajorRequiredCourse(code, collected)) return false;
    const needed = stillNeededGEFamilies(plannedOrCompletedCourses, courses, helpers);
    return ![...families].some(family => needed.has(family));
  }

  function geInterestMatches(code, profile, courses, concentrations, helpers) {
    const course = courses[code] || {};
    const matches = profileGEInterests(profile).filter(id => (course.concentrations || []).includes(id));
    const geGroups = Array.isArray(concentrations && concentrations.ge) ? concentrations.ge : [];
    for (const id of profileGEInterests(profile)) {
      const group = geGroups.find(g => g.id === id);
      if (!group) continue;
      if ((group.courses || []).includes(code) || [...geFamiliesOfCourse(code, courses, helpers)].some(f => (group.geCodes || []).some(g => geFamilyOfCode(g, helpers) === f))) {
        matches.push(id);
      }
    }
    return [...new Set(matches)];
  }

  function interestScore(code, profile, context, courses, concentrations, helpers) {
    const course = courses[code];
    if (!course) return 0;
    let score = 0;
    const electiveMatches = profileElectiveInterests(profile).filter(id => (course.concentrations || []).includes(id));
    const geMatches = geInterestMatches(code, profile, courses, concentrations, helpers);
    score += electiveMatches.length * 120;
    score += geMatches.length * 80;
    if (context && context.geGroup && (context.geGroup.courses || []).includes(code)) score += 100;
    if (context && context.geGroup && course.ge && (context.geGroup.geCodes || []).some(geCode => courseSatisfiesGEFamily(code, geCode, courses, helpers))) score += 50;
    if ((electiveMatches.length + geMatches.length) >= 2 || (electiveMatches.length && geMatches.length)) score += 40;
    return score;
  }

  function selectGECourses(collected, profile, state = {}, helpers = {}) {
    const courses = helpers.courses || {};
    const geRequirements = (collected && collected.geRequirements || helpers.geRequirements || []).map(legacyRequirement);
    const ucRequirements = (collected && collected.ucRequirements || helpers.ucRequirements || []).map(legacyRequirement);
    const concentrations = helpers.concentrations || {};
    const used = state.used || new Set();
    const completedSet = state.completedSet || new Set((profile && profile.completedCourses) || []);
    const picks = [];
    const geInterestIds = profileGEInterests(profile);
    const geConcGroups = Array.isArray(concentrations.ge)
      ? geInterestIds.map(id => concentrations.ge.find(group => group.id === id)).filter(Boolean)
      : [];
    const geConcCourses = new Set();
    geConcGroups.forEach(group => (group.courses || []).forEach(code => geConcCourses.add(code)));

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
        if (courseSatisfiesGEFamily(code, ge.id, courses, helpers)) { satisfied = true; break; }
        if ((ge.courses || []).includes(code)) { satisfied = true; break; }
        if (ge.autoSatisfiedBy && ge.autoSatisfiedBy.includes(code)) { satisfied = true; break; }
      }
      if (satisfied) continue;

      const candidates = [];
      const plannedContext = [...used, ...completedSet, ...picks];
      const neededFamiliesForContext = stillNeededGEFamilies(plannedContext, courses, helpers);
      for (const [code, course] of Object.entries(courses)) {
        if (used.has(code) || completedSet.has(code)) continue;
        if (code.startsWith('FREE')) continue;
        const families = geFamiliesOfCourse(code, courses, helpers);
        if (families.size > 0 && !isMajorRequiredCourse(code, collected) && ![...families].some(family => neededFamiliesForContext.has(family))) continue;
        if (families.has(geFamilyOfCode(ge.id, helpers))) { candidates.push(code); continue; }
        if ((ge.courses || []).includes(code)) candidates.push(code);
      }
      const fallback = (ge.courses || []).filter(code => !used.has(code) && courses[code] && !completedSet.has(code));
      const pool = candidates.length > 0 ? candidates : fallback;
      const scored = pool
        .map(code => {
          let score = 0;
          if (ge.id === 'C' && code === 'WRIT 2') score += 500;
          if (geConcCourses.has(code)) score += 100;
          for (const group of geConcGroups) score += interestScore(code, profile, { geGroup: group }, courses, concentrations, helpers);
          score += [...geFamiliesOfCourse(code, courses, helpers)].filter(family => neededFamiliesForContext.has(family)).length * 220;
          score += availabilityScore(code, profile, courses);
          const prereqBurden = estimateMissingPrereqBurden(code, new Set([...used, ...completedSet]), courses);
          score -= prereqBurden * 50;
          if (isUnrelatedLabScienceGE(code, ge, profile)) score -= 1200;
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
        const prereqGroups = [
          ...(Array.isArray(course.prereqs) ? course.prereqs : []),
          ...(Array.isArray(course.concurrentPrereqs) ? course.concurrentPrereqs : [])
        ];
        for (const orGroup of prereqGroups) {
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
      // A supplement pick must be independently schedulable; lab/coreq pairs are
      // skipped here because prerequisite expansion has already run by this phase.
      && (!courses[code].labCoreq || prereqContext.has(courses[code].labCoreq))
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
      score += interestScore(code, profile, { mode: 'filler' }, courses, concentrations, helpers);
      if (concentration && (course.concentrations || []).includes(concentration)) score += 50;
      if (geConcSet && geConcSet.has(code)) score += 30;
      score += availabilityScore(code, profile, courses);
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
    planningQuarterWindow,
    availabilityScore,
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
