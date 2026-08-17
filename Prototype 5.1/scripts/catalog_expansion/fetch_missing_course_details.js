#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ROOT, LAB_DIR, parseArgs, stripHtml, fetchUrl, mapLimit, decodeHtml, divisionFrom, mentionedCourseCodes, subjectOf, departmentMatches } = require('./common');

function htmlField(html, label) {
  const re = new RegExp(`<h4>\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<\\/h4>\\s*<p>([\\s\\S]*?)<\\/p>`, 'i');
  const m = html.match(re);
  return m ? stripHtml(m[1]) : '';
}
function extractH1(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return { code: '', title: '' };
  const inner = m[1];
  const code = stripHtml((inner.match(/<span[^>]*>([\s\S]*?)<\/span>/i) || ['', ''])[1]);
  const title = stripHtml(inner.replace(/<span[^>]*>[\s\S]*?<\/span>/i, ''));
  return { code, title };
}
function extractDesc(html) {
  const m = html.match(/<div\s+class=["']desc["'][^>]*>([\s\S]*?)<\/div>/i);
  return m ? stripHtml(m[1]) : '';
}
function extractRequirements(html) {
  const req = htmlField(html, 'Requirements');
  const text = req || stripHtml(html);
  const m = text.match(/Prerequisites?(?:\(s\))?:\s*(.*?)(?=\s(?:Credits|Repeat|General Education|Grading|Fees|Terms|Quarter offered|Instructor|$))/i);
  return m ? m[1].trim() : (req && /Prereq/i.test(req) ? req : '');
}
function extractEnrollmentText(html) {
  const req = htmlField(html, 'Requirements');
  const enroll = htmlField(html, 'Enrollment Information');
  const desc = extractDesc(html);
  const text = [req, enroll, desc, stripHtml(html)].filter(Boolean).join(' ');
  const matches = [];
  for (const m of text.matchAll(/(?:Enrollment is restricted|Enrollment limited|Students are restricted|Restricted to|May be used|Cannot receive credit)[^.]*\./gi)) matches.push(m[0].trim());
  return [...new Set(matches)].join(' ');
}
function quarterCodes(text) {
  const out = [];
  const lower = String(text || '').toLowerCase();
  if (/fall/.test(lower)) out.push('F');
  if (/winter/.test(lower)) out.push('W');
  if (/spring/.test(lower)) out.push('S');
  if (/summer/.test(lower)) out.push('SU');
  return out;
}
function flagsFor(detail) {
  const flags = [];
  if (detail.fetchStatus !== 200) flags.push('fetch-not-ok');
  if (!detail.title) flags.push('missing-title');
  if (!detail.desc) flags.push('missing-description');
  if (!detail.units) flags.push('missing-units');
  const p = (detail.officialPrereqText || '').toLowerCase();
  if (!p) flags.push('no-official-prereq-text-found');
  if (/recommended/.test(p)) flags.push('contains-recommended-language');
  if (/permission|consent|instructor/.test(p)) flags.push('contains-permission-or-consent-exception');
  if (/previous or concurrent|prior or concurrent|previously or concurrently|concurrent/.test(p)) flags.push('contains-prior-or-concurrent-language');
  if (/placement|mpe|exam|test[- ]?out|ap |ib |entry level writing|composition|writing/.test(p)) flags.push('contains-placement-exam-or-writing-requirement');
  if (/exception|exceptions|waiver|petition/.test(p)) flags.push('contains-exception-waiver-or-petition-language');
  if (/major|majors|restricted|enrollment is restricted/.test((p + ' ' + detail.enrollmentText).toLowerCase())) flags.push('contains-major-or-enrollment-condition');
  return flags;
}
function chooseTargets(missing, args) {
  let departments = missing.departments || [];
  let courses = departments.flatMap(d => d.courses.map(c => ({ ...c, missingGroupSubject: d.subject })));
  if (args.department) courses = courses.filter(c => departmentMatches(c, args.department));
  if (args.limit) courses = courses.slice(0, Number(args.limit));
  return courses;
}
async function main() {
  const args = parseArgs(process.argv);
  const missingPath = path.join(LAB_DIR, 'missing-courses-by-department.json');
  if (!fs.existsSync(missingPath)) throw new Error('Missing missing-courses-by-department.json; run build_live_catalog_index.js first.');
  const missing = JSON.parse(fs.readFileSync(missingPath, 'utf8'));
  const targets = chooseTargets(missing, args);
  const concurrency = Number(args.concurrency || 8);
  const saveRaw = !!args.raw;
  const rawDir = path.join(LAB_DIR, 'official-course-raw-pages');
  if (saveRaw) fs.mkdirSync(rawDir, { recursive: true });
  console.log(`Fetching ${targets.length} missing official course detail pages${args.department ? ` for ${args.department}` : ''} (concurrency ${concurrency})`);
  const details = await mapLimit(targets, concurrency, async (course, i) => {
    const result = await fetchUrl(course.url);
    if ((i + 1) % 25 === 0 || i === targets.length - 1) console.log(`Fetched ${i + 1}/${targets.length}`);
    if (saveRaw && result.ok) fs.writeFileSync(path.join(rawDir, `${course.code.replace(/\s+/g, '_')}.html`), result.body);
    const h1 = result.ok ? extractH1(result.body) : { code: course.code, title: course.title };
    const creditsText = result.ok ? htmlField(result.body, 'Credits') : '';
    const detail = {
      code: course.code,
      title: h1.title || course.title,
      catalogUrl: course.url,
      departmentSlug: course.departmentSlug,
      departmentText: course.departmentText,
      divisionPath: course.divisionPath,
      division: divisionFrom(course.code, course.divisionPath),
      fetchStatus: result.status,
      units: Number(creditsText) || null,
      creditsText,
      desc: result.ok ? extractDesc(result.body) : '',
      ge: result.ok ? htmlField(result.body, 'General Education Code') : '',
      quarterText: result.ok ? htmlField(result.body, 'Quarter offered') : '',
      quarters: result.ok ? quarterCodes(htmlField(result.body, 'Quarter offered')) : [],
      officialPrereqText: result.ok ? extractRequirements(result.body) : '',
      enrollmentText: result.ok ? extractEnrollmentText(result.body) : '',
      repeatText: result.ok ? htmlField(result.body, 'Repeatable for Credit') : '',
      mentionedCourses: [],
      parserFlags: []
    };
    detail.mentionedCourses = mentionedCourseCodes(detail.officialPrereqText);
    detail.parserFlags = flagsFor(detail);
    return detail;
  });
  const payload = { generatedAt: new Date().toISOString(), source: 'missing-courses-by-department.json', mode: args.department ? `department=${args.department}` : 'all-missing', count: details.length, rawPagesSaved: saveRaw, details };
  fs.writeFileSync(path.join(LAB_DIR, 'official-course-details.json'), JSON.stringify(payload, null, 2));
  console.log(`Wrote ${path.relative(ROOT, path.join(LAB_DIR, 'official-course-details.json'))}`);
  const flagBuckets = {};
  for (const d of details) for (const f of d.parserFlags) flagBuckets[f] = (flagBuckets[f] || 0) + 1;
  console.log(`Parser flag buckets: ${JSON.stringify(flagBuckets)}`);
}
main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
