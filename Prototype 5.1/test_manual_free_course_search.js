#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const dir = __dirname;
const load = f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'));
load('js/courses.js');
load('js/majors.js');
load('js/data.js');
global.RequirementNormalizer = require('./js/engine/requirement-normalizer.js');
global.RequirementCollector = require('./js/engine/requirement-collector.js');
load('js/engine.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const profile = {
  major: 'CS_BS',
  completedCourses: [],
  electiveInterests: [],
  geConcentrations: [],
  studentType: 'undergrad'
};

function resultCodes(results) {
  return results.map(r => r.code);
}

function testManualAddSearchFindsFiveTwoAndOneCreditFreeCourses() {
  const generic = Scheduler.searchAddable('F', [], [], 'free', profile);
  const five = Scheduler.searchAddable('F', [], [], 'free 5', profile);
  const two = Scheduler.searchAddable('F', [], [], 'free 2', profile);
  const one = Scheduler.searchAddable('F', [], [], 'free 1', profile);

  assert(generic.some(r => r.units === 5) && generic.some(r => r.units === 2) && generic.some(r => r.units === 1), `generic free search should include 5-, 2-, and 1-credit options, got ${JSON.stringify(generic.slice(0, 9))}`);
  assert(five.some(r => r.code.startsWith('FREE ') && r.units === 5), `free 5 search should include a 5-credit FREE course, got ${JSON.stringify(five.slice(0, 5))}`);
  assert(two.some(r => r.code.startsWith('FREE 2U') && r.units === 2), `free 2 search should include a 2-credit FREE course, got ${JSON.stringify(two.slice(0, 5))}`);
  assert(one.some(r => r.code.startsWith('FREE 1U') && r.units === 1), `free 1 search should include a 1-credit FREE course, got ${JSON.stringify(one.slice(0, 5))}`);
}

function testManualFreeSearchSkipsAlreadyPlannedFreePlaceholderOfSameCode() {
  const planned = ['FREE 1', 'FREE 2U1', 'FREE 1U1'];
  const five = Scheduler.searchAddable('W', [], planned, 'free 5', profile);
  const two = Scheduler.searchAddable('W', [], planned, 'free 2', profile);
  const one = Scheduler.searchAddable('W', [], planned, 'free 1', profile);

  assert(!resultCodes(five).includes('FREE 1'), 'free 5 search should skip already planned FREE 1');
  assert(five.some(r => r.code === 'FREE 2' && r.units === 5), 'free 5 search should offer the next available 5-credit FREE code');
  assert(!resultCodes(two).includes('FREE 2U1'), 'free 2 search should skip already planned FREE 2U1');
  assert(two.some(r => r.code === 'FREE 2U2' && r.units === 2), 'free 2 search should offer the next available 2-credit FREE code');
  assert(!resultCodes(one).includes('FREE 1U1'), 'free 1 search should skip already planned FREE 1U1');
  assert(one.some(r => r.code === 'FREE 1U2' && r.units === 1), 'free 1 search should offer the next available 1-credit FREE code');
}

const tests = [
  testManualAddSearchFindsFiveTwoAndOneCreditFreeCourses,
  testManualFreeSearchSkipsAlreadyPlannedFreePlaceholderOfSameCode
];
let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`PASS ${test.name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${test.name}: ${error.message}`);
  }
}
if (failed) process.exit(1);
console.log(`test_manual_free_course_search.js: ${tests.length}/${tests.length} passed`);
