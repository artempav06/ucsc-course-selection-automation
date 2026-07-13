#!/usr/bin/env node
// Broad student-choice matrix QA for Prototype 4 scheduler engine.
// Exercises realistic combinations of major/concentration, GE concentration,
// start term/year, graduation window, transfer level, summer, prior credits,
// completed courses, avoided courses, and GAP settings.

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const dir = __dirname;
const load = f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'));
load('js/courses.js');
load('js/majors.js');
load('js/data.js');
load('js/engine/requirement-normalizer.js');
load('js/engine/requirement-collector.js');
load('js/engine.js');

const TERM_ORDER = { F: 0, W: 1, S: 2, SU: 3 };
const MAJOR_TYPES = new Set(['major_core', 'major_elective', 'prereq']);
const MAX_REPORT = 80;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function makeProfile(overrides = {}) {
  return Object.assign({
    major: 'CS_BA', concentration: null,
    currentLevel: 1, currentTerm: 'F', currentYear: 2026,
    targetGradTerm: 'S', targetGradYear: 2030,
    completedCourses: [], avoidedCourses: [],
    includeSummer: false, maxUnits: 19, minUnits: 12,
    concentrationInterest: null, geConcentration: 'ge_arts_humanities',
    gapType: null, gapTerm: null, gapYear: null,
    elwrSatisfied: false, priorCredits: 0, studentType: 'undergrad'
  }, overrides);
}

function plannedCourses(schedule, includeFree = false) {
  const out = [];
  for (const year of schedule) {
    for (const q of ['F','W','S','SU']) {
      const arr = year.quarters[q] || [];
      out.push(...arr.filter(c => c !== '_GAP' && (includeFree || !String(c).startsWith('FREE'))));
    }
  }
  return out;
}

function units(codes) {
  return (codes || []).reduce((sum, code) => sum + (COURSES[code]?.units || 0), 0);
}

function isLabCoreqSatisfied(code, sameQuarter, completedBefore) {
  const coreq = COURSES[code]?.labCoreq;
  return !!coreq && (sameQuarter.has(coreq) || completedBefore.has(coreq));
}

function prereqViolations(schedule, completed = []) {
  const completedBefore = new Set(completed);
  const violations = [];
  for (const year of schedule) {
    for (const q of ['F','W','S','SU']) {
      const arr = year.quarters[q] || [];
      const sameQuarter = new Set(arr);
      const snapshot = new Set(completedBefore);
      for (const code of arr) {
        if (code === '_GAP' || String(code).startsWith('FREE') || !COURSES[code]) continue;
        const prereqs = COURSES[code].prereqs || [];
        for (const group of prereqs) {
          const options = Array.isArray(group) ? group : [group];
          const ok = options.some(p => snapshot.has(p)) || isLabCoreqSatisfied(code, sameQuarter, snapshot);
          if (!ok) violations.push(`${code}@${year.label}-${q} missing ${options.join('/')}`);
        }
      }
      for (const code of arr) {
        if (COURSES[code]) completedBefore.add(code);
      }
    }
  }
  return violations;
}

function coreqViolations(schedule, completed = []) {
  const violations = [];
  const completedBefore = new Set(completed);
  for (const year of schedule) {
    for (const q of ['F','W','S','SU']) {
      const arr = year.quarters[q] || [];
      const sameQuarter = new Set(arr);
      for (const code of arr) {
        const coreq = COURSES[code]?.labCoreq;
        if (coreq && !sameQuarter.has(coreq) && !completedBefore.has(coreq)) {
          violations.push(`${code}@${year.label}-${q} missing coreq ${coreq}`);
        }
      }
      for (const code of arr) if (COURSES[code]) completedBefore.add(code);
    }
  }
  return violations;
}

function duplicateCourses(courses, completed = []) {
  const all = courses.concat(completed);
  const counts = new Map();
  for (const c of all) counts.set(c, (counts.get(c) || 0) + 1);
  return [...counts.entries()].filter(([c,n]) => n > 1 && COURSES[c]).map(([c,n]) => `${c}x${n}`);
}

function unknownCourses(courses) {
  return courses.filter(c => !COURSES[c]);
}

function yearsExpected(profile) {
  const academicYearOf = (term, year) => (term === 'F') ? year : year - 1;
  const startAcad = academicYearOf(profile.currentTerm, profile.currentYear);
  const gradAcad = academicYearOf(profile.targetGradTerm, profile.targetGradYear);
  return Math.max(1, gradAcad - startAcad + 1);
}

function maxMajorQuarter(schedule) {
  const typeMap = schedule.courseTypeMap || new Map();
  let max = 0;
  for (const year of schedule) {
    for (const q of ['F','W','S','SU']) {
      const arr = year.quarters[q] || [];
      const count = arr.filter(code => {
        if (!COURSES[code]) return false;
        const type = typeMap.get(code);
        if (!MAJOR_TYPES.has(type)) return false;
        const course = COURSES[code];
        return !(course.units <= 2 && course.labCoreq);
      }).length;
      max = Math.max(max, count);
    }
  }
  return max;
}

function requiredLowerDivForMajor(major, n = 4) {
  const req = MAJOR_REQUIREMENTS[major];
  if (!req) return [];
  const out = [];
  for (const cat of req.categories) {
    if (cat.type !== 'all_required') continue;
    for (const code of cat.courses || []) {
      if (COURSES[code]?.division === 'lower' && !out.includes(code)) out.push(code);
      if (out.length >= n) return out;
    }
  }
  return out;
}

function allConcentrationIds(major) {
  const list = CONCENTRATIONS?.major?.[major] || [];
  return list.length ? list.map(c => c.id) : [null];
}

function buildProfiles() {
  const majors = Object.keys(MAJOR_REQUIREMENTS);
  const geOptions = [null, 'ge_arts_humanities'];
  const startOptions = [
    { currentTerm: 'F', currentYear: 2026, targetGradTerm: 'S', targetGradYear: 2030, currentLevel: 1, priorCredits: 0, completedCourses: [], label: 'freshman-fall' },
    { currentTerm: 'W', currentYear: 2027, targetGradTerm: 'S', targetGradYear: 2030, currentLevel: 1, priorCredits: 15, completedCourses: [], label: 'freshman-winter' },
    { currentTerm: 'S', currentYear: 2027, targetGradTerm: 'S', targetGradYear: 2030, currentLevel: 2, priorCredits: 45, completedCourses: [], label: 'sophomore-spring' },
    { currentTerm: 'SU', currentYear: 2027, targetGradTerm: 'S', targetGradYear: 2030, currentLevel: 2, priorCredits: 60, completedCourses: [], includeSummer: true, label: 'summer-start' }
  ];
  const preferenceOptions = [
    { includeSummer: false, maxUnits: 19, label: 'standard' },
    { includeSummer: true, maxUnits: 19, label: 'summer-ok' },
    { includeSummer: false, maxUnits: 15, label: 'low-max-units' }
  ];
  const gapOptions = [
    { label: 'no-gap' },
    { gapEnabled: true, gapType: 'quarter', gapTerm: 'W', gapYear: 2028, label: 'winter-gap' },
    { gapEnabled: true, gapType: 'year', gapTerm: 'F', gapYear: 2028, label: 'full-year-gap' }
  ];

  const profiles = [];
  for (const major of majors) {
    for (const concentration of allConcentrationIds(major)) {
      for (const geConcentration of geOptions) {
        for (const start of startOptions) {
          const completedBase = start.completedCourses.length ? start.completedCourses : (start.currentLevel >= 2 ? requiredLowerDivForMajor(major, 4) : []);
          for (const pref of preferenceOptions) {
            for (const gap of gapOptions) {
              // Keep matrix realistic: low-unit + gap + no-summer combinations are possible but expected to run long,
              // so include them for robustness while classifying long schedules as warnings, not hard failures.
              profiles.push(makeProfile({
                major, concentration, geConcentration,
                ...start,
                completedCourses: completedBase,
                includeSummer: pref.includeSummer || start.includeSummer || false,
                maxUnits: pref.maxUnits,
                ...gap,
                scenarioLabel: `${major}/${concentration || 'none'}/${geConcentration || 'none'}/${start.label}/${pref.label}/${gap.label}`
              }));
            }
          }
        }
      }
    }
  }

  // Explicit user-like edge scenarios.
  profiles.push(makeProfile({ major: 'TIM_BS', concentration: 'tim_entrepreneurship', avoidedCourses: ['TIM 171', 'TIM 174'], scenarioLabel: 'avoid-tim-electives' }));
  profiles.push(makeProfile({ major: 'RE_BS', concentration: 're_ai_vision', includeSummer: false, maxUnits: 19, geConcentration: null, scenarioLabel: 'dense-re-no-ge' }));
  profiles.push(makeProfile({ major: 'CS_BS', concentration: 'cs_ai_ml', completedCourses: ['MATH 19A','MATH 19B','CSE 20','CSE 30'], currentLevel: 2, currentTerm: 'F', currentYear: 2027, targetGradYear: 2030, geConcentration: null, scenarioLabel: 'cs-transfer-completed-core' }));
  return profiles;
}

function validateProfile(profile) {
  const schedule = Scheduler.generate(profile);
  const courses = plannedCourses(schedule);
  const validation = Validator.validateAll(schedule, profile);
  const issues = [];
  const warnings = [];

  if (!Array.isArray(schedule) || schedule.length === 0) issues.push('empty schedule');
  if (!validation.allMet) {
    const unmet = [];
    for (const section of ['major','ge']) {
      for (const item of validation[section] || []) if (!item.fulfilled) unmet.push(`${section}:${item.id}`);
    }
    issues.push(`unmet requirements: ${unmet.slice(0, 8).join(', ')}`);
  }
  if (validation.totalUnits < 180) issues.push(`units ${validation.totalUnits}<180`);
  const dups = duplicateCourses(courses, profile.completedCourses || []);
  if (dups.length) issues.push(`duplicates: ${dups.slice(0,5).join(', ')}`);
  const unknown = unknownCourses(courses);
  if (unknown.length) issues.push(`unknown courses: ${unknown.slice(0,5).join(', ')}`);
  const prereqs = prereqViolations(schedule, profile.completedCourses || []);
  if (prereqs.length) issues.push(`prereq violations: ${prereqs.slice(0,3).join('; ')}`);
  const coreqs = coreqViolations(schedule, profile.completedCourses || []);
  if (coreqs.length) issues.push(`coreq violations: ${coreqs.slice(0,3).join('; ')}`);
  const avoided = courses.filter(c => (profile.avoidedCourses || []).includes(c));
  if (avoided.length) issues.push(`avoided courses selected: ${avoided.join(', ')}`);

  if (profile.gapType && !profile.gapEnabled) {
    issues.push(`gap scenario ${profile.gapType} is missing gapEnabled=true`);
  }
  const expectedYears = yearsExpected(profile);
  if (schedule.length > expectedYears) warnings.push(`schedule length ${schedule.length}>window ${expectedYears}`);
  if (maxMajorQuarter(schedule) > 3) warnings.push(`max major quarter ${maxMajorQuarter(schedule)}>3`);
  const scheduledUnits = units(plannedCourses(schedule, true));
  if (scheduledUnits > 210) warnings.push(`high scheduled units ${scheduledUnits} (total with prior/completed ${validation.totalUnits})`);

  return { schedule, validation, issues, warnings };
}

function warningBucket(message) {
  if (/^schedule length /.test(message)) return 'schedule length exceeds selected window';
  if (/^max major quarter /.test(message)) return 'major-course density exceeds target';
  if (/^high scheduled units /.test(message)) return 'high scheduled units';
  return message.replace(/\d+/g, '#');
}

function groupWarnings(warnings) {
  const buckets = new Map();
  for (const warningRecord of warnings) {
    for (const warning of warningRecord.warnings) {
      const bucket = warningBucket(warning);
      const entry = buckets.get(bucket) || { count: 0, examples: [] };
      entry.count += 1;
      if (entry.examples.length < 3) {
        entry.examples.push(`${warningRecord.profile.scenarioLabel}: years=${warningRecord.years} units=${warningRecord.units} :: ${warning}`);
      }
      buckets.set(bucket, entry);
    }
  }
  return [...buckets.entries()].sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]));
}

function main() {
  assert(yearsExpected(makeProfile({ currentTerm: 'SU', currentYear: 2027, targetGradTerm: 'S', targetGradYear: 2030 })) === 4,
    'summer-start warning window should count the selected Summer academic-year bucket');

  const profiles = buildProfiles();
  const failures = [];
  const warnings = [];
  let checked = 0;
  for (const profile of profiles) {
    checked++;
    try {
      const result = validateProfile(profile);
      if (result.issues.length) failures.push({ profile, issues: result.issues, units: result.validation.totalUnits, years: result.schedule.length });
      if (result.warnings.length) warnings.push({ profile, warnings: result.warnings, units: result.validation.totalUnits, years: result.schedule.length });
    } catch (err) {
      failures.push({ profile, issues: [`exception: ${err.message}`], units: 0, years: 0 });
    }
  }

  console.log(`Prototype 4 combo matrix checked ${checked} student-choice scenarios`);
  console.log(`Hard failures: ${failures.length}`);
  console.log(`Warnings: ${warnings.length}`);

  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures.slice(0, MAX_REPORT)) {
      console.log(`- ${f.profile.scenarioLabel}: years=${f.years} units=${f.units} :: ${f.issues.join(' | ')}`);
    }
    if (failures.length > MAX_REPORT) console.log(`... ${failures.length - MAX_REPORT} more failures omitted`);
  }
  if (warnings.length) {
    console.log('\nWarning buckets:');
    for (const [bucket, info] of groupWarnings(warnings)) {
      console.log(`- ${bucket}: ${info.count}`);
      for (const example of info.examples) console.log(`  example: ${example}`);
    }

    console.log('\nWarning details:');
    for (const w of warnings.slice(0, MAX_REPORT)) {
      console.log(`- ${w.profile.scenarioLabel}: years=${w.years} units=${w.units} :: ${w.warnings.join(' | ')}`);
    }
    if (warnings.length > MAX_REPORT) console.log(`... ${warnings.length - MAX_REPORT} more warnings omitted`);
  }

  if (failures.length) process.exit(1);
}

main();
