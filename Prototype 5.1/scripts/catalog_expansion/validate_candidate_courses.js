#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ROOT, LAB_DIR, loadLocalCourses } = require('./common');
function validDivision(v) { return ['lower', 'upper', 'graduate'].includes(v); }
function validQuarter(q) { return ['F', 'W', 'S', 'SU'].includes(q); }
function validateRecord(code, record, localCourses, candidateCodes, reviewRow) {
  const errors = [];
  const warnings = [];
  if (localCourses[code]) errors.push('candidate-overwrites-existing-local-course');
  if (!record.title) errors.push('missing-title');
  if (typeof record.units !== 'number' || !Number.isFinite(record.units) || record.units <= 0 || record.units > 25) errors.push('invalid-units');
  if (!validDivision(record.division)) errors.push('invalid-division');
  if (!record.catalogUrl || !/^https:\/\/catalog\.ucsc\.edu\/en\/current\/general-catalog\/courses\//.test(record.catalogUrl)) errors.push('invalid-current-catalog-url');
  if (!record.desc) warnings.push('missing-description');
  if (!Array.isArray(record.prereqs)) errors.push('prereqs-not-array');
  else {
    for (const group of record.prereqs) {
      if (!Array.isArray(group) || group.length === 0) errors.push('malformed-prereq-group');
      for (const ref of group || []) if (!localCourses[ref] && !candidateCodes.has(ref)) errors.push(`unknown-prereq-reference:${ref}`);
    }
  }
  if (!Array.isArray(record.quarters)) errors.push('quarters-not-array');
  else for (const q of record.quarters) if (!validQuarter(q)) errors.push(`invalid-quarter:${q}`);
  if (!Array.isArray(record.prereqNotes)) errors.push('prereqNotes-not-array');
  if ((reviewRow?.needsReview || []).length) warnings.push(...reviewRow.needsReview.map(f => `review:${f}`));
  if (record.officialPrereqText && record.prereqs.length === 0 && (reviewRow?.sourceDetail?.mentionedCourses || []).length) warnings.push('official-course-prereq-text-not-encoded');
  return { errors: [...new Set(errors)], warnings: [...new Set(warnings)] };
}
function mdEscape(s) { return String(s || '').replace(/\|/g, '\\|'); }
async function main() {
  const pathIn = path.join(LAB_DIR, 'candidate-expanded-courses.json');
  if (!fs.existsSync(pathIn)) throw new Error('Missing candidate-expanded-courses.json; run normalize_candidate_courses.js first.');
  const payload = JSON.parse(fs.readFileSync(pathIn, 'utf8'));
  const localCourses = loadLocalCourses();
  const candidateCodes = new Set(Object.keys(payload.candidates || {}));
  const reviewByCode = new Map((payload.review || []).map(r => [r.code, r]));
  const rows = [];
  const buckets = { passed: 0, blocked: 0, warningsOnly: 0 };
  for (const [code, record] of Object.entries(payload.candidates || {}).sort()) {
    const result = validateRecord(code, record, localCourses, candidateCodes, reviewByCode.get(code));
    const status = result.errors.length ? 'blocked' : result.warnings.length ? 'warnings-only' : 'passed';
    if (status === 'blocked') buckets.blocked++; else if (status === 'warnings-only') buckets.warningsOnly++; else buckets.passed++;
    rows.push({ code, title: record.title, status, errors: result.errors, warnings: result.warnings, url: record.catalogUrl });
  }
  const generatedAt = new Date().toISOString();
  const qaJson = { generatedAt, sourceCandidates: 'candidate-expanded-courses.json', candidateCount: rows.length, buckets, rows };
  fs.writeFileSync(path.join(LAB_DIR, 'candidate-qa-report.json'), JSON.stringify(qaJson, null, 2));
  const lines = [];
  lines.push('# Catalog Expansion Candidate QA Report');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Candidate count: ${rows.length}`);
  lines.push(`- Passed with no warnings: ${buckets.passed}`);
  lines.push(`- Warnings only / human review needed: ${buckets.warningsOnly}`);
  lines.push(`- Blocked by hard errors: ${buckets.blocked}`);
  lines.push('');
  lines.push('## Merge readiness');
  lines.push('');
  if (buckets.blocked) lines.push('Not ready to merge: hard QA errors exist.');
  else if (buckets.warningsOnly) lines.push('Not ready for automatic merge: no hard schema blockers, but human-review warnings remain.');
  else lines.push('Technically merge-ready for this candidate set after human spot-checking official evidence.');
  lines.push('');
  lines.push('## Rows');
  lines.push('');
  for (const r of rows) {
    lines.push(`- ${r.code} — ${mdEscape(r.title)}: ${r.status}`);
    if (r.errors.length) lines.push(`  - Errors: ${r.errors.join('; ')}`);
    if (r.warnings.length) lines.push(`  - Warnings: ${r.warnings.join('; ')}`);
    lines.push(`  - URL: ${r.url}`);
  }
  fs.writeFileSync(path.join(LAB_DIR, 'qa-report.md'), lines.join('\n') + '\n');
  console.log(`Wrote ${path.relative(ROOT, path.join(LAB_DIR, 'candidate-qa-report.json'))}`);
  console.log(`Wrote ${path.relative(ROOT, path.join(LAB_DIR, 'qa-report.md'))}`);
  console.log(`QA buckets: ${JSON.stringify(buckets)}`);
  if (buckets.blocked) process.exitCode = 2;
}
main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
