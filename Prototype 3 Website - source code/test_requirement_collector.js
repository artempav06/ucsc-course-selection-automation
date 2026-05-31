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

function legacySortedCategoryIds(majorId) {
  const priority = { all_required: 0, choose_group: 1, pick_one: 2, pick_n: 3 };
  return [...MAJOR_REQUIREMENTS[majorId].categories]
    .sort((a, b) => (priority[a.type] ?? 3) - (priority[b.type] ?? 3))
    .map(category => category.id);
}

function testCollectorMirrorsLegacyMajorCategoryOrder() {
  assert.strictEqual(typeof RequirementCollector.collect, 'function', 'RequirementCollector.collect must exist');
  const requirementSet = Scheduler.buildRequirementSet(makeProfile());
  const collected = RequirementCollector.collect(requirementSet);
  assert.deepStrictEqual(collected.majorCategories.map(category => category.id), legacySortedCategoryIds('CS_BS'));
}

function testSchedulerExposesCollectedRequirements() {
  assert.strictEqual(typeof Scheduler.collectRequirements, 'function', 'Scheduler.collectRequirements must exist');
  const collected = Scheduler.collectRequirements(makeProfile());
  assert.strictEqual(collected.majorId, 'CS_BS');
  assert.strictEqual(collected.degreeTargets.totalUnitsRequired, MAJOR_REQUIREMENTS.CS_BS.totalUnitsRequired);
  assert.strictEqual(collected.degreeTargets.minUpperDivUnits, MAJOR_REQUIREMENTS.CS_BS.minUpperDivUnits);
  assert(collected.geRequirements.length > 0, 'expected GE requirements');
  assert(collected.ucRequirements.length > 0, 'expected UC requirements');
  assert(collected.profileConstraints.completedCourses.includes('CSE 20'));
}

function testCollectorComputesChooseGroupCourseSetWithoutMutatingRequirements() {
  const before = JSON.stringify(MAJOR_REQUIREMENTS.CS_BS.categories);
  const collected = Scheduler.collectRequirements(makeProfile());
  const legacySet = new Set();
  for (const category of MAJOR_REQUIREMENTS.CS_BS.categories) {
    if (category.type === 'choose_group') {
      for (const group of category.groups || []) for (const course of group.courses || []) legacySet.add(course);
    }
  }
  assert.deepStrictEqual([...collected.chooseGroupCourses].sort(), [...legacySet].sort());
  assert.strictEqual(JSON.stringify(MAJOR_REQUIREMENTS.CS_BS.categories), before);
}

const tests = [
  testCollectorMirrorsLegacyMajorCategoryOrder,
  testSchedulerExposesCollectedRequirements,
  testCollectorComputesChooseGroupCourseSetWithoutMutatingRequirements
];
let passed = 0;
for (const test of tests) {
  test();
  passed += 1;
}
console.log(`test_requirement_collector.js: ${passed}/${tests.length} passed`);
