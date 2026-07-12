# Prototype 4 Current Handoff

_Last updated: 2026-07-11 after full link audit, browser QA, and schedule-quality fixes._

## Active Workspace

Prototype 4 is the active UCSC course-selection workspace at:

`/home/artem/projects/ucsc-course-selection-automation/Prototype 4 Website - source code/`

Important: earlier browser/server QA accidentally hit a stale server rooted at Prototype 3. For future work, always verify the served directory and script URLs before judging Prototype 4 behavior.

## Latest Fix Batch

This batch addressed the staged credit-first scheduling issues Artem approved after the last session:

- Added explicit credit/load policy helpers (`quarterUnits`, `quarterTypeUnits`, `creditLoadBand`, `normalMaxUnits`, low-unit companion detection) and tests.
- Added GE/UC family/category helpers so PE/PR subfamilies, UC-style families, auto-satisfied requirements, and major-required GE courses are handled consistently.
- Updated GE selection to skip redundant already-satisfied families, prefer still-needed/multi-family coverage, and keep FREE padding as last-resort unit padding after real requirements.
- Added two-interest profile support: up to two major/elective interests and two GE interests, with singular compatibility fields preserved.
- Changed the interest UI from radio-only to checkbox-with-limit-2 behavior.
- Centralized interest scoring/reasons so generation, filler pools, add-course suggestions, and replacement suggestions understand both legacy single fields and plural arrays.
- Mirrored the normalized GE/interest logic into `RequirementCollector` so runtime and tests do not drift.
- Fixed the RE_BS autonomous fake fifth-year regression by allowing a justified dense-engineering soft-20 rescue when a <=15-unit quarter can absorb one more required course.
- Added/updated focused tests: `test_credit_first_policy.js`, `test_ge_priority.js`, `test_phase_a_preferences.js`, and `test_ui_profile_flow.js`.

Previous foundation work in this same Prototype 4 track included cache-busted script loading, verified catalog links, normalized requirement collector/browser globals, WRIT 1/2 early-placement fixes, non-lab SI-science filtering, and the initial schedule-engine rulebook.

## Browser QA Snapshot

Served actual Prototype 4 locally from:

```bash
cd "/home/artem/projects/ucsc-course-selection-automation/Prototype 4 Website - source code"
python3 -m http.server 4174
```

Browser verification at `http://127.0.0.1:4174/index.html` confirmed:

- Page title: `UCSC Course Selection Automation`.
- Prototype 4 cache-busted scripts loaded, including `js/engine.js?v=prototype4-20260711`.
- `COURSES` count: 4,233.
- Supported majors: 12.
- 60 browser-context scenarios checked across 12 majors × 5 realistic profile variants.
- Browser-context hard failures: 0.
- WRIT 1/2 appear early for default, winter-start, summer/low-unit, and gap scenarios when not already satisfied.

## Latest Test Status

Run from `Prototype 4 Website - source code/`:

```bash
for t in test_*.js; do node "$t"; done
```

Latest verified results:

- `test_credit_first_policy.js`: 7/7 passed.
- `test_combo_matrix.js`: 3,531 scenarios checked, **0 hard failures**. Remaining warnings are expected infeasible/long-window warnings and density warnings for dense majors/gaps/low-unit caps.
- `test_data_validation.js`: 13/13 passed.
- `test_edge_scenarios.js`: all edge tests passed.
- `test_enrollment_restrictions.js`: 3/3 passed.
- `test_export_availability.js`: 6/6 passed.
- `test_ge_priority.js`: 4/4 passed.
- `test_phase_a_preferences.js`: 20/20 passed.
- `test_prerequisite_correctness.js`: 7/7 passed.
- `test_requirement_collector.js`: 35/35 passed.
- `test_requirement_normalizer.js`: 7/7 passed.
- `test_requirement_normalizer_runtime.js`: 3/3 passed.
- `test_responsive_css.js`: 5/5 passed.
- `test_schedule_regression.js`: all listed regression cases passed; aggregate 12/12 majors have a <=4-year default plan.
- `test_scheduler_requirement_set.js`: 5/5 passed.
- `test_smoke.js`: 98/98 passed.
- `test_toposort.js`: exit 0.
- `test_ui_profile_flow.js`: 11/11 passed.
- `test_warning_triage_diagnostics.js`: passed.

## Remaining Caution / Next Good Work

- `test_combo_matrix.js` still reports many warnings, mostly schedule windows that run long under low max units/gaps and major-course density in dense lab-heavy plans. These are not hard failures, but they are good future UX targets.
- Artem clarified that schedule quality should be credit-first, not course-count-first: prefer about 15-17 credits per quarter, usually avoid >19, and allow 4-course quarters when credits fit, such as 5+5+2+5 = 17. Next schedule-quality batch should implement `docs/plans/credit-first-scheduling-plan-20260711.md` and revisit long-schedule warnings through that lens.
- Artem then specified the desired staged policy in more detail: early lower-division major + WRIT completion, about 10+ major-required credits plus 5-9 GE/elective credits per normal quarter, finish GE categories before generic electives/free filler, avoid duplicate GE families, allow up to two GE interests and two elective/major interests, and add a final audit/repair stage. Detailed implementation plan: `docs/plans/credit-first-staged-engine-implementation-plan-20260711.md`.
- Browser QA was done via browser console scenarios, not full Playwright clicks, because WSL Chromium dependencies have previously required user-run sudo install steps.
- Continue using official UCSC catalog pages as source of truth for any future requirement/prerequisite edits.
