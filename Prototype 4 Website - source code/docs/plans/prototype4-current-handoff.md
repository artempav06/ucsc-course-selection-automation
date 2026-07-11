# Prototype 4 Current Handoff

Updated: 2026-07-10

## Latest user direction
- Complete the planned Phase 0-4 fixes for current schedule issues in Prototype 4.
- Keep using official UCSC catalog semantics as the source of truth, and verify fixes with tests rather than assumptions.

## What was fixed in this batch
- Completed the previously failing `test_edge_scenarios.js` phase-gate items:
  1. Dense Robotics (`RE_BS/re_controls_sensing`, `RE_BS/re_ai_vision`) no longer spills a single GE/late course into an unnecessary fifth year.
  2. Robotics ECE physics-path alternatives no longer add unneeded `PHYS 6*` courses when the selected plan already satisfies the PHYS 5A/5L and PHYS 5C/5N paths.
  3. `ECE 141` now models the engineering-major prerequisite path (`ECE 103`) without imposing physics-major-only prerequisites (`PHYS 116A`, `PHYS 116C`, `PHYS 133`) on Robotics students.
  4. BMEB Bioinformatics capstone sequencing now keeps `BME 205` after `BME 185` technical writing in generated plans.
  5. AM_BS winter-start/prior-credit plans no longer extend into a final overflow year for late elective/FREE padding.
- Scheduler placement improvements in `js/engine.js`:
  - Major selection can rank future junior/senior courses without hiding them because the student is currently first-year; direct availability checks and actual quarter placement still honor class-standing restrictions.
  - Major/elective ranking now gives a schedule-flexibility bonus to broad F/W/S offerings, avoiding narrow one-quarter electives when flexible alternatives exist.
  - Dense plans can place up to three major/prerequisite courses in a quarter when unit limits permit, instead of letting GE/filler courses consume critical capacity first.
  - Non-major placement now prioritizes narrow/multi-coverage GE/UC courses like `HIS 10B` ahead of flexible generic GE fillers, preventing fake one-course overflow years.
  - Robotics plans treat the 19-unit default as a soft 20-unit UCSC-normal cap only for `RE_BS`, which matches official dense engineering-planner behavior while leaving other majors’ previous trimming behavior intact.

## Files changed
- `Prototype 4 Website - source code/js/courses.js`
  - Corrected ECE physics prerequisite encodings for `ECE 9`, `ECE 101`, `ECE 101L`, and `ECE 102` so PHYS 5/15 and PHYS 6 paths are represented as alternatives instead of accidentally requiring both tracks.
  - Corrected `ECE 141` to require `ECE 103` for engineering/robotics planning and preserve the physics-major-only prerequisite text as catalog notes.
  - Added `BME 185` as the scheduler-visible predecessor for `BME 205` in the BMEB capstone context.
- `Prototype 4 Website - source code/js/engine.js`
  - Future-planning level restriction opt-out for major selection ranking.
  - Rank-only term-flexibility bonus.
  - RE_BS soft 20-unit placement cap from the historical 19-unit default.
  - Up-to-three major/prereq placement pass.
  - Smarter non-major GE/UC placement priority.

## Verified passing now
- `node test_phase_a_preferences.js` → 18/18 passed.
- `node test_edge_scenarios.js` → 16/16 passed.
- `node test_ui_profile_flow.js` → 11/11 passed.
- `node test_export_availability.js` → 6/6 passed.
- `node test_requirement_collector.js` → 35/35 passed.
- `node test_scheduler_requirement_set.js` → 5/5 passed.
- `node test_prerequisite_correctness.js` → 7/7 passed.
- `node test_smoke.js` → 98/98 passed.
- `node tools/data-validator.js` → exit 0.

## Current known status
- The Phase 0-4 schedule-issue batch is complete and verified locally.
- Remaining smoke warnings are valid long/dense schedules for CE_BS, EE_BS, and TIM_BS, not hard failures; no prerequisite violations or duplicate-course failures are present in the smoke matrix.

## Recommendation for next batch
- Commit these Prototype 4 fixes after reviewing the diff.
- Next improvement batch should focus on reducing CE_BS/EE_BS/TIM_BS 5-year warnings if desired, but keep those separate from this completed edge-regression batch.
