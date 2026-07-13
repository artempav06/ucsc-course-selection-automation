#!/usr/bin/env node
// Phase C diagnostic helper: summarize current combo-matrix schedule-quality warnings.
// Read-only: loads static scheduler globals, generates schedules, and prints aggregate
// warning/root-cause clues without changing scheduler behavior.

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

const MAJOR_TYPES = new Set(['major_core', 'major_elective', 'prereq']);

function makeProfile(overrides = {}) {
  return Object.assign({
    major: 'CS_BA', concentration: null,
    currentLevel: 1, currentTerm: 'F', currentYear: 2026,
    targetGradTerm: 'S', targetGradYear: 2030,
    completedCourses: [], avoidedCourses: [],
    includeSummer: false, maxUnits: 19, minUnits: 12,
    concentrationInterest: null, geConcentration: 'ge_arts_humanities',
    gapEnabled: false, gapType: null, gapTerm: null, gapYear: null,
    elwrSatisfied: false, priorCredits: 0, studentType: 'undergrad'
  }, overrides);
}

function academicYearOf(term, year) {
  return term === 'F' ? year : year - 1;
}

function yearsExpected(profile) {
  const startAcad = academicYearOf(profile.currentTerm, profile.currentYear);
  const gradAcad = academicYearOf(profile.targetGradTerm, profile.targetGradYear);
  return Math.max(1, gradAcad - startAcad + 1);
}

function units(codes) {
  return (codes || []).reduce((sum, code) => sum + (COURSES[code]?.units || 0), 0);
}

function plannedCourses(schedule, includeFree = true) {
  const out = [];
  for (const year of schedule) {
    for (const q of ['F', 'W', 'S', 'SU']) {
      const arr = year.quarters[q] || [];
      out.push(...arr.filter(c => c !== '_GAP' && (includeFree || !String(c).startsWith('FREE'))));
    }
  }
  return out;
}

function maxMajorQuarter(schedule) {
  const typeMap = schedule.courseTypeMap || new Map();
  let max = 0;
  let maxQuarter = null;
  for (const year of schedule) {
    for (const q of ['F', 'W', 'S', 'SU']) {
      const arr = year.quarters[q] || [];
      const majorCourses = arr.filter(code => {
        if (!COURSES[code]) return false;
        if (!MAJOR_TYPES.has(typeMap.get(code))) return false;
        const course = COURSES[code];
        return !(course.units <= 2 && course.labCoreq);
      });
      if (majorCourses.length > max) {
        max = majorCourses.length;
        maxQuarter = {
          label: `${year.label}-${q}`,
          majorCourses,
          majorUnits: units(majorCourses),
          allCourses: arr.slice(),
          allUnits: units(arr)
        };
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
  profiles.push(makeProfile({ major: 'CS_BS', concentration: 'cs_ai_ml', completedCourses: ['MATH 19A', 'MATH 19B', 'CSE 20', 'CSE 30'], currentLevel: 2, currentTerm: 'F', currentYear: 2027, targetGradYear: 2030, geConcentration: null, scenarioLabel: 'cs-transfer-completed-core', startLabel: 'explicit', prefLabel: 'standard', gapLabel: 'no-gap' }));
  return profiles;
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function top(map, n = 20) {
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, n);
}

function objectCounts(records, keyFn, limit = 30) {
  const counts = new Map();
  for (const record of records) increment(counts, keyFn(record));
  return Object.fromEntries(top(counts, limit));
}

function noGapLengthRootCauses(record) {
  const causes = [];
  if (record.prefLabel === 'low-max-units') causes.push('lowMaxUnits');
  if (!['freshman-fall', 'explicit'].includes(record.startLabel)) causes.push('compressedStart');
  if (record.scheduledUnits > record.expectedYears * 3 * 19) causes.push('heavyScheduledUnits');
  if (record.freeUnits > 0) causes.push('freePaddingContributes');
  if ((record.phaseUnits?.major || 0) >= 140) causes.push('denseMajorRequirements');
  if (record.years - record.expectedYears > 1) causes.push('multiYearOverrun');
  if (causes.length === 0) causes.push('needsFocusedPlacementInspection');
  return causes;
}

function summarizeNoGapLength(records) {
  const noGapLengthRecords = records.filter(record =>
    record.gapLabel === 'no-gap' && record.warnings.includes('schedule length exceeds selected window')
  );
  const rootCauseCounts = new Map();
  const rootCauseByPref = new Map();
  for (const record of noGapLengthRecords) {
    for (const cause of noGapLengthRootCauses(record)) {
      increment(rootCauseCounts, cause);
      increment(rootCauseByPref, `${record.prefLabel} :: ${cause}`);
    }
  }
  const summarizeExample = record => ({
    scenario: record.scenario,
    years: record.years,
    expectedYears: record.expectedYears,
    scheduledUnits: record.scheduledUnits,
    freeUnits: record.freeUnits,
    phaseUnits: record.phaseUnits,
    rootCauses: noGapLengthRootCauses(record),
    maxMajorQuarter: record.maxMajorQuarter?.maxQuarter?.label || null
  });
  const bySeverity = noGapLengthRecords.slice()
    .sort((a, b) => (
      ((b.years - b.expectedYears) - (a.years - a.expectedYears)) ||
      (b.freeUnits - a.freeUnits) ||
      ((b.phaseUnits?.major || 0) - (a.phaseUnits?.major || 0))
    ));
  return {
    count: noGapLengthRecords.length,
    byMajor: objectCounts(noGapLengthRecords, record => record.major),
    byStart: objectCounts(noGapLengthRecords, record => record.startLabel),
    byPref: objectCounts(noGapLengthRecords, record => record.prefLabel),
    rootCauseCounts: Object.fromEntries(top(rootCauseCounts, 20)),
    rootCauseByPref: Object.fromEntries(top(rootCauseByPref, 20)),
    representativeExamples: bySeverity.slice(0, 10).map(summarizeExample),
    standardExamples: bySeverity.filter(record => record.prefLabel === 'standard').slice(0, 10).map(summarizeExample)
  };
}

function summarizeRecord(profile, schedule, validation, explanation, warnings) {
  const scheduled = plannedCourses(schedule, true);
  const byTypeUnits = {};
  const typeMap = schedule.courseTypeMap || new Map();
  for (const code of scheduled) {
    const type = typeMap.get(code) || 'unknown';
    byTypeUnits[type] = (byTypeUnits[type] || 0) + (COURSES[code]?.units || 0);
  }
  const freeCourses = scheduled.filter(code => String(code).startsWith('FREE'));
  return {
    scenario: profile.scenarioLabel,
    major: profile.major,
    startLabel: profile.startLabel || 'unknown',
    prefLabel: profile.prefLabel || 'unknown',
    gapLabel: profile.gapLabel || 'unknown',
    warnings,
    years: schedule.length,
    expectedYears: yearsExpected(profile),
    totalUnits: validation.totalUnits,
    priorCredits: profile.priorCredits || 0,
    completedUnits: units(profile.completedCourses || []),
    scheduledUnits: units(scheduled),
    freeUnits: units(freeCourses),
    freeCount: freeCourses.length,
    phaseUnits: {
      major: explanation.phases.majorSelection.units,
      ge: explanation.phases.geSelection.units,
      uc: explanation.phases.ucSelection.units,
      prereq: explanation.phases.prerequisiteExpansion.units,
      upperDivSupplement: explanation.phases.upperDivisionSupplement.units,
      freePadding: explanation.phases.freePadding.units,
      selectedBeforePlacement: explanation.totals.selectedUnitsBeforePlacement
    },
    byTypeUnits,
    maxMajorQuarter: maxMajorQuarter(schedule)
  };
}

function main() {
  const bucketCounts = new Map();
  const bucketByMajor = new Map();
  const bucketByStart = new Map();
  const bucketByPref = new Map();
  const bucketByGap = new Map();
  const lengthOverrun = new Map();
  const highUnitInputs = new Map();
  const records = [];

  const profiles = buildProfiles();
  for (const profile of profiles) {
    const { schedule, explanation } = Scheduler.generateWithExplanation(profile, { includeValidation: true });
    const validation = explanation.validation || Validator.validateAll(schedule, profile);
    const warnings = [];
    if (schedule.length > yearsExpected(profile)) warnings.push('schedule length exceeds selected window');
    if (maxMajorQuarter(schedule).max > 3) warnings.push('major-course density exceeds target');
    const scheduledUnits = units(plannedCourses(schedule, true));
    if (scheduledUnits > 210) warnings.push('high scheduled units');
    for (const bucket of warnings) {
      increment(bucketCounts, bucket);
      increment(bucketByMajor, `${bucket} :: ${profile.major}`);
      increment(bucketByStart, `${bucket} :: ${profile.startLabel}`);
      increment(bucketByPref, `${bucket} :: ${profile.prefLabel}`);
      increment(bucketByGap, `${bucket} :: ${profile.gapLabel}`);
    }
    if (warnings.includes('schedule length exceeds selected window')) {
      increment(lengthOverrun, `${schedule.length - yearsExpected(profile)} year over`);
    }
    if (warnings.includes('high scheduled units')) {
      increment(highUnitInputs, `prior=${profile.priorCredits || 0} completedUnits=${units(profile.completedCourses || [])}`);
    }
    if (warnings.length) records.push(summarizeRecord(profile, schedule, validation, explanation, warnings));
  }

  const bySeverity = records.slice().sort((a, b) => (
    (b.totalUnits - a.totalUnits) ||
    ((b.years - b.expectedYears) - (a.years - a.expectedYears)) ||
    ((b.maxMajorQuarter.max || 0) - (a.maxMajorQuarter.max || 0))
  ));

  const output = {
    checked: profiles.length,
    warningRecords: records.length,
    bucketCounts: Object.fromEntries(top(bucketCounts, 10)),
    topBucketByMajor: Object.fromEntries(top(bucketByMajor, 30)),
    topBucketByStart: Object.fromEntries(top(bucketByStart, 20)),
    topBucketByPref: Object.fromEntries(top(bucketByPref, 20)),
    topBucketByGap: Object.fromEntries(top(bucketByGap, 20)),
    lengthOverrun: Object.fromEntries(top(lengthOverrun, 10)),
    noGapLengthTriage: summarizeNoGapLength(records),
    highUnitInputs: Object.fromEntries(top(highUnitInputs, 20)),
    severeHighUnitExamples: bySeverity.filter(r => r.warnings.includes('high scheduled units')).slice(0, 8),
    densityExamples: records.filter(r => r.warnings.includes('major-course density exceeds target')).slice(0, 8),
    lengthExamples: records.filter(r => r.warnings.includes('schedule length exceeds selected window')).slice(0, 8)
  };
  console.log(JSON.stringify(output, null, 2));
}

main();
