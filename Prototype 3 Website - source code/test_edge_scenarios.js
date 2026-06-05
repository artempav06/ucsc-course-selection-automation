#!/usr/bin/env node
// Edge scenario regression tests for student-choice inputs in Prototype 2.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const dir = __dirname;
const load = f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'));
load('js/courses.js');
load('js/majors.js');
load('js/data.js');
load('js/engine/requirement-normalizer.js');
load('js/engine/requirement-collector.js');
load('js/engine.js');

function makeProfile(overrides = {}) {
  return Object.assign({
    major: 'CS_BA', currentLevel: 1, currentTerm: 'F', currentYear: 2026,
    targetGradTerm: 'S', targetGradYear: 2030, completedCourses: [],
    includeSummer: false, maxUnits: 19, minUnits: 12,
    concentration: null, geConcentration: 'ge_arts_humanities',
    elwrSatisfied: false, priorCredits: 0, studentType: 'undergrad'
  }, overrides);
}

function quarterKeys(schedule) {
  const out = [];
  for (const year of schedule) {
    for (const q of ['F', 'W', 'S', 'SU']) {
      if (Object.prototype.hasOwnProperty.call(year.quarters, q)) {
        const calYear = q === 'F' ? year.academicStart : year.academicStart + 1;
        out.push(`${calYear}-${q}`);
      }
    }
  }
  return out;
}

function gapKeys(schedule) {
  const out = [];
  for (const year of schedule) {
    for (const q of ['F', 'W', 'S', 'SU']) {
      const arr = year.quarters[q];
      if (arr && arr[0] === '_GAP') {
        const calYear = q === 'F' ? year.academicStart : year.academicStart + 1;
        out.push(`${calYear}-${q}`);
      }
    }
  }
  return out;
}

function plannedCourses(schedule) {
  const out = [];
  for (const year of schedule) {
    for (const q of ['F','W','S','SU']) {
      const arr = year.quarters[q] || [];
      out.push(...arr.filter(c => c !== '_GAP'));
    }
  }
  return out;
}

function prereqViolations(schedule) {
  const completedBefore = new Set();
  const violations = [];
  for (const year of schedule) {
    for (const q of ['F','W','S','SU']) {
      const arr = year.quarters[q] || [];
      const sameQuarter = new Set(arr);
      const snapshot = new Set(completedBefore);
      for (const code of arr) {
        if (code === '_GAP' || code.startsWith('FREE')) continue;
        const course = COURSES[code];
        const prereqContext = new Set(snapshot);
        if (course?.labCoreq && sameQuarter.has(course.labCoreq)) prereqContext.add(course.labCoreq);
        if (course?.prereqs && !Validator.prereqsMet(course.prereqs, prereqContext)) {
          violations.push(`${code} in ${year.label} ${q}`);
        }
      }
      for (const code of arr) completedBefore.add(code);
    }
  }
  return violations;
}

function coreqViolations(schedule) {
  const violations = [];
  const completedBefore = new Set();
  for (const year of schedule) {
    for (const q of ['F','W','S','SU']) {
      const arr = year.quarters[q] || [];
      const sameQuarter = new Set(arr);
      for (const code of arr) {
        if (code === '_GAP' || code.startsWith('FREE')) continue;
        const labCode = COURSES[code]?.labCoreq;
        if (labCode && COURSES[labCode] && !sameQuarter.has(labCode) && !completedBefore.has(labCode)) {
          violations.push(`${code} missing ${labCode} in ${year.label} ${q}`);
        }
      }
      for (const code of arr) completedBefore.add(code);
    }
  }
  return violations;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function courseSlot(schedule, target) {
  for (let yi = 0; yi < schedule.length; yi++) {
    const year = schedule[yi];
    for (const q of ['F','W','S','SU']) {
      const arr = year.quarters[q] || [];
      if (arr.includes(target)) return { yearIndex: yi, levelNum: year.levelNum, q, label: year.label };
    }
  }
  return null;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('current Summer starts planning in the selected Summer, not the prior Fall', () => {
  const profile = makeProfile({ currentTerm: 'SU', currentYear: 2026, includeSummer: true, targetGradTerm: 'S', targetGradYear: 2028 });
  const schedule = Scheduler.generate(profile);
  const keys = quarterKeys(schedule);
  assert(keys[0] === '2026-SU', `expected first quarter 2026-SU, got ${keys[0]} (${keys.slice(0,4).join(', ')})`);
  assert(!keys.includes('2025-F') && !keys.includes('2026-W') && !keys.includes('2026-S'), `schedule includes quarters before current Summer: ${keys.slice(0,4).join(', ')}`);
});

test('one-quarter Winter gap uses the selected calendar year', () => {
  const profile = makeProfile({ gapEnabled: true, gapType: 'quarter', gapTerm: 'W', gapYear: 2027, targetGradYear: 2029 });
  const schedule = Scheduler.generate(profile);
  const gaps = gapKeys(schedule);
  assert(gaps.includes('2027-W'), `expected Winter 2027 gap, got ${gaps.join(', ') || 'none'}`);
  assert(!gaps.includes('2028-W'), `did not expect Winter 2028 gap when user selected 2027, got ${gaps.join(', ')}`);
});

test('full-year gap honors the selected starting term', () => {
  const profile = makeProfile({ gapEnabled: true, gapType: 'year', gapTerm: 'W', gapYear: 2027, targetGradYear: 2029 });
  const schedule = Scheduler.generate(profile);
  const gaps = gapKeys(schedule);
  for (const expected of ['2027-W', '2027-S', '2027-F']) {
    assert(gaps.includes(expected), `expected full-year gap to include ${expected}, got ${gaps.join(', ') || 'none'}`);
  }
  assert(!gaps.includes('2028-W'), `full-year gap should start at selected Winter 2027, got ${gaps.join(', ')}`);
});

test('AM_BS concentration IDs are unique and meaningful', () => {
  const ids = (CONCENTRATIONS.major.AM_BS || []).map(c => c.id);
  assert(ids.every(id => id && id !== '***'), `invalid AM_BS ids: ${ids.join(', ')}`);
  assert(new Set(ids).size === ids.length, `duplicate AM_BS ids: ${ids.join(', ')}`);
});

test('avoided courses are not selected when alternatives exist', () => {
  const profile = makeProfile({ major: 'TIM_BS', concentration: 'tim_entrepreneurship', avoidedCourses: ['TIM 171', 'TIM 174'] });
  const courses = plannedCourses(Scheduler.generate(profile));
  assert(!courses.includes('TIM 171') && !courses.includes('TIM 174'), 'avoided TIM electives were selected despite alternatives');
});

test('generated schedules do not place courses before prerequisites are complete', () => {
  const cases = [
    ['BMEB_BI', 'bi_ecology_micro'],
    ['BMEB_BM', 'bm_molecular_eng'],
    ['CS_BS', 'cs_graphics_games'],
    ['RE_BS', 're_ai_vision']
  ];
  const failures = [];
  for (const [major, concentration] of cases) {
    const schedule = Scheduler.generate(makeProfile({ major, concentration, currentYear: 2024, targetGradYear: 2028 }));
    const violations = prereqViolations(schedule);
    if (violations.length) failures.push(`${major}/${concentration}: ${violations.join('; ')}`);
  }
  assert(failures.length === 0, failures.join(' | '));
});

test('generated schedules co-schedule required lab/corequisite pairs', () => {
  const cases = [
    ['BMEB_BI', 'bi_ecology_micro'],
    ['BMEB_BM', 'bm_molecular_eng'],
    ['CE_BS', 'ce_system_prog'],
    ['EE_BS', 'ee_signals_comm'],
    ['NDT_BS', 'ndt_networks'],
    ['RE_BS', 're_ai_vision']
  ];
  const failures = [];
  for (const [major, concentration] of cases) {
    const schedule = Scheduler.generate(makeProfile({ major, concentration, currentYear: 2024, targetGradYear: 2028 }));
    const violations = coreqViolations(schedule);
    if (violations.length) failures.push(`${major}/${concentration}: ${violations.join('; ')}`);
  }
  assert(failures.length === 0, failures.join(' | '));
});

test('all lab/corequisite references point to known catalog courses', () => {
  const missing = Object.entries(COURSES)
    .filter(([, course]) => course.labCoreq && !COURSES[course.labCoreq])
    .map(([code, course]) => `${code} -> ${course.labCoreq}`);
  assert(missing.length === 0, `missing lab/coreq targets: ${missing.join(', ')}`);
});

test('dense robotics concentrations avoid unnecessary fifth-year single-course overflow', () => {
  const cases = [
    ['RE_BS', 're_controls_sensing'],
    ['RE_BS', 're_ai_vision']
  ];
  const failures = [];
  for (const [major, concentration] of cases) {
    const schedule = Scheduler.generate(makeProfile({ major, concentration, geConcentration: null, currentYear: 2024, targetGradYear: 2028 }));
    const validation = Validator.validateAll(schedule, makeProfile({ major, concentration, geConcentration: null, currentYear: 2024, targetGradYear: 2028 }));
    if (!validation.allMet || schedule.length > 4) {
      failures.push(`${major}/${concentration}: ${schedule.length} years, allMet=${validation.allMet}`);
    }
  }
  assert(failures.length === 0, failures.join(' | '));
});

test('official Robotics planner constraints keep ECE capstone in senior year after ECE 118 and ECE 121', () => {
  const schedule = Scheduler.generate(makeProfile({ major: 'RE_BS', concentration: 're_autonomous', currentYear: 2024, targetGradYear: 2028 }));
  const s129A = courseSlot(schedule, 'ECE 129A');
  const s129B = courseSlot(schedule, 'ECE 129B');
  const s129C = courseSlot(schedule, 'ECE 129C');
  const s118 = courseSlot(schedule, 'ECE 118');
  const s121 = courseSlot(schedule, 'ECE 121');
  assert(s129A && s129B && s129C, 'missing ECE 129A/B/C capstone sequence');
  assert(s118 && s121, 'missing ECE 118 or ECE 121, required before RE capstone');
  assert(s129A.levelNum >= 4, `ECE 129A should be senior-year only, got ${s129A.label} ${s129A.q}`);
  assert(s118.yearIndex < s129A.yearIndex || (s118.yearIndex === s129A.yearIndex && ['F','W','S','SU'].indexOf(s118.q) < ['F','W','S','SU'].indexOf(s129A.q)), 'ECE 118 should be completed before ECE 129A');
  assert(s121.yearIndex < s129A.yearIndex || (s121.yearIndex === s129A.yearIndex && ['F','W','S','SU'].indexOf(s121.q) < ['F','W','S','SU'].indexOf(s129A.q)), 'ECE 121 should be completed before ECE 129A');
  assert(s129A.yearIndex < s129B.yearIndex || (s129A.yearIndex === s129B.yearIndex && ['F','W','S','SU'].indexOf(s129A.q) < ['F','W','S','SU'].indexOf(s129B.q)), 'ECE 129B should follow ECE 129A');
  assert(s129B.yearIndex < s129C.yearIndex || (s129B.yearIndex === s129C.yearIndex && ['F','W','S','SU'].indexOf(s129B.q) < ['F','W','S','SU'].indexOf(s129C.q)), 'ECE 129C should follow ECE 129B');
});

function category(major, id) {
  return (MAJOR_REQUIREMENTS[major].categories || []).find(c => c.id === id);
}
function groupHas(cat, courses) {
  return (cat.groups || []).some(g => courses.every(c => (g.courses || []).includes(c)));
}

function before(a, b) {
  return a.yearIndex < b.yearIndex || (a.yearIndex === b.yearIndex && ['F','W','S','SU'].indexOf(a.q) < ['F','W','S','SU'].indexOf(b.q));
}

test('official catalog alternatives are represented for audited non-RE majors', () => {
  assert(groupHas(category('BMEB_BI', 'CALCULUS'), ['MATH 20A', 'MATH 20B']), 'BMEB_BI missing MATH 20A/B calculus path');
  assert(groupHas(category('BMEB_BM', 'CALCULUS'), ['MATH 20A', 'MATH 20B']), 'BMEB_BM missing MATH 20A/B calculus path');
  assert(groupHas(category('TIM_BS', 'CALCULUS'), ['MATH 20A', 'MATH 20B']), 'TIM_BS missing MATH 20A/B calculus path');
  assert(category('CS_BS', 'UD_LANGUAGES').courses.includes('CSE 112'), 'CS_BS missing CSE 112 / CSE 114A choice');
  assert(category('BIOTECH_BS', 'LD_STATISTICS').groups.some(g => g.courses.includes('STAT 131')), 'BIOTECH_BS missing STAT 131 statistics substitution');
  assert(category('CSGD_BS', 'CGE_ELECTIVES').courses.includes('CSE 119'), 'CSGD_BS missing CSE 119 elective');
  assert(category('CSGD_BS', 'CGE_ELECTIVES').courses.includes('CSE 166A'), 'CSGD_BS missing CSE 166A cross-list elective');
  assert(category('CE_BS', 'DC').courses.includes('CSE 185S'), 'CE_BS missing CSE 185S DC option');
  assert(category('NDT_BS', 'DC').courses.includes('CSE 185S'), 'NDT_BS missing CSE 185S DC option');
  assert(!category('TIM_BS', 'ECON_ELECTIVE').courses.includes('ECON 190'), 'TIM_BS should not include ECON 190 outside official 100-189 economics elective range');
});

test('official TIM comprehensive sequence keeps required concurrent pairs together', () => {
  const schedule = Scheduler.generate(makeProfile({ major: 'TIM_BS', concentration: 'tim_entrepreneurship', currentYear: 2024, targetGradYear: 2028 }));
  const a = courseSlot(schedule, 'TIM 172A');
  const p = courseSlot(schedule, 'TIM 172P');
  const b = courseSlot(schedule, 'TIM 172B');
  const q = courseSlot(schedule, 'TIM 172Q');
  assert(a && p && b && q, 'missing TIM 172A/P/B/Q');
  assert(a.yearIndex === p.yearIndex && a.q === p.q, `TIM 172A and TIM 172P must be concurrent, got ${a.label} ${a.q} vs ${p.label} ${p.q}`);
  assert(b.yearIndex === q.yearIndex && b.q === q.q, `TIM 172B and TIM 172Q must be concurrent, got ${b.label} ${b.q} vs ${q.label} ${q.q}`);
});

test('official BMEB capstone options are alternatives and occur after BME 185 technical writing', () => {
  for (const [major, concentration] of [['BMEB_BI', 'bi_computational'], ['BMEB_BM', 'bm_molecular_eng']]) {
    const schedule = Scheduler.generate(makeProfile({ major, concentration, currentYear: 2024, targetGradYear: 2028 }));
    const technicalWriting = courseSlot(schedule, 'BME 185');
    assert(technicalWriting, `${major} missing BME 185`);
    for (const code of ['BME 205', 'BME 230A', 'BME 129C', 'BME 195']) {
      const slot = courseSlot(schedule, code);
      if (slot) assert(before(technicalWriting, slot), `${major} places ${code} before BME 185`);
    }
    const courses = plannedCourses(schedule);
    if (major === 'BMEB_BI') assert(!(courses.includes('BME 129C') && courses.includes('BME 195')), 'BMEB_BI should not require both bioinformatics capstone and senior thesis');
  }
});

let failed = 0;
for (const { name, fn } of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${name}: ${err.message}`);
  }
}
if (failed) process.exit(1);
