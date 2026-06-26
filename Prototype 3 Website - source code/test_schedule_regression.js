#!/usr/bin/env node
// Regression tests for schedule-length / prerequisite bugs.
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

function makeProfile(major, concentration) {
  return {
    major, currentLevel: 1, currentTerm: 'F', currentYear: 2024,
    targetGradTerm: 'S', targetGradYear: 2028, completedCourses: [],
    includeSummer: false, maxUnits: 19, minUnits: 12,
    concentration, geConcentration: 'ge_arts_humanities',
    elwrSatisfied: false, priorCredits: 0, studentType: 'undergrad'
  };
}

function prereqViolations(schedule) {
  const completedBefore = new Set();
  const violations = [];
  for (const year of schedule) {
    for (const q of ['F', 'W', 'S', 'SU']) {
      const arr = year.quarters[q];
      if (!arr) continue;
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

function runCase(major, concentration, opts = {}) {
  const profile = Object.assign(makeProfile(major, concentration), opts.profile || {});
  const schedule = Scheduler.generate(profile);
  const validation = Validator.validateAll(schedule, profile);
  const violations = prereqViolations(schedule);
  const errors = [];
  const maxYears = opts.maxYears || 4;
  if (schedule.length > maxYears) errors.push(`expected <=${maxYears} years, got ${schedule.length}`);
  if (opts.requireNoPrereqViolations !== false && violations.length) errors.push(`expected 0 prerequisite violations, got ${violations.length}: ${violations.join('; ')}`);
  if (opts.requireUnits !== false && !validation.totalUnitsMet) errors.push(`expected total units met, got ${validation.totalUnits}`);
  if (opts.requireUpperDiv !== false && !validation.upperDivMet) errors.push(`expected upper-div units met, got ${validation.upperDivUnits}`);
  if (opts.requireAllMajor !== false && !validation.allMajorMet) {
    const failedMajorReqs = validation.major.filter(m => !m.fulfilled).map(m => m.id).join(',');
    errors.push(`expected all major requirements met, failed: ${failedMajorReqs}`);
  }
  return { major, concentration, years: schedule.length, units: validation.totalUnits, violations, errors, schedule, validation };
}

function plannedCourses(schedule) {
  const out = [];
  for (const year of schedule) {
    for (const q of ['F', 'W', 'S', 'SU']) {
      if (year.quarters[q]) out.push(...year.quarters[q].filter(c => c !== '_GAP'));
    }
  }
  return out;
}

function firstConcentration(major) {
  return (CONCENTRATIONS.major[major] || [])[0]?.id || null;
}

function countMajorsWithFourYearPlan() {
  let count = 0;
  const summaries = [];
  for (const major of Object.keys(MAJOR_REQUIREMENTS)) {
    const profile = makeProfile(major, firstConcentration(major));
    const schedule = Scheduler.generate(profile);
    const validation = Validator.validateAll(schedule, profile);
    summaries.push(`${major}:${schedule.length}yr/${validation.totalUnits}u`);
    if (schedule.length <= 4) count++;
  }
  return { count, summaries };
}

const am = runCase('AM_BS', 'am_modeling');
const tim = runCase('TIM_BS', 'tim_entrepreneurship');
const timSystems = runCase('TIM_BS', 'tim_systems_eng');
const timFinance = runCase('TIM_BS', 'tim_finance_econ');
const reAutonomous = runCase('RE_BS', 're_autonomous');
const reAutonomousFullYearGap = runCase('RE_BS', 're_autonomous', {
  profile: {
    currentLevel: 2,
    currentTerm: 'S',
    currentYear: 2027,
    targetGradTerm: 'S',
    targetGradYear: 2030,
    completedCourses: ['MATH 19A', 'MATH 19B', 'CSE 16', 'ECE 9'],
    priorCredits: 45,
    maxUnits: 15,
    gapEnabled: true,
    gapType: 'year',
    gapTerm: 'F',
    gapYear: 2028
  },
  maxYears: 8,
  requireNoPrereqViolations: false
});
const eeSignals = runCase('EE_BS', 'ee_signals_comm', { requireAllMajor: false });
const timAvoided = runCase('TIM_BS', 'tim_entrepreneurship', {
  profile: { avoidedCourses: ['TIM 171', 'TIM 174'] }
});
const timAvoidedCourses = plannedCourses(timAvoided.schedule);
const capstoneViolations = prereqViolations(reAutonomousFullYearGap.schedule)
  .filter(v => v.includes('ECE 129B') || v.includes('ECE 129C'));
if (capstoneViolations.length) {
  reAutonomousFullYearGap.errors.push(`expected ECE 129A/B/C capstone sequence to be chronological after full-year gap, got: ${capstoneViolations.join('; ')}`);
}
if (timAvoidedCourses.includes('TIM 171') || timAvoidedCourses.includes('TIM 174')) {
  timAvoided.errors.push('expected avoidedCourses TIM 171/TIM 174 not to be selected when alternatives exist');
}
let failed = 0;
for (const result of [am, tim, timSystems, timFinance, reAutonomous, reAutonomousFullYearGap, eeSignals, timAvoided]) {
  if (result.errors.length) {
    failed++;
    console.error(`FAIL ${result.major}/${result.concentration}: ${result.errors.join(' | ')}`);
  } else {
    console.log(`PASS ${result.major}/${result.concentration}: ${result.years} years, ${result.units} units`);
  }
}

const aggregate = countMajorsWithFourYearPlan();
if (aggregate.count < 8) {
  failed++;
  console.error(`FAIL aggregate: expected at least 8 majors with a <=4-year default plan, got ${aggregate.count}. ${aggregate.summaries.join(', ')}`);
} else {
  console.log(`PASS aggregate: ${aggregate.count}/12 majors have a <=4-year default plan`);
}
if (failed) process.exit(1);
