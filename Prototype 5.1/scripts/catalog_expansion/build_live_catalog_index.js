#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ROOT, LAB_DIR, COURSES_ROOT, ensureLab, fetchUrl, departmentLinksFromCoursesRoot, courseLinksFromDepartmentPage, loadLocalCourses, isSyntheticCourse, subjectOf } = require('./common');

async function main() {
  ensureLab();
  console.log(`Fetching official UCSC course root: ${COURSES_ROOT}`);
  const root = await fetchUrl(COURSES_ROOT);
  if (!root.ok) throw new Error(`Failed to fetch course root: ${root.status} ${root.error || ''}`);
  const departments = departmentLinksFromCoursesRoot(root.body);
  console.log(`Discovered ${departments.length} department/course-family pages`);
  const officialByCode = new Map();
  const departmentFetches = [];
  const departmentCounts = {};
  for (let i = 0; i < departments.length; i++) {
    const dept = departments[i];
    const result = await fetchUrl(dept.url);
    departmentFetches.push({ slug: dept.slug, text: dept.text, url: dept.url, ok: result.ok, status: result.status });
    if (!result.ok) { console.warn(`WARN ${result.status}: ${dept.url}`); continue; }
    const courses = courseLinksFromDepartmentPage(result.body, dept);
    departmentCounts[dept.text] = courses.length;
    for (const course of courses) {
      const existing = officialByCode.get(course.code);
      if (!existing) officialByCode.set(course.code, course);
      else {
        existing.alternatePages = existing.alternatePages || [];
        existing.alternatePages.push(course);
      }
    }
    if ((i + 1) % 25 === 0 || i === departments.length - 1) console.log(`Indexed ${i + 1}/${departments.length}; official codes so far: ${officialByCode.size}`);
  }
  const officialCourses = [...officialByCode.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const localCourses = loadLocalCourses();
  const localCodes = Object.keys(localCourses).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const officialCodes = new Set(officialCourses.map(c => c.code));
  const realLocalCodes = localCodes.filter(c => !isSyntheticCourse(c));
  const syntheticLocalCodes = localCodes.filter(isSyntheticCourse);
  const exactLocalMatches = realLocalCodes.filter(c => officialCodes.has(c));
  const missingOfficial = officialCourses.filter(c => !localCourses[c.code]);
  const missingByDepartment = {};
  for (const c of missingOfficial) {
    const key = `${subjectOf(c.code)} — ${c.departmentText}`;
    missingByDepartment[key] = missingByDepartment[key] || { subject: subjectOf(c.code), departmentText: c.departmentText, departmentSlug: c.departmentSlug, count: 0, courses: [] };
    missingByDepartment[key].count++;
    missingByDepartment[key].courses.push(c);
  }
  const localOnly = realLocalCodes.filter(c => !officialCodes.has(c));
  const localOnlyBySubject = {};
  for (const c of localOnly) localOnlyBySubject[subjectOf(c)] = (localOnlyBySubject[subjectOf(c)] || 0) + 1;

  const generatedAt = new Date().toISOString();
  const index = { generatedAt, source: COURSES_ROOT, departmentCount: departments.length, officialCourseCount: officialCourses.length, departments, departmentFetches, departmentCounts, courses: officialCourses };
  const coverage = {
    generatedAt,
    sourceIndex: 'official-catalog-live-index.json',
    localCourseCount: localCodes.length,
    localRealCourseCount: realLocalCodes.length,
    localSyntheticCourseCount: syntheticLocalCodes.length,
    officialCourseCount: officialCourses.length,
    exactLocalRealMatches: exactLocalMatches.length,
    missingOfficialCourseCount: missingOfficial.length,
    localOnlyRealCourseCount: localOnly.length,
    localOnlyBySubject,
    syntheticLocalCodes,
    coveragePercentOfOfficial: Number(((exactLocalMatches.length / officialCourses.length) * 100).toFixed(2)),
    summary: `Official current catalog has ${officialCourses.length} courses; local DB has ${realLocalCodes.length} real exact-code courses plus ${syntheticLocalCodes.length} synthetic placeholders; ${exactLocalMatches.length} local real courses exactly match current official codes; ${missingOfficial.length} official courses are missing locally.`
  };
  fs.writeFileSync(path.join(LAB_DIR, 'official-catalog-live-index.json'), JSON.stringify(index, null, 2));
  fs.writeFileSync(path.join(LAB_DIR, 'local-vs-official-coverage-report.json'), JSON.stringify(coverage, null, 2));
  fs.writeFileSync(path.join(LAB_DIR, 'missing-courses-by-department.json'), JSON.stringify({ generatedAt, missingOfficialCourseCount: missingOfficial.length, departments: Object.values(missingByDepartment).sort((a,b) => a.subject.localeCompare(b.subject) || a.departmentText.localeCompare(b.departmentText)) }, null, 2));
  console.log(`Wrote ${path.relative(ROOT, path.join(LAB_DIR, 'official-catalog-live-index.json'))}`);
  console.log(`Wrote ${path.relative(ROOT, path.join(LAB_DIR, 'local-vs-official-coverage-report.json'))}`);
  console.log(`Wrote ${path.relative(ROOT, path.join(LAB_DIR, 'missing-courses-by-department.json'))}`);
  console.log(coverage.summary);
}
main().catch(e => { console.error(e.stack || e.message); process.exit(1); });
