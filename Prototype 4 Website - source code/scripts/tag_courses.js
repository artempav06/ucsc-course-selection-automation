#!/usr/bin/env node
// tag_courses.js — Adds `concentrations: [...]` field to every course in courses.js
// Reads the concentration→course mapping (hardcoded from CONCENTRATIONS.md),
// builds a reverse index (course→concentration IDs), and patches courses.js in place.

const fs = require("fs");
const path = require("path");

const CONCENTRATIONS = {
  // --- Major concentrations ---
  cs_ai_ml:        ["CSE 140","CSE 142","CSE 143","CSE 144","CSE 145","CSE 150","CMPM 146"],
  cs_systems:      ["CSE 120","CSE 130","CSE 132","CSE 134","CSE 138","CSE 110A","CSE 125","CSE 121","CSE 122"],
  cs_web_software: ["CSE 183","CSE 184","CSE 186","CSE 187","CSE 115C","CSE 115D"],
  cs_theory:       ["CSE 101M","CSE 102","CSE 103","CSE 112","CSE 114A","CSE 111","CSE 157","MATH 110","MATH 115","MATH 116","MATH 117"],
  cs_graphics_vision: ["CSE 160","CSE 163","CSE 118","CSE 150","CSE 180"],
  cs_graphics_games:  ["CSE 160","CSE 161","CSE 162","CSE 163","CSE 168","CMPM 163","CMPM 164"],
  cs_data:         ["CSE 180","CSE 181","CSE 184","CSE 144","CSE 145","STAT 132"],

  ce_system_prog:  ["CSE 130","CSE 150","CSE 111","CSE 113","CSE 134","CSE 110A"],
  ce_computer_sys: ["CSE 130","CSE 111","CSE 125","CSE 134","CSE 122","CSE 121"],
  ce_networks:     ["CSE 130","CSE 150","CSE 156","CSE 156L","CSE 138"],
  ce_digital_hw:   ["CSE 125","ECE 171","ECE 171L","CSE 122","ECE 173"],

  ee_signals_comm:       ["ECE 152","ECE 153","ECE 157","ECE 136","ECE 183"],
  ee_power_energy:       ["ECE 169","ECE 170","ECE 175","ECE 175L","ECE 176","ECE 176L","ECE 177","ECE 177L","ECE 180J","ECE 181J","ECE 185"],
  ee_embedded_controls:  ["ECE 118","ECE 121","ECE 141","ECE 145","ECE 149","ECE 163","ECE 167"],
  ee_electronics_photonics: ["ECE 130","ECE 130L","ECE 172","ECE 173","ECE 174","ECE 178","ECE 104"],

  gd_game_ai:       ["CMPM 146","CMPM 147","CMPM 148","CSE 140","CSE 142","CSE 144","CSE 145"],
  gd_graphics:      ["CMPM 163","CMPM 164","CSE 160","CSE 161","CSE 162","CSE 163"],
  gd_game_systems:  ["CMPM 122","CMPM 123","CMPM 125","CSE 113","CSE 118","CSE 120","CSE 130","CSE 138","ECE 118"],
  gd_narrative_design: ["CMPM 110","CMPM 131","CMPM 132","CMPM 150","CMPM 151","CMPM 152","CMPM 169","CMPM 172"],
  gd_data_web:      ["CSE 180","CSE 181","CSE 183","CSE 184","CSE 186","CSE 187"],

  am_computational: ["AM 148","AM 160","MATH 148","MATH 152","CSE 107","STAT 132"],
  am_modeling:      ["AM 107","AM 115","AM 130","MATH 106","MATH 107","MATH 145"],
  am_pure_math:     ["MATH 100","MATH 105A","MATH 110","MATH 111A","MATH 115","MATH 116","MATH 117","MATH 124"],
  am_data_stats:    ["STAT 131","STAT 132","STAT 108","MATH 114","CSE 107"],

  bi_computational:  ["CSE 142","CSE 144","CSE 182","AM 147","BME 132"],
  bi_molecular:      ["BME 128","BME 128L","BME 177","BME 177L","BIOC 100B","BME 140"],
  bi_ecology_micro:  ["AM 115","BME 118","BME 130","METX 100","METX 140","BME 175"],

  bm_molecular_eng:  ["BME 128","BME 128L","BME 177","BME 177L","BME 140","BME 175"],
  bm_genomics:       ["BME 130","BME 132","BME 178","CSE 142","AM 147"],
  bm_quantitative:   ["AM 115","AM 147","BME 118","BME 122H","ECE 104","METX 100"],

  bt_molecular:      ["BME 122H","BME 128","BME 130","BME 132","BME 140","METX 100"],
  bt_society_ethics: ["FMST 124","FMST 133","SOCY 121","SOCY 123","SOCY 127P"],
  bt_computational:  ["BME 177","BME 178","ECE 104"],

  ndt_networks:  ["CSE 150","CSE 156","CSE 157","CSE 138","CSE 132","ECE 152","ECE 153"],
  ndt_ai_data:   ["CSE 140","CSE 142","CSE 144","CSE 180","CSE 181","CSE 182","CMPM 146","STAT 131","STAT 132"],
  ndt_embedded:  ["ECE 101","ECE 101L","ECE 103","ECE 103L","ECE 118","ECE 135","ECE 135L","ECE 171","ECE 171L","CSE 100","CSE 100L","CSE 125"],
  ndt_software:  ["CSE 183","CSE 186","CSE 187","CSE 110A","CSE 110B","CSE 111","CSE 112","CSE 113","CSE 115A","CSE 120","CSE 121"],

  re_autonomous:       ["ECE 163","ECE 149","ECE 118","CSE 150","CSE 156","ECE 240","ECE 242","ECE 243"],
  re_controls_sensing: ["ECE 141","ECE 145","ECE 167","ECE 153","ECE 152","ECE 135","ECE 135L","ECE 130","ECE 130L"],
  re_ai_vision:        ["CSE 140","CSE 142","ECE 110","CMPM 146","AM 114","AM 147","ECE 215","ECE 216"],

  tim_entrepreneurship: ["TIM 171","TIM 174","TIM 176","TIM 177","TIM 178","ECON 166A","ECON 135","ECON 136"],
  tim_data_analytics:   ["CSE 140","CSE 142","CSE 144","CSE 145","CSE 180","CSE 183","STAT 131","ECON 113","ECON 114","ECON 131"],
  tim_systems_eng:      ["CSE 120","CSE 130","CSE 132","CSE 138","CSE 156","ECE 101","ECE 103","ECE 118","ECE 151"],
  tim_finance_econ:     ["ECON 100B","ECON 101","ECON 102","ECON 104","ECON 110A","ECON 110B","ECON 111A","ECON 111B","ECON 114","ECON 115","ECON 120","ECON 128","ECON 129"],

  // --- GE concentrations ---
  ge_arts_humanities:  ["LIT 1","PHIL 9","PHIL 11","HAVC 1","MUSC 11","FILM 20A","THEA 10","ART 10","LIT 61H","PHIL 22","PHIL 28"],
  ge_social_sciences:  ["ANTH 1","SOCY 1","SOCY 15","PSYC 1","CRES 10","HIS 10B","POLI 1","POLI 20","POLI 21","LALS 1"],
  ge_natural_sciences: ["PHYS 6A","CHEM 1A","BIOE 20B","ASTR 1","ASTR 2","PHYS 5A","EART 1","EART 5","OCEA 1"],
  ge_environment:      ["ENVS 23","ENVS 24","ENVS 100","PHIL 28","BIOE 85","ECON 50","PHYS 80A","ECE 80J","ECE 80H"],
  ge_tech_society:     ["CSE 80N","CSE 3","CSE 80A","CSE 80L","CSE 80S","CSE 40","GCH 41","ECE 80E","ECE 80S","STAT 5","STAT 7","MATH 4"],
  ge_creative:         ["ART 10","THEA 10","LIT 90","LIT 61L","FILM 20A","CMPM 17","MUSC 80A","MATH 50","WRIT 30","CMPM 80J"],
  ge_global_cultures:  ["ANTH 1","LALS 1","CRES 10","SOCY 15","HIS 10B","POLI 21","LIT 61J","LIT 61R","LIT 80H","FMST 1"],
  ge_health_wellness:  ["PSYC 1","PSYC 2","SOCY 1","BIOL 20A","GCH 41","ECON 1","ECON 2","BIOL 80J"],
};

// Build reverse index: course code → Set of concentration IDs
const reverseIndex = {};
for (const [concId, courses] of Object.entries(CONCENTRATIONS)) {
  for (const code of courses) {
    if (!reverseIndex[code]) reverseIndex[code] = new Set();
    reverseIndex[code].add(concId);
  }
}

const coursesPath = path.join(__dirname, "..", "js", "courses.js");
let src = fs.readFileSync(coursesPath, "utf-8");

// Match each course entry: "CODE": { ... }
// We add concentrations right after the opening {
let tagged = 0;
let total = 0;

// Strategy: find every course key pattern and inject concentrations field
// Course keys look like: "CSE 20": {
const courseKeyRe = /"([A-Z]{2,5} \d{1,4}[A-Z]{0,2})":\s*\{/g;
let match;
const replacements = [];

while ((match = courseKeyRe.exec(src)) !== null) {
  total++;
  const code = match[1];
  const concs = reverseIndex[code] ? [...reverseIndex[code]].sort() : [];
  const insertPos = match.index + match[0].length;

  // Check if concentrations field already exists for this entry
  const nextChunk = src.slice(insertPos, insertPos + 200);
  if (nextChunk.includes("concentrations:")) continue;

  const concStr = concs.length > 0
    ? ` concentrations: ${JSON.stringify(concs)},`
    : ` concentrations: [],`;

  replacements.push({ pos: insertPos, text: concStr });
  if (concs.length > 0) tagged++;
}

// Apply replacements in reverse order so positions don't shift
replacements.sort((a, b) => b.pos - a.pos);
for (const r of replacements) {
  src = src.slice(0, r.pos) + r.text + src.slice(r.pos);
}

fs.writeFileSync(coursesPath, src, "utf-8");

console.log(`Done. ${total} courses processed, ${tagged} tagged with concentrations, ${total - tagged} with empty [].`);
console.log(`Unique concentration IDs: ${Object.keys(CONCENTRATIONS).length}`);
console.log(`Unique courses with tags: ${Object.keys(reverseIndex).length}`);
