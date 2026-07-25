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
    concentration: null,
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

function withTemporaryCourse(code, course, fn) {
  const previous = COURSES[code];
  COURSES[code] = course;
  try { fn(); }
  finally {
    if (previous === undefined) delete COURSES[code];
    else COURSES[code] = previous;
  }
}

function testMajorRestrictedCourseEligibilityHelper() {
  withTemporaryCourse('TEST 190', {
    title: 'Restricted Test Course', units: 5, division: 'upper', prereqs: [], ge: 'PE-T', quarters: ['F'],
    desc: 'Restricted to specific majors.', section: ['TEST'], rmpScore: 5,
    restrictedMajors: ['CS_BS', 'CS_BA'],
    enrollmentRestrictions: 'Enrollment is restricted to computer science majors.'
  }, () => {
    assert.strictEqual(Scheduler.isCourseAllowedForProfile('TEST 190', makeProfile({ major: 'CS_BS' })), true);
    assert.strictEqual(Scheduler.isCourseAllowedForProfile('TEST 190', makeProfile({ major: 'BIOTECH_BS' })), false);
  });
}

function testRestrictedCoursesAreExcludedFromManualSuggestions() {
  withTemporaryCourse('TEST 191', {
    title: 'Restricted Manual Suggestion', units: 5, division: 'lower', prereqs: [], ge: 'PE-T', quarters: ['F'],
    desc: 'Restricted to computer science majors.', section: ['TEST'], rmpScore: 99,
    restrictedMajors: ['CS_BS'],
    enrollmentRestrictions: 'Enrollment is restricted to computer science majors.'
  }, () => {
    const bioResults = Scheduler.searchAddable('F', [], [], 'Restricted Manual', makeProfile({ major: 'BIOTECH_BS' }));
    assert(!bioResults.some(r => r.code === 'TEST 191'), 'restricted course must not be suggested to an ineligible major');
    const csResults = Scheduler.searchAddable('F', [], [], 'Restricted Manual', makeProfile({ major: 'CS_BS' }));
    assert(csResults.some(r => r.code === 'TEST 191'), 'restricted course should remain suggestable to an eligible major');
  });
}

function testCourseExclusionAndClassLevelRestrictions() {
  withTemporaryCourse('TEST 192', {
    title: 'Excluded Test Course', units: 5, division: 'upper', prereqs: [], ge: 'PE-T', quarters: ['F'],
    desc: 'Not intended for CS majors.', section: ['TEST'], rmpScore: 5,
    excludedMajors: ['CS_BS'],
    restrictedLevels: [3, 4]
  }, () => {
    assert.strictEqual(Scheduler.isCourseAllowedForProfile('TEST 192', makeProfile({ major: 'CS_BS', currentLevel: 4 })), false);
    assert.strictEqual(Scheduler.isCourseAllowedForProfile('TEST 192', makeProfile({ major: 'BIOTECH_BS', currentLevel: 2 })), false);
    assert.strictEqual(Scheduler.isCourseAllowedForProfile('TEST 192', makeProfile({ major: 'BIOTECH_BS', currentLevel: 3 })), true);
  });
}

const tests = [
  testMajorRestrictedCourseEligibilityHelper,
  testRestrictedCoursesAreExcludedFromManualSuggestions,
  testCourseExclusionAndClassLevelRestrictions
];

let passed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`PASS ${test.name}`);
    passed++;
  } catch (error) {
    console.error(`FAIL ${test.name}: ${error.stack || error.message}`);
    process.exitCode = 1;
  }
}
console.log(`test_enrollment_restrictions.js: ${passed}/${tests.length} passed`);
if (passed !== tests.length) process.exit(1);
