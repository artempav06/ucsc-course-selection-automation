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

  return {
    CATEGORY_PRIORITY,
    collect,
    collectMajorCategories,
    collectChooseGroupCourses,
    collectDegreeTargets,
    collectProfileConstraints,
    selectMajorCourses
  };
});
