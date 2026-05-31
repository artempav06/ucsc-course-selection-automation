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

  return {
    CATEGORY_PRIORITY,
    collect,
    collectMajorCategories,
    collectChooseGroupCourses,
    collectDegreeTargets,
    collectProfileConstraints
  };
});
