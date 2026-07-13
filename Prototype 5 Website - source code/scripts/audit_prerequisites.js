#!/usr/bin/env node
// Official UCSC prerequisite audit helper.
// Fetches catalog pages for courses referenced by supported-major requirements and
// writes a review report. It intentionally does NOT auto-edit prereq data.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const load = f => vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'));
load('js/courses.js');
load('js/majors.js');
load('js/data.js');

function parseArgs(argv) {
  const args = { major: 'CS_BA', out: null, fetch: false };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--major') args.major = argv[++i];
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--fetch') args.fetch = true;
    else if (arg === '--all-supported') args.major = 'ALL';
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function courseRefsFromCategory(category, out) {
  for (const code of category.courses || []) out.add(code);
  for (const group of category.groups || []) for (const code of group.courses || []) out.add(code);
}

function courseRefsForMajor(majorId) {
  const major = MAJOR_REQUIREMENTS[majorId];
  if (!major) throw new Error(`Unknown major: ${majorId}`);
  const refs = new Set();
  for (const category of major.categories || []) courseRefsFromCategory(category, refs);
  return [...refs].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPrerequisiteText(html) {
  const text = stripHtml(html);
  const match = text.match(/Prerequisite\(s\):\s*(.*?)(?=\s(?:Enrollment|Credits|Repeat|Requirements|General Education|Grading|Fees|Terms|Also offered|$))/i);
  return match ? match[1].trim() : '';
}

function fetchUrl(url) {
  return new Promise(resolve => {
    https.get(url, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        res.resume();
        fetchUrl(next).then(resolve);
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: data }));
    }).on('error', error => resolve({ ok: false, status: 0, error: error.message, body: '' }));
  });
}

function localPrereqText(code) {
  const groups = COURSES[code]?.prereqs || [];
  if (!groups.length) return '(none encoded)';
  return groups.map(group => `(${group.join(' OR ')})`).join(' AND ');
}

function officialAlternativesPresentNote(code, official) {
  if (!official) return '';
  const mentioned = [...official.matchAll(/\b[A-Z]{2,5}\s+\d+[A-Z]?\b/g)].map(m => m[0]);
  const unique = [...new Set(mentioned)];
  const missing = unique.filter(c => !COURSES[c]);
  return missing.length ? `Official alternatives not in local COURSES: ${missing.join(', ')}` : '';
}

async function main() {
  const args = parseArgs(process.argv);
  const majorIds = args.major === 'ALL' ? Object.keys(MAJOR_REQUIREMENTS).sort() : [args.major];
  const courseToMajors = new Map();
  for (const majorId of majorIds) {
    for (const code of courseRefsForMajor(majorId)) {
      if (!courseToMajors.has(code)) courseToMajors.set(code, []);
      courseToMajors.get(code).push(majorId);
    }
  }
  const codes = [...courseToMajors.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const rows = [];
  for (const code of codes) {
    const course = COURSES[code];
    const row = {
      code,
      majors: courseToMajors.get(code),
      exists: !!course,
      catalogUrl: course?.catalogUrl || '',
      localPrereqs: course ? localPrereqText(code) : '(missing local course)',
      officialPrereqs: '',
      fetchStatus: args.fetch ? 'not_fetched' : 'fetch_skipped',
      note: ''
    };
    if (args.fetch && course?.catalogUrl) {
      const url = course.catalogUrl.endsWith('/') ? course.catalogUrl : `${course.catalogUrl}/`;
      const result = await fetchUrl(url);
      row.fetchStatus = result.ok ? String(result.status) : `ERROR ${result.status}${result.error ? ` ${result.error}` : ''}`;
      row.officialPrereqs = result.ok ? extractPrerequisiteText(result.body) : '';
      row.note = officialAlternativesPresentNote(code, row.officialPrereqs);
    } else if (!course?.catalogUrl) {
      row.fetchStatus = 'missing_catalog_url';
    }
    rows.push(row);
  }

  const lines = [];
  lines.push(`# Prerequisite Audit — ${args.major === 'ALL' ? 'All Supported Majors' : args.major}`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('Official source rule: UCSC General Catalog course pages only. This report is evidence for human review; it does not auto-apply scraped prerequisite text.');
  lines.push('');
  lines.push(`Courses referenced: ${rows.length}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Missing local course entries: ${rows.filter(r => !r.exists).length}`);
  lines.push(`- Missing catalog URLs: ${rows.filter(r => r.fetchStatus === 'missing_catalog_url').length}`);
  lines.push(`- Official pages fetched: ${rows.filter(r => /^2/.test(r.fetchStatus)).length}`);
  lines.push(`- Official prerequisite text found: ${rows.filter(r => r.officialPrereqs).length}`);
  lines.push('');
  lines.push('## Course evidence');
  lines.push('');
  for (const row of rows) {
    lines.push(`### ${row.code}`);
    lines.push('');
    lines.push(`- Majors: ${row.majors.join(', ')}`);
    lines.push(`- Catalog URL: ${row.catalogUrl || '(missing)'}`);
    lines.push(`- Fetch status: ${row.fetchStatus}`);
    lines.push(`- Local prereqs: ${row.localPrereqs}`);
    lines.push(`- Official prerequisite text: ${row.officialPrereqs || '(none found / none listed)'}`);
    if (row.note) lines.push(`- Note: ${row.note}`);
    lines.push('- Review status: pending human encoding check');
    lines.push('');
  }
  const output = lines.join('\n');
  if (args.out) {
    fs.mkdirSync(path.dirname(path.join(ROOT, args.out)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, args.out), output);
    console.log(`wrote ${args.out}`);
  } else {
    console.log(output);
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
