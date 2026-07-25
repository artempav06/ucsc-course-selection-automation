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

function baseProfile(overrides = {}) {
  return Object.assign({ major: 'CS_BS', minUnits: 12, maxUnits: 19, completedCourses: [] }, overrides);
}

function testAuditCatchesOverCapAndDuplicateGEFamily() {
  withTemporaryCourses({
    'TDD AUD MAJ 10': { title: 'Major Ten', units: 10, quarters: ['F'], prereqs: [], division: 'lower' },
    'TDD AUD GE PE1': { title: 'GE PE One', units: 5, quarters: ['F'], prereqs: [], ge: 'PE-H', division: 'lower' },
    'TDD AUD GE PE2': { title: 'GE PE Two', units: 5, quarters: ['F'], prereqs: [], ge: 'PE-T', division: 'lower' }
  }, () => {
    const schedule = [{ label: 'Year 1 (Freshman)', academicStart: 2026, levelNum: 1, quarters: { F: ['TDD AUD MAJ 10', 'TDD AUD GE PE1', 'TDD AUD GE PE2'], W: [], S: [] } }];
    const typeMap = new Map([
      ['TDD AUD MAJ 10', 'major_core'],
      ['TDD AUD GE PE1', 'ge'],
      ['TDD AUD GE PE2', 'ge']
    ]);
    const audit = Scheduler.auditSchedulePolicy(schedule, baseProfile(), typeMap);
    assert(audit.hardErrors.some(err => err.rule === 'over_cap'), `expected over_cap hard error, got ${JSON.stringify(audit)}`);
    assert(audit.warnings.some(w => w.rule === 'duplicate_ge_family'), `expected duplicate_ge_family warning, got ${JSON.stringify(audit)}`);
    assert.strictEqual(audit.quarterDiagnostics[0].units, 20);
    assert.strictEqual(audit.quarterDiagnostics[0].loadBand, 'over_cap');
  });
}

function testAuditCatchesFreeBeforeGECompletion() {
  withTemporaryCourses({
    'TDD AUD MAJ 5': { title: 'Major Five', units: 5, quarters: ['F'], prereqs: [], division: 'lower' },
    'FREE 2U1': COURSES['FREE 2U1'] || { title: 'Free Two', units: 2, quarters: ['F', 'W', 'S'], prereqs: [] }
  }, () => {
    const schedule = [{ label: 'Year 1 (Freshman)', academicStart: 2026, levelNum: 1, quarters: { F: ['TDD AUD MAJ 5', 'FREE 2U1'], W: [], S: [] } }];
    const typeMap = new Map([['TDD AUD MAJ 5', 'major_core'], ['FREE 2U1', 'filler']]);
    const audit = Scheduler.auditSchedulePolicy(schedule, baseProfile({ geConcentration: null }), typeMap);
    assert(audit.warnings.some(w => w.rule === 'filler_before_ge_complete'), `expected filler_before_ge_complete warning, got ${JSON.stringify(audit)}`);
  });
}

function testRepairRemovesFreePaddingThatCreatesOverflow() {
  withTemporaryCourses({
    'TDD AUD MAJ 10': { title: 'Major Ten', units: 10, quarters: ['F'], prereqs: [], division: 'lower' },
    'TDD AUD GE 5': { title: 'GE Five', units: 5, quarters: ['F'], prereqs: [], ge: 'AH', division: 'lower' },
    'FREE 5': COURSES['FREE 5'] || { title: 'Free Five', units: 5, quarters: ['F', 'W', 'S'], prereqs: [] }
  }, () => {
    const schedule = [{ label: 'Year 1 (Freshman)', academicStart: 2026, levelNum: 1, quarters: { F: ['TDD AUD MAJ 10', 'TDD AUD GE 5', 'FREE 5'], W: [], S: [] } }];
    const typeMap = new Map([['TDD AUD MAJ 10', 'major_core'], ['TDD AUD GE 5', 'ge'], ['FREE 5', 'filler']]);
    const audit = Scheduler.auditSchedulePolicy(schedule, baseProfile(), typeMap);
    const repaired = Scheduler.repairSchedulePolicy(schedule, baseProfile(), typeMap, audit);
    assert(repaired.repairsApplied.some(r => r.action === 'remove_overflow_free_padding'), `expected free-padding removal repair, got ${JSON.stringify(repaired)}`);
    assert(!repaired.schedule[0].quarters.F.includes('FREE 5'), `FREE 5 should be removed from overflowing quarter: ${repaired.schedule[0].quarters.F.join(', ')}`);
    const after = Scheduler.auditSchedulePolicy(repaired.schedule, baseProfile(), typeMap);
    assert(!after.hardErrors.some(err => err.rule === 'over_cap'), `repaired schedule should not be over cap: ${JSON.stringify(after)}`);
  });
}

function testEngineeringSoft20CapIsConsistentAcrossAuditAndRepair() {
  withTemporaryCourses({
    'TDD AUD MAJ 10': { title: 'Major Ten', units: 10, quarters: ['F'], prereqs: [], division: 'lower' },
    'TDD AUD GE 5': { title: 'GE Five', units: 5, quarters: ['F'], prereqs: [], ge: 'AH', division: 'lower' },
    'FREE 5': COURSES['FREE 5'] || { title: 'Free Five', units: 5, quarters: ['F', 'W', 'S'], prereqs: [] }
  }, () => {
    const profile = baseProfile({ major: 'EE_BS', maxUnits: 19 });
    const schedule = [{ label: 'Year 1 (Freshman)', academicStart: 2026, levelNum: 1, quarters: { F: ['TDD AUD MAJ 10', 'TDD AUD GE 5', 'FREE 5'], W: [], S: [] } }];
    const typeMap = new Map([['TDD AUD MAJ 10', 'major_core'], ['TDD AUD GE 5', 'ge'], ['FREE 5', 'filler']]);
    const audit = Scheduler.auditSchedulePolicy(schedule, profile, typeMap);
    assert(!audit.hardErrors.some(err => err.rule === 'over_cap'), `engineering 20-credit quarter should not be audited over cap: ${JSON.stringify(audit)}`);
    assert.strictEqual(audit.quarterDiagnostics[0].loadBand, 'acceptable_high');
    const repaired = Scheduler.repairSchedulePolicy(schedule, profile, typeMap, audit);
    assert(!repaired.repairsApplied.some(r => r.action === 'remove_overflow_free_padding'), `engineering legal soft-20 quarter should not be repaired: ${JSON.stringify(repaired)}`);
    assert(repaired.schedule[0].quarters.F.includes('FREE 5'), `FREE 5 should remain in legal soft-20 engineering quarter: ${repaired.schedule[0].quarters.F.join(', ')}`);
  });
}

const tests = [
  testAuditCatchesOverCapAndDuplicateGEFamily,
  testAuditCatchesFreeBeforeGECompletion,
  testRepairRemovesFreePaddingThatCreatesOverflow,
  testEngineeringSoft20CapIsConsistentAcrossAuditAndRepair
];
let failed = 0;
for (const test of tests) {
  try { test(); console.log(`PASS ${test.name}`); }
  catch (err) { failed++; console.error(`FAIL ${test.name}: ${err.message}`); console.error(err.stack); }
}
if (failed) {
  console.error(`\nSchedule policy audit tests failed: ${failed}/${tests.length}`);
  process.exit(1);
}
console.log(`\nSchedule policy audit tests passed: ${tests.length}/${tests.length}`);
