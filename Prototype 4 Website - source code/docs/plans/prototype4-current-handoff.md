# Prototype 4 Current Handoff

_Last updated: 2026-07-11 after CS_BA schedule quality regression fix._

## Status

Prototype 4 is the active UCSC course-selection workspace at:

`/home/artem/projects/ucsc-course-selection-automation/Prototype 4 Website - source code/`

Latest local fixes in this batch address the schedule-quality regression Artem reported for CS_BA:

- CS_BA generic arts/humanities GE schedules no longer pull an unrelated chemistry/biology prerequisite chain (`CHEM 1A`, `CHEM 3A`, `BIOL 20A`, `BIOE 20B`) just to satisfy SI.
- The GE picker now penalizes courses with missing prerequisite chains and avoids CHEM/BIOL/BIOE/PHYS SI courses unless the student specifically chooses the natural-sciences GE concentration.
- `BIOL 20A` prerequisite encoding was corrected from two AND groups to one OR group: `CHEM 1A` OR `CHEM 3A` OR `CHEM 4A`.
- `WRIT 1` no longer engine-enforces `WRIT 26` as a required course because the official prerequisite text includes placement/direct-self-placement alternatives; the official text is preserved in notes.
- Placement now prioritizes `WRIT 1` and `WRIT 2` so unsatisfied students get them in the first two years, before major declaration pressure becomes a problem.
- Added regression tests for both issues in `test_edge_scenarios.js`.

## Verified CS_BA Example

Command:

```bash
node scripts/inspect_schedule.js CS_BA cs_ai_ml
```

For a fresh CS_BA AI/ML profile with arts/humanities GE concentration:

- Phase 2 GE courses: `MUSC 11D`, `HIS 10B`, `FILM 20A`, `ANTH 3`, `WRIT 1`, `PHIL 28`, `THEA 10`, `WRIT 2`.
- Phase 4 prereqs: none.
- `WRIT 1`: Year 2 Winter.
- `WRIT 2`: Year 2 Spring.
- No chemistry/biology chain is selected.
- SI is satisfied by `ANTH 3`.
- Overall validation: all requirements met, 183 units, 62 upper-division units, 4 years.

## Latest Test Status

Run from `Prototype 4 Website - source code/`:

```bash
node test_phase_a_preferences.js
node test_edge_scenarios.js
node test_ui_profile_flow.js
node test_export_availability.js
node test_requirement_collector.js
node test_scheduler_requirement_set.js
node test_prerequisite_correctness.js
node test_smoke.js
node tools/data-validator.js
```

Latest verified results:

- `test_phase_a_preferences.js`: 18/18 passed.
- `test_edge_scenarios.js`: all edge tests passed, including the new CS_BA no-chem-chain and WRIT first-two-years regressions.
- `test_ui_profile_flow.js`: 11/11 passed.
- `test_export_availability.js`: 6/6 passed.
- `test_requirement_collector.js`: 35/35 passed.
- `test_scheduler_requirement_set.js`: 5/5 passed.
- `test_prerequisite_correctness.js`: 7/7 passed.
- `test_smoke.js`: 98/98 passed.
- `tools/data-validator.js`: exit 0.

## Link Verification Spot Check

Current file URLs were verified with HTTP 200 for:

- `CHEM 1A`: `https://catalog.ucsc.edu/en/current/general-catalog/courses/chem-chemistry-and-biochemistry/0-99/chem-1a`
- `CHEM 3A`: `https://catalog.ucsc.edu/en/current/general-catalog/courses/chem-chemistry-and-biochemistry/0-99/chem-3a`
- `WRIT 1`: `https://catalog.ucsc.edu/en/current/general-catalog/courses/writ-writing/lower-division/writ-1`
- `WRIT 2`: `https://catalog.ucsc.edu/en/current/general-catalog/courses/writ-writing/lower-division/writ-2`

## What Actually Happened With GitHub

Repository history shows Prototype 4 was first committed to the tracked `main` history in:

- `266bf05 feat: add Prototype 4 prerequisite-quality workspace` at `2026-07-10 23:38:14 -0700`

Then schedule-edge fixes were committed/pushed in:

- `058829a fix Prototype 4 schedule edge regressions` at `2026-07-11 00:06:02 -0700`

Before `266bf05`, Prototype 4 existed locally but was not tracked by Git, so GitHub would not show it even though local files existed. Current evidence does not show a committed Prototype 4 folder being deleted from tracked history; the likely cause of it “disappearing” from GitHub earlier was that it had not actually been added/committed/pushed yet.

## Remaining Caution

Prototype 4 is much better after this patch, but before broader beta launch continue doing realistic student scenario QA and browser QA. Node tests are strong, but real UI/browser behavior still needs repeated manual/Playwright-style testing when WSL browser dependencies are available.
