const assert = require('assert');
const { departmentMatches } = require('./scripts/catalog_expansion/common');

function testDepartmentFilterDoesNotSubstringMatchAppliedMathematicsForStatOrMath() {
  const amRow = {
    code: 'AM 227',
    departmentSlug: 'am-applied-mathematics',
    departmentText: 'AM - Applied Mathematics'
  };
  assert.strictEqual(departmentMatches(amRow, 'STAT'), false, 'STAT should not match AM rows just because Applied Mathematics contains a substring');
  assert.strictEqual(departmentMatches(amRow, 'MATH'), false, 'MATH should not match AM rows just because department title says Mathematics');
}

function testDepartmentFilterKeepsExactSubjectAndDepartmentPageMatches() {
  assert.strictEqual(departmentMatches({ code: 'STAT 200', departmentSlug: 'statistics', departmentText: 'STAT - Statistics' }, 'STAT'), true);
  assert.strictEqual(departmentMatches({ code: 'MATH 201', departmentSlug: 'math-mathematics', departmentText: 'MATH - Mathematics' }, 'MATH'), true);
  assert.strictEqual(departmentMatches({ code: 'SOCD 204', departmentSlug: 'film-and-digital-media', departmentText: 'FILM - Film and Digital Media' }, 'FILM'), true, 'cross-subject courses shown on the requested official department page should remain staged for QA');
}

const tests = [
  testDepartmentFilterDoesNotSubstringMatchAppliedMathematicsForStatOrMath,
  testDepartmentFilterKeepsExactSubjectAndDepartmentPageMatches
];

for (const test of tests) {
  test();
  console.log(`PASS ${test.name}`);
}
console.log(`test_catalog_expansion_department_filter.js: ${tests.length}/${tests.length} passed`);
