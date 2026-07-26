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

function summerYears(schedule) {
  return schedule
    .filter(year => Object.prototype.hasOwnProperty.call(year.quarters, 'SU'))
    .map(year => year.academicStart + 1);
}

const selective = Scheduler.buildYearSkeleton('F', 2026, 'S', 2030, 1, 'undergrad', true, [2027, 2029]);
assert.deepStrictEqual(
  summerYears(selective),
  [2027, 2029],
  'specific summer-year choices should include only the selected summer quarters'
);

const allSummer = Scheduler.buildYearSkeleton('F', 2026, 'S', 2030, 1, 'undergrad', true);
assert.deepStrictEqual(
  summerYears(allSummer),
  [2027, 2028, 2029],
  'includeSummer without specific years should preserve the old all-summers behavior'
);

const profile = {
  major: 'CS_BA',
  currentLevel: 1,
  currentTerm: 'F',
  currentYear: 2026,
  targetGradTerm: 'S',
  targetGradYear: 2030,
  completedCourses: [],
  includeSummer: true,
  summerYears: [2027, 2029],
  maxUnits: 19,
  minUnits: 12,
  concentration: null,
  geConcentration: 'ge_arts_humanities',
  elwrSatisfied: false,
  priorCredits: 0,
  studentType: 'undergrad'
};
const schedule = Scheduler.generate(profile);
assert.deepStrictEqual(
  summerYears(schedule),
  [2027, 2029],
  'generated schedules should pass selected summer years into the engine skeleton'
);
console.log('3/3 summer year selection tests passed');
