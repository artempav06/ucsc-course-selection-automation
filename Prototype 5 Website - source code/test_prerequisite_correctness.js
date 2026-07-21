#!/usr/bin/env node
// Prototype 4 prerequisite-correctness regressions.
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

function hasGroup(code, expectedOptions) {
  const groups = COURSES[code]?.prereqs || [];
  return groups.some(group => expectedOptions.every(option => group.includes(option)));
}

function coursePosition(schedule, target) {
  const quarterOrder = ['F', 'W', 'S', 'SU'];
  for (let y = 0; y < schedule.length; y++) {
    for (let q = 0; q < quarterOrder.length; q++) {
      const term = quarterOrder[q];
      if ((schedule[y].quarters[term] || []).includes(target)) {
        return { y, q, label: `${schedule[y].label} ${term}` };
      }
    }
  }
  return null;
}

function before(a, b) {
  return a && b && (a.y < b.y || (a.y === b.y && a.q < b.q));
}

function testCse101OfficialPrerequisiteGroupsAreEncoded() {
  // Official UCSC CSE 101 prerequisite page, checked 2026-07-01:
  // https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-101/
  // "CSE 12 or BME 160; CSE 13E or ECE 13 or CSE 13S; and CSE 16; and CSE 30;
  //  and MATH 11B or MATH 19B or MATH 20B or AM 11B or ECON 11B."
  // Prototype 4 must encode only alternatives that already exist in COURSES.
  assert(hasGroup('CSE 101', ['CSE 12', 'BME 160']), 'CSE 101 should require CSE 12 or BME 160');
  assert(hasGroup('CSE 101', ['ECE 13', 'CSE 13S']), 'CSE 101 should require existing local alternatives from official CSE 13E/ECE 13/CSE 13S group');
  assert(hasGroup('CSE 101', ['CSE 16']), 'CSE 101 should require CSE 16');
  assert(hasGroup('CSE 101', ['CSE 30']), 'CSE 101 should require CSE 30');
  assert(hasGroup('CSE 101', ['MATH 11B', 'MATH 19B', 'MATH 20B', 'AM 11B']), 'CSE 101 should require existing local alternatives from official calculus group');
}

function testCsBaGeneratedSchedulePlacesCse13sBeforeCse101() {
  const profile = {
    major: 'CS_BA',
    concentration: 'cs_web_software',
    geConcentration: null,
    currentLevel: 1,
    currentTerm: 'F',
    currentYear: 2026,
    targetGradTerm: 'S',
    targetGradYear: 2030,
    completedCourses: [],
    includeSummer: false,
    maxUnits: 19,
    minUnits: 12,
    elwrSatisfied: false,
    priorCredits: 0,
    studentType: 'undergrad'
  };
  const schedule = Scheduler.generate(profile);
  const cse13s = coursePosition(schedule, 'CSE 13S');
  const cse101 = coursePosition(schedule, 'CSE 101');
  assert(cse13s, 'CS_BA schedule should include CSE 13S on the CSE 13S + CSE 101 path');
  assert(cse101, 'CS_BA schedule should include CSE 101 on the CSE 13S + CSE 101 path');
  assert(before(cse13s, cse101), `CSE 13S must be before CSE 101, got CSE 13S=${cse13s.label}, CSE 101=${cse101.label}`);
}

function testValidatorFlagsChronologicalPrerequisiteViolations() {
  const schedule = [{
    label: 'Year 1',
    quarters: {
      F: ['CSE 101'],
      W: ['CSE 13S', 'CSE 16', 'CSE 30', 'MATH 19B', 'CSE 12'],
      S: []
    }
  }];
  const validation = Validator.validateAll(schedule, {
    major: 'CS_BA',
    completedCourses: [],
    priorCredits: 180,
    elwrSatisfied: true,
    studentType: 'undergrad'
  });
  assert(Array.isArray(validation.prereqViolations), 'validation should expose prereqViolations array');
  assert(validation.prereqViolations.some(v => v.course === 'CSE 101'), 'validation should flag CSE 101 as chronologically invalid');
  assert(validation.allMet === false, 'validation allMet should be false when chronological prerequisites are violated');
}

function testMath19ADoesNotForcePrecalculusWhenPlacementAlternativesExist() {
  // Official MATH 19A allows MATH 3 OR mathematics placement OR qualifying AP exam.
  // Until the profile models placement/AP evidence, forcing every student through MATH 3 is too strict.
  assert((COURSES['MATH 19A'].prereqs || []).length === 0, 'MATH 19A should not hard-require MATH 3 without placement/AP modeling');
}

function testMath23AOfficialCoursePrerequisiteAlternativesAreEncoded() {
  // Official UCSC MATH 23A catalog page, checked 2026-07-20:
  // https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/lower-division/math-23a
  // "MATH 19B or MATH 20B or qualifying AP exam."
  assert(hasGroup('MATH 23A', ['MATH 19B', 'MATH 20B']), 'MATH 23A should require MATH 19B or MATH 20B as encoded course alternatives');
  assert((COURSES['MATH 23A'].officialPrereqText || '').includes('qualifying AP exam'), 'MATH 23A should preserve the official AP exam alternative in officialPrereqText');
}

function testReverseLabCoreqCanShareQuarterWithLecture() {
  const profile = {
    major: 'RE_BS',
    concentration: 're_autonomous',
    geConcentration: null,
    currentLevel: 1,
    currentTerm: 'F',
    currentYear: 2024,
    targetGradTerm: 'S',
    targetGradYear: 2028,
    completedCourses: [],
    includeSummer: false,
    maxUnits: 19,
    minUnits: 12,
    elwrSatisfied: false,
    priorCredits: 0,
    studentType: 'undergrad'
  };
  const schedule = Scheduler.generate(profile);
  const ece103 = coursePosition(schedule, 'ECE 103');
  const ece103l = coursePosition(schedule, 'ECE 103L');
  assert(ece103 && ece103l, 'RE_BS schedule should include ECE 103 and ECE 103L');
  assert(ece103.y === ece103l.y && ece103.q === ece103l.q, `ECE 103L should share a quarter with ECE 103 when it is modeled as labCoreq, got ${ece103.label} and ${ece103l.label}`);
  const validation = Validator.validateAll(schedule, profile);
  assert(validation.prereqViolations.length === 0, `RE_BS autonomous default schedule should preserve prerequisite correctness, got ${JSON.stringify(validation.prereqViolations)}`);
}

function testOfficialCse186PrerequisitesDoNotPreserveStaleConcurrentRequirement() {
  // Current official UCSC catalog for CSE 186 lists only CSE 101 or CSE 101P as prerequisites.
  // Older local data modeled CSE 180/CSE 182 as previous-or-concurrent; that must not survive
  // the official prerequisite sync because it would over-constrain the schedule.
  assert(hasGroup('CSE 186', ['CSE 101', 'CSE 101P']), 'CSE 186 should still require CSE 101 or CSE 101P as prior prerequisites');
  assert((COURSES['CSE 186'].concurrentPrereqs || []).length === 0, 'CSE 186 should not keep stale CSE 180/CSE 182 concurrent requirements');
  const schedule = [{
    label: 'Year 1',
    quarters: {
      F: ['CSE 101'],
      W: ['CSE 186'],
      S: []
    }
  }];
  const validation = Validator.validateAll(schedule, {
    major: 'CS_BA',
    completedCourses: [],
    priorCredits: 180,
    elwrSatisfied: true,
    studentType: 'undergrad'
  });
  assert(!validation.prereqViolations.some(v => v.course === 'CSE 186'), 'CSE 186 should validate once official CSE 101/CSE 101P prerequisite is satisfied');
}

function testSupportedMajorDefaultSchedulesHaveNoPrerequisiteViolations() {
  for (const major of Object.keys(MAJOR_REQUIREMENTS)) {
    const concentration = (CONCENTRATIONS.major[major] || [])[0]?.id || null;
    const profile = {
      major,
      concentration,
      geConcentration: null,
      currentLevel: 1,
      currentTerm: 'F',
      currentYear: 2024,
      targetGradTerm: 'S',
      targetGradYear: 2028,
      completedCourses: [],
      includeSummer: false,
      maxUnits: 19,
      minUnits: 12,
      elwrSatisfied: false,
      priorCredits: 0,
      studentType: 'undergrad'
    };
    const schedule = Scheduler.generate(profile);
    const validation = Validator.validateAll(schedule, profile);
    assert(validation.prereqViolations.length === 0, `${major}/${concentration || 'default'} should have no prerequisite chronology violations, got ${JSON.stringify(validation.prereqViolations)}`);
  }
}

const tests = [
  testCse101OfficialPrerequisiteGroupsAreEncoded,
  testCsBaGeneratedSchedulePlacesCse13sBeforeCse101,
  testValidatorFlagsChronologicalPrerequisiteViolations,
  testMath19ADoesNotForcePrecalculusWhenPlacementAlternativesExist,
  testMath23AOfficialCoursePrerequisiteAlternativesAreEncoded,
  testReverseLabCoreqCanShareQuarterWithLecture,
  testOfficialCse186PrerequisitesDoNotPreserveStaleConcurrentRequirement,
  testSupportedMajorDefaultSchedulesHaveNoPrerequisiteViolations
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
console.log(`test_prerequisite_correctness.js: ${tests.length}/${tests.length} passed`);
