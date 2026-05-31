# Validated Requirement Model Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Make Prototype 3's scheduler foundation safer by adding schemas, data validation, and a normalized requirement pipeline before adding new user-facing features.

**Architecture:** Keep the current static JavaScript runtime working. Add validation and normalization around existing globals first, then gradually extract source data and engine modules. Avoid giant rewrites.

**Tech Stack:** Static JavaScript app, Node.js validation/tests, JSON Schema-style schema documents, no external npm dependency required for the initial validator.

---

## Phase A — Inventory current data shapes

Status: started in `docs/architecture/current-data-model.md`.

Tasks:

1. Document current `COURSES`, `MAJOR_REQUIREMENTS`, and `GE_REQUIREMENTS` shapes.
2. Document requirement category semantics.
3. Document known model gaps and validation policy.

Verification:

```bash
node -e "console.log('docs only')"
```

## Phase B — Define canonical schemas

Tasks:

1. Create `schemas/course.schema.json`.
2. Create `schemas/requirement-category.schema.json`.
3. Create `schemas/major.schema.json`.
4. Create `schemas/ge.schema.json`.
5. Create `schemas/planner-expectation.schema.json` as a forward-looking contract.

Schemas should match current data first and become stricter over time.

## Phase C — Add validation script

Tasks:

1. Create `tools/data-validator.js` with reusable validation functions.
2. Create `tools/validate-data.js` CLI wrapper.
3. Create `test_data_validation.js` with tests for malformed data.
4. Add validation to the manual test workflow.

Initial validator must catch:

- missing required course fields
- invalid course divisions/quarters
- malformed prerequisite groups
- prerequisite references to unknown courses
- major requirement references to unknown courses
- duplicate category IDs inside a major
- malformed `pick_n`, `pick_one`, `all_required`, and `choose_group`
- GE course references to unknown courses

## Phase D — Introduce normalized requirement objects

Tasks:

1. Create `js/engine/requirement-normalizer.js` or equivalent. **Initial version complete.**
2. Normalize major categories into one internal format. **Initial version complete.**
3. Normalize GE/UC/DC requirement providers into the same internal format. **Initial GE/UC plus major-DC representation complete.**
4. Normalize degree-progress and student-profile constraints into provider objects. **Initial version complete.**
5. Add tests that normalization preserves current selected requirements for representative majors. **Runtime-data behavior-preserving tests added.**
6. Expose normalized requirement collection through `Scheduler.buildRequirementSet(profile)` and attach it to `Validator.validateAll(...).requirementSet`. **Initial non-invasive integration complete.**
7. Add `RequirementCollector` as a normalized-to-legacy mirror for scheduler requirement inputs. **Initial non-invasive collector complete.**

Do not change scheduling behavior yet.

## Phase E — Split engine modules gradually

Tasks:

1. Extract pure helpers first. **Started with normalized requirement collection and collector mirror.**
2. Preserve global `Scheduler` API.
3. Keep script-tag compatibility.
4. Run full suite after each extraction.

Target module responsibilities:

- requirement collection
- alternative selection
- prerequisite closure
- schedule placement
- validation
- explanation

## Phase F — Add richer requirement types

Add one type at a time with TDD:

1. `repeat_course` / repeated-credit requirement.
2. Major-specific prerequisites.
3. Course equivalencies/crosslists.
4. Credit exclusions.
5. Planner expectation checks.
6. Catalog-year variants later.

Each new type needs:

- schema update
- validator coverage
- normalizer support
- scheduler/validator behavior
- regression test using an official UCSC catalog case

Current status: schema, validator, and normalizer support have started for `repeat_course`, major-specific prerequisite metadata (`prerequisitesByMajor`), equivalency metadata (`equivalentCourses`), and credit-exclusion metadata (`creditExclusions`). Actual scheduler/validator behavior for these richer semantics is intentionally not wired yet; add it one type at a time with official catalog regressions.

Naming note: `repeat_course` means official accumulated-credit/repeatable-for-credit catalog cases only. It must never allow ordinary courses to be scheduled twice.

## Full verification command

From `Prototype 3 Website - source code`:

```bash
node tools/validate-data.js && \
node test_data_validation.js && \
node test_requirement_normalizer.js && \
node test_requirement_normalizer_runtime.js && \
node test_requirement_collector.js && \
node test_scheduler_requirement_set.js && \
node test_toposort.js && \
node test_edge_scenarios.js && \
node test_schedule_regression.js && \
node test_combo_matrix.js && \
node test_smoke.js
```
