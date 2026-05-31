const assert = require('assert');
const { loadRuntimeData } = require('./tools/data-validator');
const {
  normalizeRequirementSet,
  normalizeMajorRequirements,
  normalizeDegreeProgressRequirements
} = require('./js/engine/requirement-normalizer');

const data = loadRuntimeData(__dirname);

function testAllRuntimeMajorCategoriesNormalizeWithoutUnknownTypes() {
  for (const [majorId, major] of Object.entries(data.majors)) {
    const normalized = normalizeMajorRequirements(major);
    assert.strictEqual(normalized.length, major.categories.length, `${majorId} category count changed`);
    assert.deepStrictEqual(normalized.map(req => req.sourceId), major.categories.map(category => category.id), `${majorId} category order changed`);
    assert.strictEqual(normalized.filter(req => req.type === 'unknown').length, 0, `${majorId} has unknown normalized requirement type`);
  }
}

function testAllRuntimeMajorsExposeDegreeProgressRequirements() {
  for (const [majorId, major] of Object.entries(data.majors)) {
    const progress = normalizeDegreeProgressRequirements(major);
    assert.strictEqual(progress.length, 2, `${majorId} should expose total and upper-division unit requirements`);
    assert.deepStrictEqual(progress.map(req => req.type), ['minimum_units', 'minimum_upper_division_units']);
    assert(progress.every(req => req.minUnits > 0), `${majorId} degree-progress requirements must be positive`);
  }
}

function testRequirementSetCombinesRuntimeProvidersWithoutChangingSourceData() {
  const major = data.majors.CS_BS;
  const beforeCategories = JSON.stringify(major.categories);
  const set = normalizeRequirementSet({
    major,
    geRequirements: data.geRequirements,
    ucRequirements: data.ucRequirements,
    profile: { completedCourses: ['CSE 20'], maxUnitsPerQuarter: 15 }
  });

  assert.strictEqual(set.version, 1);
  assert.strictEqual(set.majorId, 'CS_BS');
  assert.strictEqual(JSON.stringify(major.categories), beforeCategories, 'normalizer must not mutate runtime major data');

  const expectedCount = major.categories.length + data.geRequirements.length + data.ucRequirements.length + 2 + 2;
  assert.strictEqual(set.requirements.length, expectedCount, 'combined provider count should be behavior-preserving and predictable');
  assert(set.requirements.some(req => req.id === 'CS_BS:DC' && req.domain === 'major'), 'major DC requirement should remain represented as a major requirement');
  assert(set.requirements.some(req => req.id === 'GE:DC' && req.domain === 'ge'), 'campus DC requirement should remain represented as a GE requirement');
  assert(set.requirements.some(req => req.id === 'CS_BS:TOTAL_UNITS'), 'total-units requirement missing');
  assert(set.requirements.some(req => req.id === 'CS_BS:UPPER_DIV_UNITS'), 'upper-division units requirement missing');
}

const tests = [
  testAllRuntimeMajorCategoriesNormalizeWithoutUnknownTypes,
  testAllRuntimeMajorsExposeDegreeProgressRequirements,
  testRequirementSetCombinesRuntimeProvidersWithoutChangingSourceData
];
let passed = 0;
for (const test of tests) {
  test();
  passed += 1;
}
console.log(`test_requirement_normalizer_runtime.js: ${passed}/${tests.length} passed`);
