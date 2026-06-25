# Prototype 3 Website - Validated Scheduler Foundation

Prototype 3 starts as a copy of Prototype 2, then adds a safer foundation for requirement and course data.

## Goal

Before adding new user-facing features, Prototype 3 focuses on schedule accuracy and maintainability:

1. Document current data shapes.
2. Add schema contracts.
3. Validate data before schedule tests.
4. Normalize major/GE/UC requirements into a common internal shape.
5. Refactor the engine gradually without changing behavior.
6. Add richer official-catalog requirement types one at a time.

## Key foundation files

- `docs/architecture/current-data-model.md` — current data model inventory.
- `docs/plans/validated-requirement-model.md` — A-F foundation implementation plan.
- `schemas/*.schema.json` — JSON Schema-style contracts for future source data.
- `tools/data-validator.js` — reusable validator module.
- `tools/validate-data.js` — CLI validation entrypoint.
- `js/engine/requirement-normalizer.js` — normalized requirement provider layer for major, GE, UC, degree-progress, student-profile, and richer catalog metadata requirements.
- `js/engine/requirement-collector.js` — normalized requirement collection mirror for legacy scheduler inputs.
- `test_data_validation.js` — validator tests.
- `test_requirement_normalizer.js` — normalizer unit tests.
- `test_requirement_normalizer_runtime.js` — behavior-preserving runtime-data normalizer tests.
- `test_scheduler_requirement_set.js` — behavior-preserving scheduler integration test for normalized requirement-set generation.
- `test_requirement_collector.js` — behavior-preserving collector test for normalized-to-legacy requirement inputs, including all-supported-major default coverage, representative major coverage, broad all-supported-major GE/UC profile matrices, representative prerequisite-expansion, upper-division supplement, and FREE/unit-padding profiles, `Scheduler.selectMajorCourses(profile)`, `Scheduler.selectGECourses(...)`, `Scheduler.selectUCCourses(...)`, `Scheduler.selectPrerequisiteCourses(...)`, `Scheduler.selectUpperDivisionSupplement(...)`, and `Scheduler.selectFreePaddingCourses(...)` wrapper coverage, plus guards that `Scheduler.generate()` delegates those selection phases through normalized wrappers.

## Run validation and tests

From this directory:

```bash
node tools/validate-data.js
node test_data_validation.js
node test_requirement_normalizer.js
node test_requirement_normalizer_runtime.js
node test_requirement_collector.js
node test_scheduler_requirement_set.js
node test_toposort.js
node test_edge_scenarios.js
node test_schedule_regression.js
node test_combo_matrix.js
node test_smoke.js
```

## Current validation policy

`tools/validate-data.js` uses a migration-friendly policy:

- Hard errors for malformed course/major/requirement structures.
- Hard errors for supported-major requirement categories referencing unknown courses.
- Warnings for unknown prerequisite/GE references in the imported UCSC-wide catalog, because many imported courses are outside the current supported-major subset.
- Warnings for missing catalog URLs.

The reusable `validateData()` API defaults to stricter reference checking for unit tests and future clean source data.

## Next recommended work

1. Keep filler-pool construction, quarter placement, and validator changes isolated as later normalized migration phases.
2. Continue warning-bucket triage. `test_combo_matrix.js` now groups the 2510 current warnings into schedule-length, high-unit, and major-course-density buckets with examples.
3. Start data-warning triage with `unknownGeReference: 2`, then classify broader prerequisite/catalog URL warnings.
4. Continue major-by-major official catalog audits against UCSC General Catalog requirement and planner pages.
