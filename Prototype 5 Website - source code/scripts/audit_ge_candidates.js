#!/usr/bin/env node
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '..');
const load = f => vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
load('js/courses.js');
load('js/majors.js');
load('js/data.js');

function familyOf(geCode) {
  const req = [...(GE_REQUIREMENTS || []), ...(UC_REQUIREMENTS || [])]
    .find(item => item.id === geCode || (item.subcategories || []).includes(geCode));
  return req ? req.id : geCode;
}

function courseFamilies(code) {
  const course = COURSES[code];
  const families = new Set();
  if (!course) return families;
  if (course.ge) families.add(familyOf(course.ge));
  for (const req of [...(GE_REQUIREMENTS || []), ...(UC_REQUIREMENTS || [])]) {
    if ((req.courses || []).includes(code) || (req.autoSatisfiedBy || []).includes(code)) families.add(req.id);
    if ((course.alsoSatisfies || []).includes(req.id)) families.add(req.id);
    if ((req.subcategories || []).some(sub => (course.alsoSatisfies || []).includes(sub))) families.add(req.id);
  }
  families.delete(null);
  return families;
}

function add(bucket, rule, message, extra = {}) { bucket.push({ rule, message, ...extra }); }

function auditGECandidates() {
  const hardErrors = [];
  const warnings = [];
  const checked = new Set();
  const requirements = [...(GE_REQUIREMENTS || []), ...(UC_REQUIREMENTS || [])];

  for (const req of requirements) {
    for (const code of req.courses || []) {
      checked.add(code);
      const course = COURSES[code];
      if (!course) {
        add(hardErrors, 'missing_requirement_course', `${req.id} references missing course ${code}`, { requirement: req.id, code });
        continue;
      }
      if (!course.units || course.units < 1) add(hardErrors, 'invalid_requirement_course_units', `${code} has invalid units for ${req.id}`, { requirement: req.id, code });
      if (!Array.isArray(course.quarters) || course.quarters.length === 0) add(warnings, 'missing_requirement_course_offerings', `${code} has no offering quarters`, { requirement: req.id, code });
      const families = courseFamilies(code);
      if (!families.has(req.id) && !(req.courses || []).includes(code)) add(warnings, 'candidate_family_mismatch', `${code} does not explicitly map back to ${req.id}`, { requirement: req.id, code, families: [...families] });
    }
  }

  for (const group of CONCENTRATIONS.ge || []) {
    for (const code of group.courses || []) {
      checked.add(code);
      const course = COURSES[code];
      if (!course) {
        add(hardErrors, 'missing_ge_interest_candidate', `GE interest ${group.id} references missing course ${code}`, { group: group.id, code });
        continue;
      }
      if (courseFamilies(code).size === 0) add(warnings, 'ge_interest_candidate_without_ge_family', `${code} is in GE interest ${group.id} but has no GE/UC family mapping`, { group: group.id, code });
    }
    for (const geCode of group.geCodes || []) {
      const family = familyOf(geCode);
      if (!requirements.some(req => req.id === family)) add(hardErrors, 'unknown_ge_interest_family', `GE interest ${group.id} references unknown family ${geCode}`, { group: group.id, geCode });
    }
  }

  for (const [code, course] of Object.entries(COURSES)) {
    if (course.ge) checked.add(code);
  }

  return {
    hardErrors,
    warnings,
    summary: {
      geRequirements: (GE_REQUIREMENTS || []).length,
      ucRequirements: (UC_REQUIREMENTS || []).length,
      checkedCourses: checked.size,
      geTaggedCourses: Object.values(COURSES).filter(course => course.ge).length
    }
  };
}

const result = auditGECandidates();
if (process.argv.includes('--json')) console.log(JSON.stringify(result));
else {
  console.log(`GE candidate audit: ${result.hardErrors.length} hard errors, ${result.warnings.length} warnings`);
  console.log(JSON.stringify(result.summary, null, 2));
  for (const err of result.hardErrors.slice(0, 20)) console.error(`ERROR ${err.rule}: ${err.message}`);
  for (const warn of result.warnings.slice(0, 20)) console.warn(`WARN ${warn.rule}: ${warn.message}`);
}
if (result.hardErrors.length) process.exitCode = 1;
