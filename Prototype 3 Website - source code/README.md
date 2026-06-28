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
- `test_requirement_collector.js` — behavior-preserving collector/scheduler/validator/explanation seam test for normalized-to-legacy requirement inputs, including all-supported-major default coverage, representative major coverage, broad all-supported-major GE/UC profile matrices, representative prerequisite-expansion, upper-division supplement, FREE/unit-padding, filler-pool, quarter-placement, validation, and explanation/debug-output profiles, `Scheduler.selectMajorCourses(profile)`, `Scheduler.selectGECourses(...)`, `Scheduler.selectUCCourses(...)`, `Scheduler.selectPrerequisiteCourses(...)`, `Scheduler.selectUpperDivisionSupplement(...)`, `Scheduler.selectFreePaddingCourses(...)`, `Scheduler.buildNormalizedFillerPool(...)`, `Scheduler.placeSelectedCourses(...)`, `Validator.validateSchedule(...)`, `Scheduler.generateWithExplanation(...)`, `Scheduler.generate()` wrapper delegation, and `Validator.validateAll(...)` wrapper delegation.
- `test_ui_profile_flow.js` — deterministic fake-DOM coverage for wizard profile propagation and Phase C UX states.
- `test_export_availability.js` — export-library availability guard coverage.
- `test_responsive_css.js` — static responsive/mobile CSS expectations for phone breakpoints, touch targets, and modal viewport containment.
- `scripts/inspect_schedule.js` — CLI diagnostic report powered by `Scheduler.generateWithExplanation(...)`, useful for explaining phase choices before warning-bucket fixes.
- `scripts/phase10_warning_triage.js` — read-only combo-matrix warning-bucket diagnostic helper used by the Phase 10 triage report.
- `docs/plans/warning-bucket-triage-phase10.md` — current root-cause map for schedule-length, high-unit, and major-density warnings.
- `docs/plans/data-warning-triage-phase6.md` — impact split for remaining `unknownPrerequisiteReference` and `missingCatalogUrl` data-validation warning buckets.

## Run validation and tests

From this directory:

```bash
node tools/validate-data.js
node test_data_validation.js
node test_requirement_normalizer.js
node test_requirement_normalizer_runtime.js
node test_requirement_collector.js
node test_scheduler_requirement_set.js
node test_ui_profile_flow.js
node test_export_availability.js
node test_responsive_css.js
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

1. Phase 13 real-gap matrix activation is complete: `winter-gap` / `full-year-gap` matrix profiles now set `gapEnabled: true`, and overflow chronology repair keeps RE_BS ECE 129A/B/C capstone sequences ordered after real full-year gaps. Use the new real-gap `test_combo_matrix.js` baseline (`2296` warnings: schedule length `2098`, high total units `1080`, major-course density `291`) before further placement/density work.
2. Re-triage the remaining warning buckets by separating no-gap, one-quarter-gap, and full-year-gap profiles; remaining high-unit summer-start cases are the next likely behavior target.
3. Data-warning triage has cleared the `unknownGeReference` bucket by removing stale `CSE 115` DC references. The remaining validation warnings are now impact-split by `docs/plans/data-warning-triage-phase6.md`: `unknownPrerequisiteReference` has `39` direct-supported-major and `174` outside-supported-major warnings; `missingCatalogUrl` has `92` direct-supported-major and `68` outside-supported-major warnings.
4. Continue major-by-major official catalog audits against UCSC General Catalog requirement and planner pages. The next safest data-warning cleanup is a small official-catalog-backed missing-catalog-url cluster before changing prerequisite semantics.
