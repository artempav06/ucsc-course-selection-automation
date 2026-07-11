#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const dir = __dirname;
const load = f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });
load('js/courses.js');
load('js/majors.js');
load('js/data.js');
load('js/engine/requirement-normalizer.js');
load('js/engine/requirement-collector.js');
load('js/engine.js');

function makeProfile(overrides = {}) {
  return {
    major: 'CS_BS',
    currentLevel: 1,
    currentTerm: 'F',
    currentYear: 2024,
    targetGradTerm: 'S',
    targetGradYear: 2028,
    completedCourses: ['CSE 20'],
    includeSummer: false,
    maxUnits: 19,
    minUnits: 12,
    concentration: 'cs_ai_ml',
    geConcentration: 'ge_arts_humanities',
    elwrSatisfied: false,
    priorCredits: 0,
    studentType: 'undergrad',
    ...overrides
  };
}

function legacySortedCategoryIds(majorId) {
  const priority = { all_required: 0, choose_group: 1, pick_one: 2, pick_n: 3 };
  return [...MAJOR_REQUIREMENTS[majorId].categories]
    .sort((a, b) => (priority[a.type] ?? 3) - (priority[b.type] ?? 3))
    .map(category => category.id);
}

function testCollectorMirrorsLegacyMajorCategoryOrder() {
  assert.strictEqual(typeof RequirementCollector.collect, 'function', 'RequirementCollector.collect must exist');
  const requirementSet = Scheduler.buildRequirementSet(makeProfile());
  const collected = RequirementCollector.collect(requirementSet);
  assert.deepStrictEqual(collected.majorCategories.map(category => category.id), legacySortedCategoryIds('CS_BS'));
}

function testSchedulerExposesCollectedRequirements() {
  assert.strictEqual(typeof Scheduler.collectRequirements, 'function', 'Scheduler.collectRequirements must exist');
  const collected = Scheduler.collectRequirements(makeProfile());
  assert.strictEqual(collected.majorId, 'CS_BS');
  assert.strictEqual(collected.degreeTargets.totalUnitsRequired, MAJOR_REQUIREMENTS.CS_BS.totalUnitsRequired);
  assert.strictEqual(collected.degreeTargets.minUpperDivUnits, MAJOR_REQUIREMENTS.CS_BS.minUpperDivUnits);
  assert(collected.geRequirements.length > 0, 'expected GE requirements');
  assert(collected.ucRequirements.length > 0, 'expected UC requirements');
  assert(collected.profileConstraints.completedCourses.includes('CSE 20'));
}

function testCollectorComputesChooseGroupCourseSetWithoutMutatingRequirements() {
  const before = JSON.stringify(MAJOR_REQUIREMENTS.CS_BS.categories);
  const collected = Scheduler.collectRequirements(makeProfile());
  const legacySet = new Set();
  for (const category of MAJOR_REQUIREMENTS.CS_BS.categories) {
    if (category.type === 'choose_group') {
      for (const group of category.groups || []) for (const course of group.courses || []) legacySet.add(course);
    }
  }
  assert.deepStrictEqual([...collected.chooseGroupCourses].sort(), [...legacySet].sort());
  assert.strictEqual(JSON.stringify(MAJOR_REQUIREMENTS.CS_BS.categories), before);
}

function legacySelectMajorCourses(profile) {
  const completedSet = new Set(profile.completedCourses || []);
  const used = new Set(completedSet);
  const selected = [];
  const courseTypeMap = new Map();
  const pushTagged = (code, type) => {
    if (code && COURSES[code] && !used.has(code)) {
      selected.push(code);
      used.add(code);
      courseTypeMap.set(code, type);
    }
  };

  const reqs = MAJOR_REQUIREMENTS[profile.major] || CS_BA_REQUIREMENTS;
  const sortedCats = [...(reqs.categories || [])].sort((a, b) =>
    (RequirementCollector.CATEGORY_PRIORITY[a.type] ?? 3) - (RequirementCollector.CATEGORY_PRIORITY[b.type] ?? 3)
  );

  const chooseGroupCourses = new Set();
  for (const cat of sortedCats) {
    if (cat.type === 'choose_group') {
      for (const group of (cat.groups || [])) {
        for (const course of (group.courses || [])) chooseGroupCourses.add(course);
      }
    }
  }

  for (const cat of sortedCats) {
    if (cat.type !== 'pick_n') {
      Scheduler.walk(cat, completedSet, used, profile.concentration || null, chooseGroupCourses, pushTagged, null, profile);
    }
  }

  const virtuallyPresent = new Set();
  for (const cat of sortedCats) {
    if (cat.type === 'pick_one') {
      const sel = (cat.courses || []).find(c => used.has(c));
      if (sel) for (const alt of cat.courses) if (alt !== sel) virtuallyPresent.add(alt);
    }
    if (cat.type === 'choose_group') {
      for (const group of (cat.groups || [])) {
        if (group.courses.every(c => used.has(c) || completedSet.has(c))) {
          for (const other of (cat.groups || [])) {
            if (other !== group) other.courses.forEach(c => virtuallyPresent.add(c));
          }
          break;
        }
      }
    }
  }

  for (const cat of sortedCats) {
    if (cat.type === 'pick_n') {
      Scheduler.walk(cat, completedSet, used, profile.concentration || null, chooseGroupCourses, pushTagged, virtuallyPresent, profile);
    }
  }

  return { selected, courseTypes: [...courseTypeMap.entries()], virtuallyPresent: [...virtuallyPresent].sort() };
}

function normalizedSelectMajorCourses(profile) {
  const collected = Scheduler.collectRequirements(profile);
  return RequirementCollector.selectMajorCourses(collected, profile, {
    courses: COURSES,
    rankByConcentration: (pool, concentration, selectionProfile, usedSet, virtuallyPresent) =>
      Scheduler.rankByConcentration(pool, concentration, selectionProfile, usedSet, virtuallyPresent)
  });
}

function selectionStateAfterMajor(profile) {
  const completedSet = new Set(profile.completedCourses || []);
  const used = new Set(completedSet);
  const majorSelection = Scheduler.selectMajorCourses(profile);
  for (const code of majorSelection.selected || []) used.add(code);
  return { used, completedSet };
}

function legacySelectGECourses(profile) {
  const state = selectionStateAfterMajor(profile);
  const picks = Scheduler.pickGE(state.used, state.completedSet, profile.geConcentration || null, profile);
  return { picks, used: [...state.used].sort() };
}

function normalizedSelectGECourses(profile) {
  const state = selectionStateAfterMajor(profile);
  const picks = RequirementCollector.selectGECourses(Scheduler.collectRequirements(profile), profile, state, {
    courses: COURSES,
    geRequirements: GE_REQUIREMENTS,
    ucRequirements: UC_REQUIREMENTS,
    concentrations: CONCENTRATIONS
  });
  return { picks, used: [...state.used].sort() };
}

function stateAfterMajorAndGE(profile) {
  const state = selectionStateAfterMajor(profile);
  Scheduler.pickGE(state.used, state.completedSet, profile.geConcentration || null, profile);
  return state;
}

function legacySelectUCCourses(profile) {
  const state = stateAfterMajorAndGE(profile);
  const picks = Scheduler.pickUC(state.used, profile);
  return { picks, used: [...state.used].sort() };
}

function normalizedSelectUCCourses(profile) {
  const state = stateAfterMajorAndGE(profile);
  const picks = RequirementCollector.selectUCCourses(Scheduler.collectRequirements(profile), profile, state, {
    courses: COURSES,
    ucRequirements: UC_REQUIREMENTS
  });
  return { picks, used: [...state.used].sort() };
}

function stateAfterMajorGEAndUC(profile) {
  const state = stateAfterMajorAndGE(profile);
  Scheduler.pickUC(state.used, profile);
  const majorSelection = Scheduler.selectMajorCourses(profile);
  const selected = [...(majorSelection.selected || [])];
  return {
    selected,
    used: state.used,
    completedSet: state.completedSet,
    virtuallyPresent: new Set(majorSelection.virtuallyPresent || [])
  };
}

function legacySelectPrerequisiteCourses(profile) {
  const state = stateAfterMajorGEAndUC(profile);
  const picks = Scheduler.expandPrereqs(state.selected, state.completedSet, state.used, state.virtuallyPresent);
  return { picks };
}

function normalizedSelectPrerequisiteCourses(profile) {
  const state = stateAfterMajorGEAndUC(profile);
  const picks = RequirementCollector.selectPrerequisiteCourses(Scheduler.collectRequirements(profile), profile, state, {
    courses: COURSES
  });
  return { picks };
}

function testCollectorMajorSelectionMirrorsLegacyDefaultCsBsOrdering() {
  const profile = makeProfile({ completedCourses: [] });
  assert.deepStrictEqual(normalizedSelectMajorCourses(profile), legacySelectMajorCourses(profile));
}

function testCollectorMajorSelectionPreservesCompletedCoursePathContinuity() {
  const profile = makeProfile({ completedCourses: ['MATH 19A'] });
  assert.deepStrictEqual(normalizedSelectMajorCourses(profile), legacySelectMajorCourses(profile));
}

function testCollectorMajorSelectionHonorsConcentrationAndAvoidedCourses() {
  const profile = makeProfile({ major: 'TIM_BS', concentration: 'tim_systems_eng', avoidedCourses: ['CSE 160'] });
  assert.deepStrictEqual(normalizedSelectMajorCourses(profile), legacySelectMajorCourses(profile));
}

function testCollectorMajorSelectionAcceptsSerializedChooseGroupCourseSet() {
  const collected = Scheduler.collectRequirements(makeProfile({ major: 'CS_BS', completedCourses: [] }));
  const serializedLike = {
    ...collected,
    chooseGroupCourses: [...collected.chooseGroupCourses]
  };
  assert.deepStrictEqual(
    RequirementCollector.selectMajorCourses(serializedLike, makeProfile({ major: 'CS_BS', completedCourses: [] }), {
      courses: COURSES,
      rankByConcentration: (pool, concentration, selectionProfile, usedSet, virtuallyPresent) =>
        Scheduler.rankByConcentration(pool, concentration, selectionProfile, usedSet, virtuallyPresent)
    }),
    RequirementCollector.selectMajorCourses(collected, makeProfile({ major: 'CS_BS', completedCourses: [] }), {
      courses: COURSES,
      rankByConcentration: (pool, concentration, selectionProfile, usedSet, virtuallyPresent) =>
        Scheduler.rankByConcentration(pool, concentration, selectionProfile, usedSet, virtuallyPresent)
    })
  );
}

function testCollectorPickNMaySelectVirtuallyPresentExplicitAlternatives() {
  const collected = {
    majorCategories: [
      { type: 'all_required', courses: ['CORE_A'] },
      { type: 'pick_one', courses: ['ALT_A', 'ALT_B'] },
      { type: 'pick_n', courses: ['ALT_A', 'ALT_B', 'ALT_C', 'DONE'], n: 3 }
    ],
    chooseGroupCourses: new Set()
  };
  const courses = {
    CORE_A: {},
    ALT_A: {},
    ALT_B: {},
    ALT_C: {},
    DONE: {}
  };
  let observedPickNPool = null;
  let observedVirtualAlternatives = null;

  const result = RequirementCollector.selectMajorCourses(collected, { completedCourses: ['DONE'] }, {
    courses,
    rankByConcentration(pool, concentration, selectionProfile, usedSet, virtuallyPresent) {
      if (virtuallyPresent && virtuallyPresent.size > 0) {
        observedPickNPool = pool.slice();
        observedVirtualAlternatives = [...virtuallyPresent].sort();
        assert(!pool.includes('ALT_A'), 'pick_n must exclude alternatives already used by pick_one');
        assert(!pool.includes('DONE'), 'pick_n must exclude completed courses');
        return ['ALT_B', 'ALT_C'];
      }
      return pool.slice();
    }
  });

  assert.deepStrictEqual(result.selected, ['CORE_A', 'ALT_A', 'ALT_B']);
  assert.deepStrictEqual(observedPickNPool, ['ALT_B', 'ALT_C']);
  assert.deepStrictEqual(observedVirtualAlternatives, ['ALT_B']);
  assert.deepStrictEqual(result.virtuallyPresent, ['ALT_B']);
  assert.strictEqual(result.courseTypes.find(([code]) => code === 'ALT_B')[1], 'major_elective');
}

function assertCollectorMatchesLegacyForProfiles(profiles) {
  const failures = [];
  for (const { label, profile } of profiles) {
    try {
      assert.deepStrictEqual(normalizedSelectMajorCourses(profile), legacySelectMajorCourses(profile));
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
    }
  }
  assert.deepStrictEqual(failures, []);
}

function defaultMajorProfile(majorId, overrides = {}) {
  return makeProfile({
    major: majorId,
    completedCourses: [],
    concentration: null,
    avoidedCourses: [],
    preferredCourses: [],
    ...overrides
  });
}

function firstKnownCourse(courses) {
  return (courses || []).find(code => COURSES[code]) || null;
}

function representativeCompletedCourseForMajor(majorId) {
  const reqs = MAJOR_REQUIREMENTS[majorId] || { categories: [] };
  for (const category of reqs.categories || []) {
    if (category.type === 'choose_group') {
      for (const group of category.groups || []) {
        const course = firstKnownCourse(group.courses);
        if (course) return course;
      }
    }
    const course = firstKnownCourse(category.courses);
    if (course) return course;
  }
  return null;
}

function representativeElectiveForMajor(majorId) {
  const reqs = MAJOR_REQUIREMENTS[majorId] || { categories: [] };
  const pickNCat = (reqs.categories || []).find(category => category.type === 'pick_n' && firstKnownCourse(category.courses));
  return pickNCat ? firstKnownCourse(pickNCat.courses) : representativeCompletedCourseForMajor(majorId);
}

function testCollectorMajorSelectionMirrorsLegacyForAllSupportedMajorsDefaultProfiles() {
  assertCollectorMatchesLegacyForProfiles(Object.keys(MAJOR_REQUIREMENTS).sort().map(majorId => ({
    label: `${majorId} default`,
    profile: defaultMajorProfile(majorId)
  })));
}

function testCollectorMajorSelectionMirrorsLegacyForRepresentativeProfileMatrix() {
  const profiles = [];
  for (const majorId of Object.keys(MAJOR_REQUIREMENTS).sort()) {
    const completed = representativeCompletedCourseForMajor(majorId);
    const elective = representativeElectiveForMajor(majorId);
    if (completed) {
      profiles.push({
        label: `${majorId} completed-continuity`,
        profile: defaultMajorProfile(majorId, { completedCourses: [completed] })
      });
    }
    if (elective) {
      profiles.push({
        label: `${majorId} avoided-course`,
        profile: defaultMajorProfile(majorId, { avoidedCourses: [elective] })
      });
      profiles.push({
        label: `${majorId} preferred-course`,
        profile: defaultMajorProfile(majorId, { preferredCourses: [elective] })
      });
    }
  }
  assert(profiles.length >= Object.keys(MAJOR_REQUIREMENTS).length * 2, 'expected broad representative profile coverage');
  assertCollectorMatchesLegacyForProfiles(profiles);
}

function testSchedulerSelectMajorCoursesWrapperMirrorsLegacySelection() {
  assert.strictEqual(typeof Scheduler.selectMajorCourses, 'function', 'Scheduler.selectMajorCourses must exist');
  const profiles = [
    defaultMajorProfile('CS_BS'),
    defaultMajorProfile('TIM_BS', { concentration: 'tim_systems_eng', avoidedCourses: ['CSE 160'] }),
    defaultMajorProfile('EE_BS', { completedCourses: [representativeCompletedCourseForMajor('EE_BS')] }),
    defaultMajorProfile('RE_BS', { preferredCourses: [representativeElectiveForMajor('RE_BS')] })
  ];
  for (const profile of profiles) {
    assert.deepStrictEqual(Scheduler.selectMajorCourses(profile), legacySelectMajorCourses(profile));
  }
}

function testSchedulerGenerateUsesNormalizedMajorSelectionWrapper() {
  const originalSelectMajorCourses = Scheduler.selectMajorCourses;
  let calls = 0;
  Scheduler.selectMajorCourses = function wrappedSelectMajorCourses(profile) {
    calls += 1;
    return originalSelectMajorCourses.call(this, profile);
  };
  try {
    const schedule = Scheduler.generate(defaultMajorProfile('CS_BS'));
    const validation = Validator.validateAll(schedule, defaultMajorProfile('CS_BS'));
    assert.strictEqual(validation.allMet, true, 'wrapped generate should still produce a valid schedule');
    assert.strictEqual(calls, 1, 'Scheduler.generate should delegate major selection exactly once');
  } finally {
    Scheduler.selectMajorCourses = originalSelectMajorCourses;
  }
}

function testSchedulerGenerateUsesNormalizedGEAndUCSelectionWrappers() {
  const originalSelectGECourses = Scheduler.selectGECourses;
  const originalSelectUCCourses = Scheduler.selectUCCourses;
  let geCalls = 0;
  let ucCalls = 0;
  Scheduler.selectGECourses = function wrappedSelectGECourses(profile, used, completedSet) {
    geCalls += 1;
    return originalSelectGECourses.call(this, profile, used, completedSet);
  };
  Scheduler.selectUCCourses = function wrappedSelectUCCourses(profile, used) {
    ucCalls += 1;
    return originalSelectUCCourses.call(this, profile, used);
  };
  try {
    const profile = defaultMajorProfile('CS_BS', { geConcentration: 'ge_arts_humanities' });
    const schedule = Scheduler.generate(profile);
    const validation = Validator.validateAll(schedule, profile);
    assert.strictEqual(validation.allMet, true, 'wrapped generate should still produce a valid schedule');
    assert.strictEqual(geCalls, 1, 'Scheduler.generate should delegate GE selection exactly once');
    assert.strictEqual(ucCalls, 1, 'Scheduler.generate should delegate UC selection exactly once');
  } finally {
    Scheduler.selectGECourses = originalSelectGECourses;
    Scheduler.selectUCCourses = originalSelectUCCourses;
  }
}

function geUcMirrorProfiles() {
  const profiles = [];
  for (const majorId of Object.keys(MAJOR_REQUIREMENTS).sort()) {
    profiles.push(defaultMajorProfile(majorId));
    profiles.push(defaultMajorProfile(majorId, { geConcentration: 'ge_arts_humanities' }));
    profiles.push(defaultMajorProfile(majorId, { completedCourses: ['WRIT 1'], elwrSatisfied: true }));
    const completed = representativeCompletedCourseForMajor(majorId);
    if (completed) {
      profiles.push(defaultMajorProfile(majorId, { completedCourses: [completed] }));
    }
  }
  profiles.push(defaultMajorProfile('TIM_BS', { concentration: 'tim_systems_eng', geConcentration: 'ge_arts_humanities' }));
  assert(profiles.length >= Object.keys(MAJOR_REQUIREMENTS).length * 3, 'expected broad GE/UC profile coverage');
  return profiles;
}

function testCollectorGESelectionMirrorsLegacyForBroadProfileMatrix() {
  assert.strictEqual(typeof RequirementCollector.selectGECourses, 'function', 'RequirementCollector.selectGECourses must exist');
  for (const profile of geUcMirrorProfiles()) {
    assert.deepStrictEqual(normalizedSelectGECourses(profile), legacySelectGECourses(profile));
  }
}

function testCollectorUCSelectionMirrorsLegacyForBroadProfileMatrix() {
  assert.strictEqual(typeof RequirementCollector.selectUCCourses, 'function', 'RequirementCollector.selectUCCourses must exist');
  for (const profile of geUcMirrorProfiles()) {
    assert.deepStrictEqual(normalizedSelectUCCourses(profile), legacySelectUCCourses(profile));
  }
}

function testSchedulerGEAndUCSelectionWrappersMirrorLegacySelection() {
  assert.strictEqual(typeof Scheduler.selectGECourses, 'function', 'Scheduler.selectGECourses must exist');
  assert.strictEqual(typeof Scheduler.selectUCCourses, 'function', 'Scheduler.selectUCCourses must exist');
  for (const profile of geUcMirrorProfiles()) {
    const geState = selectionStateAfterMajor(profile);
    const legacyGe = Scheduler.pickGE(new Set(geState.used), new Set(geState.completedSet), profile.geConcentration || null, profile);
    const wrapperState = selectionStateAfterMajor(profile);
    assert.deepStrictEqual(Scheduler.selectGECourses(profile, wrapperState.used, wrapperState.completedSet), legacyGe);

    const legacyUcState = stateAfterMajorAndGE(profile);
    const legacyUc = Scheduler.pickUC(new Set(legacyUcState.used), profile);
    const wrapperUcState = stateAfterMajorAndGE(profile);
    assert.deepStrictEqual(Scheduler.selectUCCourses(profile, wrapperUcState.used), legacyUc);
  }
}

function prerequisiteMirrorProfiles() {
  return [
    defaultMajorProfile('CS_BS'),
    defaultMajorProfile('CS_BA', { completedCourses: ['CSE 20'] }),
    defaultMajorProfile('CE_BS', { concentration: 'ce_digital_hw' }),
    defaultMajorProfile('RE_BS', { concentration: 're_autonomous', geConcentration: 'ge_arts_humanities' }),
    defaultMajorProfile('EE_BS', { completedCourses: ['WRIT 1'], elwrSatisfied: true }),
    defaultMajorProfile('TIM_BS', { concentration: 'tim_systems_eng', avoidedCourses: ['CSE 160'] })
  ];
}

function testCollectorPrerequisiteSelectionMirrorsLegacyForRepresentativeProfiles() {
  assert.strictEqual(typeof RequirementCollector.selectPrerequisiteCourses, 'function', 'RequirementCollector.selectPrerequisiteCourses must exist');
  for (const profile of prerequisiteMirrorProfiles()) {
    assert.deepStrictEqual(normalizedSelectPrerequisiteCourses(profile), legacySelectPrerequisiteCourses(profile));
  }
}

function testSchedulerPrerequisiteSelectionWrapperMirrorsLegacySelection() {
  assert.strictEqual(typeof Scheduler.selectPrerequisiteCourses, 'function', 'Scheduler.selectPrerequisiteCourses must exist');
  for (const profile of prerequisiteMirrorProfiles()) {
    const state = stateAfterMajorGEAndUC(profile);
    const legacy = Scheduler.expandPrereqs(state.selected, state.completedSet, state.used, state.virtuallyPresent);
    const wrapperState = stateAfterMajorGEAndUC(profile);
    assert.deepStrictEqual(
      Scheduler.selectPrerequisiteCourses(profile, wrapperState.selected, wrapperState.completedSet, wrapperState.used, wrapperState.virtuallyPresent),
      legacy
    );
  }
}

function testSchedulerGenerateUsesNormalizedPrerequisiteSelectionWrapper() {
  const originalSelectPrerequisiteCourses = Scheduler.selectPrerequisiteCourses;
  let calls = 0;
  Scheduler.selectPrerequisiteCourses = function wrappedSelectPrerequisiteCourses(profile, selected, completedSet, used, virtuallyPresent) {
    calls += 1;
    return originalSelectPrerequisiteCourses.call(this, profile, selected, completedSet, used, virtuallyPresent);
  };
  try {
    const profile = defaultMajorProfile('RE_BS', { concentration: 're_autonomous' });
    const schedule = Scheduler.generate(profile);
    const validation = Validator.validateAll(schedule, profile);
    assert.strictEqual(validation.allMet, true, 'wrapped generate should still produce a valid schedule');
    assert.strictEqual(calls, 1, 'Scheduler.generate should delegate prerequisite selection exactly once');
  } finally {
    Scheduler.selectPrerequisiteCourses = originalSelectPrerequisiteCourses;
  }
}

function stateAfterMajorGEUCAndPrereqs(profile) {
  const state = stateAfterMajorGEAndUC(profile);
  const prereqPicks = Scheduler.expandPrereqs(state.selected, state.completedSet, state.used, state.virtuallyPresent);
  for (const code of prereqPicks) {
    if (code && COURSES[code] && !state.used.has(code)) {
      state.selected.push(code);
      state.used.add(code);
    }
  }
  return state;
}

function legacySelectUpperDivisionSupplement(profile) {
  const state = stateAfterMajorGEUCAndPrereqs(profile);
  const target = [];
  const reqs = MAJOR_REQUIREMENTS[profile.major] || CS_BA_REQUIREMENTS;
  Scheduler.supplementUpperDiv(target, [], state.used, state.completedSet, reqs, profile.major, state.virtuallyPresent);
  return { picks: target, used: [...state.used].sort() };
}

function normalizedSelectUpperDivisionSupplement(profile) {
  const state = stateAfterMajorGEUCAndPrereqs(profile);
  const picks = RequirementCollector.selectUpperDivisionSupplement(Scheduler.collectRequirements(profile), profile, state, {
    courses: COURSES,
    prereqsMet: (prereqs, prereqContext) => Validator.prereqsMet(prereqs, prereqContext)
  });
  return { picks, used: [...state.used].sort() };
}

function upperDivisionSupplementMirrorProfiles() {
  return [
    defaultMajorProfile('CS_BS'),
    defaultMajorProfile('AM_BS', { concentration: 'am_modeling' }),
    defaultMajorProfile('CE_BS', { concentration: 'ce_robotics' }),
    defaultMajorProfile('EE_BS', { completedCourses: ['WRIT 1'], elwrSatisfied: true }),
    defaultMajorProfile('RE_BS', { concentration: 're_autonomous', geConcentration: 'ge_arts_humanities' }),
    defaultMajorProfile('TIM_BS', { concentration: 'tim_systems_eng', avoidedCourses: ['CSE 160'] })
  ];
}

function testCollectorUpperDivisionSupplementMirrorsLegacyForRepresentativeProfiles() {
  assert.strictEqual(typeof RequirementCollector.selectUpperDivisionSupplement, 'function', 'RequirementCollector.selectUpperDivisionSupplement must exist');
  for (const profile of upperDivisionSupplementMirrorProfiles()) {
    assert.deepStrictEqual(normalizedSelectUpperDivisionSupplement(profile), legacySelectUpperDivisionSupplement(profile));
  }
}

function testSchedulerUpperDivisionSupplementWrapperMirrorsLegacySelection() {
  assert.strictEqual(typeof Scheduler.selectUpperDivisionSupplement, 'function', 'Scheduler.selectUpperDivisionSupplement must exist');
  for (const profile of upperDivisionSupplementMirrorProfiles()) {
    const state = stateAfterMajorGEUCAndPrereqs(profile);
    const target = [];
    const reqs = MAJOR_REQUIREMENTS[profile.major] || CS_BA_REQUIREMENTS;
    Scheduler.supplementUpperDiv(target, [], state.used, state.completedSet, reqs, profile.major, state.virtuallyPresent);

    const wrapperState = stateAfterMajorGEUCAndPrereqs(profile);
    assert.deepStrictEqual(
      Scheduler.selectUpperDivisionSupplement(profile, wrapperState.used, wrapperState.completedSet, wrapperState.virtuallyPresent),
      target
    );
  }
}

function testSchedulerGenerateUsesNormalizedUpperDivisionSupplementWrapper() {
  const originalSelectUpperDivisionSupplement = Scheduler.selectUpperDivisionSupplement;
  let calls = 0;
  Scheduler.selectUpperDivisionSupplement = function wrappedSelectUpperDivisionSupplement(profile, used, completedSet, virtuallyPresent) {
    calls += 1;
    return originalSelectUpperDivisionSupplement.call(this, profile, used, completedSet, virtuallyPresent);
  };
  try {
    const profile = defaultMajorProfile('RE_BS', { concentration: 're_autonomous' });
    const schedule = Scheduler.generate(profile);
    const validation = Validator.validateAll(schedule, profile);
    assert.strictEqual(validation.allMet, true, 'wrapped generate should still produce a valid schedule');
    assert.strictEqual(calls, 1, 'Scheduler.generate should delegate upper-division supplement selection exactly once');
  } finally {
    Scheduler.selectUpperDivisionSupplement = originalSelectUpperDivisionSupplement;
  }
}

function stateAfterMajorGEUCPrereqsAndUpperDiv(profile) {
  const state = stateAfterMajorGEUCAndPrereqs(profile);
  const reqs = MAJOR_REQUIREMENTS[profile.major] || CS_BA_REQUIREMENTS;
  const udPicks = [];
  Scheduler.supplementUpperDiv(udPicks, [], state.used, state.completedSet, reqs, profile.major, state.virtuallyPresent);
  for (const code of udPicks) {
    if (code && COURSES[code] && !state.selected.includes(code)) state.selected.push(code);
  }
  return state;
}

function legacySelectFreePaddingCourses(profile) {
  const state = stateAfterMajorGEUCPrereqsAndUpperDiv(profile);
  const reqs = MAJOR_REQUIREMENTS[profile.major] || CS_BA_REQUIREMENTS;
  const targetUnits = reqs.totalUnitsRequired || 180;
  let total = Scheduler._countUnits(state.selected, state.completedSet, profile);
  const picks = [];
  for (let i = 1; i <= 30 && total < targetUnits; i++) {
    const code = `FREE ${i}`;
    if (COURSES[code] && !state.used.has(code)) {
      picks.push(code);
      state.used.add(code);
      total += COURSES[code].units;
    }
  }
  return { picks, used: [...state.used].sort() };
}

function normalizedSelectFreePaddingCourses(profile) {
  const state = stateAfterMajorGEUCPrereqsAndUpperDiv(profile);
  const picks = RequirementCollector.selectFreePaddingCourses(Scheduler.collectRequirements(profile), profile, state, {
    courses: COURSES,
    countUnits: (selected, completedSet, countProfile) => Scheduler._countUnits(selected, completedSet, countProfile)
  });
  return { picks, used: [...state.used].sort() };
}

function freePaddingMirrorProfiles() {
  return [
    defaultMajorProfile('CS_BS'),
    defaultMajorProfile('CS_BA', { completedCourses: ['CSE 20'] }),
    defaultMajorProfile('AM_BS', { concentration: 'am_modeling' }),
    defaultMajorProfile('RE_BS', { concentration: 're_ai_vision', geConcentration: null }),
    defaultMajorProfile('TIM_BS', { concentration: 'tim_finance_econ', geConcentration: 'ge_arts_humanities' }),
    defaultMajorProfile('BMEB_BI', { concentration: 'bi_computational' })
  ];
}

function testCollectorFreePaddingMirrorsLegacyForRepresentativeProfiles() {
  assert.strictEqual(typeof RequirementCollector.selectFreePaddingCourses, 'function', 'RequirementCollector.selectFreePaddingCourses must exist');
  for (const profile of freePaddingMirrorProfiles()) {
    assert.deepStrictEqual(normalizedSelectFreePaddingCourses(profile), legacySelectFreePaddingCourses(profile));
  }
}

function testSchedulerFreePaddingWrapperMirrorsLegacySelection() {
  assert.strictEqual(typeof Scheduler.selectFreePaddingCourses, 'function', 'Scheduler.selectFreePaddingCourses must exist');
  for (const profile of freePaddingMirrorProfiles()) {
    const state = stateAfterMajorGEUCPrereqsAndUpperDiv(profile);
    const reqs = MAJOR_REQUIREMENTS[profile.major] || CS_BA_REQUIREMENTS;
    const targetUnits = reqs.totalUnitsRequired || 180;
    let total = Scheduler._countUnits(state.selected, state.completedSet, profile);
    const legacy = [];
    for (let i = 1; i <= 30 && total < targetUnits; i++) {
      const code = `FREE ${i}`;
      if (COURSES[code] && !state.used.has(code)) {
        legacy.push(code);
        state.used.add(code);
        total += COURSES[code].units;
      }
    }

    const wrapperState = stateAfterMajorGEUCPrereqsAndUpperDiv(profile);
    assert.deepStrictEqual(
      Scheduler.selectFreePaddingCourses(profile, wrapperState.selected, wrapperState.completedSet, wrapperState.used),
      legacy
    );
  }
}

function testSchedulerGenerateUsesNormalizedFreePaddingWrapper() {
  const originalSelectFreePaddingCourses = Scheduler.selectFreePaddingCourses;
  let calls = 0;
  Scheduler.selectFreePaddingCourses = function wrappedSelectFreePaddingCourses(profile, selected, completedSet, used) {
    calls += 1;
    return originalSelectFreePaddingCourses.call(this, profile, selected, completedSet, used);
  };
  try {
    const profile = defaultMajorProfile('CS_BS');
    const schedule = Scheduler.generate(profile);
    const validation = Validator.validateAll(schedule, profile);
    assert.strictEqual(validation.allMet, true, 'wrapped generate should still produce a valid schedule');
    assert.strictEqual(calls, 1, 'Scheduler.generate should delegate free padding selection exactly once');
  } finally {
    Scheduler.selectFreePaddingCourses = originalSelectFreePaddingCourses;
  }
}

function stateAfterMajorGEUCPrereqsUpperDivAndFreePadding(profile) {
  const state = stateAfterMajorGEUCPrereqsAndUpperDiv(profile);
  const reqs = MAJOR_REQUIREMENTS[profile.major] || CS_BA_REQUIREMENTS;
  const targetUnits = reqs.totalUnitsRequired || 180;
  let total = Scheduler._countUnits(state.selected, state.completedSet, profile);
  for (let i = 1; i <= 30 && total < targetUnits; i++) {
    const code = `FREE ${i}`;
    if (COURSES[code] && !state.used.has(code)) {
      state.selected.push(code);
      state.used.add(code);
      total += COURSES[code].units;
    }
  }
  return state;
}

function legacyBuildFillerPool(profile) {
  const state = stateAfterMajorGEUCPrereqsUpperDivAndFreePadding(profile);
  return Scheduler.buildFillerPool(profile, state.used, state.virtuallyPresent);
}

function normalizedBuildFillerPool(profile) {
  const state = stateAfterMajorGEUCPrereqsUpperDivAndFreePadding(profile);
  return RequirementCollector.buildFillerPool(Scheduler.collectRequirements(profile), profile, state, {
    courses: COURSES,
    concentrations: CONCENTRATIONS
  });
}

function fillerPoolMirrorProfiles() {
  return [
    defaultMajorProfile('CS_BS'),
    defaultMajorProfile('CS_BA', { concentration: 'cs_graphics_vision', geConcentration: 'ge_arts_humanities' }),
    defaultMajorProfile('AM_BS', { concentration: 'am_pure_math' }),
    defaultMajorProfile('CE_BS', { concentration: 'ce_networks', avoidedCourses: ['CSE 150'] }),
    defaultMajorProfile('EE_BS', { concentration: 'ee_embedded_controls', completedCourses: ['WRIT 1'], elwrSatisfied: true }),
    defaultMajorProfile('TIM_BS', { concentration: 'tim_data_analytics', geConcentration: 'ge_arts_humanities' })
  ];
}

function testCollectorFillerPoolMirrorsLegacyForRepresentativeProfiles() {
  assert.strictEqual(typeof RequirementCollector.buildFillerPool, 'function', 'RequirementCollector.buildFillerPool must exist');
  for (const profile of fillerPoolMirrorProfiles()) {
    assert.deepStrictEqual(normalizedBuildFillerPool(profile), legacyBuildFillerPool(profile));
  }
}

function testSchedulerFillerPoolWrapperMirrorsLegacySelection() {
  assert.strictEqual(typeof Scheduler.buildNormalizedFillerPool, 'function', 'Scheduler.buildNormalizedFillerPool must exist');
  for (const profile of fillerPoolMirrorProfiles()) {
    const state = stateAfterMajorGEUCPrereqsUpperDivAndFreePadding(profile);
    assert.deepStrictEqual(
      Scheduler.buildNormalizedFillerPool(profile, state.used, state.virtuallyPresent),
      Scheduler.buildFillerPool(profile, state.used, state.virtuallyPresent)
    );
  }
}

function testSchedulerGenerateUsesNormalizedFillerPoolWrapper() {
  const originalBuildNormalizedFillerPool = Scheduler.buildNormalizedFillerPool;
  let calls = 0;
  Scheduler.buildNormalizedFillerPool = function wrappedBuildNormalizedFillerPool(profile, used, virtuallyPresent) {
    calls += 1;
    return originalBuildNormalizedFillerPool.call(this, profile, used, virtuallyPresent);
  };
  try {
    const profile = defaultMajorProfile('CS_BS');
    const schedule = Scheduler.generate(profile);
    const validation = Validator.validateAll(schedule, profile);
    assert.strictEqual(validation.allMet, true, 'wrapped generate should still produce a valid schedule');
    assert.strictEqual(calls, 1, 'Scheduler.generate should delegate filler-pool construction exactly once');
  } finally {
    Scheduler.buildNormalizedFillerPool = originalBuildNormalizedFillerPool;
  }
}

function prePlacementState(profile) {
  const completedSet = new Set(profile.completedCourses || []);
  const used = new Set(completedSet);
  const courseTypeMap = new Map();
  const selected = [];
  const addTagged = (code, type) => {
    if (code && COURSES[code] && !used.has(code)) {
      selected.push(code);
      used.add(code);
      courseTypeMap.set(code, type);
    }
  };

  const majorSelection = Scheduler.selectMajorCourses(profile);
  (majorSelection.selected || []).forEach(([code, type]) => addTagged(code, type));
  const virtuallyPresent = new Set(majorSelection.virtuallyPresent || []);
  Scheduler.selectGECourses(profile, used, completedSet).forEach(code => addTagged(code, 'ge'));
  Scheduler.selectUCCourses(profile, used).forEach(code => addTagged(code, 'uc'));
  Scheduler.selectPrerequisiteCourses(profile, selected, completedSet, used, virtuallyPresent).forEach(code => addTagged(code, 'prereq'));
  Scheduler.selectUpperDivisionSupplement(profile, used, completedSet, virtuallyPresent).forEach(code => addTagged(code, 'filler'));
  Scheduler.selectFreePaddingCourses(profile, selected, completedSet, used).forEach(code => addTagged(code, 'filler'));
  const fillerPool = Scheduler.buildNormalizedFillerPool(profile, used, virtuallyPresent);
  const remaining = selected.filter(code => !completedSet.has(code));
  return { remaining, courseTypeMap, fillerPool, completedSet };
}

function placementMirrorProfiles() {
  return [
    defaultMajorProfile('CS_BS'),
    defaultMajorProfile('CS_BA', { concentration: 'cs_data', geConcentration: 'ge_arts_humanities' }),
    defaultMajorProfile('AM_BS', { concentration: 'am_modeling', includeSummer: true }),
    defaultMajorProfile('RE_BS', { concentration: 're_autonomous', maxUnits: 17 }),
    defaultMajorProfile('TIM_BS', { concentration: 'tim_systems_eng', gapEnabled: true, gapTerm: 'W', gapYear: 2026 }),
    defaultMajorProfile('EE_BS', { concentration: 'ee_signals_comm', currentLevel: 2, currentTerm: 'S', currentYear: 2025 })
  ];
}

function testSchedulerPlacementWrapperMirrorsLegacyPlacement() {
  assert.strictEqual(typeof Scheduler.placeSelectedCourses, 'function', 'Scheduler.placeSelectedCourses must exist');
  for (const profile of placementMirrorProfiles()) {
    const legacyState = prePlacementState(profile);
    const wrapperState = prePlacementState(profile);
    assert.deepStrictEqual(
      Scheduler.placeSelectedCourses(profile, wrapperState.remaining, wrapperState.courseTypeMap, wrapperState.fillerPool, wrapperState.completedSet),
      Scheduler.placeIntoQuarters(legacyState.remaining, legacyState.courseTypeMap, legacyState.fillerPool, legacyState.completedSet, profile)
    );
  }
}

function testSchedulerGenerateUsesPlacementWrapper() {
  const originalPlaceSelectedCourses = Scheduler.placeSelectedCourses;
  let calls = 0;
  Scheduler.placeSelectedCourses = function wrappedPlaceSelectedCourses(profile, remaining, courseTypeMap, fillerPool, completedSet) {
    calls += 1;
    return originalPlaceSelectedCourses.call(this, profile, remaining, courseTypeMap, fillerPool, completedSet);
  };
  try {
    const profile = defaultMajorProfile('CS_BS');
    const schedule = Scheduler.generate(profile);
    const validation = Validator.validateAll(schedule, profile);
    assert.strictEqual(validation.allMet, true, 'wrapped generate should still produce a valid schedule');
    assert.strictEqual(calls, 1, 'Scheduler.generate should delegate quarter placement exactly once');
  } finally {
    Scheduler.placeSelectedCourses = originalPlaceSelectedCourses;
  }
}

function validatorMirrorProfiles() {
  return [
    defaultMajorProfile('CS_BS'),
    defaultMajorProfile('CS_BA', { concentration: 'cs_data', geConcentration: 'ge_arts_humanities' }),
    defaultMajorProfile('AM_BS', { concentration: 'am_modeling', includeSummer: true }),
    defaultMajorProfile('RE_BS', { concentration: 're_autonomous', maxUnits: 17 }),
    defaultMajorProfile('TIM_BS', { concentration: 'tim_systems_eng', gapEnabled: true, gapTerm: 'W', gapYear: 2026 }),
    defaultMajorProfile('EE_BS', { concentration: 'ee_signals_comm', currentLevel: 2, currentTerm: 'S', currentYear: 2025 })
  ];
}

function expectedValidationFromPublicPieces(schedule, profile) {
  const plannedFromSchedule = [];
  for (const year of schedule) {
    for (const quarter of Object.values(year.quarters)) {
      plannedFromSchedule.push(...quarter);
    }
  }
  const completed = profile && profile.completedCourses ? profile.completedCourses : [];
  const allCourses = [...plannedFromSchedule, ...completed];
  const majorId = (profile && profile.major) || 'CS_BA';
  const majorReqs = (typeof MAJOR_REQUIREMENTS !== 'undefined' && MAJOR_REQUIREMENTS[majorId])
    || CS_BA_REQUIREMENTS;
  const majorResults = Validator.validateMajor(allCourses, majorReqs);
  const geResults = Validator.validateGE(allCourses);
  const ucResults = Validator.validateUC(allCourses, profile);
  const plannedUnits = plannedFromSchedule.reduce((sum, code) => sum + (COURSES[code]?.units || 0), 0);
  const completedUnits = completed.reduce((sum, code) => sum + (COURSES[code]?.units || 0), 0);
  const totalUnits = plannedUnits + completedUnits + (profile ? (profile.priorCredits || 0) : 0);
  const upperDivUnits = [...plannedFromSchedule, ...completed]
    .reduce((sum, code) => sum + ((COURSES[code] && COURSES[code].division === 'upper') ? COURSES[code].units : 0), 0);
  const expected = {
    major: majorResults,
    ge: geResults,
    uc: ucResults,
    requirementSet: buildNormalizedRequirementSet(profile),
    totalUnits,
    upperDivUnits,
    priorCredits: profile ? (profile.priorCredits || 0) : 0,
    completedUnits,
    totalUnitsMet: totalUnits >= majorReqs.totalUnitsRequired,
    upperDivMet: upperDivUnits >= majorReqs.minUpperDivUnits,
    allMajorMet: majorResults.every(r => r.fulfilled),
    allGEMet: geResults.every(r => r.fulfilled),
    allUCMet: ucResults.every(r => r.fulfilled),
    majorReqs
  };
  expected.prereqViolations = Validator.validatePrerequisiteChronology(schedule, completed);
  expected.prerequisitesMet = expected.prereqViolations.length === 0;
  expected.allMet = expected.allMajorMet && expected.allGEMet && expected.allUCMet
    && expected.totalUnitsMet && expected.upperDivMet && expected.prerequisitesMet;
  return expected;
}

function testValidatorScheduleWrapperMirrorsValidationPiecesForRepresentativeProfiles() {
  assert.strictEqual(typeof Validator.validateSchedule, 'function', 'Validator.validateSchedule must exist');
  for (const profile of validatorMirrorProfiles()) {
    const schedule = Scheduler.generate(profile);
    assert.deepStrictEqual(
      Validator.validateSchedule(schedule, profile),
      expectedValidationFromPublicPieces(schedule, profile),
      `validateSchedule should preserve validation behavior for ${profile.major}`
    );
  }
}

function testValidatorValidateAllUsesScheduleWrapper() {
  const originalValidateSchedule = Validator.validateSchedule;
  let calls = 0;
  Validator.validateSchedule = function wrappedValidateSchedule(schedule, profile) {
    calls += 1;
    return originalValidateSchedule.call(this, schedule, profile);
  };
  try {
    const profile = defaultMajorProfile('CS_BS');
    const schedule = Scheduler.generate(profile);
    const validation = Validator.validateAll(schedule, profile);
    assert.strictEqual(validation.allMet, true, 'wrapped validation should still validate a generated schedule');
    assert.strictEqual(calls, 1, 'Validator.validateAll should delegate validation exactly once');
  } finally {
    Validator.validateSchedule = originalValidateSchedule;
  }
}

function testSchedulerGenerateWithExplanationExposesPhaseDebugOutput() {
  assert.strictEqual(typeof Scheduler.generateWithExplanation, 'function', 'Scheduler.generateWithExplanation must exist');
  for (const profile of validatorMirrorProfiles()) {
    const explained = Scheduler.generateWithExplanation(profile);
    assert(Array.isArray(explained.schedule), 'expected generated schedule array');
    assert(explained.explanation && explained.explanation.phases, 'expected explanation phase debug data');
    assert.deepStrictEqual(explained.schedule, Scheduler.generate(profile), `explained schedule should match normal generate for ${profile.major}`);
    assert.deepStrictEqual(explained.explanation.phases.majorSelection.courses, Scheduler.selectMajorCourses(profile).selected);
    assert.strictEqual(explained.explanation.phases.majorSelection.count, Scheduler.selectMajorCourses(profile).selected.length);
    assert.strictEqual(explained.explanation.phases.fillerPool.count, explained.explanation.phases.fillerPool.candidates.length);
    assert.strictEqual(explained.explanation.validation.allMet, Validator.validateSchedule(explained.schedule, profile).allMet);
    assert.strictEqual(explained.explanation.totals.scheduledUnits, Validator.validateSchedule(explained.schedule, profile).totalUnits - (profile.priorCredits || 0));
  }
}

function testSchedulerGenerateUsesExplanationWrapper() {
  const originalGenerateWithExplanation = Scheduler.generateWithExplanation;
  let calls = 0;
  Scheduler.generateWithExplanation = function wrappedGenerateWithExplanation(profile) {
    calls += 1;
    return originalGenerateWithExplanation.call(this, profile);
  };
  try {
    const profile = defaultMajorProfile('CS_BS');
    const schedule = Scheduler.generate(profile);
    const validation = Validator.validateAll(schedule, profile);
    assert.strictEqual(validation.allMet, true, 'wrapped explanation generation should still produce a valid schedule');
    assert.strictEqual(calls, 1, 'Scheduler.generate should delegate explanation-aware generation exactly once');
  } finally {
    Scheduler.generateWithExplanation = originalGenerateWithExplanation;
  }
}

function testSchedulerAvailabilityScoreDelegatesToCollectorHelper() {
  assert.strictEqual(typeof RequirementCollector.availabilityScore, 'function', 'RequirementCollector.availabilityScore must exist');
  const originalAvailabilityScore = RequirementCollector.availabilityScore;
  let calls = 0;
  RequirementCollector.availabilityScore = function wrappedAvailabilityScore(code, profile, courses) {
    calls += 1;
    assert.strictEqual(code, 'CSE 186');
    assert.strictEqual(courses, COURSES, 'Scheduler should pass the runtime course catalog into the collector helper');
    return originalAvailabilityScore(code, profile, courses);
  };
  try {
    const profile = makeProfile({ currentTerm: 'S', currentYear: 2026, targetGradTerm: 'S', targetGradYear: 2026 });
    assert.strictEqual(
      Scheduler.availabilityScore('CSE 186', profile),
      originalAvailabilityScore('CSE 186', profile, COURSES),
      'Scheduler.availabilityScore should return the collector helper score, including in-window availability strength'
    );
    assert.strictEqual(calls, 1, 'Scheduler.availabilityScore should delegate to RequirementCollector.availabilityScore exactly once');
  } finally {
    RequirementCollector.availabilityScore = originalAvailabilityScore;
  }
}

const tests = [
  testCollectorMirrorsLegacyMajorCategoryOrder,
  testSchedulerExposesCollectedRequirements,
  testCollectorComputesChooseGroupCourseSetWithoutMutatingRequirements,
  testCollectorMajorSelectionMirrorsLegacyDefaultCsBsOrdering,
  testCollectorMajorSelectionPreservesCompletedCoursePathContinuity,
  testCollectorMajorSelectionHonorsConcentrationAndAvoidedCourses,
  testCollectorMajorSelectionAcceptsSerializedChooseGroupCourseSet,
  testCollectorPickNMaySelectVirtuallyPresentExplicitAlternatives,
  testCollectorMajorSelectionMirrorsLegacyForAllSupportedMajorsDefaultProfiles,
  testCollectorMajorSelectionMirrorsLegacyForRepresentativeProfileMatrix,
  testSchedulerSelectMajorCoursesWrapperMirrorsLegacySelection,
  testSchedulerGenerateUsesNormalizedMajorSelectionWrapper,
  testSchedulerGenerateUsesNormalizedGEAndUCSelectionWrappers,
  testCollectorGESelectionMirrorsLegacyForBroadProfileMatrix,
  testCollectorUCSelectionMirrorsLegacyForBroadProfileMatrix,
  testSchedulerGEAndUCSelectionWrappersMirrorLegacySelection,
  testCollectorPrerequisiteSelectionMirrorsLegacyForRepresentativeProfiles,
  testSchedulerPrerequisiteSelectionWrapperMirrorsLegacySelection,
  testSchedulerGenerateUsesNormalizedPrerequisiteSelectionWrapper,
  testCollectorUpperDivisionSupplementMirrorsLegacyForRepresentativeProfiles,
  testSchedulerUpperDivisionSupplementWrapperMirrorsLegacySelection,
  testSchedulerGenerateUsesNormalizedUpperDivisionSupplementWrapper,
  testCollectorFreePaddingMirrorsLegacyForRepresentativeProfiles,
  testSchedulerFreePaddingWrapperMirrorsLegacySelection,
  testSchedulerGenerateUsesNormalizedFreePaddingWrapper,
  testCollectorFillerPoolMirrorsLegacyForRepresentativeProfiles,
  testSchedulerFillerPoolWrapperMirrorsLegacySelection,
  testSchedulerGenerateUsesNormalizedFillerPoolWrapper,
  testSchedulerPlacementWrapperMirrorsLegacyPlacement,
  testSchedulerGenerateUsesPlacementWrapper,
  testValidatorScheduleWrapperMirrorsValidationPiecesForRepresentativeProfiles,
  testValidatorValidateAllUsesScheduleWrapper,
  testSchedulerGenerateWithExplanationExposesPhaseDebugOutput,
  testSchedulerGenerateUsesExplanationWrapper,
  testSchedulerAvailabilityScoreDelegatesToCollectorHelper
];
let passed = 0;
for (const test of tests) {
  test();
  passed += 1;
}
console.log(`test_requirement_collector.js: ${passed}/${tests.length} passed`);
