const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const LAB_DIR = path.join(ROOT, 'data', 'catalog-expansion-lab');
const BASE = 'https://catalog.ucsc.edu';
const COURSES_ROOT = `${BASE}/en/current/general-catalog/courses/`;

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) out._.push(a);
    else {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else out[key] = next, i++;
    }
  }
  return out;
}

function ensureLab() { fs.mkdirSync(LAB_DIR, { recursive: true }); }

function decodeHtml(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
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
    const requestUrl = url.endsWith('/') ? url : `${url}/`;
    https.get(requestUrl, { headers: { 'User-Agent': 'Hermes-UCSC-Catalog-Expansion/1.0' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, requestUrl).toString();
        res.resume();
        fetchUrl(next).then(resolve);
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body, url: requestUrl }));
    }).on('error', error => resolve({ ok: false, status: 0, body: '', error: error.message, url: requestUrl }));
  });
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
  await Promise.all(Array.from({ length: Math.max(1, Number(limit) || 1) }, worker));
  return results;
}

function absolutize(href) {
  if (!href) return '';
  return new URL(href, BASE).toString().replace(/\/$/, '');
}

function parseLinks(html) {
  const links = [];
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) links.push({ href: m[1], url: absolutize(m[1]), text: stripHtml(m[2]) });
  return links;
}

function normalizeCode(code) { return String(code || '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function courseCodeFromText(text) { const m = String(text || '').match(/^([A-Z]{2,5})\s+(\d+[A-Z]*)\b/); return m ? `${m[1]} ${m[2]}` : ''; }
function courseCodeFromUrl(url) { const slug = String(url || '').split('/').filter(Boolean).pop() || ''; const m = slug.match(/^([a-z]{2,5})-(\d+[a-z]*)$/i); return m ? `${m[1].toUpperCase()} ${m[2].toUpperCase()}` : ''; }

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
    const row = { code, title, url: link.url, departmentSlug: department.slug, departmentText: department.text, divisionPath: divisionMatch ? divisionMatch[1] : '' };
    if (!seen.has(code)) seen.set(code, row);
    else {
      const existing = seen.get(code);
      existing.alternatePages = existing.alternatePages || [];
      existing.alternatePages.push(row);
    }
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

function isSyntheticCourse(code) { return /^FREE(?:\s+|\s*\d*U)\d+$/i.test(code); }
function subjectOf(code) { return String(code || '').split(/\s+/)[0] || ''; }
function divisionFrom(code, divisionPath) {
  if (/graduate|200/i.test(divisionPath || '')) return 'graduate';
  if (/upper|100/i.test(divisionPath || '')) return 'upper';
  const n = Number((String(code).match(/\d+/) || ['0'])[0]);
  if (n >= 200) return 'graduate';
  if (n >= 100) return 'upper';
  return 'lower';
}
function mentionedCourseCodes(text) { return [...new Set([...String(text || '').matchAll(/\b[A-Z]{2,5}\s+\d+[A-Z]?\b/g)].map(m => normalizeCode(m[0])))]; }

module.exports = { ROOT, LAB_DIR, BASE, COURSES_ROOT, parseArgs, ensureLab, decodeHtml, stripHtml, fetchUrl, mapLimit, parseLinks, normalizeCode, courseCodeFromText, courseCodeFromUrl, departmentLinksFromCoursesRoot, courseLinksFromDepartmentPage, loadLocalCourses, isSyntheticCourse, subjectOf, divisionFrom, mentionedCourseCodes };
