# Prototype 4 verified stale/no-page course cleanup — final handoff

## Scope

Applied Artem's verified stale/no-page/renumbered course decisions from `data/audit/artem-verified-course-statuses.json` to Prototype 4.

Primary generated application artifact:

- `data/audit/artem-verified-course-application-report.json`

## Applied decisions

- Active courses kept/updated from the current official catalog index: 24
- Replacement targets fetched/inserted: 31
- Old/stale local codes deleted: 82

## PHIL 140 decision

Artem rechecked PHIL 140 and confirmed it does not exist in the current 2026-27 catalog. The verified status artifact was corrected from `Active - still offered` to `Discontinued / no current official page`.

Result:

- `PHIL 140` was deleted from `js/courses.js`.
- It appears in the deleted-old-code list in `data/audit/artem-verified-course-application-report.json`.
- Search of live `js/` data found no active course key or requirement reference to `PHIL 140`; the only live occurrence is inside the description for current `PHIL 142` saying it was formerly PHIL 140. A backup file also still contains the old entry, but it is not loaded by the app.
- No supported major requirement was using `PHIL 140`; prior audit row marked supported-major impact as `no`, majors `none`.

## CSE 182 / TIM_BS bug investigation

Official source confirmed by user:

- https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-182

Local `CSE 182` remains current and required for `TIM_BS` programming requirements.

Root cause:

- `CSE 182` was correctly selected as a TIM_BS required major course.
- It was not placed because the local data encodes official standing restriction as `restrictedLevels: [3, 4]` for junior/senior standing.
- The scheduler may extend dense schedules past Year 4. Extended years use numeric class levels like 5, so the previous restriction check rejected a fifth-year undergraduate even though a fifth-year undergrad should be treated as senior standing for "junior/senior" restrictions.
- Because CSE 182 could not be placed in the overflow/extended year, TIM_BS validation reported the programming requirement missing.

Fix:

- Updated `Scheduler.isCourseAllowedForProfile()` in `js/engine.js` to cap numeric class level at senior standing for restriction checks: `Math.min(currentLevel, 4)`.
- Added a focused regression in `test_scheduler_requirement_set.js` proving:
  - CSE 182 is still not allowed for first-year standing.
  - CSE 182 is allowed for fifth-year/senior standing.
  - TIM_BS schedules include CSE 182.
  - TIM_BS programming requirement is fulfilled.
  - The representative TIM_BS scenario validates fully.

Representative post-fix result:

- TIM_BS / tim_entrepreneurship / ge_arts_humanities: `allMet: true`
- `CSE 182` scheduled in Year 5 Fall for the dense default profile
- TIM_BS programming requirement fulfilled: 6/6, no missing courses

## Verification commands run

All commands run from `Prototype 4 Website - source code`.

```bash
node scripts/apply_artem_verified_course_statuses.js
node tools/data-validator.js
node test_scheduler_requirement_set.js
node test_data_validation.js
node test_prerequisite_correctness.js
node test_smoke.js
```

Results:

- `node scripts/apply_artem_verified_course_statuses.js`: updated courses/majors; 24 active kept/updated, 31 replacement targets, 82 deleted old codes.
- `node tools/data-validator.js`: exit code 0.
- `node test_scheduler_requirement_set.js`: 4/4 passed.
- `node test_data_validation.js`: 13/13 passed.
- `node test_prerequisite_correctness.js`: 7/7 passed.
- `node test_smoke.js`: 98 passed, 0 failed out of 98 total.

## Remaining notes

The smoke suite still reports schedule-length warnings for several dense majors/profiles, including TIM_BS. These are warnings rather than requirement failures: all smoke rows now have `allMet: YES`, zero duplicate courses, and zero prerequisite violations. The previous TIM_BS hard failures caused by missing CSE 182 are resolved.

Number 6 cleanup is complete for the verified stale/no-page/renumbered course decisions currently encoded in the audit artifact.
