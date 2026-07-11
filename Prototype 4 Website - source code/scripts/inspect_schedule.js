#!/usr/bin/env node
// inspect_schedule.js — Diagnostic dump for Prototype 4 scheduler decisions.
// Usage: node scripts/inspect_schedule.js [MAJOR_ID] [CONCENTRATION_ID]
// Defaults: CS_BA cs_ai_ml

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const dir = path.join(__dirname, "..");
const load = f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), "utf-8"), { filename: f });

load("js/courses.js");
load("js/majors.js");
load("js/data.js");
load("js/engine/requirement-normalizer.js");
load("js/engine/requirement-collector.js");
load("js/engine.js");

const majorId = process.argv[2] || "CS_BA";
const concId  = process.argv[3] || "cs_ai_ml";

const profile = {
  major: majorId, currentLevel: 1, currentTerm: "F", currentYear: 2024,
  targetGradTerm: "S", targetGradYear: 2028, completedCourses: [],
  includeSummer: false, maxUnits: 19, minUnits: 12,
  concentration: concId, geConcentration: "ge_arts_humanities",
  elwrSatisfied: false, priorCredits: 0, studentType: "undergrad"
};

const { schedule, explanation } = Scheduler.generateWithExplanation(profile);
const validation = explanation.validation || Validator.validateAll(schedule, profile);
const phases = explanation.phases;
const out = [];
const P = s => out.push(s);
const list = courses => (courses && courses.length ? courses.join(", ") : "(none)");
const units = courses => (courses || []).reduce((sum, code) => sum + (COURSES[code]?.units || 0), 0);

P("=".repeat(100));
P(`SCHEDULER EXPLANATION: ${majorId} + ${concId}`);
P("Profile: Freshman, F2024→S2028, maxUnits=19, minUnits=12, no summer, no completed");
P("=".repeat(100));

P("\n── PHASE BREAKDOWN ──");
P(`Phase 1 (Major selection): ${phases.majorSelection.count} courses, ${phases.majorSelection.units} units`);
P(`  Types: ${JSON.stringify(phases.majorSelection.courseTypes)}`);
P(`  Courses: ${list(phases.majorSelection.courses)}`);
P(`Phase 2 (GE selection):    ${phases.geSelection.count} courses, ${phases.geSelection.units} units`);
P(`  Courses: ${list(phases.geSelection.courses)}`);
P(`Phase 3 (UC selection):    ${phases.ucSelection.count} courses, ${phases.ucSelection.units} units`);
P(`  Courses: ${list(phases.ucSelection.courses)}`);
P(`Phase 4 (Prereqs):         ${phases.prerequisiteExpansion.count} courses, ${phases.prerequisiteExpansion.units} units`);
P(`  Courses: ${list(phases.prerequisiteExpansion.courses)}`);
P(`Phase 5 (UD supplement):   ${phases.upperDivisionSupplement.count} courses, ${phases.upperDivisionSupplement.units} units (${phases.upperDivisionSupplement.upperDivUnits} UD)`);
P(`  Courses: ${list(phases.upperDivisionSupplement.courses)}`);
P(`Phase 6 (FREE padding):    ${phases.freePadding.count} courses, ${phases.freePadding.units} units (target ${phases.freePadding.targetUnits})`);
P(`  Courses: ${list(phases.freePadding.courses)}`);
P(`Phase 7 (Filler pool):     ${phases.fillerPool.count} candidates`);
P(`Phase 8 (Placement):       ${phases.placement.remainingCount} courses queued, ${phases.placement.scheduledCount} scheduled, ${phases.placement.years} years`);
P(`  Final placed type counts: ${JSON.stringify(phases.placement.courseTypes)}`);

P("\n── TOTALS ──");
P(`Selected units before placement: ${explanation.totals.selectedUnitsBeforePlacement}`);
P(`Scheduled/completed units:       ${explanation.totals.scheduledUnits}`);
P(`Validation total units:          ${validation.totalUnits}`);
P(`Upper-division units:            ${validation.upperDivUnits}`);
P(`Prior credits:                   ${validation.priorCredits}`);
P(`Schedule spans:                  ${schedule.length} years`);

const seen = new Set();
const dupes = [];
for (const c of phases.placement.scheduledCourses) {
  if (seen.has(c)) dupes.push(c);
  seen.add(c);
}
P("\n── DUPLICATES ──");
P(dupes.length === 0 ? "None found." : `DUPLICATES: ${dupes.join(", ")}`);

P("\n── SCHEDULE (quarter by quarter) ──");
const typeMap = schedule.courseTypeMap || new Map();
for (const year of schedule) {
  P(`\n${year.label} (${year.academicStart}–${year.academicStart + 1})`);
  for (const [q, arr] of Object.entries(year.quarters)) {
    if (!arr || arr[0] === "_GAP") { P(`  ${q}: [GAP]`); continue; }
    if (arr.length === 0) { P(`  ${q}: [empty]`); continue; }
    const qUnits = units(arr);
    P(`  ${q}: ${qUnits} units`);
    for (const code of arr) {
      const c = COURSES[code];
      const type = typeMap.get(code) || "?";
      P(`    ${code.padEnd(14)} ${String(c?.units || 0).padStart(2)}u  ${(c?.division || "?").padEnd(5)}  [${type.padEnd(14)}]  ${c?.title || ""}`);
    }
  }
}

P("\n── REQUIREMENT SATISFACTION ──");
P(`allMet: ${validation.allMet}`);
P(`  Major: ${validation.allMajorMet}  GE: ${validation.allGEMet}  UC: ${validation.allUCMet}`);
P(`  totalUnits: ${validation.totalUnits} (need ${validation.majorReqs.totalUnitsRequired})  upperDiv: ${validation.upperDivUnits} (need ${validation.majorReqs.minUpperDivUnits})`);

P("\nMajor categories:");
for (const r of validation.major) {
  P(`  ${r.fulfilled ? "✓" : "✗"} ${r.id.padEnd(20)} ${r.fulfilledCount}/${r.neededCount}  courses: ${r.selectedCourses.join(", ")}`);
  if (r.missing && r.missing.length > 0) P(`    MISSING: ${r.missing.join(", ")}`);
}

P("\nGE categories:");
for (const r of validation.ge)
  P(`  ${r.fulfilled ? "✓" : "✗"} ${r.id.padEnd(5)} ${r.name.padEnd(35)} courses: ${r.courses.join(", ")}`);

P("\nUC requirements:");
for (const r of validation.uc)
  P(`  ${r.fulfilled ? "✓" : "✗"} ${r.id.padEnd(6)} ${r.name.padEnd(25)} courses: ${r.courses.join(", ")}`);

const output = out.join("\n");
console.log(output);

const outDir = path.join(__dirname, "output");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const filename = `${majorId.toLowerCase()}_${concId.replace(/^[a-z]+_/, "")}_dump.txt`;
fs.writeFileSync(path.join(outDir, filename), output, "utf-8");
console.log(`\nSaved to scripts/output/${filename}`);
