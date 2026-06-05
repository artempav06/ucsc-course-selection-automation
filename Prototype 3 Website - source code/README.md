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
- `test_requirement_collector.js` — behavior-preserving collector test for normalized-to-legacy requirement inputs, including all-supported-major default coverage, a representative completed/preferred/avoided profile matrix, `Scheduler.selectMajorCourses(profile)` wrapper coverage, and a guard that `Scheduler.generate()` delegates major selection through the normalized wrapper.

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

1. Mirror and replace GE/UC selection through the normalized requirement pipeline using the same pattern: old-vs-new equality tests first, then one isolated scheduler swap.
2. Keep prerequisite expansion, upper-div supplement, filler/free padding, placement, and validator changes out of the GE/UC replacement commit.
3. Improve combo-matrix warning reports so the existing 2510 warnings are grouped by schedule length, high units, overload, filler, prerequisites/order, and unsupported profile constraint.
4. Continue warning-bucket triage, starting with `unknownGeReference`, after the normalized major-selection extraction remains stable.
