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

function testPhaseBGESelectionPrefersCoursesOfferedInRemainingWindow() {
  const profile = makeProfile({
    currentTerm: 'S',
    currentYear: 2026,
    targetGradTerm: 'S',
    targetGradYear: 2026,
    geConcentration: 'ge_tech_society'
  });
  const gePicks = selectedGE(profile);
  assert(
    gePicks.includes('CSE 3') || gePicks.includes('CSE 80A') || gePicks.includes('GCH 41') || gePicks.includes('ECE 80E'),
    `spring-only tech/society GE choice should prefer a spring-offered PE option over fall/winter-only CSE 80N; picked ${gePicks.join(', ')}`
  );
  assert(
    !gePicks.includes('CSE 80N'),
    `spring-only GE selection should avoid fall/winter-only CSE 80N when spring tech/society PE alternatives exist; picked ${gePicks.join(', ')}`
  );
}

function testPhaseBGEExplanationIncludesAvailabilityScoresForPickedCourses() {
  const profile = makeProfile({
    currentTerm: 'S',
    currentYear: 2026,
    targetGradTerm: 'S',
    targetGradYear: 2026,
    geConcentration: 'ge_tech_society'
  });
  const explained = Scheduler.generateWithExplanation(profile, { includeValidation: false });
  const geExplanation = explained.explanation.phases.geSelection;
  const springPick = geExplanation.courses.find(code => ['CSE 3', 'CSE 80A', 'GCH 41', 'ECE 80E'].includes(code));
  assert(springPick, `expected a spring-offered tech/society PE pick; got ${geExplanation.courses.join(', ')}`);
  assert.deepStrictEqual(
    geExplanation.availabilityWindow,
    ['S'],
    'GE explanation should expose the real remaining quarter window used by availability scoring'
  );
  assert(
    geExplanation.availabilityScores[springPick] > geExplanation.availabilityScores['CSE 80N'],
    `GE explanation should show the spring pick outranking fall/winter-only CSE 80N by availability; scores: ${JSON.stringify(geExplanation.availabilityScores)}`
  );
}

function testPhaseBElectiveRankingPrefersRemainingQuarterAvailability() {
  const profile = makeProfile({
    major: 'CS_BS',
    concentration: 'cs_web_software',
    currentTerm: 'S',
    currentYear: 2026,
    targetGradTerm: 'S',
    targetGradYear: 2026
  });
  const ranked = Scheduler.rankByConcentration(['CSE 187', 'CSE 186'], 'cs_web_software', profile, new Set(), new Set());
  assert.strictEqual(
    ranked[0],
    'CSE 186',
    `spring-only elective ranking should prefer spring-offered CSE 186 over fall-only CSE 187; got ${ranked.join(', ')}`
  );
}

function testPhaseBFillerPoolPrefersRemainingQuarterAvailability() {
  const profile = makeProfile({
    major: 'CS_BS',
    concentration: 'cs_web_software',
    currentTerm: 'S',
    currentYear: 2026,
    targetGradTerm: 'S',
    targetGradYear: 2026,
    geConcentration: null
  });
  const fillerPool = Scheduler.buildFillerPool(profile, new Set(), new Set());
  const springIndex = fillerPool.indexOf('CSE 186');
  const fallIndex = fillerPool.indexOf('CSE 187');
  assert(springIndex >= 0, `spring-offered CSE 186 should remain in filler pool; got ${fillerPool.slice(0, 12).join(', ')}`);
  assert(
    fallIndex === -1 || springIndex < fallIndex,
    `spring-only filler pool should rank spring-offered CSE 186 before fall-only CSE 187 when both are candidates; top candidates: ${fillerPool.slice(0, 12).join(', ')}`
  );
}

function testPhaseBFillerPoolExplanationIncludesAvailabilityScoresForConcentrationComparisons() {
  const profile = makeProfile({
    major: 'CS_BS',
    concentration: 'cs_web_software',
    currentTerm: 'S',
    currentYear: 2026,
    targetGradTerm: 'S',
    targetGradYear: 2026,
    geConcentration: null
  });
  const explained = Scheduler.generateWithExplanation(profile, { includeValidation: false });
  const fillerExplanation = explained.explanation.phases.fillerPool;
  assert.deepStrictEqual(
    fillerExplanation.availabilityWindow,
    ['S'],
    'filler-pool explanation should expose the real remaining quarter window used by availability scoring'
  );
  assert(
    fillerExplanation.availabilityScores['CSE 186'] > fillerExplanation.availabilityScores['CSE 187'],
    `filler-pool explanation should show spring-offered CSE 186 outranking fall-only CSE 187 by availability; scores: ${JSON.stringify(fillerExplanation.availabilityScores)}`
  );
}

function withTemporaryCourses(tempCourses, fn) {
  for (const [code, course] of Object.entries(tempCourses)) COURSES[code] = course;
  try {
    return fn();
  } finally {
    for (const code of Object.keys(tempCourses)) delete COURSES[code];
  }
}

function testPhaseBAvailabilityScoringExcludesGapQuarters() {
  withTemporaryCourses({
    'TEST GAP SPRING': {
      title: 'Test Spring Gap Course', units: 5, quarters: ['S'], division: 'upper', ge: null,
      concentrations: ['cs_web_software'], prereqs: [], rmpScore: 9
    },
    'TEST WINTER OPEN': {
      title: 'Test Winter Open Course', units: 5, quarters: ['W'], division: 'upper', ge: null,
      concentrations: ['cs_web_software'], prereqs: [], rmpScore: 0
    }
  }, () => {
    const profile = makeProfile({
      concentration: 'cs_web_software',
      currentTerm: 'W',
      currentYear: 2027,
      targetGradTerm: 'S',
      targetGradYear: 2027,
      gapEnabled: true,
      gapType: 'quarter',
      gapTerm: 'S',
      gapYear: 2027
    });
    const ranked = Scheduler.rankByConcentration(['TEST GAP SPRING', 'TEST WINTER OPEN'], 'cs_web_software', profile, new Set(), new Set());
    assert.strictEqual(
      ranked[0],
      'TEST WINTER OPEN',
      `availability scoring should ignore Spring 2027 because it is a gap quarter; got ${ranked.join(', ')}`
    );
  });
}

function testPhaseBAvailabilityScoringRanksEmptyQuartersBelowKnownOutOfWindowCourses() {
  const profile = makeProfile({
    major: 'TIM_BS',
    concentration: 'tim_entrepreneurship',
    currentTerm: 'S',
    currentYear: 2026,
    targetGradTerm: 'S',
    targetGradYear: 2026
  });
  const ranked = Scheduler.rankByConcentration(['TIM 171', 'ECON 135'], 'tim_entrepreneurship', profile, new Set(), new Set());
  assert.strictEqual(
    ranked[0],
    'ECON 135',
    `courses with empty quarter metadata should not outrank known out-of-window courses; got ${ranked.join(', ')}`
  );
}

function testPhaseBAddableSuggestionsPenalizeGapOnlyOfferings() {
  withTemporaryCourses({
    'ZPHASEB GAP ONLY PE': {
      title: 'Zphaseb Gap Only PE', units: 5, quarters: ['W'], division: 'lower', ge: 'PE-T',
      concentrations: ['ge_tech_society'], prereqs: [], rmpScore: 9
    },
    'ZPHASEB SPRING PE': {
      title: 'Zphaseb Spring PE', units: 5, quarters: ['W', 'S'], division: 'lower', ge: 'PE-T',
      concentrations: ['ge_tech_society'], prereqs: [], rmpScore: 0
    }
  }, () => {
    const profile = makeProfile({
      geConcentration: 'ge_tech_society',
      currentTerm: 'W',
      currentYear: 2027,
      targetGradTerm: 'S',
      targetGradYear: 2027,
      gapEnabled: true,
      gapType: 'quarter',
      gapTerm: 'W',
      gapYear: 2027
    });
    const results = Scheduler.searchAddable('W', [], [], 'ZPHASEB', profile);
    assertTopResult(
      results,
      'ZPHASEB SPRING PE',
      `add-course suggestions should prefer a PE option still available after a Winter gap over a gap-only high-RMP option; got ${results.map(r => r.code).join(', ')}`
    );
  });
}

function testPhaseBReplacementSuggestionsPenalizeGapOnlyOfferings() {
  withTemporaryCourses({
    'ZPHASEB GAP ONLY PE': {
      title: 'Zphaseb Gap Only PE', units: 5, quarters: ['W'], division: 'lower', ge: 'PE-T',
      concentrations: ['ge_tech_society'], prereqs: [], rmpScore: 9
    },
    'ZPHASEB SPRING PE': {
      title: 'Zphaseb Spring PE', units: 5, quarters: ['W', 'S'], division: 'lower', ge: 'PE-T',
      concentrations: ['ge_tech_society'], prereqs: [], rmpScore: 0
    }
  }, () => {
    const profile = makeProfile({
      geConcentration: 'ge_tech_society',
      currentTerm: 'W',
      currentYear: 2027,
      targetGradTerm: 'S',
      targetGradYear: 2027,
      gapEnabled: true,
      gapType: 'quarter',
      gapTerm: 'W',
      gapYear: 2027
    });
    const results = Scheduler.getReplacements('PSYC 1', 'W', [], [], 'ZPHASEB', profile);
    assertTopResult(
      results,
      'ZPHASEB SPRING PE',
      `swap suggestions should prefer a PE option still available after a Winter gap over a gap-only high-RMP option; got ${results.map(r => r.code).join(', ')}`
    );
  });
}

function reasonIds(result) {
  return (result.reasons || []).map(reason => reason.id);
}

function testPhaseCAddableSuggestionsExposeTrustworthyReasons() {
  const profile = makeProfile({
    concentration: 'cs_ai_ml',
    geConcentration: 'ge_tech_society',
    preferredCourses: ['CSE 140'],
    profImportance: 'high'
  });
  const results = Scheduler.searchAddable('W', ['CSE 101', 'CSE 40'], [], 'CSE 140', profile);
  assertTopResult(results, 'CSE 140', 'phase C add-course reason test should inspect the known AI/ML top suggestion');
  const ids = reasonIds(results[0]);
  assert(ids.includes('major_concentration'), `CSE 140 should explain that it matches the selected major concentration; got ${ids.join(', ')}`);
  assert(ids.includes('offered_current_quarter'), `CSE 140 should explain that it is offered in the selected quarter; got ${ids.join(', ')}`);
  assert(ids.includes('prerequisites_met'), `CSE 140 should explain that prerequisites are met for this add slot; got ${ids.join(', ')}`);
  assert(ids.includes('preferred_course'), `CSE 140 should explain the preferred-course boost; got ${ids.join(', ')}`);
  assert(ids.includes('professor_rating'), `CSE 140 should explain a positive professor/RMP contribution when professor importance is high; got ${ids.join(', ')}`);
}

function testPhaseCReplacementSuggestionsExposeRequirementAndGEReasons() {
  const profile = makeProfile({ geConcentration: 'ge_tech_society' });
  const replacements = Scheduler.getReplacements('PSYC 1', 'F', [], [], '', profile);
  assertTopResult(replacements, 'CSE 80N', 'phase C replacement reason test should inspect the known tech/society GE replacement');
  const ids = reasonIds(replacements[0]);
  assert(ids.includes('same_ge_requirement'), `CSE 80N should explain that it preserves the replaced GE family; got ${ids.join(', ')}`);
  assert(ids.includes('ge_concentration'), `CSE 80N should explain that it matches the selected GE concentration; got ${ids.join(', ')}`);
  assert(ids.includes('offered_current_quarter'), `CSE 80N should explain that it is offered in the selected quarter; got ${ids.join(', ')}`);
  assert(ids.includes('prerequisites_met'), `CSE 80N should explain that prerequisites are met for this swap slot; got ${ids.join(', ')}`);
}

const tests = [
  testGEConcentrationChangesSelectionTowardStudentInterest,
  testMajorConcentrationCourseTagsAreComplete,
  testMajorConcentrationRaisesMatchingElectivesInRepresentativeFillerPools,
  testAvoidedCoursesAreRemovedFromPreferenceDrivenChoicesWhenAlternativesExist,
  testPreferredCourseIsPromotedWhenItCanSatisfyElectivePreference,
  testReplacementSuggestionsPreserveGERequirementAndGEInterest,
  testAddableSuggestionsUseMajorAndGEInterestWhenProfileProvided,
  testPhaseBGESelectionPrefersCoursesOfferedInRemainingWindow,
  testPhaseBGEExplanationIncludesAvailabilityScoresForPickedCourses,
  testPhaseBElectiveRankingPrefersRemainingQuarterAvailability,
  testPhaseBFillerPoolPrefersRemainingQuarterAvailability,
  testPhaseBFillerPoolExplanationIncludesAvailabilityScoresForConcentrationComparisons,
  testPhaseBAvailabilityScoringExcludesGapQuarters,
  testPhaseBAvailabilityScoringRanksEmptyQuartersBelowKnownOutOfWindowCourses,
  testPhaseBAddableSuggestionsPenalizeGapOnlyOfferings,
  testPhaseBReplacementSuggestionsPenalizeGapOnlyOfferings,
  testPhaseCAddableSuggestionsExposeTrustworthyReasons,
  testPhaseCReplacementSuggestionsExposeRequirementAndGEReasons
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
