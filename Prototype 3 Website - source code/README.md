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
- `test_requirement_collector.js` — behavior-preserving collector test for normalized-to-legacy requirement inputs, including all-supported-major default coverage, a representative completed/preferred/avoided profile matrix, and `Scheduler.selectMajorCourses(profile)` wrapper coverage.

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

1. Replace the legacy major-selection block in `Scheduler.generate()` with the already-tested `Scheduler.selectMajorCourses(profile)` wrapper, but keep the change isolated from GE/UC, prereq closure, filler, and placement logic.
2. After replacement, add schedule-output preservation checks for representative profiles and run the full suite.
3. Then move to GE/UC selection mirroring, prerequisite expansion, and upper-div/filler phases one at a time.
4. Continue warning-bucket triage after the major-selection extraction is stable.
