// test_debug_schedule.js — Print detailed schedule for debugging
const fs = require("fs");
const vm = require("vm");
const path = require("path");
const jsDir = path.join(__dirname, "js");
function loadFile(name) {
  vm.runInThisContext(fs.readFileSync(path.join(jsDir, name), "utf-8"), { filename: name });
}
loadFile("courses.js");
loadFile("majors.js");
loadFile("data.js");
loadFile("engine.js");

function printSchedule(schedule, label) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(label);
  console.log("=".repeat(70));
  let totalUnits = 0;
  for (const year of schedule) {
    console.log(`\n${year.label} (Academic ${year.academicStart}–${year.academicStart + 1})`);
    for (const [q, courses] of Object.entries(year.quarters)) {
      if (courses[0] === "_GAP") { console.log(`  ${q}: [GAP]`); continue; }
      const calYear = q === "F" ? year.academicStart : year.academicStart + 1;
      let qUnits = 0;
      const details = courses.map(c => {
        const u = COURSES[c]?.units || 0;
        qUnits += u;
        return `${c} (${u}u)`;
      });
      totalUnits += qUnits;
      console.log(`  ${q} ${calYear}: [${qUnits}u] ${details.join(", ")}`);
    }
  }
  console.log(`\nTotal: ${totalUnits} units, ${schedule.length} years`);
}

// Scenario 1: CS_BA Freshman F2026 → S2030 (baseline)
const profile1 = {
  major: "CS_BA", degreeType: "BA", studentType: "undergrad",
  currentLevel: 1, currentTerm: "F", currentYear: 2026,
  targetGradTerm: "S", targetGradYear: 2030,
  maxUnits: 17, includeSummer: false,
  completedCourses: [], interests: [], geInterests: [],
  priorCredits: 0, elwrSatisfied: false, profImportance: "medium",
  autoSuggest: true, gapEnabled: false
};
printSchedule(Scheduler.generate(profile1), "CS_BA: Freshman F2026 → S2030");

// Scenario 2: CS_BA Sophomore S2026 → S2028
const profile2 = { ...profile1, currentLevel: 2, currentTerm: "S", currentYear: 2026,
  targetGradTerm: "S", targetGradYear: 2028 };
printSchedule(Scheduler.generate(profile2), "CS_BA: Sophomore S2026 → S2028");

// Scenario 3: CS_BA Sophomore S2026 → S2030
const profile3 = { ...profile1, currentLevel: 2, currentTerm: "S", currentYear: 2026,
  targetGradTerm: "S", targetGradYear: 2030 };
printSchedule(Scheduler.generate(profile3), "CS_BA: Sophomore S2026 → S2030");

// Scenario 4: CS_BA Junior W2027 → S2028
const profile4 = { ...profile1, currentLevel: 3, currentTerm: "W", currentYear: 2027,
  targetGradTerm: "S", targetGradYear: 2028 };
printSchedule(Scheduler.generate(profile4), "CS_BA: Junior W2027 → S2028");

// Scenario 5: CS_BA Senior F2026 → S2027
const profile5 = { ...profile1, currentLevel: 4, currentTerm: "F", currentYear: 2026,
  targetGradTerm: "S", targetGradYear: 2027 };
printSchedule(Scheduler.generate(profile5), "CS_BA: Senior F2026 → S2027");

// Scenario 6: CS_BA Freshman F2026 → S2030 + 30 prior credits
const profile6 = { ...profile1, priorCredits: 30 };
printSchedule(Scheduler.generate(profile6), "CS_BA: Freshman F2026 → S2030 + 30 prior credits");

// Scenario 7: CS_BA Gap in F2027
const profile7 = { ...profile1, gapEnabled: true, gapType: "quarter", gapTerm: "F", gapYear: 2027 };
printSchedule(Scheduler.generate(profile7), "CS_BA: Freshman F2026 → S2030 + Gap F2027");

// Scenario 8: CS_BA Summer enabled
const profile8 = { ...profile1, includeSummer: true };
printSchedule(Scheduler.generate(profile8), "CS_BA: Freshman F2026 → S2030 + Summer");
