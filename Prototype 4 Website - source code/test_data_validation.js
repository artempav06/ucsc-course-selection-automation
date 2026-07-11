const assert = require('assert');
const path = require('path');
const { loadRuntimeData, validateData, summarizeWarnings, summarizeWarningImpact } = require('./tools/data-validator');

function validFixture() {
  return {
    courses: {
      'CSE 1': {
        title: 'Intro',
        units: 5,
        division: 'lower',
        prereqs: [],
        ge: null,
        quarters: ['F'],
        desc: 'Intro course',
        section: ['CORE'],
        rmpScore: 0
      },
      'CSE 2': {
        title: 'Next',
        units: 5,
        division: 'lower',
        prereqs: [['CSE 1']],
        ge: 'MF',
        quarters: ['W'],
        desc: 'Next course',
        section: ['CORE'],
        rmpScore: 0
      },
      'BME 195': {
        title: 'Senior Thesis',
        units: 5,
        division: 'upper',
        prereqs: [],
        ge: null,
        quarters: ['F', 'W', 'S'],
        desc: 'Repeatable thesis course',
        section: ['CAPSTONE'],
        rmpScore: 0
      }
    },
    majors: {
      TEST_BS: {
        id: 'TEST_BS',
        name: 'Test B.S.',
        catalogUrl: 'https://catalog.ucsc.edu/test',
        totalUnitsRequired: 180,
        minUpperDivUnits: 60,
        categories: [
          { id: 'CORE', name: 'Core', type: 'all_required', courses: ['CSE 1'] },
          { id: 'CHOICE', name: 'Choice', type: 'pick_one', courses: ['CSE 2'] },
          { id: 'ELECTIVES', name: 'Electives', type: 'pick_n', n: 1, courses: ['CSE 1', 'CSE 2'] },
          { id: 'PATH', name: 'Path', type: 'choose_group', groups: [{ label: 'Default', courses: ['CSE 1', 'CSE 2'] }] }
        ]
      }
    },
    geRequirements: [
      { id: 'MF', name: 'Mathematical and Formal Reasoning', needed: 1, courses: ['CSE 2'] }
    ]
  };
}

function expectErrorSubstring(result, text) {
  assert(result.errors.some(error => error.includes(text)), `Expected error containing ${text}; got:\n${result.errors.join('\n')}`);
}

function testValidFixturePasses() {
  const result = validateData(validFixture());
  assert.strictEqual(result.errors.length, 0, result.errors.join('\n'));
}

function testUnknownPrereqFails() {
  const fixture = validFixture();
  fixture.courses['CSE 2'].prereqs = [['MISSING 1']];
  const result = validateData(fixture);
  expectErrorSubstring(result, 'unknown prerequisite MISSING 1');
}

function testUnknownMajorCourseFails() {
  const fixture = validFixture();
  fixture.majors.TEST_BS.categories[0].courses.push('MISSING 2');
  const result = validateData(fixture);
  expectErrorSubstring(result, 'references unknown course MISSING 2');
}

function testDuplicateCategoryIdsFail() {
  const fixture = validFixture();
  fixture.majors.TEST_BS.categories.push({ id: 'CORE', name: 'Duplicate', type: 'all_required', courses: ['CSE 1'] });
  const result = validateData(fixture);
  expectErrorSubstring(result, 'duplicate category id CORE');
}

function testMalformedPickNFails() {
  const fixture = validFixture();
  fixture.majors.TEST_BS.categories[2].n = 3;
  const result = validateData(fixture);
  expectErrorSubstring(result, 'pick_n n=3 exceeds course count 2');
}

function testUnknownGeCourseFails() {
  const fixture = validFixture();
  fixture.geRequirements[0].courses.push('MISSING GE');
  const result = validateData(fixture);
  expectErrorSubstring(result, 'GE MF references unknown course MISSING GE');
}

function testRepeatCourseRequirementPasses() {
  const fixture = validFixture();
  fixture.majors.TEST_BS.categories.push({
    id: 'THESIS',
    name: 'Senior Thesis',
    type: 'repeat_course',
    course: 'BME 195',
    minUnits: 15,
    minTerms: 3
  });
  const result = validateData(fixture);
  assert.strictEqual(result.errors.length, 0, result.errors.join('\n'));
}

function testMalformedRepeatCourseFails() {
  const fixture = validFixture();
  fixture.majors.TEST_BS.categories.push({
    id: 'THESIS',
    name: 'Senior Thesis',
    type: 'repeat_course',
    course: 'MISSING 195',
    minUnits: 0,
    minTerms: 0
  });
  const result = validateData(fixture);
  expectErrorSubstring(result, 'repeat_course references unknown course MISSING 195');
  expectErrorSubstring(result, 'repeat_course requires positive minUnits');
  expectErrorSubstring(result, 'repeat_course requires positive integer minTerms');
}

function testMajorSpecificPrereqMetadataFailsForUnknownCourse() {
  const fixture = validFixture();
  fixture.majors.TEST_BS.categories[1].prerequisitesByMajor = { TEST_BS: [['MISSING PREREQ']] };
  const result = validateData(fixture);
  expectErrorSubstring(result, 'prerequisitesByMajor[TEST_BS][0] references unknown course MISSING PREREQ');
}

function testEquivalenciesAndCreditExclusionsFailForUnknownCourse() {
  const fixture = validFixture();
  fixture.majors.TEST_BS.categories[1].equivalentCourses = [['CSE 2', 'MISSING EQ']];
  fixture.majors.TEST_BS.categories[1].creditExclusions = [['CSE 1', 'MISSING EX']];
  const result = validateData(fixture);
  expectErrorSubstring(result, 'equivalentCourses[0] references unknown course MISSING EQ');
  expectErrorSubstring(result, 'creditExclusions[0] references unknown course MISSING EX');
}


function testWarningSummaryBucketsWarningsByActionableType() {
  const summary = summarizeWarnings([
    'COURSES[CSE 12] missing catalogUrl',
    'COURSES[CSE 13S] prereq references unknown course CSE 999',
    'GE IM references unknown course ANTH 999',
    'COURSES[CSE 195] has no current offerings'
  ]);
  assert.strictEqual(summary.total, 4);
  assert.strictEqual(summary.buckets.missingCatalogUrl.count, 1);
  assert.strictEqual(summary.buckets.unknownPrerequisiteReference.count, 1);
  assert.strictEqual(summary.buckets.unknownGeReference.count, 1);
  assert.strictEqual(summary.buckets.noCurrentOfferings.count, 1);
}

function testRuntimeDataHasNoUnknownGeReferences() {
  const data = loadRuntimeData(path.resolve(__dirname));
  const result = validateData(data, { strictPrereqReferences: false, strictGeReferences: false });
  const summary = summarizeWarnings(result.warnings);
  const unknownGe = summary.buckets.unknownGeReference;
  assert.strictEqual(
    unknownGe ? unknownGe.count : 0,
    0,
    `runtime GE requirements should not reference missing courses; examples: ${unknownGe ? unknownGe.examples.join('; ') : 'none'}`
  );
}

function testWarningImpactClassifiesDirectSupportedMajorReferences() {
  const fixture = validFixture();
  for (const [code, course] of Object.entries(fixture.courses)) {
    course.catalogUrl = `https://catalog.ucsc.edu/${code.toLowerCase().replace(/ /g, '-')}`;
  }
  fixture.courses['CSE 2'].prereqs = [['MISSING PREREQ']];
  fixture.courses['CSE 1'].catalogUrl = '';
  fixture.courses['BME 195'].catalogUrl = '';
  const result = validateData(fixture, { strictPrereqReferences: false });
  const impact = summarizeWarningImpact(result.warnings, fixture);

  assert.strictEqual(impact.buckets.unknownPrerequisiteReference.total, 1);
  assert.strictEqual(impact.buckets.unknownPrerequisiteReference.directSupportedMajor.count, 1);
  assert.strictEqual(impact.buckets.unknownPrerequisiteReference.outsideSupportedMajor.count, 0);
  assert.deepStrictEqual(impact.buckets.unknownPrerequisiteReference.directSupportedMajor.examples[0].majors, ['TEST_BS']);
  assert.strictEqual(impact.buckets.missingCatalogUrl.total, 2);
  assert.strictEqual(impact.buckets.missingCatalogUrl.directSupportedMajor.count, 1);
  assert.strictEqual(impact.buckets.missingCatalogUrl.outsideSupportedMajor.count, 1);
}

const tests = [
  testValidFixturePasses,
  testUnknownPrereqFails,
  testUnknownMajorCourseFails,
  testDuplicateCategoryIdsFail,
  testMalformedPickNFails,
  testUnknownGeCourseFails,
  testRepeatCourseRequirementPasses,
  testMalformedRepeatCourseFails,
  testMajorSpecificPrereqMetadataFailsForUnknownCourse,
  testEquivalenciesAndCreditExclusionsFailForUnknownCourse,
  testWarningSummaryBucketsWarningsByActionableType,
  testRuntimeDataHasNoUnknownGeReferences,
  testWarningImpactClassifiesDirectSupportedMajorReferences
];

let passed = 0;
for (const test of tests) {
  test();
  passed += 1;
}
console.log(`test_data_validation.js: ${passed}/${tests.length} passed`);
