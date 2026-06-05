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

const tests = [
  testCollectorMirrorsLegacyMajorCategoryOrder,
  testSchedulerExposesCollectedRequirements,
  testCollectorComputesChooseGroupCourseSetWithoutMutatingRequirements,
  testCollectorMajorSelectionMirrorsLegacyDefaultCsBsOrdering,
  testCollectorMajorSelectionPreservesCompletedCoursePathContinuity,
  testCollectorMajorSelectionHonorsConcentrationAndAvoidedCourses,
  testCollectorMajorSelectionAcceptsSerializedChooseGroupCourseSet,
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
  testSchedulerGenerateUsesNormalizedPrerequisiteSelectionWrapper
];
let passed = 0;
for (const test of tests) {
  test();
  passed += 1;
}
console.log(`test_requirement_collector.js: ${passed}/${tests.length} passed`);
