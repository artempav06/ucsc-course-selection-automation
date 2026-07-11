# Prototype 4 Current Handoff

_Last updated: 2026-07-11 after full link audit, browser QA, and schedule-quality fixes._

## Active Workspace

Prototype 4 is the active UCSC course-selection workspace at:

`/home/artem/projects/ucsc-course-selection-automation/Prototype 4 Website - source code/`

Important: earlier browser/server QA accidentally hit a stale server rooted at Prototype 3. For future work, always verify the served directory and script URLs before judging Prototype 4 behavior.

## Latest Fix Batch

This batch addressed the broad schedule-quality issues Artem approved after the last session:

- Added cache-busting query strings to Prototype 4 script tags in `index.html` so browsers do not silently reuse stale JS.
- Verified concrete catalog URLs: 4,207 concrete `catalog.ucsc.edu` links checked, 0 wrong `/en/current/general-catalog` paths, 0 HTTP failures. Audit artifact: `docs/plans/catalog-link-audit-20260711.json`.
- Fixed UMD globals for `RequirementNormalizer` and `RequirementCollector` so Node tests and browser runtime use the same normalized pipeline instead of falling back inconsistently.
- Strengthened GE scoring so non-lab majors do not get unrelated CHEM/BIOL/BIOE/PHYS lab-science chains for generic SI unless the student explicitly chooses a science/health focus or the major requires that science path.
- Prioritized regular `WRIT 2` over summer-only/global-seminar Composition variants to prevent summer-start/low-unit profiles from stranding the C requirement.
- Added early WRIT placement before normal major placement, allowing WRIT 1/2 to be placed as soon as prerequisites/capacity permit.
- Reduced default full-major placement pressure to two full major/prereq courses per quarter, with rescue placement still available when needed.
- Treated the default 19-unit cap as a soft 20-unit cap for CE_BS, EE_BS, and RE_BS because official engineering planners often need occasional 20-credit quarters; lower user caps remain hard.
- Wrote the schedule-engine rulebook at `docs/plans/schedule-engine-rulebook-20260711.md`.

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

- `test_combo_matrix.js`: 3,531 scenarios checked, **0 hard failures**. Remaining warnings are expected infeasible/long-window warnings and density warnings for dense majors/gaps/low-unit caps.
- `test_data_validation.js`: 13/13 passed.
- `test_edge_scenarios.js`: all edge tests passed.
- `test_enrollment_restrictions.js`: 3/3 passed.
- `test_export_availability.js`: 6/6 passed.
- `test_phase_a_preferences.js`: 18/18 passed.
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
- Browser QA was done via browser console scenarios, not full Playwright clicks, because WSL Chromium dependencies have previously required user-run sudo install steps.
- Continue using official UCSC catalog pages as source of truth for any future requirement/prerequisite edits.
