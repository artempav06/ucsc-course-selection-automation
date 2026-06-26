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
    concentration: 'cs_ai_ml',
    currentLevel: 1,
    currentTerm: 'F',
    currentYear: 2026,
    targetGradTerm: 'S',
    targetGradYear: 2030,
    completedCourses: [],
    avoidedCourses: [],
    preferredCourses: [],
    includeSummer: false,
    maxUnits: 19,
    minUnits: 12,
    geConcentration: null,
    elwrSatisfied: false,
    priorCredits: 0,
    studentType: 'undergrad',
    profImportance: 'medium',
    ...overrides
  };
}

function plannedCourses(schedule) {
  const out = [];
  for (const year of schedule || []) {
    for (const list of Object.values(year.quarters || {})) out.push(...list);
  }
  return out;
}

function geGroup(id) {
  return CONCENTRATIONS.ge.find(group => group.id === id);
}

function selectedGE(profile) {
  return Scheduler.generateWithExplanation(profile, { includeValidation: true }).explanation.phases.geSelection.courses;
}

function assertTopResult(results, expected, message) {
  assert(results.length > 0, `${message}: expected non-empty results`);
  assert.strictEqual(results[0].code, expected, `${message}: expected ${expected} first, got ${results[0].code}`);
}

function testGEConcentrationChangesSelectionTowardStudentInterest() {
  const tech = makeProfile({ geConcentration: 'ge_tech_society' });
  const arts = makeProfile({ geConcentration: 'ge_arts_humanities' });
  const techPicks = selectedGE(tech);
  const artsPicks = selectedGE(arts);
  assert.notDeepStrictEqual(techPicks, artsPicks, 'different GE interests should produce different GE picks');
  assert(
    techPicks.includes('CSE 80N'),
    `tech/society GE interest should prefer the PE-T course CSE 80N when PE is open; picked ${techPicks.join(', ')}`
  );
  assert(
    artsPicks.includes('PHIL 22') || artsPicks.includes('PHIL 28') || artsPicks.includes('FILM 20A'),
    `arts/humanities GE interest should pull at least one arts/humanities-tagged GE option; picked ${artsPicks.join(', ')}`
  );
}

function testMajorConcentrationCourseTagsAreComplete() {
  const missing = [];
  for (const [major, groups] of Object.entries(CONCENTRATIONS.major)) {
    for (const group of groups) {
      for (const code of group.courses) {
        if (!COURSES[code]) missing.push(`${major}/${group.id}/${code}: missing course`);
        else if (!(COURSES[code].concentrations || []).includes(group.id)) {
          missing.push(`${major}/${group.id}/${code}: course missing concentration tag`);
        }
      }
    }
  }
  assert.strictEqual(missing.length, 0, missing.join('\n'));
}

function testMajorConcentrationRaisesMatchingElectivesInRepresentativeFillerPools() {
  const cases = [
    ['CS_BA', 'cs_web_software'],
    ['CS_BS', 'cs_graphics_games'],
    ['TIM_BS', 'tim_finance_econ'],
    ['RE_BS', 're_ai_vision'],
    ['NDT_BS', 'ndt_ai_data']
  ];
  for (const [major, concentration] of cases) {
    const profile = makeProfile({ major, concentration, geConcentration: null });
    const explained = Scheduler.generateWithExplanation(profile, { includeValidation: true });
    const candidates = explained.explanation.phases.fillerPool.candidates.slice(0, 12);
    const scheduled = explained.explanation.phases.placement.scheduledCourses || [];
    const taggedCandidates = candidates.filter(code => (COURSES[code].concentrations || []).includes(concentration));
    const taggedScheduled = scheduled.filter(code => (COURSES[code].concentrations || []).includes(concentration));
    assert(
      taggedCandidates.length > 0 || taggedScheduled.length > 0,
      `${major}/${concentration} should surface or schedule at least one matching elective; top candidates: ${candidates.join(', ')}; scheduled tagged: ${taggedScheduled.join(', ')}`
    );
  }
}

function testAvoidedCoursesAreRemovedFromPreferenceDrivenChoicesWhenAlternativesExist() {
  const profile = makeProfile({
    major: 'TIM_BS',
    concentration: 'tim_entrepreneurship',
    avoidedCourses: ['TIM 171', 'TIM 174'],
    geConcentration: null
  });
  const courses = plannedCourses(Scheduler.generate(profile));
  assert(!courses.includes('TIM 171'), 'TIM 171 is avoidable and should not be scheduled when avoided');
  assert(!courses.includes('TIM 174'), 'TIM 174 is avoidable and should not be scheduled when avoided');
}

function testPreferredCourseIsPromotedWhenItCanSatisfyElectivePreference() {
  const profile = makeProfile({
    major: 'CS_BS',
    concentration: 'cs_graphics_games',
    preferredCourses: ['CMPM 164'],
    geConcentration: null
  });
  const courses = plannedCourses(Scheduler.generate(profile));
  assert(courses.includes('CMPM 164'), `preferred graphics/game elective CMPM 164 should be scheduled; got ${courses.join(', ')}`);
}

function testReplacementSuggestionsPreserveGERequirementAndGEInterest() {
  const profile = makeProfile({ geConcentration: 'ge_tech_society' });
  const replacements = Scheduler.getReplacements('PSYC 1', 'F', [], [], '', profile);
  assertTopResult(
    replacements,
    'CSE 80N',
    'replacing a PE-H GE for a tech/society student should keep the PE requirement and rank the PE-T tech option first'
  );
}

function testAddableSuggestionsUseMajorAndGEInterestWhenProfileProvided() {
  const profile = makeProfile({ concentration: 'cs_ai_ml', geConcentration: 'ge_tech_society' });
  const results = Scheduler.searchAddable('W', ['CSE 101', 'CSE 40'], [], '', profile);
  assertTopResult(
    results,
    'CSE 140',
    'add-course suggestions for a CS AI/ML student should prioritize matching major-interest courses over generic high-RMP courses'
  );
}

const tests = [
  testGEConcentrationChangesSelectionTowardStudentInterest,
  testMajorConcentrationCourseTagsAreComplete,
  testMajorConcentrationRaisesMatchingElectivesInRepresentativeFillerPools,
  testAvoidedCoursesAreRemovedFromPreferenceDrivenChoicesWhenAlternativesExist,
  testPreferredCourseIsPromotedWhenItCanSatisfyElectivePreference,
  testReplacementSuggestionsPreserveGERequirementAndGEInterest,
  testAddableSuggestionsUseMajorAndGEInterestWhenProfileProvided
];

let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`PASS ${test.name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${test.name}: ${err.message}`);
  }
}

if (failed > 0) {
  console.error(`\nPhase A preference tests failed: ${failed}/${tests.length}`);
  process.exit(1);
}
console.log(`\nPhase A preference tests passed: ${tests.length}/${tests.length}`);
