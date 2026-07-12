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
    electiveInterests: ['cs_ai_ml'],
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
    geConcentration: 'ge_tech_society',
    geConcentrations: ['ge_tech_society'],
    elwrSatisfied: false,
    priorCredits: 0,
    studentType: 'undergrad',
    profImportance: 'medium',
    ...overrides
  };
}

function withTemporaryCourses(tempCourses, fn) {
  const old = new Map();
  for (const [code, course] of Object.entries(tempCourses)) {
    old.set(code, COURSES[code]);
    COURSES[code] = course;
  }
  try { return fn(); }
  finally {
    for (const [code, value] of old.entries()) {
      if (value === undefined) delete COURSES[code];
      else COURSES[code] = value;
    }
  }
}

function testPickGEPrefersOneCourseCoveringAHAndAI() {
  withTemporaryCourses({
    'ZZ AH ONLY': { title: 'AH Only', units: 5, quarters: ['F','W','S'], division: 'lower', ge: 'AH', prereqs: [], concentrations: [], rmpScore: 9 },
    'ZZ AI ONLY': { title: 'AI Only', units: 5, quarters: ['F','W','S'], division: 'lower', ge: 'AI', prereqs: [], concentrations: [], rmpScore: 9 },
    'ZZ BOTH AH AI': { title: 'Both AH AI', units: 5, quarters: ['F','W','S'], division: 'lower', ge: 'AH', alsoSatisfies: ['AI'], prereqs: [], concentrations: [], rmpScore: 0 }
  }, () => {
    const used = new Set(['HIS 10B']);
    const profile = makeProfile();
    const picks = Scheduler.pickGE(used, new Set(), null, profile);
    assert(!picks.includes('POLI 20'), `AI should already be satisfied by HIS 10B instead of adding another AI course; got ${picks.join(', ')}`);
    assert.strictEqual(Scheduler.isRedundantGE('POLI 20', ['HIS 10B'], profile), true, 'a second AI course should be redundant after HIS 10B covers both AH and AI');
  });
}

function testPickGEDoesNotSelectDuplicatePEFamily() {
  const used = new Set(['PSYC 1']);
  const picks = Scheduler.pickGE(used, new Set(), 'ge_tech_society', makeProfile());
  assert(!picks.includes('CSE 80N'), `PE should already be covered by PSYC 1; got ${picks.join(', ')}`);
}

function testMajorRequiredGEIsExcludedFromRedundancyFilter() {
  const profile = makeProfile({ major: 'EE_BS' });
  assert.strictEqual(Scheduler.isRedundantGE('ECE 129A', ['CSE 16'], profile), false);
}

function testFreePaddingPhaseOccursAfterGESelection() {
  const explained = Scheduler.generateWithExplanation(makeProfile(), { includeValidation: true });
  const phases = Object.keys(explained.explanation.phases);
  assert(phases.indexOf('geSelection') < phases.indexOf('freePadding'), `GE selection should happen before free padding; phase order: ${phases.join(' > ')}`);
  assert(explained.explanation.phases.freePadding.policy.includes('after'), 'free padding explanation should document that it is last-resort after real requirements');
}

const tests = [
  testPickGEPrefersOneCourseCoveringAHAndAI,
  testPickGEDoesNotSelectDuplicatePEFamily,
  testMajorRequiredGEIsExcludedFromRedundancyFilter,
  testFreePaddingPhaseOccursAfterGESelection
];

let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`PASS ${test.name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${test.name}: ${err.message}`);
    console.error(err.stack);
  }
}
if (failed) {
  console.error(`\nGE priority tests failed: ${failed}/${tests.length}`);
  process.exit(1);
}
console.log(`\nGE priority tests passed: ${tests.length}/${tests.length}`);
