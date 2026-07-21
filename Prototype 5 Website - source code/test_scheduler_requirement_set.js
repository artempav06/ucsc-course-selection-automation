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
    avoidedCourses: ['CSE 160'],
    preferredCourses: ['CSE 144'],
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

function testSchedulerBuildsNormalizedRequirementSet() {
  assert.strictEqual(typeof Scheduler.buildRequirementSet, 'function', 'Scheduler.buildRequirementSet must exist');
  const profile = makeProfile();
  const set = Scheduler.buildRequirementSet(profile);
  assert.strictEqual(set.version, 1);
  assert.strictEqual(set.majorId, 'CS_BS');
  assert(set.requirements.some(req => req.id === 'CS_BS:DC' && req.domain === 'major'));
  assert(set.requirements.some(req => req.id === 'GE:DC' && req.domain === 'ge'));
  assert(set.requirements.some(req => req.id === 'UC:ELWR' && req.domain === 'uc'));
  assert(set.requirements.some(req => req.id === 'CS_BS:TOTAL_UNITS' && req.type === 'minimum_units'));
  assert(set.requirements.some(req => req.id === 'PROFILE:COMPLETED_COURSES' && req.courses.includes('CSE 20')));
}

function testSchedulerBuildRequirementSetDoesNotMutateRuntimeData() {
  const before = JSON.stringify(MAJOR_REQUIREMENTS.CS_BS.categories);
  Scheduler.buildRequirementSet(makeProfile());
  assert.strictEqual(JSON.stringify(MAJOR_REQUIREMENTS.CS_BS.categories), before);
}

function testGeneratedValidationCarriesRequirementSetForDebuggingWithoutChangingResults() {
  const profile = makeProfile();
  const schedule = Scheduler.generate(profile);
  const validation = Validator.validateAll(schedule, profile);
  assert(validation.requirementSet, 'validateAll should attach normalized requirementSet for Prototype 4 debugging');
  assert.strictEqual(validation.requirementSet.majorId, 'CS_BS');
  assert.strictEqual(validation.allMet, true, 'normalized foundation must not change scheduler pass/fail behavior');
}

function testTimRequiredCse182SchedulesDespiteJuniorSeniorRestriction() {
  const profile = makeProfile({
    major: 'TIM_BS',
    currentLevel: 1,
    concentration: 'tim_entrepreneurship',
    completedCourses: []
  });
  assert.strictEqual(Scheduler.isCourseAllowedForProfile('CSE 182', profile), false, 'CSE 182 should not be available to first-year standing');
  assert.strictEqual(Scheduler.isCourseAllowedForProfile('CSE 182', { ...profile, currentLevel: 5 }), true, '5th-year students should count as senior standing for junior/senior restrictions');
  const schedule = Scheduler.generate(profile);
  const scheduled = schedule.flatMap(year => Object.values(year.quarters).flat());
  assert(scheduled.includes('CSE 182'), 'TIM_BS required CSE 182 must be scheduled');
  const validation = Validator.validateAll(schedule, profile);
  const programming = validation.major.find(req => req.id === 'PROGRAMMING');
  assert(programming && programming.fulfilled, 'TIM_BS programming requirement should be fulfilled');
  assert.strictEqual(validation.allMet, true, 'TIM_BS scenario should validate after CSE 182 placement');
}

function testWrit2TreatsWrit1AndWrit1EAsAlternatives() {
  const withWrit1 = new Set(['WRIT 1']);
  const withWrit1E = new Set(['WRIT 1E']);
  assert(Validator.prereqsMet(COURSES['WRIT 2'].prereqs, withWrit1), 'WRIT 1 should satisfy WRIT 2 prerequisite');
  assert(Validator.prereqsMet(COURSES['WRIT 2'].prereqs, withWrit1E), 'WRIT 1E should satisfy WRIT 2 prerequisite');
}

function testElwrPlacementCountsAsWrit1ForTaAndWrit2Planning() {
  const profile = makeProfile({ completedCourses: [], elwrSatisfied: true });
  const validation = Validator.validateAll([], profile);
  const elwr = validation.uc.find(req => req.id === 'ELWR');
  const textualAnalysis = validation.ge.find(req => req.id === 'TA');
  assert(elwr && elwr.fulfilled, 'ELWR placement checkbox should fulfill Entry Level Writing');
  assert(textualAnalysis && textualAnalysis.fulfilled, 'ELWR placement should count like WRIT 1 for the Textual Analysis section WRIT 1 covers');
  assert(textualAnalysis.courses.includes('WRIT 1'), `TA fulfillment should show WRIT 1 as profile-satisfied; got ${textualAnalysis.courses.join(', ')}`);

  const used = new Set();
  const picks = Scheduler.pickUC(used, profile);
  assert(!picks.includes('WRIT 1') && !picks.includes('WRIT 1E'), `ELWR-satisfied profiles should not schedule WRIT 1/1E; got ${picks.join(', ')}`);
}

function testAmericanHistoryInstitutionProfileFulfillment() {
  const fullYearProfile = makeProfile({ completedCourses: [], ahiFulfillment: { usHistoryFullYear: true } });
  const fullYearUC = Validator.validateUC([], fullYearProfile);
  assert(fullYearUC.find(req => req.id === 'AH').fulfilled, 'one-year high-school U.S. history should fulfill American History');
  assert(fullYearUC.find(req => req.id === 'AI').fulfilled, 'one-year high-school U.S. history should fulfill American Institutions');
  assert.deepStrictEqual(Scheduler.pickUC(new Set(), fullYearProfile).filter(code => ['HIS 10B', 'POLI 20'].includes(code)), [], 'AH&I-fulfilled profiles should not schedule UCSC AH/AI courses');

  const historyOnly = Validator.validateUC([], makeProfile({ completedCourses: [], ahiFulfillment: { usHistoryHalfYear: true } }));
  assert(historyOnly.find(req => req.id === 'AH').fulfilled, 'half-year U.S. history should fulfill American History');
  assert(!historyOnly.find(req => req.id === 'AI').fulfilled, 'half-year U.S. history alone should not fulfill American Institutions');

  const governmentOnly = Validator.validateUC([], makeProfile({ completedCourses: [], ahiFulfillment: { americanGovernmentHalfYear: true } }));
  assert(!governmentOnly.find(req => req.id === 'AH').fulfilled, 'half-year American government alone should not fulfill American History');
  assert(governmentOnly.find(req => req.id === 'AI').fulfilled, 'half-year American government should fulfill American Institutions');
}

function testCollegeCoreCoursesArePlannedUnlessAlreadyCompleted() {
  assert.strictEqual(typeof Scheduler.collegeCoreCoursesForProfile, 'function', 'Scheduler.collegeCoreCoursesForProfile must exist');
  const cowellProfile = makeProfile({ collegeAffiliation: 'cowell', collegeCoreCompleted: false, completedCourses: [] });
  assert.deepStrictEqual(Scheduler.collegeCoreCoursesForProfile(cowellProfile), ['COWL 1'], 'Cowell should map to COWL 1');
  const cowellSchedule = Scheduler.generate(cowellProfile);
  const cowellScheduled = cowellSchedule.flatMap(year => Object.values(year.quarters).flat());
  assert(cowellScheduled.includes('COWL 1'), 'uncompleted Cowell core should be scheduled');

  const stevensonCompletedProfile = makeProfile({ collegeAffiliation: 'stevenson', collegeCoreCompleted: true, completedCourses: ['STEV 1', 'STEV 2'] });
  assert.deepStrictEqual(Scheduler.collegeCoreCoursesForProfile(stevensonCompletedProfile), ['STEV 1', 'STEV 2'], 'Stevenson should map to STEV 1 + STEV 2');
  const stevensonSchedule = Scheduler.generate(stevensonCompletedProfile);
  const stevensonScheduled = stevensonSchedule.flatMap(year => Object.values(year.quarters).flat());
  assert(!stevensonScheduled.includes('STEV 1'), 'completed Stevenson STEV 1 should not be scheduled again');
  assert(!stevensonScheduled.includes('STEV 2'), 'completed Stevenson STEV 2 should not be scheduled again');
}

function testCollegeCoreRequirementAppearsForEveryMajorAndValidatesByAffiliation() {
  const majorIds = Object.keys(MAJOR_REQUIREMENTS || {});
  assert(majorIds.length > 1, 'fixture should include all supported Prototype 5 majors');

  for (const majorId of majorIds) {
    const profile = makeProfile({ major: majorId, collegeAffiliation: 'cowell', collegeCoreCompleted: false, completedCourses: [] });
    const set = Scheduler.buildRequirementSet(profile);
    const coreReq = set.requirements.find(req => req.id === 'PROFILE:COLLEGE_CORE');
    assert(coreReq, `${majorId} should include the profile-driven college core requirement`);
    assert.strictEqual(coreReq.domain, 'college_core', `${majorId} college core requirement should have its own domain`);
    assert.deepStrictEqual(coreReq.courses, ['COWL 1'], `${majorId} Cowell affiliation should require COWL 1`);
  }

  const missingValidation = Validator.validateAll([], makeProfile({ collegeAffiliation: 'cowell', collegeCoreCompleted: false, completedCourses: [] }));
  assert(missingValidation.collegeCore, 'validation should expose collegeCore results for the requirements panel');
  assert.strictEqual(missingValidation.allCollegeCoreMet, false, 'missing selected college core should block allMet');
  assert.strictEqual(missingValidation.allMet, false, 'allMet should include college core completion');
  assert.strictEqual(missingValidation.collegeCore[0].name, 'Cowell College Core', 'requirement should name the selected college');
  assert.deepStrictEqual(missingValidation.collegeCore[0].missing, ['COWL 1'], 'missing requirement should show exact required college course');

  const completedValidation = Validator.validateAll([], makeProfile({ collegeAffiliation: 'stevenson', collegeCoreCompleted: true, completedCourses: ['STEV 1', 'STEV 2'] }));
  assert.strictEqual(completedValidation.allCollegeCoreMet, true, 'completed Stevenson core sequence should satisfy college core requirement');
  assert.deepStrictEqual(completedValidation.collegeCore[0].selectedCourses, ['STEV 1', 'STEV 2'], 'Stevenson requirement should show both Fall and Winter core courses');
}

function testCollegeCorePlacementUsesRequiredFreshmanQuarters() {
  const cowellProfile = makeProfile({ collegeAffiliation: 'cowell', collegeCoreCompleted: false, completedCourses: [], maxUnits: 20 });
  const cowellSchedule = Scheduler.generate(cowellProfile);
  assert(cowellSchedule[0].quarters.F.includes('COWL 1'), 'Cowell core must be placed in freshman Fall');

  const stevensonProfile = makeProfile({ collegeAffiliation: 'stevenson', collegeCoreCompleted: false, completedCourses: [], maxUnits: 20 });
  const stevensonSchedule = Scheduler.generate(stevensonProfile);
  assert(stevensonSchedule[0].quarters.F.includes('STEV 1'), 'Stevenson STEV 1 must be placed in freshman Fall');
  assert(stevensonSchedule[0].quarters.W.includes('STEV 2'), 'Stevenson STEV 2 must be placed in freshman Winter');
}

const tests = [
  testSchedulerBuildsNormalizedRequirementSet,
  testSchedulerBuildRequirementSetDoesNotMutateRuntimeData,
  testGeneratedValidationCarriesRequirementSetForDebuggingWithoutChangingResults,
  testTimRequiredCse182SchedulesDespiteJuniorSeniorRestriction,
  testWrit2TreatsWrit1AndWrit1EAsAlternatives,
  testElwrPlacementCountsAsWrit1ForTaAndWrit2Planning,
  testAmericanHistoryInstitutionProfileFulfillment,
  testCollegeCoreCoursesArePlannedUnlessAlreadyCompleted,
  testCollegeCoreRequirementAppearsForEveryMajorAndValidatesByAffiliation,
  testCollegeCorePlacementUsesRequiredFreshmanQuarters
];
let passed = 0;
for (const test of tests) {
  test();
  passed += 1;
}
console.log(`test_scheduler_requirement_set.js: ${passed}/${tests.length} passed`);
