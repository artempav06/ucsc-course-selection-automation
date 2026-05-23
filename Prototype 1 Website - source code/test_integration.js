// test_integration.js — Full integration test simulating the app flow
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const jsDir = path.join(__dirname, "js");
function load(n) { vm.runInThisContext(fs.readFileSync(path.join(jsDir, n), "utf-8"), { filename: n }); }
load("courses.js"); load("majors.js"); load("data.js"); load("engine.js");

let pass = 0, fail = 0;
const failures = [];
function assert(cond, label) {
  if (cond) { pass++; } else { fail++; failures.push(`  [FAIL] ${label}`); }
}

function makeProfile(overrides) {
  return {
    major: "CS_BA", degreeType: "BA", studentType: "undergrad",
    currentLevel: 1, currentTerm: "F", currentYear: 2026,
    targetGradTerm: "S", targetGradYear: 2030,
    maxUnits: 17, includeSummer: false, completedCourses: [],
    interests: [], geInterests: [], priorCredits: 0,
    elwrSatisfied: false, profImportance: "medium",
    autoSuggest: true, gapEnabled: false,
    ...overrides
  };
}

console.log("=== Integration Tests ===\n");

// Test 1: Full generate + validate flow for every major
console.log("── Test 1: Generate + Validate for all majors ──");
for (const [majorId, majorDef] of Object.entries(MAJOR_REQUIREMENTS)) {
  const profile = makeProfile({
    major: majorId,
    degreeType: majorId.endsWith("_BA") ? "BA" : "BS"
  });
  try {
    const schedule = Scheduler.generate(profile);
    const validation = Validator.validateAll(schedule, profile);
    assert(validation !== null, `${majorId}: validation returns result`);
    assert(typeof validation.totalUnits === "number", `${majorId}: totalUnits is number`);
    assert(typeof validation.allMet === "boolean", `${majorId}: allMet is boolean`);
    assert(Array.isArray(validation.major), `${majorId}: major results is array`);
    assert(Array.isArray(validation.ge), `${majorId}: GE results is array`);
    assert(Array.isArray(validation.uc), `${majorId}: UC results is array`);
    console.log(`  ${majorId}: ${validation.totalUnits}u, ${validation.allMet ? "ALL MET" : "warnings"}, progress ${Math.round((validation.major.filter(r=>r.fulfilled).length / validation.major.length) * 100)}%`);
  } catch (e) {
    assert(false, `${majorId}: threw ${e.message}`);
  }
}

// Test 2: Swap/replacement helpers
console.log("\n── Test 2: Course swap/replacement ──");
{
  const schedule = Scheduler.generate(makeProfile());
  const placed = [];
  for (const y of schedule) for (const cs of Object.values(y.quarters)) placed.push(...cs);
  const code = placed.find(c => c !== "_GAP" && !c.startsWith("FREE"));
  if (code) {
    const replacements = Scheduler.getReplacements(code, "F", placed, schedule, "");
    assert(Array.isArray(replacements), "getReplacements returns array");
    assert(!replacements.includes(code), "replacement doesn't include original");
    console.log(`  Replacements for ${code}: ${replacements.length} options`);
  }
}

// Test 3: Course catalog integrity
console.log("\n── Test 3: Course catalog integrity ──");
{
  const courseCount = Object.keys(COURSES).length;
  assert(courseCount > 100, `Course catalog has ${courseCount} courses (> 100)`);

  let missingTitle = 0, missingUnits = 0;
  for (const [code, c] of Object.entries(COURSES)) {
    if (!c.title) missingTitle++;
    if (typeof c.units !== "number" || c.units < 0) missingUnits++;
  }
  assert(missingTitle === 0, `No courses missing title (${missingTitle} missing)`);
  assert(missingUnits === 0, `No courses missing/invalid units (${missingUnits} invalid)`);
  console.log(`  ${courseCount} courses, ${missingTitle} missing titles, ${missingUnits} invalid units`);
}

// Test 4: GE requirements coverage
console.log("\n── Test 4: GE requirements ──");
{
  assert(Array.isArray(GE_REQUIREMENTS), "GE_REQUIREMENTS is array");
  assert(GE_REQUIREMENTS.length >= 10, `At least 10 GE codes (got ${GE_REQUIREMENTS.length})`);
  for (const ge of GE_REQUIREMENTS) {
    assert(ge.id && ge.name, `GE ${ge.id} has id and name`);
  }
  console.log(`  ${GE_REQUIREMENTS.length} GE requirement categories`);
}

// Test 5: UC requirements
console.log("\n── Test 5: UC requirements ──");
{
  assert(Array.isArray(UC_REQUIREMENTS), "UC_REQUIREMENTS is array");
  for (const uc of UC_REQUIREMENTS) {
    assert(uc.id && uc.name, `UC ${uc.id} has id and name`);
    assert(Array.isArray(uc.courses), `UC ${uc.id} has courses array`);
  }
  console.log(`  ${UC_REQUIREMENTS.length} UC requirement categories`);
}

// Test 6: Transcript course matching simulation
console.log("\n── Test 6: Transcript parsing simulation ──");
{
  const testText = "CSE 20 MATH 19A CSE 12 WRIT 1 PHYS 5A";
  const regex = /\b([A-Z]{2,5})\s{1,5}(\d{1,3}[A-Z]{0,2})\b/g;
  const matches = [];
  let m;
  while ((m = regex.exec(testText)) !== null) {
    const code = `${m[1]} ${m[2]}`;
    if (COURSES[code]) matches.push(code);
  }
  assert(matches.length === 5, `Parsed 5 courses from text (got ${matches.length})`);
  assert(matches.includes("CSE 20"), "Found CSE 20");
  assert(matches.includes("MATH 19A"), "Found MATH 19A");
  console.log(`  Parsed: ${matches.join(", ")}`);
}

// Test 7: Completed courses exclusion
console.log("\n── Test 7: Completed courses ──");
{
  const completed = ["CSE 20", "CSE 12", "MATH 19A", "MATH 19B", "CSE 16", "AM 10"];
  const s = Scheduler.generate(makeProfile({ completedCourses: completed }));
  const placed = [];
  for (const y of s) for (const cs of Object.values(y.quarters))
    for (const c of cs) if (c !== "_GAP") placed.push(c);

  for (const c of completed) {
    assert(!placed.includes(c), `Completed ${c} not in schedule`);
  }
  console.log(`  ${completed.length} completed courses excluded, ${placed.length} placed`);
}

// Test 8: Course equivalence — CS_BA with MATH 21 (≡ AM 10)
console.log("\n── Test 8: CS_BA equivalence — MATH 21 for AM 10 ──");
{
  const s = Scheduler.generate(makeProfile({ completedCourses: ["MATH 21"] }));
  const placed = [];
  for (const y of s) for (const cs of Object.values(y.quarters))
    for (const c of cs) if (c !== "_GAP") placed.push(c);
  assert(!placed.includes("AM 10"), "AM 10 not scheduled when MATH 21 completed");
  assert(!placed.includes("MATH 21"), "MATH 21 (completed) not re-scheduled");
  console.log(`  AM 10 absent: ${!placed.includes("AM 10")}, MATH 21 absent: ${!placed.includes("MATH 21")}`);
}

// Test 9: Course equivalence — CS_BA with MATH 20A+20B (≡ 19-series)
console.log("\n── Test 9: CS_BA equivalence — 20-series for 19-series ──");
{
  const s = Scheduler.generate(makeProfile({ completedCourses: ["MATH 20A", "MATH 20B"] }));
  const placed = [];
  for (const y of s) for (const cs of Object.values(y.quarters))
    for (const c of cs) if (c !== "_GAP") placed.push(c);
  assert(!placed.includes("MATH 19A"), "MATH 19A not scheduled when 20-series completed");
  assert(!placed.includes("MATH 19B"), "MATH 19B not scheduled when 20-series completed");
  assert(!placed.includes("MATH 20A"), "MATH 20A (completed) not re-scheduled");
  assert(!placed.includes("MATH 20B"), "MATH 20B (completed) not re-scheduled");
  console.log(`  19A absent: ${!placed.includes("MATH 19A")}, 19B absent: ${!placed.includes("MATH 19B")}`);
}

// Test 10: Course equivalence — WRIT 1E satisfies WRIT 1 / GE TA / UC ELWR
console.log("\n── Test 10: WRIT 1E equivalence ──");
{
  const s = Scheduler.generate(makeProfile({ completedCourses: ["WRIT 1E"] }));
  const placed = [];
  for (const y of s) for (const cs of Object.values(y.quarters))
    for (const c of cs) if (c !== "_GAP") placed.push(c);
  assert(!placed.includes("WRIT 1"), "WRIT 1 not scheduled when WRIT 1E completed");
  assert(!placed.includes("WRIT 1E"), "WRIT 1E (completed) not re-scheduled");
  console.log(`  WRIT 1 absent: ${!placed.includes("WRIT 1")}, WRIT 1E absent: ${!placed.includes("WRIT 1E")}`);
}

// Test 11: Combined equivalences — full transcript scenario
console.log("\n── Test 11: Combined equivalences ──");
{
  const completed = ["MATH 21", "MATH 20A", "MATH 20B", "WRIT 1E", "CSE 20", "CSE 12"];
  const s = Scheduler.generate(makeProfile({ completedCourses: completed }));
  const placed = [];
  for (const y of s) for (const cs of Object.values(y.quarters))
    for (const c of cs) if (c !== "_GAP") placed.push(c);
  assert(!placed.includes("AM 10"), "AM 10 absent (MATH 21 completed)");
  assert(!placed.includes("MATH 19A"), "MATH 19A absent (20-series completed)");
  assert(!placed.includes("MATH 19B"), "MATH 19B absent (20-series completed)");
  assert(!placed.includes("WRIT 1"), "WRIT 1 absent (WRIT 1E completed)");
  for (const c of completed) {
    assert(!placed.includes(c), `Completed ${c} not re-scheduled`);
  }
  console.log(`  All equivalences respected, ${placed.length} courses placed`);
}

// Test 12: Generic pick_one — CS_BS with completed MATH 21
console.log("\n── Test 12: Generic pick_one — CS_BS MATH 21 ──");
{
  const s = Scheduler.generate(makeProfile({
    major: "CS_BS", degreeType: "BS", completedCourses: ["MATH 21"]
  }));
  const placed = [];
  for (const y of s) for (const cs of Object.values(y.quarters))
    for (const c of cs) if (c !== "_GAP") placed.push(c);
  assert(!placed.includes("AM 10"), "CS_BS: AM 10 not scheduled when MATH 21 completed");
  console.log(`  AM 10 absent: ${!placed.includes("AM 10")}`);
}

// Summary
console.log("\n" + "=".repeat(60));
console.log(`RESULTS: ${pass} passed, ${fail} failed`);
if (failures.length > 0) { console.log("\nFAILURES:"); failures.forEach(f => console.log(f)); }
console.log("=".repeat(60));
process.exit(fail > 0 ? 1 : 0);
