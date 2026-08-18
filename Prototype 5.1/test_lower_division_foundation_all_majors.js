#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const dir = __dirname;
const load = file => vm.runInThisContext(fs.readFileSync(path.join(dir, file), 'utf8'), { filename: file });
load('js/courses.js');
load('js/majors.js');
load('js/data.js');
load('js/engine/requirement-normalizer.js');
load('js/engine/requirement-collector.js');
load('js/engine.js');

const TERM_ORDER = { F: 0, W: 1, S: 2, SU: 3 };
const STRICT_UPPER_TYPES = new Set(['major_core', 'major_elective', 'prereq', 'filler', 'elective', 'other']);

function courseNumber(code) {
  const match = String(code || '').match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function isLowerDivision(code) {
  const course = COURSES[code];
  const number = courseNumber(code);
  return Boolean(course) && (course.division === 'lower' || (Number.isFinite(number) && number <= 99));
}

function isUpperDivision(code) {
  const course = COURSES[code];
  const number = courseNumber(code);
  return Boolean(course) && (course.division === 'upper' || (Number.isFinite(number) && number >= 100));
}

function positionKey(position) {
  return position.yi * 10 + TERM_ORDER[position.term];
}

function schedulePositions(schedule) {
  const positions = new Map();
  for (let yi = 0; yi < schedule.length; yi++) {
    for (const term of ['F', 'W', 'S', 'SU']) {
      const courses = schedule[yi].quarters[term] || [];
      courses.forEach((code, idx) => {
        if (code !== '_GAP') positions.set(code, { yi, term, idx, label: schedule[yi].label });
      });
    }
  }
  return positions;
}

function defaultProfile(major, overrides = {}) {
  return Object.assign({
    major,
    studentType: 'undergrad',
    currentLevel: 1,
    currentTerm: 'F',
    currentYear: 2026,
    targetGradTerm: 'S',
    targetGradYear: 2030,
    minUnits: 12,
    maxUnits: 19,
    includeSummer: false,
    completedCourses: [],
    elwrSatisfied: false,
    priorCredits: 0,
    collegeAffiliation: 'crown'
  }, overrides);
}

function auditLowerBeforeUpper(profile) {
  const { schedule } = Scheduler.generateWithExplanation(profile);
  const courseTypeMap = schedule.courseTypeMap || new Map();
  const positions = schedulePositions(schedule);
  const lowerRequired = [...courseTypeMap.entries()]
    .filter(([code, type]) => ['major_core', 'prereq'].includes(type) && isLowerDivision(code) && positions.has(code))
    .map(([code]) => code);

  let latestLower = null;
  for (const code of lowerRequired) {
    const pos = positions.get(code);
    if (!latestLower || positionKey(pos) > positionKey(latestLower.pos)) latestLower = { code, pos };
  }

  if (!latestLower) return [];

  return [...courseTypeMap.entries()]
    .filter(([code, type]) => positions.has(code) && isUpperDivision(code) && STRICT_UPPER_TYPES.has(type || 'other'))
    .filter(([code]) => positionKey(positions.get(code)) < positionKey(latestLower.pos))
    .map(([code, type]) => ({ code, type, pos: positions.get(code), beforeLower: latestLower }));
}

function testAllSupportedMajorsKeepLowerDivisionFoundationBeforeUpperDivisionWork() {
  const majors = Object.keys(MAJOR_REQUIREMENTS).filter(id => id.endsWith('_BA') || id.endsWith('_BS'));
  const scenarios = [
    { name: 'first-year-default', overrides: {} },
    { name: 'low-cap-17', overrides: { maxUnits: 17 } },
    { name: 'include-summer', overrides: { includeSummer: true, summerYears: [2027, 2028] } },
    { name: 'gap-winter-2027', overrides: { gapEnabled: true, gapType: 'quarter', gapTerm: 'W', gapYear: 2027 } },
    { name: 'sophomore-no-completed', overrides: { currentLevel: 2, currentYear: 2027, targetGradYear: 2030, completedCourses: [] } }
  ];

  const failures = [];
  for (const major of majors) {
    for (const scenario of scenarios) {
      const profile = defaultProfile(major, scenario.overrides);
      const offenders = auditLowerBeforeUpper(profile);
      if (offenders.length > 0) {
        failures.push(`${major} ${scenario.name}: ${offenders.map(offender => `${offender.code} (${offender.type}) at ${offender.pos.label} ${offender.pos.term} before ${offender.beforeLower.code} at ${offender.beforeLower.pos.label} ${offender.beforeLower.pos.term}`).join('; ')}`);
      }
    }
  }

  assert.strictEqual(failures.length, 0, `upper-division work appeared before required lower-division major foundation:\n${failures.join('\n')}`);
  console.log(`PASS lower-division foundation audit for ${majors.length} majors x ${scenarios.length} scenarios`);
}

testAllSupportedMajorsKeepLowerDivisionFoundationBeforeUpperDivisionWork();
console.log('\nLower-division foundation all-major tests passed: 1/1');
