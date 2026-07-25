#!/usr/bin/env node
// Phase 10 diagnostic helper: summarize combo-matrix warning buckets and representative root-cause clues.
// This script is intentionally read-only: it loads the static scheduler globals, generates schedules,
// and prints aggregate warning/phase metrics without changing scheduler behavior.

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const dir = path.join(__dirname, '..');
const load = f => vm.runInThisContext(fs.readFileSync(path.join(dir, f), 'utf8'), { filename: f });

load('js/courses.js');
load('js/majors.js');
load('js/data.js');
load('js/engine/requirement-normalizer.js');
load('js/engine/requirement-collector.js');
load('js/engine.js');

const TERM_ORDER = { F: 0, W: 1, S: 2, SU: 3 };
const MAJOR_TYPES = new Set(['major_core', 'major_elective', 'prereq']);

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

function yearsExpected(profile) {
  const academicYearOf = (term, year) => (term === 'F') ? year : year - 1;
  const startAcad = academicYearOf(profile.currentTerm, profile.currentYear);
  const gradAcad = academicYearOf(profile.targetGradTerm, profile.targetGradYear);
  return Math.max(1, gradAcad - startAcad + 1);
}

function plannedCourses(schedule) {
  const out = [];
  for (const year of schedule) {
    for (const q of ['F','W','S','SU']) {
      out.push(...(year.quarters[q] || []).filter(c => c !== '_GAP' && !String(c).startsWith('FREE')));
    }
  }
  return out;
}

function maxMajorQuarter(schedule) {
  const typeMap = schedule.courseTypeMap || new Map();
  let max = 0;
  let maxQuarter = null;
  for (const year of schedule) {
    for (const q of ['F','W','S','SU']) {
      const arr = year.quarters[q] || [];
      const majorCourses = arr.filter(code => {
        if (!COURSES[code]) return false;
        const type = typeMap.get(code);
        if (!MAJOR_TYPES.has(type)) return false;
        const course = COURSES[code];
        return !(course.units <= 2 && course.labCoreq);
      });
      if (majorCourses.length > max) {
        max = majorCourses.length;
        maxQuarter = { label: `${year.label}-${q}`, courses: majorCourses };
      }
    }
  }
  return { max, maxQuarter };
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
              profiles.push(makeProfile({
                major, concentration, geConcentration,
                ...start,
                completedCourses: completedBase,
                includeSummer: pref.includeSummer || start.includeSummer || false,
                maxUnits: pref.maxUnits,
                ...gap,
                scenarioLabel: `${major}/${concentration || 'none'}/${geConcentration || 'none'}/${start.label}/${pref.label}/${gap.label}`,
                startLabel: start.label,
                prefLabel: pref.label,
                gapLabel: gap.label
              }));
            }
          }
        }
      }
    }
  }
  profiles.push(makeProfile({ major: 'TIM_BS', concentration: 'tim_entrepreneurship', avoidedCourses: ['TIM 171', 'TIM 174'], scenarioLabel: 'avoid-tim-electives', startLabel: 'explicit', prefLabel: 'standard', gapLabel: 'no-gap' }));
  profiles.push(makeProfile({ major: 'RE_BS', concentration: 're_ai_vision', includeSummer: false, maxUnits: 19, geConcentration: null, scenarioLabel: 'dense-re-no-ge', startLabel: 'explicit', prefLabel: 'standard', gapLabel: 'no-gap' }));
  profiles.push(makeProfile({ major: 'CS_BS', concentration: 'cs_ai_ml', completedCourses: ['MATH 19A','MATH 19B','CSE 20','CSE 30'], currentLevel: 2, currentTerm: 'F', currentYear: 2027, targetGradYear: 2030, geConcentration: null, scenarioLabel: 'cs-transfer-completed-core', startLabel: 'explicit', prefLabel: 'standard', gapLabel: 'no-gap' }));
  return profiles;
}

function warningBucket(message) {
  if (/^schedule length /.test(message)) return 'schedule length exceeds selected window';
  if (/^max major quarter /.test(message)) return 'major-course density exceeds target';
  if (/^high total units /.test(message)) return 'high total units';
  return message.replace(/\d+/g, '#');
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function top(map, n = 12) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, n);
}

function phaseSummary(explanation, schedule, validation, profile) {
  const phases = explanation.phases;
  const typeMap = schedule.courseTypeMap || new Map();
  const scheduled = plannedCourses(schedule);
  const scheduledTypeUnits = {};
  const scheduledTypeCount = {};
  for (const code of scheduled) {
    const type = typeMap.get(code) || 'unknown';
    scheduledTypeUnits[type] = (scheduledTypeUnits[type] || 0) + (COURSES[code]?.units || 0);
    scheduledTypeCount[type] = (scheduledTypeCount[type] || 0) + 1;
  }
  const majorQ = maxMajorQuarter(schedule);
  return {
    scenario: profile.scenarioLabel,
    years: schedule.length,
    expectedYears: yearsExpected(profile),
    units: validation.totalUnits,
    requiredUnits: validation.majorReqs.totalUnitsRequired,
    priorCredits: validation.priorCredits,
    completedCourses: profile.completedCourses || [],
    scheduledCourseCount: scheduled.length,
    selectedUnitsBeforePlacement: explanation.totals.selectedUnitsBeforePlacement,
    majorSelection: phases.majorSelection,
    geSelection: phases.geSelection,
    ucSelection: phases.ucSelection,
    prerequisiteExpansion: phases.prerequisiteExpansion,
    upperDivisionSupplement: phases.upperDivisionSupplement,
    freePadding: phases.freePadding,
    fillerPoolCount: phases.fillerPool.count,
    placement: phases.placement,
    scheduledTypeUnits,
    scheduledTypeCount,
    maxMajorQuarter: majorQ.max,
    maxMajorQuarterDetail: majorQ.maxQuarter
  };
}

function main() {
  const profiles = buildProfiles();
  const bucketCounts = new Map();
  const bucketByMajor = new Map();
  const bucketByStart = new Map();
  const bucketByPref = new Map();
  const bucketByGap = new Map();
  const warningRecords = [];

  for (const profile of profiles) {
    const { schedule, explanation } = Scheduler.generateWithExplanation(profile, { includeValidation: true });
    const validation = explanation.validation || Validator.validateAll(schedule, profile);
    const warnings = [];
    if (schedule.length > yearsExpected(profile)) warnings.push(`schedule length ${schedule.length}>window ${yearsExpected(profile)}`);
    const majorQ = maxMajorQuarter(schedule);
    if (majorQ.max > 3) warnings.push(`max major quarter ${majorQ.max}>3`);
    if (validation.totalUnits > 210) warnings.push(`high total units ${validation.totalUnits}`);
    for (const warning of warnings) {
      const bucket = warningBucket(warning);
      increment(bucketCounts, bucket);
      increment(bucketByMajor, `${bucket} :: ${profile.major}`);
      increment(bucketByStart, `${bucket} :: ${profile.startLabel}`);
      increment(bucketByPref, `${bucket} :: ${profile.prefLabel}`);
      increment(bucketByGap, `${bucket} :: ${profile.gapLabel}`);
    }
    if (warnings.length) warningRecords.push({ profile, warnings, summary: phaseSummary(explanation, schedule, validation, profile) });
  }

  const representatives = [];
  const wants = [
    r => r.profile.major === 'AM_BS' && r.profile.startLabel === 'freshman-winter' && r.profile.prefLabel === 'standard' && r.profile.gapLabel === 'no-gap' && r.profile.geConcentration === null,
    r => r.profile.major === 'AM_BS' && r.profile.startLabel === 'sophomore-spring' && r.profile.prefLabel === 'standard' && r.profile.gapLabel === 'no-gap' && r.profile.geConcentration === null,
    r => r.profile.major === 'AM_BS' && r.profile.startLabel === 'summer-start' && r.profile.prefLabel === 'standard' && r.profile.gapLabel === 'no-gap' && r.profile.geConcentration === null,
    r => r.profile.scenarioLabel === 'BMEB_BI/bi_computational/none/sophomore-spring/low-max-units/no-gap',
    r => r.profile.major === 'RE_BS' && r.profile.concentration === 're_ai_vision' && r.profile.startLabel === 'freshman-fall' && r.profile.prefLabel === 'standard' && r.profile.gapLabel === 'no-gap'
  ];
  for (const want of wants) {
    const record = warningRecords.find(want);
    if (record) representatives.push(record);
  }

  const output = {
    checked: profiles.length,
    bucketCounts: Object.fromEntries(top(bucketCounts, 10)),
    topBucketByMajor: Object.fromEntries(top(bucketByMajor, 36)),
    topBucketByStart: Object.fromEntries(top(bucketByStart, 20)),
    topBucketByPref: Object.fromEntries(top(bucketByPref, 20)),
    topBucketByGap: Object.fromEntries(top(bucketByGap, 20)),
    representatives: representatives.map(r => ({ warnings: r.warnings, ...r.summary }))
  };
  console.log(JSON.stringify(output, null, 2));
}

main();
