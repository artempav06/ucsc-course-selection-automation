const fs = require('fs');
const path = require('path');
const vm = require('vm');

const VALID_DIVISIONS = new Set(['lower', 'upper', 'graduate']);
const VALID_QUARTERS = new Set(['F', 'W', 'S', 'SU']);
const CATEGORY_TYPES = new Set(['all_required', 'pick_one', 'pick_n', 'choose_group', 'repeat_course']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asArrayLike(value) {
  if (Array.isArray(value)) return value;
  if (isPlainObject(value)) return Object.values(value);
  return [];
}

function add(errors, message) {
  errors.push(message);
}

function addWarning(warnings, message) {
  warnings.push(message);
}

function validateCourse(code, course, courses, errors, warnings, options) {
  const location = `COURSES[${code}]`;
  if (!isPlainObject(course)) {
    add(errors, `${location} must be an object`);
    return;
  }

  for (const field of ['title', 'units', 'division', 'prereqs', 'ge', 'quarters', 'desc', 'section', 'rmpScore']) {
    if (!(field in course)) add(errors, `${location} missing required field ${field}`);
  }

  if (typeof course.title !== 'string' || course.title.trim() === '') add(errors, `${location}.title must be a non-empty string`);
  if (typeof course.units !== 'number' || Number.isNaN(course.units) || course.units < 0) add(errors, `${location}.units must be a non-negative number`);
  if (!VALID_DIVISIONS.has(course.division)) add(errors, `${location}.division must be one of ${[...VALID_DIVISIONS].join(', ')}`);

  if (!Array.isArray(course.prereqs)) {
    add(errors, `${location}.prereqs must be an array`);
  } else {
    course.prereqs.forEach((group, groupIndex) => {
      if (!Array.isArray(group)) {
        add(errors, `${location}.prereqs[${groupIndex}] must be an array`);
        return;
      }
      if (group.length === 0) add(errors, `${location}.prereqs[${groupIndex}] must not be empty`);
      group.forEach((prereq, prereqIndex) => {
        if (typeof prereq !== 'string' || prereq.trim() === '') {
          add(errors, `${location}.prereqs[${groupIndex}][${prereqIndex}] must be a non-empty string`);
        } else if (!courses[prereq]) {
          const message = `${location} references unknown prerequisite ${prereq}`;
          if (options.strictPrereqReferences) add(errors, message);
          else addWarning(warnings, message);
        }
      });
    });
  }

  if (!(course.ge === null || typeof course.ge === 'string')) add(errors, `${location}.ge must be string or null`);

  if (!Array.isArray(course.quarters)) {
    add(errors, `${location}.quarters must be an array`);
  } else {
    const seen = new Set();
    course.quarters.forEach((quarter, index) => {
      if (!VALID_QUARTERS.has(quarter)) add(errors, `${location}.quarters[${index}] has invalid quarter ${quarter}`);
      if (seen.has(quarter)) add(errors, `${location}.quarters has duplicate quarter ${quarter}`);
      seen.add(quarter);
    });
  }

  if (!Array.isArray(course.section)) {
    add(errors, `${location}.section must be an array`);
  } else {
    course.section.forEach((section, index) => {
      if (typeof section !== 'string' || section.trim() === '') add(errors, `${location}.section[${index}] must be a non-empty string`);
    });
  }

  if (typeof course.rmpScore !== 'number' || Number.isNaN(course.rmpScore)) add(errors, `${location}.rmpScore must be a number`);
  if (!course.catalogUrl) addWarning(warnings, `${location} missing catalogUrl`);
  if (course.labCoreq && !courses[course.labCoreq]) add(errors, `${location} references unknown labCoreq ${course.labCoreq}`);
}

function collectCategoryCourseRefs(category) {
  if (!isPlainObject(category)) return [];
  if (category.type === 'repeat_course' && typeof category.course === 'string') return [category.course];
  if (Array.isArray(category.courses)) return category.courses;
  if (Array.isArray(category.groups)) return category.groups.flatMap(group => Array.isArray(group.courses) ? group.courses : []);
  return [];
}

function validateCourseRefMatrix(location, matrixName, matrix, courses, errors) {
  if (!Array.isArray(matrix)) {
    add(errors, `${location}.${matrixName} must be an array`);
    return;
  }
  matrix.forEach((group, groupIndex) => {
    if (!Array.isArray(group) || group.length === 0) {
      add(errors, `${location}.${matrixName}[${groupIndex}] must be a non-empty array`);
      return;
    }
    group.forEach(ref => {
      if (typeof ref !== 'string' || ref.trim() === '') add(errors, `${location}.${matrixName}[${groupIndex}] has malformed course reference`);
      else if (!courses[ref]) add(errors, `${location}.${matrixName}[${groupIndex}] references unknown course ${ref}`);
    });
  });
}

function validateRicherMetadata(location, category, courses, errors) {
  if (category.prerequisitesByMajor !== undefined) {
    if (!isPlainObject(category.prerequisitesByMajor)) {
      add(errors, `${location}.prerequisitesByMajor must be an object`);
    } else {
      for (const [majorId, groups] of Object.entries(category.prerequisitesByMajor)) {
        validateCourseRefMatrix(location, `prerequisitesByMajor[${majorId}]`, groups, courses, errors);
      }
    }
  }
  if (category.equivalentCourses !== undefined) validateCourseRefMatrix(location, 'equivalentCourses', category.equivalentCourses, courses, errors);
  if (category.creditExclusions !== undefined) validateCourseRefMatrix(location, 'creditExclusions', category.creditExclusions, courses, errors);
  if (category.catalogYear !== undefined && (typeof category.catalogYear !== 'string' || category.catalogYear.trim() === '')) {
    add(errors, `${location}.catalogYear must be a non-empty string`);
  }
}

function validateCategory(majorId, category, courses, seenCategoryIds, errors, warnings) {
  const location = `MAJOR_REQUIREMENTS[${majorId}].categories`;
  if (!isPlainObject(category)) {
    add(errors, `${location} entry must be an object`);
    return;
  }

  for (const field of ['id', 'name', 'type']) {
    if (typeof category[field] !== 'string' || category[field].trim() === '') add(errors, `${location} category missing non-empty ${field}`);
  }

  if (category.id) {
    if (seenCategoryIds.has(category.id)) add(errors, `MAJOR_REQUIREMENTS[${majorId}] has duplicate category id ${category.id}`);
    seenCategoryIds.add(category.id);
  }

  if (!CATEGORY_TYPES.has(category.type)) {
    add(errors, `${location}[${category.id || '?'}] has unsupported type ${category.type}`);
    return;
  }

  if (category.type === 'repeat_course') {
    if (typeof category.course !== 'string' || category.course.trim() === '') {
      add(errors, `${location}[${category.id}] repeat_course requires non-empty course`);
    } else if (!courses[category.course]) {
      add(errors, `${location}[${category.id}] repeat_course references unknown course ${category.course}`);
    }
    if (typeof category.minUnits !== 'number' || Number.isNaN(category.minUnits) || category.minUnits <= 0) {
      add(errors, `${location}[${category.id}] repeat_course requires positive minUnits`);
    }
    if (!Number.isInteger(category.minTerms) || category.minTerms <= 0) {
      add(errors, `${location}[${category.id}] repeat_course requires positive integer minTerms`);
    }
  } else if (category.type === 'choose_group') {
    if (!Array.isArray(category.groups) || category.groups.length === 0) {
      add(errors, `${location}[${category.id}] choose_group must have non-empty groups`);
    } else {
      category.groups.forEach((group, index) => {
        if (!isPlainObject(group)) {
          add(errors, `${location}[${category.id}].groups[${index}] must be an object`);
          return;
        }
        if (typeof group.label !== 'string' || group.label.trim() === '') add(errors, `${location}[${category.id}].groups[${index}] missing non-empty label`);
        if (!Array.isArray(group.courses) || group.courses.length === 0) add(errors, `${location}[${category.id}].groups[${index}] must have non-empty courses`);
      });
    }
  } else {
    if (!Array.isArray(category.courses) || category.courses.length === 0) add(errors, `${location}[${category.id}] ${category.type} must have non-empty courses`);
  }

  if (category.type === 'pick_n') {
    if (!Number.isInteger(category.n) || category.n < 1) {
      add(errors, `${location}[${category.id}] pick_n requires positive integer n`);
    } else if (Array.isArray(category.courses) && category.n > category.courses.length) {
      add(errors, `${location}[${category.id}] pick_n n=${category.n} exceeds course count ${category.courses.length}`);
    }
  }

  for (const ref of collectCategoryCourseRefs(category)) {
    if (typeof ref !== 'string' || ref.trim() === '') {
      add(errors, `${location}[${category.id}] has malformed course reference`);
    } else if (!courses[ref]) {
      add(errors, `${location}[${category.id}] references unknown course ${ref}`);
    } else if (courses[ref].quarters && Array.isArray(courses[ref].quarters) && courses[ref].quarters.length === 0 && /elective|choice|pick|supplement/i.test(category.name || category.id || '')) {
      addWarning(warnings, `${location}[${category.id}] includes no-offering course ${ref} in elective-like category`);
    }
  }

  validateRicherMetadata(`${location}[${category.id}]`, category, courses, errors);
}

function validateMajor(majorId, major, courses, errors, warnings) {
  const location = `MAJOR_REQUIREMENTS[${majorId}]`;
  if (!isPlainObject(major)) {
    add(errors, `${location} must be an object`);
    return;
  }
  if (major.id !== majorId) add(errors, `${location}.id must match key ${majorId}`);
  if (typeof major.name !== 'string' || major.name.trim() === '') add(errors, `${location}.name must be a non-empty string`);
  if (typeof major.catalogUrl !== 'string' || major.catalogUrl.trim() === '') add(errors, `${location}.catalogUrl must be a non-empty string`);
  if (!Array.isArray(major.categories) || major.categories.length === 0) {
    add(errors, `${location}.categories must be a non-empty array`);
    return;
  }

  const seenCategoryIds = new Set();
  major.categories.forEach(category => validateCategory(majorId, category, courses, seenCategoryIds, errors, warnings));
}

function validateGeRequirements(geRequirements, courses, errors, warnings, options) {
  const geList = asArrayLike(geRequirements);
  geList.forEach((ge, index) => {
    const id = ge && ge.id ? ge.id : String(index);
    const location = `GE ${id}`;
    if (!isPlainObject(ge)) {
      add(errors, `${location} must be an object`);
      return;
    }
    if (typeof ge.id !== 'string' || ge.id.trim() === '') add(errors, `${location} missing non-empty id`);
    if (typeof ge.name !== 'string' || ge.name.trim() === '') add(errors, `${location} missing non-empty name`);
    if (!Number.isInteger(ge.needed) || ge.needed < 0) add(errors, `${location} needs non-negative integer needed`);

    for (const ref of ge.courses || []) {
      if (!courses[ref]) {
        const message = `GE ${id} references unknown course ${ref}`;
        if (options.strictGeReferences) add(errors, message);
        else addWarning(warnings, message);
      }
    }
    for (const ref of ge.autoSatisfiedBy || []) {
      if (!courses[ref]) {
        const message = `GE ${id} autoSatisfiedBy references unknown course ${ref}`;
        if (options.strictGeReferences) add(errors, message);
        else addWarning(warnings, message);
      }
    }
    for (const sub of ge.subcategories || []) {
      for (const ref of sub.courses || []) {
        if (!courses[ref]) {
          const message = `GE ${id} subcategory ${sub.id || '?'} references unknown course ${ref}`;
          if (options.strictGeReferences) add(errors, message);
          else addWarning(warnings, message);
        }
      }
    }
  });
}

function validateData(data, options = {}) {
  options = {
    strictPrereqReferences: true,
    strictGeReferences: true,
    ...options
  };
  const errors = [];
  const warnings = [];
  const courses = data.courses || data.COURSES || {};
  const majors = data.majors || data.MAJOR_REQUIREMENTS || {};
  const geRequirements = data.geRequirements || data.GE_REQUIREMENTS || [];

  if (!isPlainObject(courses)) add(errors, 'COURSES must be an object');
  if (!isPlainObject(majors)) add(errors, 'MAJOR_REQUIREMENTS must be an object');
  if (errors.length) return { errors, warnings };

  for (const [code, course] of Object.entries(courses)) validateCourse(code, course, courses, errors, warnings, options);
  for (const [majorId, major] of Object.entries(majors)) validateMajor(majorId, major, courses, errors, warnings);
  validateGeRequirements(geRequirements, courses, errors, warnings, options);

  return { errors, warnings };
}


function classifyWarning(warning) {
  if (/missing catalogUrl/.test(warning)) return 'missingCatalogUrl';
  if (/references unknown prerequisite|prereq references unknown course/.test(warning)) return 'unknownPrerequisiteReference';
  if (/^GE .*references unknown course|^GE .*autoSatisfiedBy references unknown course|^GE .*subcategory .*references unknown course/.test(warning)) return 'unknownGeReference';
  if (/no current offerings|includes no-offering course/.test(warning)) return 'noCurrentOfferings';
  return 'other';
}

function summarizeWarnings(warnings) {
  const buckets = {};
  for (const warning of warnings || []) {
    const key = classifyWarning(warning);
    if (!buckets[key]) buckets[key] = { count: 0, examples: [] };
    buckets[key].count += 1;
    if (buckets[key].examples.length < 5) buckets[key].examples.push(warning);
  }
  return { total: (warnings || []).length, buckets };
}

function buildDirectMajorReferenceMap(majors) {
  const refs = new Map();
  for (const [majorId, major] of Object.entries(majors || {})) {
    for (const category of major.categories || []) {
      for (const course of collectCategoryCourseRefs(category)) {
        if (!refs.has(course)) refs.set(course, new Set());
        refs.get(course).add(majorId);
      }
    }
  }
  return refs;
}

function warningCourseCode(warning) {
  const courseMatch = warning.match(/^COURSES\[(.+?)\]/);
  if (courseMatch) return courseMatch[1];
  return null;
}

function emptyImpactGroup() {
  return { count: 0, examples: [] };
}

function addImpactExample(group, warning, majors) {
  group.count += 1;
  if (group.examples.length < 10) group.examples.push({ warning, majors });
}

function summarizeWarningImpact(warnings, data) {
  const majors = data.majors || data.MAJOR_REQUIREMENTS || {};
  const directMajorRefs = buildDirectMajorReferenceMap(majors);
  const buckets = {};

  for (const warning of warnings || []) {
    const bucket = classifyWarning(warning);
    if (!buckets[bucket]) {
      buckets[bucket] = {
        total: 0,
        directSupportedMajor: emptyImpactGroup(),
        outsideSupportedMajor: emptyImpactGroup()
      };
    }

    buckets[bucket].total += 1;
    const code = warningCourseCode(warning);
    const majorsForCourse = code && directMajorRefs.has(code) ? [...directMajorRefs.get(code)].sort() : [];
    if (majorsForCourse.length) {
      addImpactExample(buckets[bucket].directSupportedMajor, warning, majorsForCourse);
    } else {
      addImpactExample(buckets[bucket].outsideSupportedMajor, warning, []);
    }
  }

  return { total: (warnings || []).length, buckets };
}

function loadRuntimeData(rootDir = process.cwd()) {
  const context = { console };
  vm.createContext(context);
  const exportsByFile = {
    'js/courses.js': 'if (typeof COURSES !== "undefined") this.COURSES = COURSES;',
    'js/majors.js': 'if (typeof MAJOR_REQUIREMENTS !== "undefined") this.MAJOR_REQUIREMENTS = MAJOR_REQUIREMENTS;',
    'js/data.js': 'if (typeof GE_REQUIREMENTS !== "undefined") this.GE_REQUIREMENTS = GE_REQUIREMENTS; if (typeof UC_REQUIREMENTS !== "undefined") this.UC_REQUIREMENTS = UC_REQUIREMENTS;'
  };
  for (const rel of ['js/courses.js', 'js/majors.js', 'js/data.js']) {
    const file = path.join(rootDir, rel);
    const source = `${fs.readFileSync(file, 'utf8')}\n;${exportsByFile[rel]}`;
    vm.runInContext(source, context, { filename: rel });
  }
  return {
    courses: context.COURSES,
    majors: context.MAJOR_REQUIREMENTS,
    geRequirements: context.GE_REQUIREMENTS,
    ucRequirements: context.UC_REQUIREMENTS
  };
}

module.exports = {
  validateData,
  loadRuntimeData,
  collectCategoryCourseRefs,
  summarizeWarnings,
  summarizeWarningImpact,
  classifyWarning
};
