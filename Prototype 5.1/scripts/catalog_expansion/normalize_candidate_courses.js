#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ROOT, LAB_DIR, parseArgs, loadLocalCourses, mentionedCourseCodes, subjectOf, departmentMatches } = require('./common');

function prereqNotes(detail) {
  const notes = [];
  if (detail.officialPrereqText) notes.push(`Official prerequisite text: ${detail.officialPrereqText}`);
  if (detail.enrollmentText) notes.push(`Official enrollment/restriction text: ${detail.enrollmentText}`);
  for (const flag of detail.parserFlags || []) {
    if (/placement|writing|permission|major|recommended|concurrent/.test(flag)) notes.push(`Needs review: ${flag}`);
  }
  return [...new Set(notes)];
}
function simpleGroupsFromPrereqText(text) {
  // Conservative first pass only: split semicolon-delimited AND groups and OR alternatives inside each group.
  // If text contains commas with prose, parentheses outside the standard Prerequisite(s) label, previous/concurrent,
  // placement, writing, permission, recommendations, or restrictions, leave parsing for review.
  const parseText = String(text || '').replace(/^\s*Prerequisite(?:\(s\)|s)?:\s*/i, '').trim();
  const lower = parseText.toLowerCase();
  if (!parseText) return { groups: [], confidence: 'no-prereq-text' };
  if (/[()]/.test(parseText) || /previous or concurrent|prior or concurrent|concurrent|placement|mpe|exam|ap |ib |entry level writing|composition|writing|permission|consent|instructor|major|restricted|recommended|equivalent|exception|exceptions|waiver|petition/.test(lower)) {
    return { groups: [], confidence: 'manual-review-required' };
  }
  const groups = [];
  const chunks = parseText.split(/;|\band\b/i).map(s => s.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const codes = mentionedCourseCodes(chunk);
    if (!codes.length) continue;
    groups.push([...new Set(codes)]);
  }
  const allMentioned = mentionedCourseCodes(parseText).sort();
  const encoded = [...new Set(groups.flat())].sort();
  if (JSON.stringify(allMentioned) !== JSON.stringify(encoded)) return { groups: [], confidence: 'manual-review-required' };
  return { groups, confidence: groups.length ? 'simple-course-code-groups' : 'no-course-code-prereqs' };
}
function candidateFromDetail(detail, localCourses, candidateCodes = new Set()) {
  const parsed = simpleGroupsFromPrereqText(detail.officialPrereqText || '');
  const missingRefs = [...new Set(parsed.groups.flat().filter(c => !localCourses[c] && !candidateCodes.has(c)))];
  const needsReview = new Set();
  for (const f of detail.parserFlags || []) if (!['no-official-prereq-text-found'].includes(f)) needsReview.add(f);
  if (parsed.confidence === 'manual-review-required') needsReview.add('prerequisite-logic-not-auto-encoded');
  if (missingRefs.length) needsReview.add('prerequisite-references-missing-locally');
  const record = {
    concentrations: [],
    title: detail.title || '',
    units: detail.units,
    division: detail.division,
    prereqs: missingRefs.length ? [] : parsed.groups,
    ge: detail.ge || null,
    quarters: detail.quarters || [],
    catalogUrl: detail.catalogUrl,
    desc: detail.desc || '',
    section: ['FREE'],
    rmpScore: 0,
    officialPrereqText: detail.officialPrereqText || '',
    prereqNotes: prereqNotes(detail)
  };
  if (detail.enrollmentText) record.enrollmentText = detail.enrollmentText;
  return { code: detail.code, record, sourceDetail: { catalogUrl: detail.catalogUrl, parserFlags: detail.parserFlags || [], prereqParseConfidence: parsed.confidence, mentionedCourses: detail.mentionedCourses || [], missingPrerequisiteReferences: missingRefs }, needsReview: [...needsReview] };
}
async function main() {
  const args = parseArgs(process.argv);
  const detailsPath = path.join(LAB_DIR, 'official-course-details.json');
  if (!fs.existsSync(detailsPath)) throw new Error('Missing official-course-details.json; run fetch_missing_course_details.js first.');
  const detailsPayload = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
  const localCourses = loadLocalCourses();
  let details = detailsPayload.details || [];
  if (args.department) details = details.filter(d => departmentMatches(d, args.department));
  if (args.limit) details = details.slice(0, Number(args.limit));
  const candidateCodes = new Set(details.map(d => d.code));
  const rows = details.map(d => candidateFromDetail(d, localCourses, candidateCodes));
  const candidates = {};
  const review = [];
  for (const row of rows) { candidates[row.code] = row.record; review.push({ code: row.code, needsReview: row.needsReview, sourceDetail: row.sourceDetail }); }
  fs.writeFileSync(path.join(LAB_DIR, 'candidate-expanded-courses.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sourceDetails: 'official-course-details.json', count: rows.length, candidates, review }, null, 2));
  const reviewCount = review.filter(r => r.needsReview.length).length;
  console.log(`Wrote ${path.relative(ROOT, path.join(LAB_DIR, 'candidate-expanded-courses.json'))} (${rows.length} candidates; ${reviewCount} need review)`);
}
main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
