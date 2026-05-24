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
