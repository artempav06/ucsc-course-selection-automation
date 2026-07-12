#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const load = f => vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
load('js/courses.js');
load('js/majors.js');
load('js/data.js');

function add(bucket, rule, message, extra = {}) { bucket.push({ rule, message, ...extra }); }

function auditInterestTags() {
  const hardErrors = [];
  const warnings = [];
  const majorGroups = [];
  const geGroups = (CONCENTRATIONS.ge || []);
  for (const [major, groups] of Object.entries(CONCENTRATIONS.major || {})) {
    for (const group of groups || []) majorGroups.push({ major, group });
  }

  const knownInterestIds = new Set([
    ...majorGroups.map(({ group }) => group.id),
    ...geGroups.map(group => group.id)
  ].filter(Boolean));

  for (const { major, group } of majorGroups) {
    if (!group.id) add(hardErrors, 'missing_major_interest_id', `Major ${major} has an interest group without an id`);
    const refs = group.courses || [];
    if (refs.length === 0) add(warnings, 'empty_major_interest_group', `Major ${major} interest ${group.id} has no referenced courses`, { major, id: group.id });
    let existing = 0;
    for (const code of refs) {
      if (COURSES[code]) existing++;
      else add(hardErrors, 'missing_major_interest_course', `Major ${major} interest ${group.id} references missing course ${code}`, { major, id: group.id, code });
    }
    if (refs.length > 0 && existing < Math.min(2, refs.length)) add(warnings, 'thin_major_interest_group', `Major ${major} interest ${group.id} has only ${existing} existing referenced courses`, { major, id: group.id, existing });
  }

  for (const group of geGroups) {
    if (!group.id) add(hardErrors, 'missing_ge_interest_id', 'GE interest group has no id');
    const refs = group.courses || [];
    const geCodes = group.geCodes || [];
    if (refs.length === 0 && geCodes.length === 0) add(warnings, 'empty_ge_interest_group', `GE interest ${group.id} has no courses or GE families`, { id: group.id });
    for (const code of refs) {
      if (!COURSES[code]) add(hardErrors, 'missing_ge_interest_course', `GE interest ${group.id} references missing course ${code}`, { id: group.id, code });
    }
    for (const geCode of geCodes) {
      const knownGE = (GE_REQUIREMENTS || []).some(req => req.id === geCode || (req.subcategories || []).includes(geCode));
      const knownUC = (UC_REQUIREMENTS || []).some(req => req.id === geCode || (req.subcategories || []).includes(geCode));
      if (!knownGE && !knownUC) add(hardErrors, 'unknown_ge_interest_family', `GE interest ${group.id} references unknown GE/UC family ${geCode}`, { id: group.id, geCode });
    }
  }

  for (const [code, course] of Object.entries(COURSES)) {
    for (const tag of course.concentrations || []) {
      if (!knownInterestIds.has(tag)) add(warnings, 'unknown_course_interest_tag', `Course ${code} has unknown concentration tag ${tag}`, { code, tag });
    }
  }

  return {
    hardErrors,
    warnings,
    summary: {
      majorInterestGroups: majorGroups.length,
      geInterestGroups: geGroups.length,
      courseInterestTags: Object.values(COURSES).reduce((sum, course) => sum + ((course.concentrations || []).length), 0)
    }
  };
}

const result = auditInterestTags();
if (process.argv.includes('--json')) console.log(JSON.stringify(result));
else {
  console.log(`Interest tag audit: ${result.hardErrors.length} hard errors, ${result.warnings.length} warnings`);
  console.log(JSON.stringify(result.summary, null, 2));
  for (const err of result.hardErrors.slice(0, 20)) console.error(`ERROR ${err.rule}: ${err.message}`);
  for (const warn of result.warnings.slice(0, 20)) console.warn(`WARN ${warn.rule}: ${warn.message}`);
}
if (result.hardErrors.length) process.exitCode = 1;
