# Prototype 4 Current Handoff

Updated: 2026-07-10

## Latest user direction
- Do not split course status into “recently offered / Schedule of Classes availability.” If a course is in the 2026-27 UCSC catalog, keep it usable.
- Focus on actual problems found by validation/tests, not catalog-page-but-not-recently-taught distinctions.

## What was checked in this batch
- Confirmed the TIM_BS/CSE 182 regression is a normal default-style TIM_BS generation case, not a gap/summer-only edge case: currentLevel 1, no completed courses, no summer, no gap; CSE 182 lands in Year 5 Fall and validation passes.
- Ran Prototype 4 validator and broad JS tests.

## Fixes made
- Fixed `WRIT 2` prerequisite encoding in `js/courses.js`: `WRIT 1` and `WRIT 1E` are alternatives, not both required.
- Added regression coverage for the `WRIT 2` alternative prerequisite in `test_scheduler_requirement_set.js`.
- Cleaned current concentration-interest pools in `js/data.js` so they no longer reference removed/no-current-course records:
  - Removed `AM 130` from `am_modeling`.
  - Removed deleted TIM entrepreneurship courses (`TIM 171`, `TIM 174`, `TIM 176`, `TIM 177`, `TIM 178`) from the TIM entrepreneurship interest pool.
  - Replaced old `ECON 110A`/`ECON 110B` with current `ECON 110` in TIM finance/econ interest pool; removed deleted `ECON 102` and `ECON 129`.
  - Added `tim_finance_econ` concentration tag to `ECON 110`.
- Updated preference/edge regression tests to use current course IDs (`ECON 166A`, `CSE 185E`, existing TIM interest electives) instead of removed stale IDs.

## Verified passing now
- `node tools/data-validator.js`
- `node test_combo_matrix.js` → 3531 scenarios, 0 hard failures, 2625 warnings.
- `node test_scheduler_requirement_set.js` → 5/5 passed.
- `node test_phase_a_preferences.js` → 18/18 passed.

## Remaining known failing edge regression tests
`node test_edge_scenarios.js` still has 3 failures:
1. Dense Robotics concentrations (`RE_BS/re_controls_sensing`, `RE_BS/re_ai_vision`) currently generate 6-year valid schedules. This may be a real planner-density issue, not a stale catalog-page issue.
2. BMEB_BI places `BME 205` before `BME 185`; test expects BMEB capstone-style options after technical writing. Need verify official requirement/capstone semantics before changing scheduler/data.
3. AM_BS winter-start with 15 prior credits still takes 5 years, but the 5th year contains `MATH 110` and `MATH 116`, not just FREE padding. The old test wording (“FREE-only overflow”) is stale, but the 5-year outcome still deserves review.

## Recommendation for next batch
- Treat #6 stale/no-page list as mostly done under the user’s latest direction: current catalog page = acceptable; do not block based on recent-offering availability.
- Next focus should be the 3 remaining `test_edge_scenarios.js` failures above, then rerun the full suite.
