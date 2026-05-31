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
- `test_data_validation.js` — validator tests.
- `test_requirement_normalizer.js` — normalizer unit tests.
- `test_requirement_normalizer_runtime.js` — behavior-preserving runtime-data normalizer tests.
- `test_scheduler_requirement_set.js` — behavior-preserving scheduler integration test for normalized requirement-set generation.

## Run validation and tests

From this directory:

```bash
node tools/validate-data.js
node test_data_validation.js
node test_requirement_normalizer.js
node test_requirement_normalizer_runtime.js
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

1. Improve warning triage by marking which warning buckets affect supported-major requirements versus broad imported catalog data.
2. Start extracting the engine requirement-collection code into a module that consumes `Scheduler.buildRequirementSet(profile)`.
3. Keep scheduler behavior unchanged while extraction tests compare old and normalized outputs.
4. Use the new `repeat_course`, `prerequisitesByMajor`, `equivalentCourses`, and `creditExclusions` metadata contracts when adding official catalog cases.
5. Add actual scheduling behavior for accumulated-credit/repeatable-credit requirements and major-specific prerequisite branches only after official catalog regressions exist.
