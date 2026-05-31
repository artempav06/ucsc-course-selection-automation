#!/usr/bin/env node
// test_smoke.js — Smoke test all majors × concentrations for Prototype 2
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const dir = __dirname;
const load = f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), "utf-8"));

load("js/courses.js");
load("js/majors.js");
load("js/data.js");
load("js/engine.js");

const MAJORS = Object.keys(MAJOR_REQUIREMENTS);
let pass = 0, fail = 0;
const failures = [];

function makeProfile(major, concentration, geConcentration) {
  return {
    major, currentLevel: 1, currentTerm: "F", currentYear: 2024,
    targetGradTerm: "S", targetGradYear: 2028, completedCourses: [],
    includeSummer: false, maxUnits: 19, minUnits: 12, concentration, geConcentration,
    elwrSatisfied: false, priorCredits: 0, studentType: "undergrad"
  };
}

function extractPlaced(schedule) {
  const all = [];
  for (const year of schedule)
    for (const q of Object.values(year.quarters))
      all.push(...q.filter(c => c !== "_GAP"));
  return all;
}

function getBalanceMetrics(schedule) {
  const typeMap = schedule.courseTypeMap || new Map();
  const MAJOR_TYPES = new Set(["major_core", "major_elective", "prereq"]);
  const isLabWork = code => {
    const course = COURSES[code];
    if (!course) return false;
    return Boolean(course.labCoreq) || /L$/.test(code) || /laboratory/i.test(course.title || "") || course.units <= 2;
  };
  let totalQ = 0, targetQ = 0, acceptQ = 0, maxMajQ = 0;

  for (const year of schedule) {
    for (const [q, arr] of Object.entries(year.quarters)) {
      if (!arr || arr[0] === "_GAP" || arr.length === 0) continue;
      totalQ++;
      const units = arr.reduce((s, c) => s + (COURSES[c]?.units || 0), 0);
      // Labs/corequisite companions are usually 1–2 unit workload add-ons and
      // should not make an otherwise balanced quarter look like it has four or
      // five full major classes.
      const majCount = arr.filter(c => MAJOR_TYPES.has(typeMap.get(c)) && !isLabWork(c)).length;
      if (units >= 15 && units <= 19) targetQ++;
      if (units >= 12 && units <= 22) acceptQ++;
      if (majCount > maxMajQ) maxMajQ = majCount;
    }
  }
  return {
    targetPct: totalQ > 0 ? Math.round(100 * targetQ / totalQ) : 0,
    acceptPct: totalQ > 0 ? Math.round(100 * acceptQ / totalQ) : 0,
    maxMajQ
  };
}

function checkPrereqOrder(schedule) {
  const completedBefore = new Set();
  const violations = [];
  for (const year of schedule) {
    for (const q of ["F","W","S","SU"]) {
      if (!year.quarters[q]) continue;
      const sameQuarter = new Set(year.quarters[q]);
      const snapshot = new Set(completedBefore);
      for (const code of year.quarters[q]) {
        if (code === "_GAP" || code.startsWith("FREE")) continue;
        const course = COURSES[code];
        if (!course || !course.prereqs) continue;
        const prereqContext = new Set(snapshot);
        if (course.labCoreq && sameQuarter.has(course.labCoreq)) prereqContext.add(course.labCoreq);
        if (!Validator.prereqsMet(course.prereqs, prereqContext)) {
          violations.push(code);
        }
      }
      for (const code of year.quarters[q]) completedBefore.add(code);
    }
  }
  return violations;
}

console.log("Prototype 2 — Smoke Test (Balanced Placement)");
console.log("=".repeat(130));
console.log(
  "Major".padEnd(12) +
  "Concentration".padEnd(25) +
  "GE Conc".padEnd(22) +
  "allMet" .padEnd(8) +
  "Units".padEnd(7) +
  "Years".padEnd(7) +
  "Dupes".padEnd(7) +
  "PrereqV".padEnd(9) +
  "Tgt%".padEnd(6) +
  "Acc%".padEnd(6) +
  "MaxMQ".padEnd(7) +
  "Result"
);
console.log("-".repeat(130));

for (const major of MAJORS) {
  const majorConcs = (CONCENTRATIONS.major[major] || []).map(c => c.id);
  if (majorConcs.length === 0) majorConcs.push(null);
  const geConcs = CONCENTRATIONS.ge.map(g => g.id);

  for (const conc of majorConcs) {
    for (const geC of [geConcs[0], null]) {
      let result = "PASS";
      let details = [];

      try {
        const profile = makeProfile(major, conc, geC);
        const schedule = Scheduler.generate(profile);
        const placed = extractPlaced(schedule);
        const validation = Validator.validateAll(schedule, profile);

        const dupes = placed.filter((c,i) => placed.indexOf(c) !== i);
        const prereqViolations = checkPrereqOrder(schedule);
        const years = schedule.length;
        const bal = getBalanceMetrics(schedule);

        const checks = [];
        if (!validation.allMet) { checks.push("allMet=false"); result = "FAIL"; }
        if (dupes.length > 0) { checks.push(`${dupes.length} dupes`); result = "FAIL"; }
        if (prereqViolations.length > 0) { checks.push(`${prereqViolations.length} prereq violations`); result = "WARN"; }
        if (years > 4) { checks.push(`${years} years`); result = result === "FAIL" ? "FAIL" : "WARN"; }
        if (bal.maxMajQ > 3) { checks.push(`maxMaj=${bal.maxMajQ}`); result = result === "FAIL" ? "FAIL" : "WARN"; }

        if (result === "PASS") pass++;
        else if (result === "FAIL") {
          fail++;
          const failedReqs = [];
          if (!validation.allMajorMet) failedReqs.push("major:" + validation.major.filter(m=>!m.fulfilled).map(m=>m.id).join(","));
          if (!validation.allGEMet) failedReqs.push("GE:" + validation.ge.filter(g=>!g.fulfilled).map(g=>g.id).join(","));
          if (!validation.allUCMet) failedReqs.push("UC:" + validation.uc.filter(u=>!u.fulfilled).map(u=>u.id).join(","));
          if (!validation.totalUnitsMet) failedReqs.push("units:" + validation.totalUnits);
          if (!validation.upperDivMet) failedReqs.push("UD:" + validation.upperDivUnits);
          failures.push({ major, conc, geC, issues: checks.join("; "), failedReqs: failedReqs.join("; ") });
        } else { pass++; } // WARN counts as pass

        console.log(
          (major).padEnd(12) +
          (conc || "none").padEnd(25) +
          (geC || "none").padEnd(22) +
          (validation.allMet ? "YES" : "NO").padEnd(8) +
          String(validation.totalUnits).padEnd(7) +
          String(years).padEnd(7) +
          String(dupes.length).padEnd(7) +
          String(prereqViolations.length).padEnd(9) +
          (bal.targetPct + "%").padEnd(6) +
          (bal.acceptPct + "%").padEnd(6) +
          String(bal.maxMajQ).padEnd(7) +
          result + (checks.length > 0 ? " (" + checks.join("; ") + ")" : "")
        );
      } catch (e) {
        fail++;
        failures.push({ major, conc, geC, issues: "CRASH: " + e.message });
        console.log(
          (major).padEnd(12) +
          (conc || "none").padEnd(25) +
          (geC || "none").padEnd(22) +
          "---".padEnd(8) + "---".padEnd(7) + "---".padEnd(7) + "---".padEnd(7) + "---".padEnd(9) + "---".padEnd(6) + "---".padEnd(6) + "---".padEnd(7) +
          "CRASH: " + e.message.slice(0, 60)
        );
      }
    }
  }
}

console.log("\n" + "=".repeat(100));
console.log(`Results: ${pass} passed, ${fail} failed out of ${pass + fail} total`);

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  ${f.major} / ${f.conc || "none"} / ${f.geC || "none"}: ${f.issues}`);
    if (f.failedReqs) console.log(`    → ${f.failedReqs}`);
  }
}
