#!/usr/bin/env node
// Build a local index of current official UCSC General Catalog course pages.
// Source rule: catalog.ucsc.edu current General Catalog pages only.
// This script does not edit course data. It writes JSON reports for review.
const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://catalog.ucsc.edu';
const COURSES_ROOT = `${BASE}/en/current/general-catalog/courses/`;
const OUT_DIR = path.join(ROOT, 'data', 'audit');
const INDEX_OUT = path.join(OUT_DIR, 'official-catalog-course-index.json');
const MATCH_OUT = path.join(OUT_DIR, 'official-catalog-local-match-report.json');

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

function absolutize(href) {
  if (!href) return '';
  return new URL(href, BASE).toString().replace(/\/$/, '');
}

function parseLinks(html) {
  const links = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    const text = stripHtml(m[2]);
    links.push({ href, url: absolutize(href), text });
  }
  return links;
}

function normalizeCode(code) {
  return String(code || '').toUpperCase().replace(/\s+/g, ' ').trim();
}

function courseCodeFromText(text) {
  const m = String(text || '').match(/^([A-Z]{2,5})\s+(\d+[A-Z]*)\b/);
  return m ? `${m[1]} ${m[2]}` : '';
}

function courseCodeFromUrl(url) {
  const slug = String(url || '').split('/').filter(Boolean).pop() || '';
  const m = slug.match(/^([a-z]{2,5})-(\d+[a-z]*)$/i);
  return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : '';
}

function departmentLinksFromCoursesRoot(html) {
  const seen = new Map();
  for (const link of parseLinks(html)) {
    if (!/\/en\/current\/general-catalog\/courses\/[a-z0-9-]+\/?$/i.test(link.url)) continue;
    if (/\/courses\/?$/i.test(link.url)) continue;
    const slug = link.url.split('/').filter(Boolean).pop();
    if (!slug || ['lower-division', 'upper-division', 'graduate'].includes(slug)) continue;
    seen.set(link.url, { url: link.url, text: link.text, slug });
  }
  return [...seen.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

function courseLinksFromDepartmentPage(html, department) {
  const seen = new Map();
  for (const link of parseLinks(html)) {
    if (!/\/en\/current\/general-catalog\/courses\/[a-z0-9-]+\/(lower-division|upper-division|graduate|0-99|1-99|100|100-199|200)\/[a-z]{2,5}-\d+[a-z]*$/i.test(link.url)) continue;
    const code = normalizeCode(courseCodeFromText(link.text) || courseCodeFromUrl(link.url));
    if (!code) continue;
    const title = link.text.replace(new RegExp(`^${code.replace(' ', '\\s+')}`, 'i'), '').trim();
    const divisionMatch = link.url.match(/\/(lower-division|upper-division|graduate|100|1-99|100-199|200)\//i);
    seen.set(code, {
      code,
      title,
      url: link.url,
      departmentSlug: department.slug,
      departmentText: department.text,
      divisionPath: divisionMatch ? divisionMatch[1] : ''
    });
  }
  return [...seen.values()];
}

function loadLocalCourses() {
  const context = { console };
  vm.createContext(context);
  const source = `${fs.readFileSync(path.join(ROOT, 'js', 'courses.js'), 'utf8')}\n;if (typeof COURSES !== 'undefined') this.COURSES = COURSES;`;
  vm.runInContext(source, context, { filename: 'js/courses.js' });
  return context.COURSES;
}

function localCourseRefsByCode(courses) {
  return Object.keys(courses || {}).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function isSyntheticCourse(code) {
  return /^FREE(?:\s+|\s*\d*U)\d+$/i.test(code);
}

function classifyLocalCourse(code, course, officialByCode) {
  if (isSyntheticCourse(code)) return { code, classification: 'synthetic', confidence: 'safe-ignore', candidates: [] };
  const exact = officialByCode.get(code);
  if (exact) return { code, classification: 'exact-current-match', confidence: 'high', candidates: [exact] };

  const [subject, number] = code.split(/\s+/);
  const candidates = [];
  for (const official of officialByCode.values()) {
    const [osubject, onumber] = official.code.split(/\s+/);
    if (osubject === subject && (onumber === number || onumber.replace(/[A-Z]$/, '') === number.replace(/[A-Z]$/, '') || number.replace(/[A-Z]$/, '') === onumber.replace(/[A-Z]$/, ''))) {
      candidates.push(official);
    }
  }
  if (candidates.length) return { code, classification: 'possible-renamed-or-renumbered-same-subject', confidence: 'manual-review', candidates };

  return { code, classification: 'no-current-official-match-found', confidence: 'manual-review', candidates: [] };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Fetching catalog course root: ${COURSES_ROOT}`);
  const rootResult = await fetchUrl(COURSES_ROOT);
  if (!rootResult.ok) throw new Error(`Failed to fetch courses root: ${rootResult.status} ${rootResult.error || ''}`);
  const departments = departmentLinksFromCoursesRoot(rootResult.body);
  console.log(`Discovered ${departments.length} department/course-family pages`);

  const officialByCode = new Map();
  const fetches = [];
  for (let i = 0; i < departments.length; i++) {
    const dept = departments[i];
    const result = await fetchUrl(dept.url);
    fetches.push({ url: dept.url, status: result.status, ok: result.ok, slug: dept.slug, text: dept.text });
    if (!result.ok) {
      console.warn(`WARN department fetch failed ${result.status}: ${dept.url}`);
      continue;
    }
    const courses = courseLinksFromDepartmentPage(result.body, dept);
    for (const course of courses) {
      if (!officialByCode.has(course.code)) officialByCode.set(course.code, course);
      else {
        const existing = officialByCode.get(course.code);
        if (!existing.alternatePages) existing.alternatePages = [];
        existing.alternatePages.push(course);
      }
    }
    if ((i + 1) % 25 === 0 || i === departments.length - 1) console.log(`Indexed ${i + 1}/${departments.length} department pages; official courses so far: ${officialByCode.size}`);
  }

  const officialCourses = [...officialByCode.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const index = {
    generatedAt: new Date().toISOString(),
    source: COURSES_ROOT,
    departmentCount: departments.length,
    officialCourseCount: officialCourses.length,
    departments,
    departmentFetches: fetches,
    courses: officialCourses
  };
  fs.writeFileSync(INDEX_OUT, JSON.stringify(index, null, 2));

  const localCourses = loadLocalCourses();
  const localCodes = localCourseRefsByCode(localCourses);
  const classifications = localCodes.map(code => ({
    ...classifyLocalCourse(code, localCourses[code], officialByCode),
    title: localCourses[code]?.title || '',
    hasCatalogUrl: !!localCourses[code]?.catalogUrl,
    existingCatalogUrl: localCourses[code]?.catalogUrl || ''
  }));
  const buckets = {};
  for (const row of classifications) buckets[row.classification] = (buckets[row.classification] || 0) + 1;
  const matchReport = {
    generatedAt: new Date().toISOString(),
    localCourseCount: localCodes.length,
    officialCourseCount: officialCourses.length,
    buckets,
    classifications
  };
  fs.writeFileSync(MATCH_OUT, JSON.stringify(matchReport, null, 2));

  console.log(`Wrote ${path.relative(ROOT, INDEX_OUT)} (${officialCourses.length} official courses)`);
  console.log(`Wrote ${path.relative(ROOT, MATCH_OUT)}`);
  console.log(`Local classification buckets: ${JSON.stringify(buckets)}`);
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
