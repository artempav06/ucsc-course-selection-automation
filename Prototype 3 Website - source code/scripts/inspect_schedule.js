#!/usr/bin/env node
// inspect_schedule.js — Deep diagnostic dump for the 5-year-bug investigation
// Usage: node scripts/inspect_schedule.js [MAJOR_ID] [CONCENTRATION_ID]
// Defaults: CS_BA cs_ai_ml

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const dir = path.join(__dirname, "..");
const load = f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), "utf-8"));

load("js/courses.js");
load("js/majors.js");
load("js/data.js");
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

// ── Instrument generate() to capture per-phase data ──

const origGenerate = Scheduler.generate.bind(Scheduler);
const origSupplement = Scheduler.supplementUpperDiv.bind(Scheduler);
const origExpand = Scheduler.expandPrereqs.bind(Scheduler);

let phaseData = {};

Scheduler.generate = function(prof) {
  const completedSet = new Set(prof.completedCourses || []);
  const used = new Set(completedSet);
  const concentration   = prof.concentration   || null;
  const geConcentration = prof.geConcentration || null;
  const majorReqId = (prof && prof.major) || "CS_BA";
  const reqs = MAJOR_REQUIREMENTS[majorReqId] || CS_BA_REQUIREMENTS;

  const selected = [];
  const courseTypeMap = new Map();
  const pushTagged = (code, type) => {
    if (code && COURSES[code] && !used.has(code)) {
      selected.push(code); used.add(code); courseTypeMap.set(code, type);
    }
  };

  // Phase 1: Walk major categories
  const CAT_PRIORITY = { all_required: 0, choose_group: 1, pick_one: 2, pick_n: 3 };
  const sortedCats = [...(reqs.categories || [])].sort(
    (a, b) => (CAT_PRIORITY[a.type] ?? 3) - (CAT_PRIORITY[b.type] ?? 3)
  );
  const chooseGroupCourses = new Set();
  for (const cat of sortedCats)
    if (cat.type === "choose_group")
      for (const g of (cat.groups || [])) (g.courses || []).forEach(c => chooseGroupCourses.add(c));

  for (const cat of sortedCats)
    this.walk(cat, completedSet, used, concentration, chooseGroupCourses, pushTagged);

  phaseData.phase1 = [...selected];
  phaseData.phase1Units = selected.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
  phaseData.phase1UD = selected.filter(c => COURSES[c]?.division === "upper")
    .reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
  phaseData.phase1Types = {};
  for (const c of selected) {
    const t = courseTypeMap.get(c) || "unknown";
    phaseData.phase1Types[t] = (phaseData.phase1Types[t] || 0) + 1;
  }

  // Phase 2: GE
  const gePicks = this.pickGE(used, completedSet, geConcentration);
  gePicks.forEach(c => { if (c && COURSES[c]) { selected.push(c); courseTypeMap.set(c, "ge"); } });
  phaseData.phase2 = [...gePicks];
  phaseData.phase2Units = gePicks.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);

  // Phase 3: UC
  const ucPicks = this.pickUC(used, prof);
  ucPicks.forEach(c => { selected.push(c); used.add(c); courseTypeMap.set(c, "uc"); });
  phaseData.phase3 = [...ucPicks];
  phaseData.phase3Units = ucPicks.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);

  // Phase 4: Expand prereqs
  const beforeExpand = [...selected];
  const prereqAdded = this.expandPrereqs(selected, completedSet, used);
  prereqAdded.forEach(c => pushTagged(c, "prereq"));
  phaseData.phase4 = [...prereqAdded];
  phaseData.phase4Units = prereqAdded.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);

  // Capture UD before supplement
  phaseData.udBeforeSupplement = selected.filter(c => COURSES[c]?.division === "upper")
    .reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
  phaseData.totalBeforeSupplement = selected.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
  phaseData.countBeforeSupplement = selected.length;

  // Phase 5: Upper-div supplement (THE BUG)
  const udAdded = [];
  this.supplementUpperDiv(udAdded, [], used, completedSet, reqs, majorReqId);
  udAdded.forEach(c => { selected.push(c); courseTypeMap.set(c, "filler"); });
  phaseData.phase5 = [...udAdded];
  phaseData.phase5Units = udAdded.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
  phaseData.phase5UD = udAdded.filter(c => COURSES[c]?.division === "upper")
    .reduce((s, c) => s + (COURSES[c]?.units || 0), 0);

  phaseData.udAfterSupplement = selected.filter(c => COURSES[c]?.division === "upper")
    .reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
  phaseData.totalAfterSupplement = selected.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);

  // Phase 6: FREE pad
  const targetUnits = reqs.totalUnitsRequired || 180;
  let total = this._countUnits(selected, completedSet, prof);
  const freeAdded = [];
  for (let i = 1; i <= 30 && total < targetUnits; i++) {
    const code = `FREE ${i}`;
    if (COURSES[code] && !used.has(code)) {
      pushTagged(code, "filler"); total += COURSES[code].units;
      freeAdded.push(code);
    }
  }
  phaseData.phase6 = [...freeAdded];
  phaseData.phase6Units = freeAdded.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
  phaseData.totalAfterFREE = selected.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);

  // Phase 7: Filler pool
  const fillerPool = this.buildFillerPool(prof, used);
  phaseData.fillerPoolSize = fillerPool.length;

  // Phase 8: Place
  const remaining = selected.filter(c => !completedSet.has(c));
  phaseData.remainingForPlacement = remaining.length;
  phaseData.remainingUnits = remaining.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);

  const schedule = this.placeIntoQuarters(remaining, courseTypeMap, fillerPool, completedSet, prof);
  schedule.courseTypeMap = courseTypeMap;

  // Count fillers added during placement (Phase D)
  const allPlaced = [];
  for (const year of schedule)
    for (const arr of Object.values(year.quarters))
      allPlaced.push(...arr.filter(c => c !== "_GAP"));
  const placementFillers = allPlaced.filter(c => !remaining.includes(c) && !completedSet.has(c));
  phaseData.placementFillers = placementFillers;
  phaseData.placementFillerUnits = placementFillers.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);

  phaseData.schedule = schedule;
  phaseData.courseTypeMap = courseTypeMap;
  phaseData.allPlaced = allPlaced;
  phaseData.selected = selected;
  return schedule;
};

// ── Run ──
const schedule = Scheduler.generate(profile);
const validation = Validator.validateAll(schedule, profile);

const out = [];
const P = s => out.push(s);

P("=" .repeat(100));
P(`INVESTIGATION DUMP: ${majorId} + ${concId}`);
P(`Profile: Freshman, F2024→S2028, maxUnits=19, minUnits=12, no summer, no completed`);
P("=" .repeat(100));

P("\n── PHASE BREAKDOWN ──");
P(`Phase 1 (Major walk):     ${phaseData.phase1.length} courses, ${phaseData.phase1Units} units (${phaseData.phase1UD} UD)`);
P(`  Types: ${JSON.stringify(phaseData.phase1Types)}`);
P(`  Courses: ${phaseData.phase1.join(", ")}`);
P(`Phase 2 (GE):             ${phaseData.phase2.length} courses, ${phaseData.phase2Units} units`);
P(`  Courses: ${phaseData.phase2.join(", ")}`);
P(`Phase 3 (UC):             ${phaseData.phase3.length} courses, ${phaseData.phase3Units} units`);
P(`  Courses: ${phaseData.phase3.join(", ")}`);
P(`Phase 4 (Prereq expand):  ${phaseData.phase4.length} courses, ${phaseData.phase4Units} units`);
P(`  Courses: ${phaseData.phase4.join(", ") || "(none)"}`);

P("\n── THE BUG: supplementUpperDiv ──");
P(`Before Phase 5: ${phaseData.countBeforeSupplement} courses, ${phaseData.totalBeforeSupplement} units total, ${phaseData.udBeforeSupplement} UD units`);
P(`Phase 5 (UD supplement):  ${phaseData.phase5.length} courses, ${phaseData.phase5Units} units (${phaseData.phase5UD} UD)`);
P(`  supplementUpperDiv saw curUD=0 (bug: counted from empty udAdded[], not selected[])`);
P(`  Actually had ${phaseData.udBeforeSupplement} UD units already → only needed ${Math.max(0, 60 - phaseData.udBeforeSupplement)} more`);
P(`  EXCESS: ${phaseData.phase5Units - Math.max(0, (60 - phaseData.udBeforeSupplement) * 1)} units added unnecessarily`);
P(`  Courses: ${phaseData.phase5.join(", ")}`);
P(`After Phase 5: ${phaseData.totalAfterSupplement} units total, ${phaseData.udAfterSupplement} UD units`);

P("\n── PHASES 6-8 ──");
P(`Phase 6 (FREE pad):       ${phaseData.phase6.length} courses, ${phaseData.phase6Units} units (target was 180)`);
P(`Phase 7 (Filler pool):    ${phaseData.fillerPoolSize} candidates built`);
P(`Phase 8 (Placement):      ${phaseData.remainingForPlacement} courses, ${phaseData.remainingUnits} units to place`);
P(`  Fillers added during placement: ${phaseData.placementFillers.length} courses, ${phaseData.placementFillerUnits} units`);
if (phaseData.placementFillers.length > 0)
  P(`  Placement fillers: ${phaseData.placementFillers.join(", ")}`);

P("\n── TOTALS ──");
const totalPlacedUnits = phaseData.allPlaced.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
P(`Total placed: ${phaseData.allPlaced.length} courses, ${totalPlacedUnits} units`);
P(`totalUnitsRequired: 180`);
P(`EXCESS: ${totalPlacedUnits - 180} units over target`);
P(`Schedule spans: ${schedule.length} years`);

// Duplicates
const seen = new Set();
const dupes = [];
for (const c of phaseData.allPlaced) {
  if (seen.has(c)) dupes.push(c);
  seen.add(c);
}
P(`\n── DUPLICATES ──`);
P(dupes.length === 0 ? "None found." : `DUPLICATES: ${dupes.join(", ")}`);

// Quarter-by-quarter
P("\n── SCHEDULE (quarter by quarter) ──");
const typeMap = phaseData.courseTypeMap;
for (const year of schedule) {
  P(`\n${year.label} (${year.academicStart}–${year.academicStart + 1})`);
  for (const [q, arr] of Object.entries(year.quarters)) {
    if (!arr || arr[0] === "_GAP") { P(`  ${q}: [GAP]`); continue; }
    if (arr.length === 0) { P(`  ${q}: [empty]`); continue; }
    const qUnits = arr.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
    P(`  ${q}: ${qUnits} units`);
    for (const code of arr) {
      const c = COURSES[code];
      const type = typeMap.get(code) || "?";
      P(`    ${code.padEnd(14)} ${String(c?.units || 0).padStart(2)}u  ${(c?.division || "?").padEnd(5)}  [${type.padEnd(14)}]  ${c?.title || ""}`);
    }
  }
}

// Requirement satisfaction
P("\n── REQUIREMENT SATISFACTION ──");
P(`allMet: ${validation.allMet}`);
P(`  Major: ${validation.allMajorMet}  GE: ${validation.allGEMet}  UC: ${validation.allUCMet}`);
P(`  totalUnits: ${validation.totalUnits} (need 180)  upperDiv: ${validation.upperDivUnits} (need 60)`);

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

// Save to file
const outDir = path.join(__dirname, "output");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const filename = `${majorId.toLowerCase()}_${concId.replace(/^[a-z]+_/, "")}_dump.txt`;
fs.writeFileSync(path.join(outDir, filename), output, "utf-8");
console.log(`\nSaved to scripts/output/${filename}`);
