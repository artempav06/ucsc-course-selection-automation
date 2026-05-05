// test_all_majors.js — Automated smoke test for all 10 majors
// Run: node test_all_majors.js

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const jsDir = path.join(__dirname, "js");

function loadFile(name) {
  const code = fs.readFileSync(path.join(jsDir, name), "utf-8");
  vm.runInThisContext(code, { filename: name });
}

// Load in dependency order (same as index.html)
loadFile("courses.js");
loadFile("majors.js");
loadFile("data.js");
loadFile("engine.js");

// ── Test infrastructure ──

let totalPass = 0;
let totalFail = 0;
const failures = [];

function assert(condition, label, majorId) {
  if (condition) {
    totalPass++;
  } else {
    totalFail++;
    failures.push(`  [FAIL] ${majorId}: ${label}`);
  }
}

// ── Default profile for a standard 4-year plan ──

function makeProfile(majorId, overrides = {}) {
  return {
    major: majorId,
    degreeType: majorId.endsWith("_BA") ? "BA" : "BS",
    studentType: "undergrad",
    currentLevel: 1,       // Freshman
    currentTerm: "F",
    currentYear: 2026,
    targetGradTerm: "S",
    targetGradYear: 2030,
    maxUnits: 17,
    includeSummer: false,
    completedCourses: [],
    interests: [],
    geInterests: [],
    priorCredits: 0,
    elwrSatisfied: false,
    profImportance: "medium",
    autoSuggest: true,
    gapEnabled: false,
    ...overrides,
  };
}

// ── Collect all courses from a schedule into a flat list ──

function allCoursesFromSchedule(schedule) {
  const all = [];
  for (const year of schedule) {
    for (const [q, courses] of Object.entries(year.quarters)) {
      for (const code of courses) {
        if (code === "_GAP") continue;
        all.push({ code, year: year.academicStart, quarter: q, levelNum: year.levelNum });
      }
    }
  }
  return all;
}

// ── Count total units in a schedule ──

function totalUnitsInSchedule(schedule) {
  let units = 0;
  for (const year of schedule) {
    for (const courses of Object.values(year.quarters)) {
      for (const code of courses) {
        if (code === "_GAP") continue;
        if (COURSES[code]) units += COURSES[code].units;
      }
    }
  }
  return units;
}

// ── Check quarter units don't exceed max ──

function maxQuarterUnits(schedule) {
  let max = 0;
  for (const year of schedule) {
    for (const [q, courses] of Object.entries(year.quarters)) {
      let qUnits = 0;
      for (const code of courses) {
        if (code === "_GAP") continue;
        if (COURSES[code]) qUnits += COURSES[code].units;
      }
      if (qUnits > max) max = qUnits;
    }
  }
  return max;
}

// ── Check for duplicate courses ──

function findDuplicates(schedule) {
  const seen = new Set();
  const dupes = [];
  for (const year of schedule) {
    for (const courses of Object.values(year.quarters)) {
      for (const code of courses) {
        if (code === "_GAP") continue;
        if (seen.has(code)) dupes.push(code);
        seen.add(code);
      }
    }
  }
  return dupes;
}

// ── Check prerequisite ordering ──
// Prerequisites must be completed in a PRIOR quarter (strict check).

function findPrereqViolations(schedule) {
  const completed = new Set();
  const violations = [];
  for (const year of schedule) {
    for (const q of ["F", "W", "S", "SU"]) {
      const courses = year.quarters[q];
      if (!courses) continue;
      for (const code of courses) {
        if (code === "_GAP") continue;
        const course = COURSES[code];
        if (course && course.prereqs && course.prereqs.length > 0) {
          const met = course.prereqs.every(orGroup =>
            orGroup.some(prereq => completed.has(prereq))
          );
          if (!met) {
            violations.push({ code, prereqs: course.prereqs, quarter: `${q} ${year.academicStart}` });
          }
        }
      }
      // Add all courses from this quarter to completed AFTER checking
      for (const code of courses) {
        if (code !== "_GAP") completed.add(code);
      }
    }
  }
  return violations;
}

// ── Run tests for one major ──

function testMajor(majorId) {
  const majorDef = MAJOR_REQUIREMENTS[majorId];
  const profile = makeProfile(majorId);

  console.log(`\n── ${majorId}: ${majorDef.name} ──`);

  // Test 1: Schedule generates without error
  let schedule;
  try {
    schedule = Scheduler.generate(profile);
    assert(true, "generates without error", majorId);
  } catch (e) {
    assert(false, `generates without error (threw: ${e.message})`, majorId);
    console.log(`  ✗ CRASHED: ${e.message}`);
    return;
  }

  // Test 2: Schedule is a non-empty array
  assert(Array.isArray(schedule) && schedule.length > 0, "returns non-empty array", majorId);

  // Test 3: Schedule fits in 4-5 academic years (some heavy majors need overflow)
  assert(schedule.length >= 4 && schedule.length <= 5,
    `has 4-5 academic years (got ${schedule.length})`, majorId);

  // Test 4: Each year has F/W/S quarters
  for (let i = 0; i < schedule.length; i++) {
    const year = schedule[i];
    const qKeys = Object.keys(year.quarters);
    const hasAll = qKeys.includes("F") && qKeys.includes("W") && qKeys.includes("S");
    assert(hasAll, `year ${i + 1} has F/W/S quarters (got: ${qKeys.join(",")})`, majorId);
  }

  // Test 5: Year labels are correct for the first 4 years
  const expectedLabels = [
    "Year 1 (Freshman)",
    "Year 2 (Sophomore)",
    "Year 3 (Junior)",
    "Year 4 (Senior)"
  ];
  for (let i = 0; i < Math.min(schedule.length, expectedLabels.length); i++) {
    assert(
      schedule[i].label === expectedLabels[i],
      `year ${i + 1} label = "${expectedLabels[i]}" (got "${schedule[i].label}")`,
      majorId
    );
  }

  // Test 6: No empty non-GAP quarters
  let emptyQuarters = [];
  for (const year of schedule) {
    for (const [q, courses] of Object.entries(year.quarters)) {
      if (courses.length === 0) {
        emptyQuarters.push(`${q} ${year.academicStart}`);
      }
    }
  }
  assert(emptyQuarters.length === 0, `no empty quarters (empty: ${emptyQuarters.join(", ")})`, majorId);

  // Test 7: No duplicate courses
  const dupes = findDuplicates(schedule);
  assert(dupes.length === 0, `no duplicate courses (dupes: ${dupes.slice(0, 5).join(", ")})`, majorId);

  // Test 8: Total units >= totalUnitsRequired
  const totalUnits = totalUnitsInSchedule(schedule);
  const required = majorDef.totalUnitsRequired || 180;
  assert(totalUnits >= required, `total units >= ${required} (got ${totalUnits})`, majorId);

  // Test 9: Max quarter units <= maxUnits (17)
  const maxQU = maxQuarterUnits(schedule);
  assert(maxQU <= 17, `no quarter exceeds 17 units (max was ${maxQU})`, majorId);

  // Test 10: No prerequisite violations
  const prereqViolations = findPrereqViolations(schedule);
  if (prereqViolations.length > 0) {
    const summary = prereqViolations.slice(0, 3).map(v =>
      `${v.code} in ${v.quarter} needs ${JSON.stringify(v.prereqs)}`
    ).join("; ");
    assert(false, `no prereq violations (${prereqViolations.length} found: ${summary})`, majorId);
  } else {
    assert(true, "no prerequisite violations", majorId);
  }

  // Test 11: Academic year starts are correct (2026, 2027, 2028, 2029)
  for (let i = 0; i < schedule.length; i++) {
    assert(
      schedule[i].academicStart === 2026 + i,
      `year ${i + 1} academicStart = ${2026 + i} (got ${schedule[i].academicStart})`,
      majorId
    );
  }

  // Summary for this major
  const allCourses = allCoursesFromSchedule(schedule);
  console.log(`  Courses placed: ${allCourses.length}`);
  console.log(`  Total units: ${totalUnits}`);
  console.log(`  Max quarter units: ${maxQU}`);
  if (prereqViolations.length > 0) console.log(`  Prereq violations: ${prereqViolations.length}`);
  if (dupes.length > 0) console.log(`  Duplicates: ${dupes.join(", ")}`);
  if (emptyQuarters.length > 0) console.log(`  Empty quarters: ${emptyQuarters.join(", ")}`);
}

// ── Run all majors ──

console.log("=== UCSC Course Selection Automation — Smoke Test (All Majors) ===\n");

const majorIds = Object.keys(MAJOR_REQUIREMENTS);
console.log(`Testing ${majorIds.length} majors: ${majorIds.join(", ")}`);

for (const majorId of majorIds) {
  testMajor(majorId);
}

// ── Final summary ──

console.log("\n" + "=".repeat(60));
console.log(`RESULTS: ${totalPass} passed, ${totalFail} failed`);
if (failures.length > 0) {
  console.log("\nFAILURES:");
  failures.forEach(f => console.log(f));
}
console.log("=".repeat(60));

process.exit(totalFail > 0 ? 1 : 0);
