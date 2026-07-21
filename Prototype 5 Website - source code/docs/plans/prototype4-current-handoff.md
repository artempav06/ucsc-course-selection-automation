# Prototype 4 Current Handoff

_Last updated: 2026-07-20 after Prototype 5 college-core requirement-tracker integration, generated-schedule warning/export cleanup, and focused/full JS regression checks._

## Prototype 5 Latest Handoff

Active workspace is now Prototype 5 at:

`/home/artem/projects/ucsc-course-selection-automation/Prototype 5 Website - source code/`

Latest batch completed:

- Removed the Word download option from the generated schedule UI; PDF and Excel remain.
- Added generated-schedule advising warning language with selected-major UCSC Catalog requirement link and course-quarter availability caveat.
- Added college-core handling as an explicit requirement when a student chooses a UCSC college affiliation: the normalized requirement set now includes `PROFILE:COLLEGE_CORE`, validation exposes `collegeCore` / `allCollegeCoreMet`, `allMet` is blocked when the selected college core is missing, the Requirement Tracker shows a College Core section, and validation alerts surface missing college-core courses.
- Confirmed college-core placement policy: non-Stevenson college core is planned in freshman Fall; Stevenson plans `STEV 1` in freshman Fall and `STEV 2` in freshman Winter unless already completed.
- Added regressions in `test_scheduler_requirement_set.js` and `test_ui_profile_flow.js` for all-major college-core requirement availability, affiliation-specific validation, freshman-quarter placement, and Requirement Tracker rendering.

Verified from Prototype 5:

```bash
node test_scheduler_requirement_set.js      # 10/10 passed
node test_ui_profile_flow.js                # 14/14 passed
node test_requirement_collector.js          # 35/35 passed
```

Additional verification already run in this batch:

- `for f in test_*.js; do node "$f"; done` progressed through many tests, but timed out at the long suite boundary before `test_requirement_collector.js`; rerunning `test_requirement_collector.js` separately passed.
- Follow-up explicit run passed: `test_requirement_normalizer.js`, `test_requirement_normalizer_runtime.js`, `test_responsive_css.js`, `test_schedule_policy_audit.js`, `test_schedule_regression.js`, `test_scheduler_requirement_set.js`, `test_smoke.js`, `test_toposort.js`, `test_ui_profile_flow.js`, and `test_warning_triage_diagnostics.js`.

Next continuation should start by checking current `git diff` in Prototype 5, then continue from any remaining Artem requests rather than the older Prototype 4 sections below.

## Prototype 4 Historical Handoff

_Last updated: 2026-07-12 after fixing no-implicit-gap quarter compaction/padding, rerunning focused scheduler/UI tests, and verifying no no-gap empty regular quarter remains before later scheduled work across a broad student-choice matrix._

## Active Workspace

Prototype 4 is the active UCSC course-selection workspace at:

`/home/artem/projects/ucsc-course-selection-automation/Prototype 4 Website - source code/`

Important: earlier browser/server QA accidentally hit a stale server rooted at Prototype 3. For future work, always verify the served directory and script URLs before judging Prototype 4 behavior.

## Latest No-Implicit-Gap Fix

Artem flagged a serious UX/scheduler bug: regular Fall/Winter/Spring quarters could appear blank even though the student did not choose a GAP quarter, while later quarters still contained scheduled work. This is now treated as wasted capacity and an implicit break.

Fixes added on 2026-07-12:

- Added a post-chronology compaction pass in `Scheduler.placeIntoQuarters(...)` that pulls legally-placeable later real courses backward into empty non-gap quarters before optional FREE padding.
- Added a final no-implicit-gap safeguard that fills any still-blank regular quarter before later scheduled work with FREE credit rather than leaving an unchosen break. Summer is still excluded unless `includeSummer` is true; explicit `_GAP` quarters remain the only intentional blank quarters.
- Added an AM_BS compressed-transfer regression in `test_schedule_regression.js` proving no empty non-gap quarter appears before later scheduled work.
- Rechecked student-option wiring: `includeSummer` comes from `check-summer`, `gapEnabled` comes from `check-gap`, and scheduler gap marking only activates when `profile.gapEnabled` is true.
- Ran a broad no-gap/no-summer matrix over majors, levels, current terms, prior credits, and grad years; result: `empty-before-later count 0` and no Summer quarter emitted when `includeSummer:false`.

## Latest Credit-First Completion Batch

Follow-up verification on 2026-07-12 fixed the review-found engineering soft-20 mismatch: `Scheduler.effectiveMaxUnits(profile)` is now the single cap source for placement, credit-load bands, final policy audit, and safe repair. `test_schedule_policy_audit.js` now includes a regression proving an EE_BS 20-credit soft-cap quarter is not flagged or repaired as overflow while normal non-engineering 20-credit quarters are still hard errors.

This batch completed the remaining staged credit-first plan in `docs/plans/credit-first-staged-engine-implementation-plan-20260711.md`:

- Rechecked Phase 4 GE-before-filler behavior with `test_ge_priority.js` and kept FREE padding as last-resort unit padding.
- Replaced remaining course-count-first major placement with credit-first placement: normal quarters now aim for about 10+ major/prereq credits when valid courses fit, then GE/UC before elective/filler while distribution requirements remain.
- Added `Scheduler.courseUrgency(...)` for lower-division foundations, WRIT 1/2, prerequisite-chain starters, and rare offerings, while preserving topological prerequisite order.
- Added schedule policy audit/repair APIs: `Scheduler.auditSchedulePolicy(...)`, `Scheduler.repairSchedulePolicy(...)`, and `explanation.policyAudit = { beforeRepair, repairsApplied, afterRepair }`.
- Added data/tag audit scripts: `scripts/audit_interest_tags.js` and `scripts/audit_ge_candidates.js`, with `test_interest_tag_audit.js`. Current hard audit errors are 0.
- Removed stale `HIS 80A` references from active AH/AI and `ge_social_sciences` pools because the local official-audit data classifies it as possible renamed/renumbered with no exact current official page; current alternatives remain `HIS 10B` and `POLI 20`.

## Previous Fix Batch

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
python3 -m http.server 8094
```

Browser verification at `http://127.0.0.1:8094/` confirmed on 2026-07-12:

- Page title: `UCSC Course Selection Automation`.
- Landing page and wizard loaded with no console errors.
- Real browser wizard generated an Electrical Engineering B.S. schedule from a freshman Fall 2026 profile.
- Generated schedule rendered without obvious visual breakage, overlapping controls, missing schedule content, or unreadable main content.
- Requirement tracker showed `100% Complete`, `Total Units: 192 / 180`, `Upper Div: 89 / 60`, and all major/GE/UC sections complete for the tested EE_BS schedule.
- Top action buttons and repeated `+ Add Course` buttons were visible; no JS errors were reported after generation.
- Screenshot evidence: `/home/artem/.hermes/cache/screenshots/browser_screenshot_63c072973e404e10b6fdff569800a82f.png`.

Previous browser-context coverage also checked 60 scenarios across 12 majors × 5 realistic profile variants with 0 hard failures and confirmed WRIT 1/2 early placement for default, winter-start, summer/low-unit, and gap scenarios.

## Latest Test Status

Run from `Prototype 4 Website - source code/`. The full verification was split so the long combo matrix did not run twice inside the catch-all loop. Verified commands/results:

```bash
node tools/data-validator.js                # 13/13 passed via test_data_validation.js
node test_credit_first_policy.js          # 7/7 passed
node test_credit_first_placement.js       # 3/3 passed
node test_ge_priority.js                  # 4/4 passed
node test_schedule_policy_audit.js        # 4/4 passed, including engineering soft-20 audit/repair regression
node test_interest_tag_audit.js           # 2/2 passed
node test_ui_profile_flow.js              # 11/11 passed
node test_phase_a_preferences.js          # 20/20 passed
node test_prerequisite_correctness.js     # 7/7 passed
node test_schedule_regression.js          # representative regressions passed; 12/12 majors have <=4-year default plan
node test_combo_matrix.js                 # 3,531 scenarios, 0 hard failures, 2,281 warnings
for t in test_*.js; do node "$t"; done     # all files through test_ui_profile_flow passed before 600s timeout at final long warning triage file
node test_warning_triage_diagnostics.js   # passed when run separately
node scripts/audit_interest_tags.js       # 0 hard errors, 0 warnings
node scripts/audit_ge_candidates.js       # 0 hard errors, 3 advisory warnings
```

The catch-all loop hit the 600s command limit only because it reached the final long warning-triage file after already running the combo matrix and nearly every other test in one shell. The timed-out file was rerun separately and passed. Browser smoke via `http://127.0.0.1:8094/` loaded actual Prototype 4 with no console errors and generated an EE_BS schedule that rendered complete in the real browser.

## Remaining Caution / Next Good Work

- `test_combo_matrix.js` still reports many warnings, mostly schedule windows that run long under low max units/gaps and major-course density in dense lab-heavy plans. These are not hard failures, but they are good future UX targets.
- The staged credit-first plan is now implemented and verified. Future schedule-quality work should focus on reducing remaining non-fatal warning buckets rather than redoing the core phases.
- `test_combo_matrix.js` currently reports 2,281 warnings with 0 hard failures: schedule-length-over-window warnings dominate, followed by major-course-density warnings for dense majors/gaps/low-unit caps.
- Browser QA used the built-in Hermes browser against a local Prototype 4 server and found no console errors or obvious generated-schedule rendering breakage. Some browser-tool clicks on wizard buttons were unreliable, so JS-triggered clicks were used to complete the flow; Node UI-flow tests still cover the normal event handlers.
- Continue using official UCSC catalog pages as source of truth for any future requirement/prerequisite edits.
