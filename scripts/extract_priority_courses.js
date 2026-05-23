#!/usr/bin/env node
// extract_priority_courses.js
// Extracts all course codes referenced by majors + transitive prereqs.
// Outputs: scripts/priority_courses.json, scripts/priority_departments.json

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const jsDir = path.join(__dirname, "..", "Prototype 1 Website - source code", "js");
const outDir = __dirname;

function loadFile(name) {
  const code = fs.readFileSync(path.join(jsDir, name), "utf-8");
  vm.runInThisContext(code, { filename: name });
}

loadFile("courses.js");
loadFile("majors.js");
loadFile("data.js");

// Walk all majors and collect every course code
function extractMajorCodes(majorReqs) {
  const codes = new Set();
  for (const cat of majorReqs.categories) {
    if (cat.courses) {
      cat.courses.forEach(c => codes.add(c));
    }
    if (cat.groups) {
      for (const g of cat.groups) {
        if (g.courses) g.courses.forEach(c => codes.add(c));
      }
    }
  }
  return codes;
}

const allDirectCodes = new Set();
const majorIds = Object.keys(MAJOR_REQUIREMENTS);

console.log(`Found ${majorIds.length} majors: ${majorIds.join(", ")}`);

for (const id of majorIds) {
  const major = MAJOR_REQUIREMENTS[id];
  const codes = extractMajorCodes(major);
  console.log(`  ${id}: ${codes.size} direct course codes`);
  codes.forEach(c => allDirectCodes.add(c));
}

// Also include GE and UC requirement courses
if (typeof GE_REQUIREMENTS !== "undefined") {
  let geCount = 0;
  for (const ge of GE_REQUIREMENTS) {
    if (ge.courses) ge.courses.forEach(c => { if (!allDirectCodes.has(c)) geCount++; allDirectCodes.add(c); });
  }
  console.log(`  GE requirements: added ${geCount} new codes`);
}
if (typeof UC_REQUIREMENTS !== "undefined") {
  let ucCount = 0;
  for (const uc of UC_REQUIREMENTS) {
    if (uc.courses) uc.courses.forEach(c => { if (!allDirectCodes.has(c)) ucCount++; allDirectCodes.add(c); });
  }
  console.log(`  UC requirements: added ${ucCount} new codes`);
}

console.log(`\nTotal direct codes (deduplicated): ${allDirectCodes.size}`);

// Walk prereq chains up to 4 levels deep
function expandPrereqs(codes, courses, maxDepth) {
  const all = new Set(codes);
  const unresolvable = [];

  for (let pass = 0; pass < maxDepth; pass++) {
    let added = 0;
    for (const code of [...all]) {
      const course = courses[code];
      if (!course) continue;
      if (!course.prereqs) continue;
      for (const orGroup of course.prereqs) {
        for (const prereq of orGroup) {
          if (!all.has(prereq)) {
            all.add(prereq);
            added++;
          }
        }
      }
    }
    console.log(`  Prereq pass ${pass + 1}: added ${added} codes`);
    if (added === 0) break;
  }

  // Check for unresolvable codes
  for (const code of all) {
    if (!courses[code]) {
      unresolvable.push(code);
    }
  }

  return { all, unresolvable };
}

console.log("\nExpanding prereq chains (max 4 levels):");
const { all: allCodes, unresolvable } = expandPrereqs(allDirectCodes, COURSES, 4);

console.log(`\nTotal codes after prereq expansion: ${allCodes.size}`);
if (unresolvable.length > 0) {
  console.log(`Unresolvable codes (not in COURSES): ${unresolvable.join(", ")}`);
}

// Extract department prefixes
const departments = new Set();
for (const code of allCodes) {
  const dept = code.split(" ")[0];
  if (dept) departments.add(dept);
}

const sortedCodes = [...allCodes].sort();
const sortedDepts = [...departments].sort();

console.log(`\nPriority departments (${sortedDepts.length}): ${sortedDepts.join(", ")}`);

// Write outputs
fs.writeFileSync(
  path.join(outDir, "priority_courses.json"),
  JSON.stringify(sortedCodes, null, 2)
);

fs.writeFileSync(
  path.join(outDir, "priority_departments.json"),
  JSON.stringify(sortedDepts, null, 2)
);

console.log("\nWritten:");
console.log(`  scripts/priority_courses.json (${sortedCodes.length} courses)`);
console.log(`  scripts/priority_departments.json (${sortedDepts.length} departments)`);
