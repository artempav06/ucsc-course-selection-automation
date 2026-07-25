const assert = require('assert');
const {
  normalizeMajorRequirements,
  normalizeGeRequirements,
  normalizeUcRequirements,
  normalizeDegreeProgressRequirements,
  normalizeStudentProfileRequirements,
  normalizeRequirementSet,
  normalizeRicherRequirementMetadata
} = require('./js/engine/requirement-normalizer');

const sampleMajor = {
  id: 'TEST_BS',
  categories: [
    { id: 'CORE', name: 'Core', type: 'all_required', courses: ['CSE 1', 'CSE 2'] },
    { id: 'STAT', name: 'Statistics', type: 'pick_one', courses: ['STAT 1', 'STAT 2'] },
    { id: 'ELEC', name: 'Electives', type: 'pick_n', n: 2, courses: ['A', 'B', 'C'] },
    { id: 'PATH', name: 'Path', type: 'choose_group', groups: [{ label: 'Path A', courses: ['X', 'Y'] }] }
  ],
  totalUnitsRequired: 180,
  minUpperDivUnits: 60
};

function testNormalizeMajorRequirements() {
  const normalized = normalizeMajorRequirements(sampleMajor);
  assert.deepStrictEqual(normalized.map(r => r.id), ['TEST_BS:CORE', 'TEST_BS:STAT', 'TEST_BS:ELEC', 'TEST_BS:PATH']);
  assert.deepStrictEqual(normalized[0], {
    id: 'TEST_BS:CORE',
    sourceId: 'CORE',
    domain: 'major',
    majorId: 'TEST_BS',
    name: 'Core',
    type: 'all_required',
    minChoices: 2,
    options: [{ label: 'Required courses', courses: ['CSE 1', 'CSE 2'] }],
    metadata: {},
    original: sampleMajor.categories[0]
  });
  assert.strictEqual(normalized[1].minChoices, 1);
  assert.deepStrictEqual(normalized[1].options[0].courses, ['STAT 1', 'STAT 2']);
  assert.strictEqual(normalized[2].minChoices, 2);
  assert.deepStrictEqual(normalized[3].options, [{ label: 'Path A', courses: ['X', 'Y'] }]);
}

function testNormalizeGeRequirements() {
  const ge = normalizeGeRequirements([
    { id: 'MF', name: 'Math', needed: 1, courses: ['CSE 2'] },
    { id: 'PR', name: 'Practice', needed: 2, subcategories: [{ id: 'A', name: 'A', courses: ['A1'] }, { id: 'B', name: 'B', courses: ['B1'] }] }
  ]);
  assert.deepStrictEqual(ge.map(r => r.id), ['GE:MF', 'GE:PR']);
  assert.strictEqual(ge[0].domain, 'ge');
  assert.strictEqual(ge[0].minChoices, 1);
  assert.deepStrictEqual(ge[0].options, [{ label: 'Math', courses: ['CSE 2'] }]);
  assert.strictEqual(ge[1].minChoices, 2);
  assert.deepStrictEqual(ge[1].options, [{ label: 'A', courses: ['A1'] }, { label: 'B', courses: ['B1'] }]);
}

function testNormalizeUcRequirements() {
  const input = [
    { id: 'ELWR', name: 'Entry Level Writing', needed: 1, courses: ['WRIT 1'], canBeSatisfiedByPlacement: true }
  ];
  const uc = normalizeUcRequirements(input);
  assert.deepStrictEqual(uc, [{
    id: 'UC:ELWR',
    sourceId: 'ELWR',
    domain: 'uc',
    name: 'Entry Level Writing',
    type: 'uc_requirement',
    minChoices: 1,
    options: [{ label: 'Entry Level Writing', courses: ['WRIT 1'] }],
    canBeSatisfiedByPlacement: true,
    metadata: {},
    original: input[0]
  }]);
}

function testNormalizeDegreeProgressRequirements() {
  const requirements = normalizeDegreeProgressRequirements(sampleMajor);
  assert.deepStrictEqual(requirements, [
    {
      id: 'TEST_BS:TOTAL_UNITS',
      sourceId: 'totalUnitsRequired',
      domain: 'degree_progress',
      majorId: 'TEST_BS',
      name: 'Total Units',
      type: 'minimum_units',
      minUnits: 180,
      appliesTo: 'degree',
      metadata: {},
      original: 180
    },
    {
      id: 'TEST_BS:UPPER_DIV_UNITS',
      sourceId: 'minUpperDivUnits',
      domain: 'degree_progress',
      majorId: 'TEST_BS',
      name: 'Upper-Division Units',
      type: 'minimum_upper_division_units',
      minUnits: 60,
      appliesTo: 'degree',
      metadata: {},
      original: 60
    }
  ]);
}

function testNormalizeStudentProfileRequirements() {
  const profile = {
    completedCourses: ['CSE 20'],
    avoidedCourses: ['THEA 10'],
    preferredCourses: ['CSE 101'],
    maxUnitsPerQuarter: 15,
    allowSummer: true,
    startTerm: 'F',
    startYear: 2026
  };
  const requirements = normalizeStudentProfileRequirements(profile);
  assert.deepStrictEqual(requirements, [
    {
      id: 'PROFILE:COMPLETED_COURSES',
      sourceId: 'completedCourses',
      domain: 'student_profile',
      name: 'Completed Courses',
      type: 'completed_courses',
      courses: ['CSE 20'],
      metadata: {},
      original: ['CSE 20']
    },
    {
      id: 'PROFILE:AVOIDED_COURSES',
      sourceId: 'avoidedCourses',
      domain: 'student_profile',
      name: 'Avoided Courses',
      type: 'avoid_courses',
      courses: ['THEA 10'],
      metadata: {},
      original: ['THEA 10']
    },
    {
      id: 'PROFILE:PREFERRED_COURSES',
      sourceId: 'preferredCourses',
      domain: 'student_profile',
      name: 'Preferred Courses',
      type: 'prefer_courses',
      courses: ['CSE 101'],
      metadata: {},
      original: ['CSE 101']
    },
    {
      id: 'PROFILE:WORKLOAD',
      sourceId: 'maxUnitsPerQuarter',
      domain: 'student_profile',
      name: 'Quarter Workload Limit',
      type: 'quarter_unit_limit',
      maxUnitsPerQuarter: 15,
      allowSummer: true,
      metadata: { startTerm: 'F', startYear: 2026 },
      original: profile
    }
  ]);
}

function testNormalizeRicherRequirementMetadata() {
  const category = {
    id: 'THESIS',
    name: 'Senior Thesis',
    type: 'repeat_course',
    course: 'BME 195',
    minUnits: 15,
    minTerms: 3,
    prerequisitesByMajor: { BMEB_BI: [['BME 185']] },
    equivalentCourses: [['CSE 166A', 'ECON 166A']],
    creditExclusions: [['CSE 185S', 'CSE 195']],
    catalogYear: '2025-26'
  };
  assert.deepStrictEqual(normalizeRicherRequirementMetadata(category), {
    repeatable: { course: 'BME 195', minUnits: 15, minTerms: 3 },
    prerequisitesByMajor: { BMEB_BI: [['BME 185']] },
    equivalentCourses: [['CSE 166A', 'ECON 166A']],
    creditExclusions: [['CSE 185S', 'CSE 195']],
    catalogYear: '2025-26'
  });
}

function testNormalizeRequirementSetCombinesProviders() {
  const set = normalizeRequirementSet({
    major: sampleMajor,
    geRequirements: [{ id: 'MF', name: 'Math', needed: 1, courses: ['CSE 2'] }],
    ucRequirements: [{ id: 'AH', name: 'American History', needed: 1, courses: ['HIS 10B'] }],
    profile: { completedCourses: ['CSE 20'], maxUnitsPerQuarter: 15 }
  });
  assert.strictEqual(set.version, 1);
  assert.strictEqual(set.majorId, 'TEST_BS');
  assert.deepStrictEqual(set.requirements.map(r => r.id), [
    'TEST_BS:CORE', 'TEST_BS:STAT', 'TEST_BS:ELEC', 'TEST_BS:PATH',
    'GE:MF', 'UC:AH', 'TEST_BS:TOTAL_UNITS', 'TEST_BS:UPPER_DIV_UNITS',
    'PROFILE:COMPLETED_COURSES', 'PROFILE:WORKLOAD'
  ]);
}

const tests = [
  testNormalizeMajorRequirements,
  testNormalizeGeRequirements,
  testNormalizeUcRequirements,
  testNormalizeDegreeProgressRequirements,
  testNormalizeStudentProfileRequirements,
  testNormalizeRicherRequirementMetadata,
  testNormalizeRequirementSetCombinesProviders
];
let passed = 0;
for (const test of tests) {
  test();
  passed += 1;
}
console.log(`test_requirement_normalizer.js: ${passed}/${tests.length} passed`);
