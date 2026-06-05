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
  assert(validation.requirementSet, 'validateAll should attach normalized requirementSet for Prototype 3 debugging');
  assert.strictEqual(validation.requirementSet.majorId, 'CS_BS');
  assert.strictEqual(validation.allMet, true, 'normalized foundation must not change scheduler pass/fail behavior');
}

const tests = [
  testSchedulerBuildsNormalizedRequirementSet,
  testSchedulerBuildRequirementSetDoesNotMutateRuntimeData,
  testGeneratedValidationCarriesRequirementSetForDebuggingWithoutChangingResults
];
let passed = 0;
for (const test of tests) {
  test();
  passed += 1;
}
console.log(`test_scheduler_requirement_set.js: ${passed}/${tests.length} passed`);
