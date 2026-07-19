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

function withTemporaryCourses(tempCourses, fn) {
  const old = new Map();
  for (const [code, course] of Object.entries(tempCourses)) {
    old.set(code, COURSES[code]);
    COURSES[code] = course;
  }
  try { return fn(); }
  finally {
    for (const [code, value] of old.entries()) {
      if (value === undefined) delete COURSES[code];
      else COURSES[code] = value;
    }
  }
}

function firstQuarter(schedule) {
  return schedule[0].quarters.F.filter(code => code !== '_GAP');
}

function units(codes) {
  return codes.reduce((sum, code) => sum + (COURSES[code]?.units || 0), 0);
}

function realCourses(codes) {
  return codes.filter(code => code !== '_GAP' && !String(code).startsWith('FREE'));
}

function typeUnits(codes, typeMap, wanted) {
  return codes
    .filter(code => wanted.has(typeMap.get(code)))
    .reduce((sum, code) => sum + (COURSES[code]?.units || 0), 0);
}

function baseProfile(overrides = {}) {
  return Object.assign({
    major: 'CS_BS',
    currentTerm: 'F',
    currentYear: 2026,
    targetGradTerm: 'S',
    targetGradYear: 2027,
    currentLevel: 1,
    minUnits: 12,
    maxUnits: 19,
    includeSummer: false,
    completedCourses: []
  }, overrides);
}

function testMajorCreditTargetUsesCreditsNotCourseCount() {
  withTemporaryCourses({
    'TDD MAJ 5A': { title: 'Major Five A', units: 5, quarters: ['F'], prereqs: [], division: 'lower' },
    'TDD MAJ 2B': { title: 'Major Two B', units: 2, quarters: ['F'], prereqs: [], division: 'lower' },
    'TDD MAJ 3C': { title: 'Major Three C', units: 3, quarters: ['F'], prereqs: [], division: 'lower' },
    'TDD GE 5A': { title: 'GE Five A', units: 5, quarters: ['F'], prereqs: [], ge: 'AH', division: 'lower' }
  }, () => {
    const typeMap = new Map([
      ['TDD MAJ 5A', 'major_core'],
      ['TDD MAJ 2B', 'major_core'],
      ['TDD MAJ 3C', 'major_core'],
      ['TDD GE 5A', 'ge']
    ]);
    const schedule = Scheduler.placeIntoQuarters(
      ['TDD MAJ 5A', 'TDD MAJ 2B', 'TDD MAJ 3C', 'TDD GE 5A'],
      typeMap,
      [],
      new Set(),
      baseProfile()
    );
    const fall = realCourses(firstQuarter(schedule));
    assert(fall.includes('TDD MAJ 3C'), `expected third 3-credit major course to be placed before GE because major credits were only 7; got ${fall.join(', ')}`);
    assert.strictEqual(typeUnits(fall, typeMap, new Set(['major_core', 'major_elective', 'prereq'])), 10);
    assert.strictEqual(units(fall), 15);
  });
}

function testFourCourseSeventeenCreditQuarterIsAllowedWhenCreditsFit() {
  withTemporaryCourses({
    'TDD MAJ 5D': { title: 'Major Five D', units: 5, quarters: ['F'], prereqs: [], division: 'lower', labCoreq: 'TDD LAB 2D' },
    'TDD LAB 2D': { title: 'Two Credit Lab D', units: 2, quarters: ['F'], prereqs: [], division: 'lower' },
    'TDD MAJ 5E': { title: 'Major Five E', units: 5, quarters: ['F'], prereqs: [], division: 'lower' },
    'TDD GE 5E': { title: 'GE Five E', units: 5, quarters: ['F'], prereqs: [], ge: 'ER', division: 'lower' }
  }, () => {
    const typeMap = new Map([
      ['TDD MAJ 5D', 'major_core'],
      ['TDD LAB 2D', 'prereq'],
      ['TDD MAJ 5E', 'major_core'],
      ['TDD GE 5E', 'ge']
    ]);
    const schedule = Scheduler.placeIntoQuarters(
      ['TDD MAJ 5D', 'TDD LAB 2D', 'TDD MAJ 5E', 'TDD GE 5E'],
      typeMap,
      [],
      new Set(),
      baseProfile()
    );
    const fall = realCourses(firstQuarter(schedule));
    assert.deepStrictEqual(new Set(fall), new Set(['TDD MAJ 5D', 'TDD LAB 2D', 'TDD MAJ 5E', 'TDD GE 5E']));
    assert.strictEqual(fall.length, 4);
    assert.strictEqual(units(fall), 17);
  });
}

function testCourseUrgencyPrioritizesLowerDivisionAndPrereqChainStarters() {
  withTemporaryCourses({
    'TDD LD START 1': { title: 'Lower Division Starter', units: 5, quarters: ['F'], prereqs: [], division: 'lower' },
    'TDD UD NEXT 101': { title: 'Upper Next', units: 5, quarters: ['W'], prereqs: [['TDD LD START 1']], division: 'upper' },
    'TDD UD ELECT 180': { title: 'Upper Elective', units: 5, quarters: ['F'], prereqs: [], division: 'upper' },
    'WRIT 1': COURSES['WRIT 1']
  }, () => {
    const earlySlot = { yearIndex: 0, term: 'F', levelNum: 1 };
    const starter = Scheduler.courseUrgency('TDD LD START 1', baseProfile(), earlySlot, new Set(['TDD LD START 1', 'TDD UD NEXT 101', 'TDD UD ELECT 180']));
    const elective = Scheduler.courseUrgency('TDD UD ELECT 180', baseProfile(), earlySlot, new Set(['TDD LD START 1', 'TDD UD NEXT 101', 'TDD UD ELECT 180']));
    const writing = Scheduler.courseUrgency('WRIT 1', baseProfile(), earlySlot, new Set(['WRIT 1']));
    assert(starter > elective, `lower-division chain starter should outrank unrelated upper elective, got ${starter} <= ${elective}`);
    assert(writing > elective, `WRIT 1 should have early urgency, got ${writing} <= ${elective}`);
  });
}

function positionOf(schedule, code) {
  for (let yi = 0; yi < schedule.length; yi++) {
    for (const term of ['F', 'W', 'S', 'SU']) {
      const courses = schedule[yi].quarters[term] || [];
      const idx = courses.indexOf(code);
      if (idx >= 0) return { yi, term, idx };
    }
  }
  return null;
}

function comparePositions(a, b) {
  const termOrder = { F: 0, W: 1, S: 2, SU: 3 };
  if (a.yi !== b.yi) return a.yi - b.yi;
  if (termOrder[a.term] !== termOrder[b.term]) return termOrder[a.term] - termOrder[b.term];
  return a.idx - b.idx;
}

function testRequiredUpperDivisionWaitsUntilAllRequiredLowerDivisionIsComplete() {
  withTemporaryCourses({
    'TDD LD FALL 10': { title: 'Fall Lower Division Requirement', units: 5, quarters: ['F'], prereqs: [], division: 'lower' },
    'TDD LD SPRING 20': { title: 'Spring Lower Division Requirement', units: 5, quarters: ['S'], prereqs: [], division: 'lower' },
    'TDD UD WINTER 120': { title: 'Winter Upper Division Requirement', units: 5, quarters: ['W'], prereqs: [], division: 'upper' },
    'TDD GE WINTER 5': { title: 'Winter GE', units: 5, quarters: ['W'], prereqs: [], ge: 'AH', division: 'lower' }
  }, () => {
    const typeMap = new Map([
      ['TDD LD FALL 10', 'major_core'],
      ['TDD LD SPRING 20', 'major_core'],
      ['TDD UD WINTER 120', 'major_core'],
      ['TDD GE WINTER 5', 'ge']
    ]);
    const schedule = Scheduler.placeIntoQuarters(
      ['TDD UD WINTER 120', 'TDD GE WINTER 5', 'TDD LD FALL 10', 'TDD LD SPRING 20'],
      typeMap,
      [],
      new Set(),
      baseProfile({ targetGradYear: 2028 })
    );
    const lowerSpring = positionOf(schedule, 'TDD LD SPRING 20');
    const upperWinter = positionOf(schedule, 'TDD UD WINTER 120');
    assert(lowerSpring, 'spring-only lower-division required course should be scheduled');
    assert(upperWinter, 'upper-division required course should still be scheduled after the lower-division foundation');
    assert(
      comparePositions(lowerSpring, upperWinter) < 0,
      `upper required course should wait until all required lower division courses are complete; lower=${JSON.stringify(lowerSpring)} upper=${JSON.stringify(upperWinter)}`
    );
    const firstWinter = schedule[0].quarters.W.filter(code => !String(code).startsWith('FREE'));
    assert(firstWinter.includes('TDD GE WINTER 5'), `GE should be allowed while upper major requirements wait; got ${firstWinter.join(', ')}`);
    assert(!firstWinter.includes('TDD UD WINTER 120'), 'upper major requirement should not occupy Winter before Spring lower-division requirement');
  });
}

const tests = [
  testMajorCreditTargetUsesCreditsNotCourseCount,
  testFourCourseSeventeenCreditQuarterIsAllowedWhenCreditsFit,
  testCourseUrgencyPrioritizesLowerDivisionAndPrereqChainStarters,
  testRequiredUpperDivisionWaitsUntilAllRequiredLowerDivisionIsComplete
];

let failed = 0;
for (const test of tests) {
  try {
    test();
    console.log(`PASS ${test.name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${test.name}: ${err.message}`);
    console.error(err.stack);
  }
}
if (failed) {
  console.error(`\nCredit-first placement tests failed: ${failed}/${tests.length}`);
  process.exit(1);
}
console.log(`\nCredit-first placement tests passed: ${tests.length}/${tests.length}`);
