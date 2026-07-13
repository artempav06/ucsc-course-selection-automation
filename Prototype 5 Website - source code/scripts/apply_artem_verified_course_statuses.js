#!/usr/bin/env node
// Apply Artem's verified 2026-27 catalog status spreadsheet decisions to Prototype 4 data.
// Inputs:
//   data/audit/artem-verified-course-statuses.json
//   data/audit/official-catalog-course-index.json
// Output edits:
//   js/courses.js
//   js/majors.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const VERIFIED_PATH = path.join(ROOT, 'data/audit/artem-verified-course-statuses.json');
const INDEX_PATH = path.join(ROOT, 'data/audit/official-catalog-course-index.json');
const COURSES_PATH = path.join(ROOT, 'js/courses.js');
const MAJORS_PATH = path.join(ROOT, 'js/majors.js');

const replacementMap = new Map([
  ['CSE 109', ['CSE 111']],
  ['CSE 116', ['CSE 114A']],
  ['CSE 131', ['CSE 130']],
  ['CSE 166A', ['ECON 166A']],
  ['CT 110', ['CT 167I']],
  ['CT 161', ['CT 167N']],
  ['CT 163', ['CT 167Q']],
  ['ECON 155', ['ECON 150']],
  ['HUMN 15', ['HTEC 15']],
  ['HUMN 25', ['HTEC 25']],
  ['HUMN 35', ['HTEC 35']],
  ['HUMN 45', ['HTEC 45']],
  ['HUMN 55', ['HTEC 55']],
  ['ART 10', ['ART 10D', 'ART 10E', 'ART 10F']],
  ['CSE 104A', ['CSE 104']],
  ['CSE 185', ['CSE 185E']],
  ['CSE 185S', ['CSE 185E']],
  ['ECON 110A', ['ECON 110']],
  ['ECON 110B', ['ECON 110']],
  ['ECON 160', ['ECON 160A', 'ECON 160B']],
  ['ECON 166', ['ECON 166A', 'ECON 166B']],
  ['FMST 194R', ['CRES 190R']],
  ['FMST 194U', ['CRES 190U']],
  ['FMST 194V', ['CRES 190V']],
  ['METX 141', ['METX 141L']],
  ['MUSC 11', ['MUSC 11A', 'MUSC 11B', 'MUSC 11C', 'MUSC 11D', 'MUSC 11E']],
]);

const divisionByCode = code => {
  const n = Number((String(code).match(/\b(\d+)/) || [])[1] || 0);
  if (n >= 200) return 'grad';
  if (n >= 100) return 'upper';
  return 'lower';
};

function decodeHtml(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(html) {
  return decodeHtml(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function fetchUrl(url) {
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Hermes-UCSC-Catalog-Audit/1.0' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        fetchUrl(next).then(resolve);
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body, url }));
    }).on('error', error => resolve({ ok: false, status: 0, body: '', error: error.message, url }));
  });
}

function textFromBlock(html, className) {
  const re = new RegExp(`<div\\s+class=["']${className}["'][^>]*>([\\s\\S]*?)<\\/div>`, 'i');
  const m = html.match(re);
  return m ? stripHtml(m[1]) : '';
}

function parseExtraFields(html) {
  const out = {};
  const re = /<div\s+class=["'](?:extraFields|quarter)["'][^>]*>\s*<h4>\s*([\s\S]*?)\s*<\/h4>\s*<p>([\s\S]*?)<\/p>\s*<\/div>/gi;
  let m;
  while ((m = re.exec(html))) {
    out[stripHtml(m[1])] = stripHtml(m[2]);
  }
  return out;
}

function extractTitle(html, fallbackCode, fallbackTitle) {
  const m = html.match(/<h1>\s*<span>\s*([^<]+)\s*<\/span>\s*([\s\S]*?)<\/h1>/i);
  if (!m) return fallbackTitle || '';
  return stripHtml(m[2]) || fallbackTitle || '';
}

function extractPrereqText(requirementsText) {
  const match = String(requirementsText || '').match(/Prerequisites?:\s*(.*?)(?=\s*Enrollment is restricted|\s*Enrollment restricted|\s*Credits\b|$)/i);
  return match ? match[1].trim() : '';
}

function extractEnrollmentText(requirementsText) {
  const match = String(requirementsText || '').match(/(Enrollment (?:is )?restricted[\s\S]*)$/i);
  return match ? match[1].trim() : '';
}

function quartersFromText(text, fallback = []) {
  const q = [];
  if (/Fall/i.test(text)) q.push('F');
  if (/Winter/i.test(text)) q.push('W');
  if (/Spring/i.test(text)) q.push('S');
  if (/Summer/i.test(text)) q.push('SU');
  return q.length ? q : fallback;
}

function loadData() {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${fs.readFileSync(COURSES_PATH, 'utf8')}\nthis.COURSES = COURSES;`, context, { filename: COURSES_PATH });
  vm.runInContext(`${fs.readFileSync(MAJORS_PATH, 'utf8')}\nthis.MAJOR_REQUIREMENTS = MAJOR_REQUIREMENTS; this.CS_BA_REQUIREMENTS = CS_BA_REQUIREMENTS;`, context, { filename: MAJORS_PATH });
  return { courses: context.COURSES, majors: context.MAJOR_REQUIREMENTS };
}

function clone(x) { return JSON.parse(JSON.stringify(x)); }

function mapCourseRefs(value) {
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) {
      if (typeof item === 'string') {
        const reps = replacementMap.get(item);
        if (reps) out.push(...reps);
        else out.push(item);
      } else {
        out.push(mapCourseRefs(item));
      }
    }
    return [...new Set(out)];
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = mapCourseRefs(value[key]);
  }
  return value;
}

function removeDeletedRefs(value, deletedCodes) {
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) {
      if (typeof item === 'string') {
        if (!deletedCodes.has(item)) out.push(item);
      } else {
        out.push(removeDeletedRefs(item, deletedCodes));
      }
    }
    return [...new Set(out)];
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = removeDeletedRefs(value[key], deletedCodes);
  }
  return value;
}

function remapPrereqGroups(groups) {
  return (groups || []).map(group => {
    const out = [];
    for (const code of group) out.push(...(replacementMap.get(code) || [code]));
    return [...new Set(out)];
  }).filter(group => group.length > 0);
}

function jsonConst(name, value) {
  return `const ${name} = ${JSON.stringify(value, null, 2)};`;
}

async function main() {
  const verified = JSON.parse(fs.readFileSync(VERIFIED_PATH, 'utf8'));
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const officialByCode = new Map(index.courses.map(c => [c.code, c]));
  const { courses, majors } = loadData();

  const activeCodes = new Set(verified.filter(r => /^Active - still offered$/i.test(r['Verified Status (2026-27 catalog)'] || '')).map(r => r.code));
  const oldCodes = new Set(verified.map(r => r.code));
  const replacementTargets = new Set([...replacementMap.values()].flat());
  const targetCodes = new Set([...activeCodes, ...replacementTargets]);

  const details = new Map();
  for (const code of [...targetCodes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    const official = officialByCode.get(code);
    if (!official) {
      console.warn(`WARN no official index entry for ${code}`);
      continue;
    }
    const result = await fetchUrl(official.url);
    if (!result.ok) {
      console.warn(`WARN fetch failed for ${code}: ${result.status} ${official.url}`);
      continue;
    }
    const fields = parseExtraFields(result.body);
    const requirements = fields.Requirements || '';
    const desc = textFromBlock(result.body, 'desc');
    details.set(code, {
      code,
      title: extractTitle(result.body, code, official.title),
      url: official.url,
      desc,
      units: fields.Credits ? Number(fields.Credits.match(/\d+(?:\.\d+)?/)?.[0] || 5) : 5,
      ge: fields['General Education Code'] || null,
      quarters: quartersFromText(fields['Quarter offered'] || '', []),
      requirements,
      officialPrereqText: extractPrereqText(requirements),
      enrollmentRestrictions: extractEnrollmentText(requirements),
    });
  }

  function sourceForTarget(target) {
    for (const [oldCode, reps] of replacementMap) if (reps.includes(target) && courses[oldCode]) return courses[oldCode];
    return null;
  }

  for (const code of targetCodes) {
    const detail = details.get(code);
    if (!detail) continue;
    const existing = courses[code] ? clone(courses[code]) : {};
    const source = sourceForTarget(code);
    const base = Object.keys(existing).length ? existing : clone(source || {});
    const sourceConcentrations = source?.concentrations || [];
    const sourceSection = source?.section || ['FREE'];
    const prereqs = Object.keys(existing).length ? existing.prereqs : remapPrereqGroups(source?.prereqs || []);
    const concurrentPrereqs = Object.keys(existing).length ? existing.concurrentPrereqs : remapPrereqGroups(source?.concurrentPrereqs || []);
    const course = {
      concentrations: base.concentrations || sourceConcentrations || [],
      title: detail.title || base.title || code,
      units: detail.units || base.units || 5,
      division: divisionByCode(code),
      prereqs: prereqs || [],
      ge: detail.ge || base.ge || null,
      quarters: detail.quarters.length ? detail.quarters : (base.quarters || ['F', 'W', 'S']),
      catalogUrl: detail.url,
      desc: detail.desc || base.desc || detail.title || code,
      section: base.section || sourceSection || ['FREE'],
      rmpScore: base.rmpScore ?? 0,
    };
    if (concurrentPrereqs && concurrentPrereqs.length) course.concurrentPrereqs = concurrentPrereqs;
    if (detail.enrollmentRestrictions || base.enrollmentRestrictions) course.enrollmentRestrictions = detail.enrollmentRestrictions || base.enrollmentRestrictions;
    course.officialPrereqText = detail.officialPrereqText || '(none found/ none listed)';
    if (/Entry Level Writing|Composition|permission|consent|placement|major|restricted/i.test(course.officialPrereqText || '')) {
      course.prereqNotes = base.prereqNotes || [];
      const note = `Official prerequisite/eligibility text: ${course.officialPrereqText}`;
      if (!course.prereqNotes.includes(note)) course.prereqNotes.push(note);
    }
    courses[code] = course;
  }

  // Map current prerequisites before deleting old aliases/stale courses.
  for (const course of Object.values(courses)) {
    course.prereqs = remapPrereqGroups(course.prereqs || []);
    if (course.concurrentPrereqs) course.concurrentPrereqs = remapPrereqGroups(course.concurrentPrereqs);
  }

  const deleteCodes = new Set([...oldCodes].filter(code => !activeCodes.has(code)));
  for (const code of deleteCodes) delete courses[code];

  // Remove stale deleted prerequisites that have no replacement.
  for (const course of Object.values(courses)) {
    course.prereqs = (course.prereqs || []).map(group => group.filter(c => !deleteCodes.has(c))).filter(group => group.length);
    if (course.concurrentPrereqs) course.concurrentPrereqs = course.concurrentPrereqs.map(group => group.filter(c => !deleteCodes.has(c))).filter(group => group.length);
  }

  // Update major requirement refs: replace mapped old codes, then drop deleted stale codes.
  mapCourseRefs(majors);
  removeDeletedRefs(majors, deleteCodes);

  const sortedCourses = Object.fromEntries(Object.entries(courses).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })));
  fs.writeFileSync(COURSES_PATH, `// ============================================================\n// courses.js  --  UCSC Course Selection Automation\n// Prototype 4 official catalog prerequisite sync.\n// Source of truth for prerequisite text: current UCSC General Catalog exact course pages.\n// Generated/updated by scripts/apply_artem_verified_course_statuses.js after Artem's #6 spreadsheet verification.\n// ============================================================\n\n${jsonConst('COURSES', sortedCourses)}\n`);

  const majorOrder = Object.keys(majors);
  let majorSrc = `// ============================================================\n// majors.js  --  UCSC Course Selection Automation\n// Major requirement definitions. Course references were refreshed from Artem's verified 2026-27 #6 stale-course review.\n// ============================================================\n\n`;
  for (const id of majorOrder) {
    const constName = `${id}_REQUIREMENTS`;
    majorSrc += `${jsonConst(constName, majors[id])}\n\n`;
  }
  majorSrc += `const MAJOR_REQUIREMENTS = {\n${majorOrder.map(id => `  ${JSON.stringify(id)}: ${id}_REQUIREMENTS`).join(',\n')}\n};\n`;
  fs.writeFileSync(MAJORS_PATH, majorSrc);

  const report = {
    generatedAt: new Date().toISOString(),
    activeKeptOrUpdated: [...activeCodes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    replacementMap: Object.fromEntries(replacementMap),
    deletedOldCodes: [...deleteCodes].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    targetCoursesFetched: [...details.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
  };
  fs.writeFileSync(path.join(ROOT, 'data/audit/artem-verified-course-application-report.json'), JSON.stringify(report, null, 2));
  console.log(`Updated ${path.relative(ROOT, COURSES_PATH)} and ${path.relative(ROOT, MAJORS_PATH)}`);
  console.log(`Kept/updated active: ${activeCodes.size}; replacement targets: ${replacementTargets.size}; deleted old codes: ${deleteCodes.size}`);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
