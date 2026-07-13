#!/usr/bin/env node
// Fetch official UCSC General Catalog detail pages for current official courses.
// Writes prerequisite evidence and review flags. Does not edit course data.
const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'audit');
const INDEX_PATH = path.join(OUT_DIR, 'official-catalog-course-index.json');
const DETAILS_OUT = path.join(OUT_DIR, 'official-catalog-course-details.json');
const PREREQ_REPORT_OUT = path.join(OUT_DIR, 'official-prerequisite-review-report.json');

function parseArgs(argv) {
  const args = { onlyLocalExact: true, limit: 0, concurrency: 12 };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--all-official') args.onlyLocalExact = false;
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else if (arg === '--concurrency') args.concurrency = Number(argv[++i]);
    else throw new Error(`Unknown arg: ${arg}`);
  }
  return args;
}

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
    .replace(/&mdash;/g, '—');
}

function stripHtml(html) {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fetchUrl(url) {
  return new Promise(resolve => {
    https.get(url.endsWith('/') ? url : `${url}/`, { headers: { 'User-Agent': 'Hermes-UCSC-Catalog-Audit/1.0' } }, res => {
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

function extractPrerequisiteText(html) {
  const text = stripHtml(html);
  const match = text.match(/Prerequisites?(?:\(s\))?:\s*(.*?)(?=\s(?:Enrollment|Credits|Repeat|Requirements|General Education|Grading|Fees|Terms|Also offered|Quarter offered|Instructor|$))/i);
  return match ? match[1].trim() : '';
}

function extractCreditsText(html) {
  const text = stripHtml(html);
  const match = text.match(/Credits\s+(\d+(?:\.\d+)?)/i);
  return match ? match[1] : '';
}

function mentionedCourseCodes(text) {
  return [...new Set([...String(text || '').matchAll(/\b[A-Z]{2,5}\s+\d+[A-Z]?\b/g)].map(m => m[0]))];
}

function flagsForPrereq(text) {
  const lower = String(text || '').toLowerCase();
  const flags = [];
  if (!text) flags.push('no-official-prereq-text-found');
  if (/recommended/.test(lower)) flags.push('contains-recommended-language');
  if (/permission|consent|instructor/.test(lower)) flags.push('contains-permission-or-consent-exception');
  if (/previous or concurrent|prior or concurrent|previously or concurrently|concurrent/.test(lower)) flags.push('contains-prior-or-concurrent-language');
  if (/placement|mpe|exam|test[- ]?out|ap |ib |entry level writing|composition|writing/.test(lower)) flags.push('contains-placement-exam-or-writing-requirement');
  if (/major|majors|restricted|enrollment is restricted/.test(lower)) flags.push('contains-major-or-enrollment-condition');
  return flags;
}

function loadLocalCourses() {
  const context = { console };
  vm.createContext(context);
  const source = `${fs.readFileSync(path.join(ROOT, 'js', 'courses.js'), 'utf8')}\n;if (typeof COURSES !== 'undefined') this.COURSES = COURSES;`;
  vm.runInContext(source, context, { filename: 'js/courses.js' });
  return context.COURSES;
}

function localPrereqText(course) {
  const groups = course?.prereqs || [];
  const concurrentGroups = course?.concurrentPrereqs || [];
  const prior = groups.length ? groups.map(group => `(${group.join(' OR ')})`).join(' AND ') : '(none encoded)';
  const concurrent = concurrentGroups.length ? `; prior-or-concurrent: ${concurrentGroups.map(group => `(${group.join(' OR ')})`).join(' AND ')}` : '';
  return prior + concurrent;
}

function prereqMentionSetFromLocal(course) {
  const out = new Set();
  for (const group of course?.prereqs || []) for (const code of group) out.add(code);
  for (const group of course?.concurrentPrereqs || []) for (const code of group) out.add(code);
  return [...out].sort();
}

function sameMentionSet(a, b) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, limit) }, worker));
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const localCourses = loadLocalCourses();
  const localExact = new Set(Object.keys(localCourses).filter(code => index.courses.some(c => c.code === code)));
  let targets = args.onlyLocalExact ? index.courses.filter(c => localExact.has(c.code)) : index.courses;
  if (args.limit > 0) targets = targets.slice(0, args.limit);
  console.log(`Fetching details for ${targets.length} official course pages (concurrency ${args.concurrency})`);

  const details = await mapLimit(targets, args.concurrency, async (course, i) => {
    const result = await fetchUrl(course.url);
    if ((i + 1) % 250 === 0 || i === targets.length - 1) console.log(`Fetched ${i + 1}/${targets.length}`);
    const officialPrereqText = result.ok ? extractPrerequisiteText(result.body) : '';
    return {
      code: course.code,
      title: course.title,
      url: course.url,
      fetchStatus: result.ok ? result.status : `ERROR ${result.status}${result.error ? ` ${result.error}` : ''}`,
      creditsText: result.ok ? extractCreditsText(result.body) : '',
      officialPrereqText,
      mentionedCourses: mentionedCourseCodes(officialPrereqText),
      flags: flagsForPrereq(officialPrereqText)
    };
  });

  const byCode = new Map(details.map(d => [d.code, d]));
  fs.writeFileSync(DETAILS_OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    sourceIndex: path.relative(ROOT, INDEX_PATH),
    targetMode: args.onlyLocalExact ? 'local-exact-current-matches' : 'all-official-courses',
    count: details.length,
    details
  }, null, 2));

  const review = [];
  for (const code of Object.keys(localCourses).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (!byCode.has(code)) continue;
    const course = localCourses[code];
    const official = byCode.get(code);
    const localMentions = prereqMentionSetFromLocal(course);
    const officialMentions = official.mentionedCourses.filter(c => localCourses[c]);
    const missingOfficialAlternatives = official.mentionedCourses.filter(c => !localCourses[c]);
    let status = 'needs-human-review';
    if (!official.officialPrereqText && localMentions.length === 0) status = 'verified-no-prereq-text-and-none-encoded';
    else if (official.officialPrereqText && sameMentionSet(localMentions, officialMentions) && !official.flags.some(f => /recommended|prior-or-concurrent|placement|permission|major/.test(f))) status = 'mention-set-matches-simple-text';
    review.push({
      code,
      title: course.title,
      url: official.url,
      localPrereqText: localPrereqText(course),
      officialPrereqText: official.officialPrereqText || '(none found / none listed)',
      localMentionedCourses: localMentions,
      officialMentionedLocalCourses: officialMentions,
      officialAlternativesMissingLocally: missingOfficialAlternatives,
      flags: official.flags,
      status
    });
  }
  const buckets = {};
  for (const row of review) buckets[row.status] = (buckets[row.status] || 0) + 1;
  fs.writeFileSync(PREREQ_REPORT_OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    exactLocalCoursesReviewed: review.length,
    buckets,
    review
  }, null, 2));
  console.log(`Wrote ${path.relative(ROOT, DETAILS_OUT)}`);
  console.log(`Wrote ${path.relative(ROOT, PREREQ_REPORT_OUT)}`);
  console.log(`Review buckets: ${JSON.stringify(buckets)}`);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
