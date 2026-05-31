(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RequirementNormalizer = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function cloneCourses(courses) {
    return Array.isArray(courses) ? courses.slice() : [];
  }

  function cloneNestedCourseGroups(groups) {
    return Array.isArray(groups) ? groups.map(group => cloneCourses(group)) : [];
  }

  function cloneNestedPairs(pairs) {
    return Array.isArray(pairs) ? pairs.map(pair => cloneCourses(pair)) : [];
  }

  function normalizeRicherRequirementMetadata(source) {
    const metadata = {};
    if (!source || typeof source !== 'object') return metadata;

    if (source.type === 'repeat_course' || source.repeatable) {
      metadata.repeatable = {
        course: source.course || source.repeatable.course,
        minUnits: source.minUnits || source.repeatable.minUnits,
        minTerms: source.minTerms || source.repeatable.minTerms
      };
    }
    if (source.prerequisitesByMajor) {
      metadata.prerequisitesByMajor = Object.fromEntries(
        Object.entries(source.prerequisitesByMajor).map(([majorId, groups]) => [majorId, cloneNestedCourseGroups(groups)])
      );
    }
    if (source.equivalentCourses) metadata.equivalentCourses = cloneNestedPairs(source.equivalentCourses);
    if (source.creditExclusions) metadata.creditExclusions = cloneNestedPairs(source.creditExclusions);
    if (source.catalogYear) metadata.catalogYear = source.catalogYear;
    if (source.sourceUrl) metadata.sourceUrl = source.sourceUrl;
    if (source.unsupportedOptions) metadata.unsupportedOptions = source.unsupportedOptions.slice();
    return metadata;
  }

  function normalizeMajorCategory(majorId, category) {
    const base = {
      id: `${majorId}:${category.id}`,
      sourceId: category.id,
      domain: 'major',
      majorId,
      name: category.name,
      type: category.type,
      minChoices: 1,
      options: [],
      metadata: normalizeRicherRequirementMetadata(category),
      original: category
    };

    if (category.type === 'all_required') {
      return {
        ...base,
        minChoices: cloneCourses(category.courses).length,
        options: [{ label: 'Required courses', courses: cloneCourses(category.courses) }]
      };
    }

    if (category.type === 'pick_one') {
      return {
        ...base,
        minChoices: 1,
        options: [{ label: category.name, courses: cloneCourses(category.courses) }]
      };
    }

    if (category.type === 'pick_n') {
      return {
        ...base,
        minChoices: category.n,
        options: [{ label: category.name, courses: cloneCourses(category.courses) }]
      };
    }

    if (category.type === 'choose_group') {
      return {
        ...base,
        minChoices: 1,
        options: (category.groups || []).map(group => ({
          label: group.label,
          courses: cloneCourses(group.courses)
        }))
      };
    }

    if (category.type === 'repeat_course') {
      return {
        ...base,
        minChoices: category.minTerms,
        options: [{ label: category.name, courses: [category.course] }]
      };
    }

    return {
      ...base,
      type: 'unknown',
      options: []
    };
  }

  function normalizeMajorRequirements(major) {
    if (!major || !Array.isArray(major.categories)) return [];
    return major.categories.map(category => normalizeMajorCategory(major.id, category));
  }

  function normalizeGeRequirements(geRequirements) {
    const geList = Array.isArray(geRequirements) ? geRequirements : Object.values(geRequirements || {});
    return geList.map(ge => {
      const options = Array.isArray(ge.subcategories) && ge.subcategories.length
        ? ge.subcategories.map(sub => ({ label: sub.name || sub.id, courses: cloneCourses(sub.courses) }))
        : [{ label: ge.name, courses: cloneCourses(ge.courses) }];
      return {
        id: `GE:${ge.id}`,
        sourceId: ge.id,
        domain: 'ge',
        name: ge.name,
        type: 'ge_requirement',
        minChoices: ge.needed,
        options,
        autoSatisfiedBy: cloneCourses(ge.autoSatisfiedBy),
        metadata: normalizeRicherRequirementMetadata(ge),
        original: ge
      };
    });
  }

  function normalizeUcRequirements(ucRequirements) {
    const ucList = Array.isArray(ucRequirements) ? ucRequirements : Object.values(ucRequirements || {});
    return ucList.map(uc => ({
      id: `UC:${uc.id}`,
      sourceId: uc.id,
      domain: 'uc',
      name: uc.name,
      type: 'uc_requirement',
      minChoices: uc.needed,
      options: [{ label: uc.name, courses: cloneCourses(uc.courses) }],
      canBeSatisfiedByPlacement: Boolean(uc.canBeSatisfiedByPlacement),
      metadata: normalizeRicherRequirementMetadata(uc),
      original: uc
    }));
  }

  function normalizeDegreeProgressRequirements(major) {
    if (!major) return [];
    const requirements = [];
    if (typeof major.totalUnitsRequired === 'number') {
      requirements.push({
        id: `${major.id}:TOTAL_UNITS`,
        sourceId: 'totalUnitsRequired',
        domain: 'degree_progress',
        majorId: major.id,
        name: 'Total Units',
        type: 'minimum_units',
        minUnits: major.totalUnitsRequired,
        appliesTo: 'degree',
        metadata: {},
        original: major.totalUnitsRequired
      });
    }
    if (typeof major.minUpperDivUnits === 'number') {
      requirements.push({
        id: `${major.id}:UPPER_DIV_UNITS`,
        sourceId: 'minUpperDivUnits',
        domain: 'degree_progress',
        majorId: major.id,
        name: 'Upper-Division Units',
        type: 'minimum_upper_division_units',
        minUnits: major.minUpperDivUnits,
        appliesTo: 'degree',
        metadata: {},
        original: major.minUpperDivUnits
      });
    }
    return requirements;
  }

  function normalizeStudentProfileRequirements(profile) {
    if (!profile) return [];
    const requirements = [];
    if (Array.isArray(profile.completedCourses) && profile.completedCourses.length) {
      requirements.push({
        id: 'PROFILE:COMPLETED_COURSES',
        sourceId: 'completedCourses',
        domain: 'student_profile',
        name: 'Completed Courses',
        type: 'completed_courses',
        courses: cloneCourses(profile.completedCourses),
        metadata: {},
        original: cloneCourses(profile.completedCourses)
      });
    }
    if (Array.isArray(profile.avoidedCourses) && profile.avoidedCourses.length) {
      requirements.push({
        id: 'PROFILE:AVOIDED_COURSES',
        sourceId: 'avoidedCourses',
        domain: 'student_profile',
        name: 'Avoided Courses',
        type: 'avoid_courses',
        courses: cloneCourses(profile.avoidedCourses),
        metadata: {},
        original: cloneCourses(profile.avoidedCourses)
      });
    }
    if (Array.isArray(profile.preferredCourses) && profile.preferredCourses.length) {
      requirements.push({
        id: 'PROFILE:PREFERRED_COURSES',
        sourceId: 'preferredCourses',
        domain: 'student_profile',
        name: 'Preferred Courses',
        type: 'prefer_courses',
        courses: cloneCourses(profile.preferredCourses),
        metadata: {},
        original: cloneCourses(profile.preferredCourses)
      });
    }
    if (typeof profile.maxUnitsPerQuarter === 'number') {
      requirements.push({
        id: 'PROFILE:WORKLOAD',
        sourceId: 'maxUnitsPerQuarter',
        domain: 'student_profile',
        name: 'Quarter Workload Limit',
        type: 'quarter_unit_limit',
        maxUnitsPerQuarter: profile.maxUnitsPerQuarter,
        allowSummer: Boolean(profile.allowSummer),
        metadata: {
          startTerm: profile.startTerm,
          startYear: profile.startYear
        },
        original: profile
      });
    }
    return requirements;
  }

  function normalizeRequirementSet({ major, geRequirements, ucRequirements, profile } = {}) {
    return {
      version: 1,
      majorId: major && major.id,
      requirements: [
        ...normalizeMajorRequirements(major),
        ...normalizeGeRequirements(geRequirements),
        ...normalizeUcRequirements(ucRequirements),
        ...normalizeDegreeProgressRequirements(major),
        ...normalizeStudentProfileRequirements(profile)
      ]
    };
  }

  return {
    normalizeMajorRequirements,
    normalizeGeRequirements,
    normalizeUcRequirements,
    normalizeDegreeProgressRequirements,
    normalizeStudentProfileRequirements,
    normalizeRequirementSet,
    normalizeRicherRequirementMetadata,
    normalizeMajorCategory
  };
});
