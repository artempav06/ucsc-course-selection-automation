/**
 * test_category_fulfillment.js
 * Verifies that schedule generation fulfills ALL major requirement categories.
 * Runs Validator.validateAll() and reports per-category fulfillment status.
 */

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const jsDir = path.join(__dirname, "js");
function loadFile(name) {
  const code = fs.readFileSync(path.join(jsDir, name), "utf-8");
  vm.runInThisContext(code, { filename: name });
}

loadFile("courses.js");
loadFile("majors.js");
loadFile("data.js");
loadFile("engine.js");

let totalPassed = 0;
let totalFailed = 0;
const failures = [];

const majors = Object.keys(MAJOR_REQUIREMENTS);

for (const majorId of majors) {
  const reqs = MAJOR_REQUIREMENTS[majorId];
  console.log(`\n── ${majorId}: ${reqs.name} ──`);

  const profile = {
    major: majorId,
    currentLevel: "freshman",
    completedCourses: [],
    targetGradYear: 2030,
    includeSummer: false,
    maxUnits: 15,
    interests: [],
    gapEnabled: false,
  };

  const schedule = Scheduler.generate(profile);
  const validation = Validator.validateAll(schedule, profile);

  let majorPassed = 0;
  let majorFailed = 0;
  const unfulfilled = [];

  for (const catResult of validation.major) {
    if (catResult.fulfilled) {
      majorPassed++;
      totalPassed++;
      const count = catResult.neededCount > 0
        ? ` (${catResult.fulfilledCount}/${catResult.neededCount})`
        : ` (${catResult.courses?.length || catResult.selectedCourses?.length || 0} courses)`;
      console.log(`  PASS  ${catResult.id}${count}`);
    } else {
      majorFailed++;
      totalFailed++;
      const count = catResult.neededCount > 0
        ? ` (${catResult.fulfilledCount}/${catResult.neededCount})`
        : "";
      const missing = catResult.missing?.length > 0
        ? ` — missing: ${catResult.missing.slice(0, 5).join(", ")}${catResult.missing.length > 5 ? "..." : ""}`
        : "";
      console.log(`  FAIL  ${catResult.id}${count}${missing}`);
      unfulfilled.push({ major: majorId, category: catResult.id, detail: `${count}${missing}` });
    }
  }

  console.log(`  Summary: ${majorPassed} passed, ${majorFailed} failed out of ${validation.major.length}`);
  if (majorFailed > 0) {
    failures.push({ majorId, unfulfilled: unfulfilled.map(u => u.category) });
  }
}

console.log(`\n${"=".repeat(60)}`);
console.log(`RESULTS: ${totalPassed} passed, ${totalFailed} failed across ${majors.length} majors`);
if (failures.length > 0) {
  console.log(`\nFAILURES:`);
  for (const f of failures) {
    console.log(`  ${f.majorId}: ${f.unfulfilled.join(", ")}`);
  }
}
console.log("=".repeat(60));

// Also check how many courses from each major exist in COURSES
console.log("\n── Course Existence Check ──");
for (const majorId of majors) {
  const reqs = MAJOR_REQUIREMENTS[majorId];
  let missing = [];
  for (const cat of reqs.categories) {
    const courses = cat.courses || [];
    const groups = cat.groups || [];
    const allCourses = [...courses];
    for (const g of groups) {
      allCourses.push(...(g.courses || []));
    }
    for (const c of allCourses) {
      if (!COURSES[c]) {
        missing.push(c);
      }
    }
  }
  if (missing.length > 0) {
    const unique = [...new Set(missing)];
    console.log(`  ${majorId}: ${unique.length} courses NOT in courses.js: ${unique.slice(0, 10).join(", ")}${unique.length > 10 ? "..." : ""}`);
  }
}

process.exit(totalFailed > 0 ? 1 : 0);
