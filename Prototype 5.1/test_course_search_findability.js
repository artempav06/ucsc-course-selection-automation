#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const dir = __dirname;

function load(file) {
  vm.runInThisContext(fs.readFileSync(path.join(dir, file), 'utf8'), { filename: file });
}

const fakeDocument = {
  addEventListener() {},
  getElementById() { return null; },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  createElement() { return { appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {} }, style: {} }; }
};

global.document = fakeDocument;
global.window = global;
global.alert = () => {};
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };

load('js/courses.js');
load('js/majors.js');
load('js/data.js');
global.RequirementNormalizer = require('./js/engine/requirement-normalizer.js');
global.RequirementCollector = require('./js/engine/requirement-collector.js');
load('js/engine.js');
load('js/app.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function realCourseCodes() {
  return Object.keys(COURSES).filter(code => !code.startsWith('FREE')).sort();
}

function sampleMissing(codes, limit = 12) {
  return codes.slice(0, limit).join(', ') + (codes.length > limit ? `, ... (+${codes.length - limit} more)` : '');
}

const profile = {
  major: 'CS_BS',
  completedCourses: [],
  electiveInterests: [],
  geConcentrations: [],
  studentType: 'undergrad',
  currentLevel: 1
};

function testAcademicHistoryExactCodeSearchFindsEveryRealDatabaseCourse() {
  const missing = [];
  for (const code of realCourseCodes()) {
    const results = searchCourses(code);
    if (!results.some(result => result.code === code)) missing.push(code);
  }
  assert(missing.length === 0, `Academic history exact-code search missed ${missing.length} database courses: ${sampleMissing(missing)}`);
}

function testAcademicHistorySpaceInsensitiveCodeSearchFindsEveryRealDatabaseCourse() {
  const missing = [];
  for (const code of realCourseCodes()) {
    const compactQuery = code.replace(/\s+/g, '');
    const results = searchCourses(compactQuery);
    if (!results.some(result => result.code === code)) missing.push(`${code} via ${compactQuery}`);
  }
  assert(missing.length === 0, `Academic history compact-code search missed ${missing.length} database courses: ${sampleMissing(missing)}`);
}

function testManualAddExactCodeSearchFindsEveryUnplannedRealDatabaseCourse() {
  const missing = [];
  for (const code of realCourseCodes()) {
    const results = Scheduler.searchAddable('F', [], [], code, profile);
    if (!results.some(result => result.code === code)) missing.push(code);
  }
  assert(missing.length === 0, `Generated-schedule add-course exact-code search missed ${missing.length} database courses: ${sampleMissing(missing)}`);
}

function testManualAddCompactCodeSearchFindsEveryUnplannedRealDatabaseCourse() {
  const missing = [];
  for (const code of realCourseCodes()) {
    const compactQuery = code.replace(/\s+/g, '');
    const results = Scheduler.searchAddable('F', [], [], compactQuery, profile);
    if (!results.some(result => result.code === code)) missing.push(`${code} via ${compactQuery}`);
  }
  assert(missing.length === 0, `Generated-schedule add-course compact-code search missed ${missing.length} database courses: ${sampleMissing(missing)}`);
}

function testManualSwapExactCodeSearchFindsEveryRealDatabaseCourseExceptCourseBeingReplaced() {
  const swapOut = realCourseCodes().find(code => code !== 'CSE 20');
  const missing = [];
  for (const code of realCourseCodes()) {
    if (code === swapOut) continue;
    const results = Scheduler.getReplacements(swapOut, 'F', [], [], code, profile);
    if (!results.some(result => result.code === code)) missing.push(code);
  }
  assert(missing.length === 0, `Generated-schedule swap exact-code search missed ${missing.length} database courses: ${sampleMissing(missing)}`);
}

function testManualSwapCompactCodeSearchFindsEveryRealDatabaseCourseExceptCourseBeingReplaced() {
  const swapOut = realCourseCodes().find(code => code !== 'CSE 20');
  const missing = [];
  for (const code of realCourseCodes()) {
    if (code === swapOut) continue;
    const compactQuery = code.replace(/\s+/g, '');
    const results = Scheduler.getReplacements(swapOut, 'F', [], [], compactQuery, profile);
    if (!results.some(result => result.code === code)) missing.push(`${code} via ${compactQuery}`);
  }
  assert(missing.length === 0, `Generated-schedule swap compact-code search missed ${missing.length} database courses: ${sampleMissing(missing)}`);
}

const tests = [
  testAcademicHistoryExactCodeSearchFindsEveryRealDatabaseCourse,
  testAcademicHistorySpaceInsensitiveCodeSearchFindsEveryRealDatabaseCourse,
  testManualAddExactCodeSearchFindsEveryUnplannedRealDatabaseCourse,
  testManualAddCompactCodeSearchFindsEveryUnplannedRealDatabaseCourse,
  testManualSwapExactCodeSearchFindsEveryRealDatabaseCourseExceptCourseBeingReplaced,
  testManualSwapCompactCodeSearchFindsEveryRealDatabaseCourseExceptCourseBeingReplaced
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
console.log(`test_course_search_findability.js: ${tests.length}/${tests.length} passed`);
