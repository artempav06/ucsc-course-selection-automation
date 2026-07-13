#!/usr/bin/env node
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const dir = __dirname;
const load = f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), "utf-8"));

load("js/courses.js");
load("js/majors.js");
load("js/data.js");
load("js/engine/requirement-normalizer.js");
load("js/engine/requirement-collector.js");
load("js/engine.js");

// Test 1: topoSort dedup
const coreCourses = [
  "MATH 19A","MATH 19B","CSE 20","CSE 30","CSE 12","CSE 16",
  "AM 10","CSE 13S","CSE 40","CSE 101",
  "CSE 110A","CSE 115A","CSE 130","CSE 140","CSE 142","CSE 143",
  "CSE 144","CSE 145","CSE 150"
];
const sorted = Scheduler.topoSort(coreCourses, new Set());
console.log(`topoSort: ${coreCourses.length} in → ${sorted.length} out`);
const dupes = sorted.filter((c,i) => sorted.indexOf(c) !== i);
if (dupes.length > 0) {
  console.log("FAIL: duplicates found:", dupes);
  process.exit(1);
} else {
  console.log("PASS: no duplicates");
}

// Test 2: generate CS_BA schedule
const profile = {
  major: "CS_BA",
  currentLevel: 1,
  currentTerm: "F",
  currentYear: 2024,
  targetGradTerm: "S",
  targetGradYear: 2028,
  completedCourses: [],
  includeSummer: false,
  maxUnits: 15,
  concentration: "cs_ai_ml",
  geConcentration: "ge_arts_humanities",
  elwrSatisfied: false,
  priorCredits: 0,
  studentType: "undergrad"
};

const schedule = Scheduler.generate(profile);
const allPlaced = [];
for (const year of schedule)
  for (const q of Object.values(year.quarters))
    allPlaced.push(...q);

const placedDupes = allPlaced.filter((c,i) => allPlaced.indexOf(c) !== i && c !== "_GAP");
console.log(`\nCS_BA schedule: ${allPlaced.length} courses placed`);
if (placedDupes.length > 0) {
  console.log("FAIL: duplicate placements:", [...new Set(placedDupes)]);
} else {
  console.log("PASS: no duplicate placements");
}

const validation = Validator.validateAll(schedule, profile);
console.log(`Total units: ${validation.totalUnits}`);
console.log(`All major met: ${validation.allMajorMet}`);
console.log(`All GE met: ${validation.allGEMet}`);
console.log(`All UC met: ${validation.allUCMet}`);
console.log(`Units met: ${validation.totalUnitsMet}`);
console.log(`UD met: ${validation.upperDivMet}`);
console.log(`allMet: ${validation.allMet}`);

// Show failed GE
const failedGE = validation.ge.filter(g => !g.fulfilled);
if (failedGE.length > 0) {
  console.log("\nFailed GE requirements:");
  failedGE.forEach(g => console.log(`  ${g.id}: ${g.name}`));
}

// Show failed major
const failedMaj = validation.major.filter(m => !m.fulfilled);
if (failedMaj.length > 0) {
  console.log("\nFailed major requirements:");
  failedMaj.forEach(m => console.log(`  ${m.id}: ${m.name} (${m.fulfilledCount}/${m.neededCount})`));
}

// Print schedule overview
console.log("\nSchedule overview:");
for (const year of schedule) {
  console.log(`  ${year.label}:`);
  for (const [q, courses] of Object.entries(year.quarters)) {
    const units = courses.reduce((s,c) => s + (COURSES[c]?.units || 0), 0);
    console.log(`    ${q}: [${courses.join(", ")}] (${units}u)`);
  }
}
