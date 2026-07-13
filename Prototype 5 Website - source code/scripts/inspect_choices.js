#!/usr/bin/env node
// inspect_choices.js — Audit pick_one/choose_group violations and redundant courses
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const dir = path.join(__dirname, "..");
const load = f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), "utf-8"));

load("js/courses.js");
load("js/majors.js");
load("js/data.js");
load("js/engine/requirement-normalizer.js");
load("js/engine/requirement-collector.js");
load("js/engine.js");

const out = [];
const P = s => out.push(s);

const MAJORS = Object.keys(MAJOR_REQUIREMENTS);

const summary = [];

for (const majorId of MAJORS) {
  const concs = (typeof CONCENTRATIONS !== "undefined" && CONCENTRATIONS.major[majorId]) || [];
  const concId = concs.length > 0 ? concs[0].id : null;
  const reqs = MAJOR_REQUIREMENTS[majorId];

  const profile = {
    major: majorId, currentLevel: 1, currentTerm: "F", currentYear: 2024,
    targetGradTerm: "S", targetGradYear: 2028, completedCourses: [],
    includeSummer: false, maxUnits: 19, minUnits: 12,
    concentration: concId, geConcentration: "ge_arts_humanities",
    elwrSatisfied: false, priorCredits: 0, studentType: "undergrad"
  };

  const schedule = Scheduler.generate(profile);
  const typeMap = schedule.courseTypeMap || new Map();

  const placed = [];
  for (const year of schedule)
    for (const arr of Object.values(year.quarters))
      placed.push(...arr.filter(c => c !== "_GAP"));
  const placedSet = new Set(placed);

  P("=" .repeat(100));
  P(`${majorId} (${concId || "none"}) — ${placed.length} courses, ${placed.reduce((s, c) => s + (COURSES[c]?.units || 0), 0)}u, ${schedule.length} years`);
  P("=" .repeat(100));

  let pickOneViolations = 0;
  let chooseGroupViolations = 0;
  let extraUnits = 0;

  // --- Pick-one violations ---
  P("\n  Pick-one categories:");
  for (const cat of reqs.categories) {
    if (cat.type !== "pick_one") continue;
    const present = (cat.courses || []).filter(c => placedSet.has(c));
    const status = present.length > 1 ? "VIOLATION" : "ok";
    if (present.length > 1) {
      pickOneViolations++;
      const excess = present.slice(1);
      extraUnits += excess.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
      P(`    ${status} ${cat.id}: ${present.length}/${cat.courses.length} placed → ${present.join(", ")}`);
      P(`      Excess: ${excess.join(", ")} (${excess.reduce((s, c) => s + (COURSES[c]?.units || 0), 0)}u)`);
      for (const c of excess) P(`        ${c} type=${typeMap.get(c) || "??"}`);
    } else {
      P(`    ${status} ${cat.id}: ${present.length}/${cat.courses.length} → ${present.join(", ") || "(none)"}`);
    }
  }

  // --- Choose-group violations ---
  P("\n  Choose-group categories:");
  for (const cat of reqs.categories) {
    if (cat.type !== "choose_group") continue;
    const groupsPresent = (cat.groups || []).filter(g => g.courses.some(c => placedSet.has(c)));
    if (groupsPresent.length > 1) {
      // Check if non-primary groups have courses NOT shared with the primary group
      const primaryCourses = new Set(groupsPresent[0].courses);
      let hasUniqueExtras = false;
      for (let gi = 1; gi < groupsPresent.length; gi++) {
        const uniqueExtras = groupsPresent[gi].courses.filter(c => placedSet.has(c) && !primaryCourses.has(c));
        if (uniqueExtras.length > 0) hasUniqueExtras = true;
      }
      if (hasUniqueExtras) chooseGroupViolations++;
      const label = hasUniqueExtras ? "VIOLATION" : "SHARED-OK";
      P(`    ${label} ${cat.id}: ${groupsPresent.length} groups present`);
      for (const g of groupsPresent) {
        const present = g.courses.filter(c => placedSet.has(c));
        const excess = g === groupsPresent[0] ? [] : present.filter(c => !primaryCourses.has(c));
        extraUnits += excess.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
        P(`      "${g.label}": ${present.join(", ")} ${g === groupsPresent[0] ? "(selected)" : excess.length > 0 ? "(EXTRA)" : "(shared only)"}`);
        for (const c of excess) P(`        ${c} type=${typeMap.get(c) || "??"}`);
      }
    } else {
      const gName = groupsPresent.length > 0 ? groupsPresent[0].label : "(none)";
      P(`    ok ${cat.id}: 1 group → "${gName}"`);
    }
  }

  // --- Redundant courses (Bug B: one course could satisfy multiple requirements) ---
  P("\n  Redundant courses (multi-coverage missed):");
  let redundantCount = 0;

  // Check UC: did we pick courses that are already covered by GE picks?
  const gePicks = placed.filter(c => typeMap.get(c) === "ge");
  const ucPicks = placed.filter(c => typeMap.get(c) === "uc");

  // For each UC pick, check if a GE pick already covers that UC requirement
  for (const ucCode of ucPicks) {
    for (const ucReq of UC_REQUIREMENTS) {
      if (!ucReq.courses.includes(ucCode)) continue;
      // Check if any GE pick also satisfies this UC requirement
      for (const geCode of gePicks) {
        if (ucReq.courses.includes(geCode) ||
            (COURSES[geCode]?.alsoSatisfies || []).includes(ucReq.id)) {
          P(`    REDUNDANT: UC ${ucReq.id} satisfied by GE pick ${geCode}, but also picked ${ucCode}`);
          redundantCount++;
        }
      }
      // Check if another UC pick already covers it
      for (const otherUC of ucPicks) {
        if (otherUC === ucCode) continue;
        if (ucReq.courses.includes(otherUC) ||
            (COURSES[otherUC]?.alsoSatisfies || []).includes(ucReq.id)) {
          P(`    REDUNDANT: UC ${ucReq.id} already covered by ${otherUC}, but also picked ${ucCode}`);
          redundantCount++;
        }
      }
    }
  }

  // Check GE: could a different course have covered both GE and UC?
  for (const ge of GE_REQUIREMENTS) {
    const gePick = gePicks.find(c => {
      const course = COURSES[c];
      if (!course) return false;
      if (course.ge === ge.id) return true;
      if (ge.subcategories && ge.subcategories.includes(course.ge)) return true;
      if (ge.autoSatisfiedBy && ge.autoSatisfiedBy.includes(c)) return true;
      return false;
    });
    if (!gePick) continue;

    // Does this GE pick also satisfy any UC requirement?
    const geCoversUC = [];
    for (const ucReq of UC_REQUIREMENTS) {
      if (ucReq.courses.includes(gePick) ||
          (COURSES[gePick]?.alsoSatisfies || []).includes(ucReq.id)) {
        geCoversUC.push(ucReq.id);
      }
    }

    // Check: are there alternative GE candidates that would cover MORE UC requirements?
    const candidates = (ge.courses || []).filter(c => COURSES[c]);
    for (const alt of candidates) {
      if (alt === gePick) continue;
      const altCoversUC = [];
      for (const ucReq of UC_REQUIREMENTS) {
        if (ucReq.courses.includes(alt) ||
            (COURSES[alt]?.alsoSatisfies || []).includes(ucReq.id)) {
          altCoversUC.push(ucReq.id);
        }
      }
      if (altCoversUC.length > geCoversUC.length) {
        P(`    MISSED-COVERAGE: GE ${ge.id} picked ${gePick} (covers UC: ${geCoversUC.join(",") || "none"}), but ${alt} would cover UC: ${altCoversUC.join(",")}`);
        redundantCount++;
      }
    }
  }

  if (redundantCount === 0) P("    (none detected)");

  const totalUnits = placed.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
  summary.push({
    major: majorId, conc: concId, pickOneViolations, chooseGroupViolations,
    redundantCount, extraUnits, totalUnits, years: schedule.length,
    placed: placed.length
  });
}

P("\n\n" + "=" .repeat(120));
P("SUMMARY TABLE");
P("=" .repeat(120));
P(
  "Major".padEnd(12) +
  "Concentration".padEnd(25) +
  "PO_Viol".padEnd(9) +
  "CG_Viol".padEnd(9) +
  "Redundant".padEnd(11) +
  "ExtraU".padEnd(8) +
  "Placed".padEnd(8) +
  "Units".padEnd(7) +
  "Years"
);
P("-".repeat(120));

for (const s of summary) {
  P(
    s.major.padEnd(12) +
    (s.conc || "none").padEnd(25) +
    String(s.pickOneViolations).padEnd(9) +
    String(s.chooseGroupViolations).padEnd(9) +
    String(s.redundantCount).padEnd(11) +
    String(s.extraUnits).padEnd(8) +
    String(s.placed).padEnd(8) +
    String(s.totalUnits).padEnd(7) +
    String(s.years)
  );
}

const totalPO = summary.reduce((s, r) => s + r.pickOneViolations, 0);
const totalCG = summary.reduce((s, r) => s + r.chooseGroupViolations, 0);
const totalRedundant = summary.reduce((s, r) => s + r.redundantCount, 0);
P("\nTotals: " + totalPO + " pick_one violations, " + totalCG + " choose_group violations, " + totalRedundant + " redundant courses");

const output = out.join("\n");
console.log(output);

const outDir = path.join(__dirname, "output");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "choice_audit.txt"), output, "utf-8");
console.log("\nSaved to scripts/output/choice_audit.txt");
