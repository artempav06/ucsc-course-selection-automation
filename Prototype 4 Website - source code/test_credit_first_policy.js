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

function testCreditLoadBandsUseArtemCreditFirstPolicy() {
  const profile = { major: 'CS_BS', maxUnits: 19, minUnits: 12 };
  assert.strictEqual(Scheduler.creditLoadBand(9, profile), 'under_min');
  assert.strictEqual(Scheduler.creditLoadBand(12, profile), 'low');
  assert.strictEqual(Scheduler.creditLoadBand(17, profile), 'target');
  assert.strictEqual(Scheduler.creditLoadBand(19, profile), 'acceptable_high');
  assert.strictEqual(Scheduler.creditLoadBand(20, profile), 'over_cap');
}

function testNormalMaxUnitsKeepsNineteenAsDefaultCap() {
  assert.strictEqual(Scheduler.normalMaxUnits({ major: 'CS_BS', maxUnits: 19 }), 19);
  assert.strictEqual(Scheduler.normalMaxUnits({ major: 'EE_BS', maxUnits: 20, allowSoftOverload: true }), 20);
}

function testQuarterUnitsAndTypeUnitsCountCreditsNotCourses() {
  withTemporaryCourses({
    'TEST LECTURE 5': { title: 'Test Lecture', units: 5, quarters: ['F'], prereqs: [] },
    'TEST LAB 2': { title: 'Test Laboratory', units: 2, quarters: ['F'], prereqs: [] },
    'TEST WRIT 5': { title: 'Test Writing', units: 5, quarters: ['F'], prereqs: [] }
  }, () => {
    const courses = ['TEST LECTURE 5', 'TEST LAB 2', 'TEST WRIT 5'];
    const types = new Map([['TEST LECTURE 5', 'major_core'], ['TEST LAB 2', 'prereq'], ['TEST WRIT 5', 'uc']]);
    assert.strictEqual(Scheduler.quarterUnits(courses), 12);
    assert.deepStrictEqual(Scheduler.quarterTypeUnits(courses, types), { major_core: 5, prereq: 2, uc: 5 });
  });
}

function testLowUnitCompanionFlagsLabsWithoutDroppingCredits() {
  withTemporaryCourses({
    'TEST LECTURE 5': { title: 'Test Lecture', units: 5, quarters: ['F'], prereqs: [], labCoreq: 'TEST LAB 2' },
    'TEST LAB 2': { title: 'Test Laboratory', units: 2, quarters: ['F'], prereqs: [] }
  }, () => {
    assert.strictEqual(Scheduler.isLowUnitCompanion('TEST LAB 2'), true, '2-credit labs should be companion courses');
    assert.strictEqual(Scheduler.quarterUnits(['TEST LECTURE 5', 'TEST LAB 2']), 7, 'companion units still count in total credit load');
  });
}

function testGEFamilyHelpersUnderstandSubcategoriesAndRedundancy() {
  assert.strictEqual(Scheduler.geFamilyOfCourse('PSYC 1'), 'PE');
  assert(Scheduler.geFamiliesSatisfiedBy(['PSYC 1']).has('PE'));
  assert.strictEqual(Scheduler.courseSatisfiesGEFamily('CSE 80N', 'PE'), true);
  assert.strictEqual(Scheduler.isRedundantGE('CSE 80N', ['PSYC 1'], { major: 'CS_BS' }), true, 'a second PE-only GE should be redundant after PE is covered');
}

function testMultiCoverageGECountsBothFamilies() {
  const families = Scheduler.geFamiliesSatisfiedBy(['HIS 10B']);
  assert(families.has('AH'), 'HIS 10B should satisfy AH through explicit GE course list');
  assert(families.has('AI'), 'HIS 10B should satisfy AI through explicit GE course list');
}

function testMajorRequiredGEIsNotMarkedRedundant() {
  assert.strictEqual(
    Scheduler.isRedundantGE('ECE 129A', ['CSE 16'], { major: 'EE_BS' }),
    false,
    'major-required GE/DC courses should stay allowed even if their GE family is already covered'
  );
}

const tests = [
  testCreditLoadBandsUseArtemCreditFirstPolicy,
  testNormalMaxUnitsKeepsNineteenAsDefaultCap,
  testQuarterUnitsAndTypeUnitsCountCreditsNotCourses,
  testLowUnitCompanionFlagsLabsWithoutDroppingCredits,
  testGEFamilyHelpersUnderstandSubcategoriesAndRedundancy,
  testMultiCoverageGECountsBothFamilies,
  testMajorRequiredGEIsNotMarkedRedundant
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
  console.error(`\nCredit-first policy tests failed: ${failed}/${tests.length}`);
  process.exit(1);
}
console.log(`\nCredit-first policy tests passed: ${tests.length}/${tests.length}`);
