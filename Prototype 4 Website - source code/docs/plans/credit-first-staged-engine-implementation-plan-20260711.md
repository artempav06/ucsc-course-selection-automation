# Credit-First Staged Scheduler Implementation Plan

> **For Hermes:** Use test-driven-development for every behavior change. Use subagent-driven-development only after this plan is stable and if Artem asks for implementation in parallel.

**Goal:** Rebuild Prototype 4 scheduling behavior around Artem's quarter-by-quarter policy: finish lower-division major + WRIT early, prioritize GE completion before free/elective filler, keep normal quarters near 15-17 credits and <=19, and use student interests to choose the best GE/elective courses.

**Architecture:** Keep the existing normalized requirement collector/engine split, but add a clearer staged pipeline and a final audit/repair stage. Selection should still choose the right courses first; placement should then distribute them quarter-by-quarter using credit-load scoring and phase priorities. The final audit should explain exactly which rule failed and either perform a safe local repair or emit a diagnostic instead of silently producing a low-quality schedule.

**Tech Stack:** Static JavaScript app, Node-based tests, current files under `js/`, tests as `test_*.js`, docs under `docs/plans/`.

---

## Current findings from inspection

### Existing engine phases

`js/engine.js` already has a staged `generateWithExplanation(profile)` pipeline:

1. Major selection.
2. GE selection.
3. UC selection.
4. Prerequisite expansion.
5. Upper-division supplement.
6. FREE unit padding.
7. Filler pool.
8. Quarter placement.
9. Validation/totals if requested.

`placeIntoQuarters(...)` then has quarter-level subphases:

1. early WRIT placement;
2. major/prereq placement, currently capped by `majorCount < 2`;
3. non-major placement;
4. third-major rescue if under minimum units;
5. backfill/overflow/chronology repair;
6. final FREE padding;
7. trailing-quarter trimming.

This is close to Artem's requested shape, but it still needs a stronger credit-first policy, GE-before-elective policy, and final rule audit.

### Existing interest/tag data

There are interest-like tags already:

- Major/elective interest groups live in `CONCENTRATIONS.major` in `js/data.js`.
- GE interest groups live in `CONCENTRATIONS.ge` in `js/data.js`.
- Course-level major/elective tags are stored as `COURSES[code].concentrations` in `js/courses.js`.
- GE category tags are stored as `COURSES[code].ge`, plus GE groups in `CONCENTRATIONS.ge[*].geCodes` and `CONCENTRATIONS.ge[*].courses`.

Quick current counts:

- total courses: 4,233;
- courses with non-empty `concentrations`: 228;
- courses with `ge`: 1,603;
- GE interest ids appear in some course `concentrations`, so the tag system mixes major-interest and GE-interest style ids in one array.

Plan implication: we should support both fields cleanly instead of assuming one selected `profile.concentration` and one selected `profile.geConcentration` are enough forever.

---

## Artem's target scheduling policy

### Quarter-level load rule

Each normal quarter should aim for:

- **10+ credits of major-required/prerequisite/major-elective work**, when available and prerequisites allow.
- **5-9 credits of GE or elective work**, depending on current stage.
- **15-17 total credits preferred**.
- **<=19 total credits normally**.
- Course count is secondary. 4 courses are fine when credits fit, e.g. `5 + 5 + 2 + 5 = 17`.

### First two years / lower-division rule

The scheduler should aggressively complete:

- lower-division major requirements;
- lower-division prerequisites for upper-division major courses;
- WRIT 1 and WRIT 2;
- GE/UC requirements that can be completed without disrupting major progress.

Target window:

- ideally first 1.5 years;
- normally by end of first 2 years;
- if impossible due to start term, transfer profile, gaps, low unit cap, or offerings, explain why.

### GE-before-elective rule

Before all GE categories are fulfilled:

- fill the non-major 5-9 credit slot with GE/UC courses;
- do **not** add generic electives/free fillers just because there is room;
- do **not** take a second GE from an already-covered GE family/category unless it also satisfies another still-needed requirement or is major-required.

After all GE/UC categories are fulfilled:

- switch the non-major slot to useful electives/fillers:
  - major electives if still needed;
  - upper-division supplement if needed;
  - interest-matched elective/filler only if it helps total units without delaying required courses;
  - FREE padding only as the last resort to reach the degree-unit floor.

### Interest preference rule

The UI should allow students to choose up to **2 GE interests** and up to **2 elective/major interests**.

Selection scoring should then prefer courses that:

1. satisfy a still-needed requirement;
2. match both a GE need and a selected interest;
3. cover multiple requirements/categories when allowed;
4. have low prerequisite burden;
5. are offered inside the student's valid planning window;
6. fit the target quarter credit load;
7. respect preferred/avoided courses and enrollment restrictions.

### Final audit rule

After generation, run a final scheduler audit that checks every quarter and the whole plan against the rule pipeline:

1. all hard requirements met;
2. no chronological prerequisite violations;
3. lower-division/WRIT completed early when feasible;
4. quarter loads near 15-17 and <=19 unless justified;
5. 10+ major credits in normal quarters when major work is available;
6. GE categories not duplicated unnecessarily;
7. no electives/FREE padding before GE completion unless they are required/justified;
8. no fake longer schedules caused by conservative placement;
9. if a rule fails, either repair it safely or explain the exact blocker.

---

## Implementation phases

## Phase 0 — Baseline and fixtures

### Task 0.1: Record baseline warning/output snapshot

**Objective:** Know exactly what changes after the new logic.

**Files:**

- Read: `test_combo_matrix.js`
- Read: `scripts/inspect_schedule.js`
- Create/update: `docs/plans/credit-first-baseline-20260711.md`

**Steps:**

1. Run:

```bash
cd "/home/artem/projects/ucsc-course-selection-automation/Prototype 4 Website - source code"
node test_combo_matrix.js > /tmp/prototype4-combo-before.txt
node test_schedule_regression.js > /tmp/prototype4-regression-before.txt
```

2. Save warning bucket summary in the baseline doc.
3. Pick 4 representative profiles for regression fixtures:
   - CS_BS default freshman;
   - CE_BS or EE_BS dense engineering;
   - TIM_BS interest-heavy/elective-heavy;
   - one bio/biotech lab-heavy major.

**Verification:** baseline docs mention current warnings and representative schedules.

---

## Phase 1 — Define schedule policy helpers

**Progress 2026-07-11:** Implemented and verified. Added credit/load helpers and GE family helpers on `Scheduler`, plus mirrored GE-family logic in `RequirementCollector`. Covered by `test_credit_first_policy.js` (7/7 passed) and `test_ge_priority.js` (4/4 passed).

### Task 1.1: Add quarter classification helpers

**Objective:** Centralize credit/load policy so tests and engine use the same definitions.

**Files:**

- Modify: `js/engine.js`
- Test: create `test_credit_first_policy.js`

**Add helper API on `Scheduler`:**

```js
creditLoadBand(units, profile) // "under_min", "low", "target", "acceptable_high", "over_cap"
quarterUnits(courses)
quarterTypeUnits(courses, courseTypeMap)
isLowUnitCompanion(code)
normalMaxUnits(profile) // usually 19; engineering soft 20 only with explicit justification path
```

**Policy:**

- target: 15-17;
- acceptable low: 12-14 when there are not enough valid courses yet;
- acceptable high: 18-19;
- over cap: >19 unless explicitly allowed by profile and documented.

**RED tests:**

- 17 credits => target;
- 19 credits => acceptable_high;
- 20 credits => over_cap for normal CS profile;
- low-unit lab counts in total units but is flagged as companion, not a full lecture load.

**Verification command:**

```bash
node test_credit_first_policy.js
```

---

### Task 1.2: Add GE family/category helpers

**Objective:** Prevent duplicate GE category courses after a category is already covered.

**Files:**

- Modify: `js/engine.js`
- Test: `test_credit_first_policy.js`

**Add helper API:**

```js
geFamilyOfCourse(code)
geFamiliesSatisfiedBy(courses)
courseSatisfiesGEFamily(code, familyId)
stillNeededGEFamilies(plannedOrCompletedCourses, profile)
isRedundantGE(code, plannedOrCompletedCourses, profile)
```

**Important rules:**

- `PE-H`, `PE-T`, `PE-E` all satisfy the `PE` family; once PE is satisfied, avoid another PE unless major-required or it satisfies another still-needed requirement.
- `PR-C`, `PR-E`, `PR-S` all satisfy the `PR` family.
- `DC` may be satisfied by major capstone/DC courses; do not add generic DC courses when major DC already covers it.
- WRIT 2 covers `C`; WRIT 1/1E can cover ELWR/TA-style needs depending current data but should not cause duplicate writing filler.

**RED tests:**

- If `PSYC 1` already satisfies PE, another PE-only course should be redundant.
- If `HIS 10B` satisfies both AH and AI, it should be preferred over taking separate AH and AI courses.
- A major-required course with GE should not be removed just because its GE family is already satisfied.

---

## Phase 2 — Expand profile model and UI for two interests

**Progress 2026-07-11:** Implemented in this batch. `collectConcentrations()` now captures up to two `electiveInterests` and two `geConcentrations` while keeping `profile.concentration` / `profile.geConcentration` as first-item compatibility fields. `populateConcentrationGrids()` renders checkbox options with a limit-2 guard. Covered by `test_ui_profile_flow.js`.

### Task 2.1: Add profile arrays while keeping old fields compatible

**Objective:** Support up to two GE interests and two elective/major interests without breaking existing tests/UI.

**Files:**

- Modify: `js/app.js`
- Modify: `js/engine.js`
- Modify: `js/engine/requirement-normalizer.js` if it records profile preference fields
- Test: `test_ui_profile_flow.js`
- Test: `test_phase_a_preferences.js`

**Profile shape:**

```js
profile.geConcentrations = ["ge_tech_society", "ge_creative"];
profile.electiveInterests = ["cs_ai_ml", "cs_data"];
```

Compatibility:

```js
profile.geConcentration // still maps to first item for existing code
profile.concentration   // still maps to first major/elective interest
```

**RED tests:**

- Wizard can capture two GE interests.
- Wizard can capture two elective/major interests.
- Existing single-choice profile still works.
- Scheduler sees both arrays in generated profile.

---

### Task 2.2: Change UI controls from radio to checkbox-with-limit-2

**Objective:** Let the student express two interests without noisy multi-select UX.

**Files:**

- Modify: `index.html` only if labels/instructions are static there.
- Modify: `js/app.js:populateConcentrationGrids`, `collectConcentrations`.
- Modify: CSS if selected checkbox styling needs improvement.
- Test: `test_ui_profile_flow.js` fake-DOM coverage.

**Behavior:**

- Show “Choose up to 2” for major/elective interests.
- Show “Choose up to 2” for GE interests.
- Allow “No preference” to clear all selected checkboxes.
- If a student selects a third option, either block it or uncheck the oldest selection. Prefer block + small inline hint.

**Verification:** UI flow test asserts arrays of length 0, 1, and 2 are collected correctly.

---

## Phase 3 — Preference scoring cleanup

**Progress 2026-07-11:** Partially implemented. Added normalized interest helper APIs on `Scheduler` and mirrored the normalized scoring in `RequirementCollector` so GE selection, filler pools, ranking, add-course, and replacement suggestions understand both legacy single fields and new two-interest arrays. Added two-interest reason assertions to `test_phase_a_preferences.js`. The tag-audit script task remains future work.

### Task 3.1: Normalize interest matching

**Objective:** Make GE and elective scoring understand arrays and mixed tag sources.

**Files:**

- Modify: `js/engine.js`
- Modify: `js/engine/requirement-collector.js` if collector scoring mirrors engine scoring.
- Test: `test_phase_a_preferences.js`

**Add helper API:**

```js
profileGEInterests(profile)       // array
profileElectiveInterests(profile) // array
courseInterestMatches(code, profile)
geInterestMatches(code, profile)
interestScore(code, profile, context)
```

**Scoring idea:**

- exact selected elective interest in `course.concentrations`: +120 each;
- exact selected GE interest in `course.concentrations`: +80 each;
- GE group course list match: +100;
- GE family match through `geCodes`: +50;
- two-interest match bonus: +40 extra if course matches both selected interests or a GE interest plus major/elective interest;
- never let interest match override missing prerequisites, impossible offering window, or wrong requirement family.

**RED tests:**

- Changing selected GE interests changes selected GE course when both options satisfy the same GE family.
- Changing elective interests changes chosen pick_n elective order.
- A course matching both interests beats a course matching one interest when all hard constraints are equal.

---

### Task 3.2: Add tag coverage diagnostics

**Objective:** Confirm the “cool feature” is real and maintained: advertised interests must map to courses.

**Files:**

- Create: `scripts/audit_interest_tags.js`
- Test: `test_data_validation.js` or new `test_interest_tag_audit.js`
- Possibly modify: `tools/data-validator.js`

**Audit should report:**

- every `CONCENTRATIONS.major[major][*].id` has at least one course reference;
- every referenced course exists;
- every selected/elective interest has enough schedulable candidates for its major;
- every GE interest has at least one candidate for each relevant GE family it claims through `geCodes`;
- no placeholder/bad ids like `***` in active concentration definitions;
- no course has unknown interest ids unless intentionally shared GE-interest ids are allowed.

**Verification:**

```bash
node scripts/audit_interest_tags.js
node test_interest_tag_audit.js
```

---

## Phase 4 — Course selection policy: GE before free/elective filler

**Progress 2026-07-11:** Implemented and verified for the current normalized path. GE/UC family matching now includes both `GE_REQUIREMENTS` and `UC_REQUIREMENTS`, skips redundant already-satisfied families, preserves major-required GE courses, and gives multi-family/still-needed GE coverage priority. FREE padding has an explicit last-resort policy string and remains after major/GE/UC/prereq/upper-division selection. Covered by `test_ge_priority.js` and regression tests.

### Task 4.1: Make GE selection cover each GE family once

**Objective:** Ensure `selectGECourses`/`pickGE` selects only still-needed GE families and prefers multi-coverage.

**Files:**

- Modify: `js/engine.js:pickGE`
- Modify: `js/engine/requirement-collector.js:selectGECourses` if normalized path is active.
- Test: new `test_ge_priority.js`

**RED tests:**

- A profile with `HIS 10B` available should use it for AH+AI instead of picking two separate courses where possible.
- Once PE is satisfied, `pickGE` does not select another PE-only course.
- If a major-required course satisfies MF/SR/DC, GE picker does not add duplicate MF/SR/DC.
- GE picker selects one valid course per unsatisfied family and no redundant extras.

---

### Task 4.2: Delay FREE padding and generic filler until after GE/UC satisfaction

**Objective:** Prevent electives/free courses from taking room before GE categories are done.

**Files:**

- Modify: `js/engine.js:generateWithExplanation`
- Modify: `js/engine/requirement-collector.js:selectFreePaddingCourses` if needed.
- Test: `test_ge_priority.js`

**Policy:**

- Before GE/UC are satisfied, quarter non-major slot should pull from selected GE/UC list only.
- FREE padding should occur only after all real requirements and needed GE/UC are scheduled, and only to reach total units.
- Upper-division supplement is not generic filler; it can be selected when needed for upper-div minimum, but should not displace GE completion early.

---

## Phase 5 — Quarter placement: credit-first staged placement

**Progress 2026-07-11:** Partially implemented. The placement policy now exposes credit/load helpers and allows dense engineering plans to use a justified soft 20-unit rescue when a <=15-unit quarter can absorb an additional required course, fixing the RE_BS autonomous fake fifth-year regression while keeping normal CS profiles capped by policy tests. Full lower-division urgency scoring and final audit/repair remain future phases.

### Task 5.1: Replace `majorCount < 2` with major-credit target

**Objective:** Stop using course count as the main quarter load control.

**Files:**

- Modify: `js/engine.js:placeIntoQuarters`
- Test: `test_credit_first_placement.js`

**New placement subphases per quarter:**

1. **Writing gate:** place WRIT 1/2 as early as possible if still needed.
2. **Lower-division/critical major gate:** place prerequisite-critical lower-division major courses first, especially years 1-2.
3. **Major credit target:** add major/prereq/major-elective courses until quarter has about 10+ major credits or no valid major course fits.
4. **GE stage:** if GE/UC remains, add best GE/UC course that brings quarter to 15-17 and covers a new family.
5. **Elective stage:** only after GE/UC complete, add elective/upper-div/free as needed to reach 15-17 or degree totals.
6. **Do not exceed 19** unless explicit soft exception is justified.

**RED tests:**

- A quarter can contain 4 courses totaling 17 credits if one course is a 2-credit lab.
- Engine prefers 15-17 credits over 12 when valid GE exists.
- Engine does not place 20 credits for a normal CS profile.
- If two 5-credit major courses are available, quarter should usually have at least 10 major credits.

---

### Task 5.2: Add lower-division early scheduling pressure

**Objective:** Finish lower-division major/prereq courses within first 1.5-2 years when feasible.

**Files:**

- Modify: `js/engine.js:topoSort` or placement scoring helper.
- Test: `test_lower_division_priority.js`

**Implementation idea:**

Add a course urgency score:

```js
courseUrgency(code, profile, slot)
```

Boost:

- lower-division major/prereq in years 1-2;
- courses that unlock long prerequisite chains;
- WRIT 1/2 before year 2;
- offered rarely this planning window;
- required by many later selected courses.

Penalize:

- upper-division electives before lower-division foundation is complete unless required/rare offering;
- generic filler before GE completion.

**RED tests:**

- CS_BS places CSE/MATH lower-division foundation before upper-division electives when both are available.
- WRIT 1 and WRIT 2 complete by year 2 if profile starts freshman and prerequisites allow.
- Dense engineering still respects actual prerequisite ordering and offerings.

---

### Task 5.3: Prefer GE slots before elective slots until GE complete

**Objective:** Make the quarter-level behavior match Artem's “major + GE first, then major + elective” rule.

**Files:**

- Modify: `js/engine.js:placeIntoQuarters`
- Test: `test_ge_priority.js`

**RED tests:**

- In the first years, if a needed GE and a generic elective both fit, GE is placed first.
- After all GE categories are satisfied, elective/filler can be used to reach 15-17.
- No duplicate GE family is placed while another GE family remains unsatisfied.

---

## Phase 6 — Final audit and repair stage

### Task 6.1: Add schedule policy audit

**Objective:** Make the final stage explicitly double-check the entire rule pipeline.

**Files:**

- Modify: `js/engine.js`
- Test: `test_schedule_policy_audit.js`

**Add API:**

```js
Scheduler.auditSchedulePolicy(schedule, profile, courseTypeMap)
```

**Audit output:**

```js
{
  hardErrors: [],
  warnings: [],
  quarterDiagnostics: [
    {
      yearLabel,
      term,
      units,
      majorUnits,
      geUnits,
      electiveUnits,
      loadBand,
      neededGEBeforeQuarter,
      redundantGECourses,
      earlyLowerDivisionMissing,
      fixSuggestions
    }
  ]
}
```

**Hard errors:** unmet major/GE/UC, prerequisite violations, over hard cap.

**Warnings:** avoidable low-load quarters, duplicate GE family, elective before GE completion, lower-division foundation late, soft-20 used.

**RED tests:**

- Audit catches a duplicate PE GE while CC remains unsatisfied.
- Audit catches an elective placed before GE completion when a GE could fit.
- Audit catches >19 units without allowed exception.
- Audit passes a normal valid 15-17 credit quarter.

---

### Task 6.2: Add safe local repair pass

**Objective:** Fix obvious quarter-quality issues without rerunning the whole generator blindly.

**Files:**

- Modify: `js/engine.js`
- Test: `test_schedule_policy_audit.js`

**Add API:**

```js
Scheduler.repairSchedulePolicy(schedule, profile, courseTypeMap, audit)
```

**Allowed repairs:**

- Move flexible GE/elective earlier if prerequisites/offerings/cap allow.
- Swap redundant GE with a still-needed GE from selected pool/filler pool if valid.
- Move generic filler later if it blocks a required GE/major course.
- Remove FREE padding that causes a real course to overflow.

**Not allowed:**

- Break prerequisites.
- Invent courses not in data.
- Drop major/GE/UC requirements.
- Exceed unit cap.
- Change a required major path without revalidating requirements.

**Loop policy:**

- Run audit.
- Apply one batch of safe repairs.
- Re-run audit.
- Max 3 iterations to avoid infinite loops.
- If unresolved, explanation should name exact blockers.

---

### Task 6.3: Expose audit in `generateWithExplanation`

**Objective:** Make debugging and UI explanations transparent.

**Files:**

- Modify: `js/engine.js:generateWithExplanation`
- Modify: possibly `scripts/inspect_schedule.js`
- Test: `test_schedule_policy_audit.js`

**Explanation shape:**

```js
explanation.policyAudit = {
  beforeRepair,
  repairsApplied,
  afterRepair
};
```

**Verification:** `scripts/inspect_schedule.js` prints quarter diagnostics and policy warnings.

---

## Phase 7 — Data correctness / tag-category audit

### Task 7.1: Audit GE category correctness for selected/advertised GE pools

**Objective:** Avoid bad GE recommendations from wrong data.

**Files:**

- Create: `scripts/audit_ge_candidates.js`
- Possibly modify: `js/data.js`, `js/courses.js` only after official catalog verification.
- Test: `test_data_validation.js` or new `test_ge_candidate_audit.js`

**Scope:**

Start with courses used by:

- `GE_REQUIREMENTS[*].courses`;
- `CONCENTRATIONS.ge[*].courses`;
- currently selected GE courses across supported-major default schedules;
- common low-prereq candidates from the 1,603 GE-tagged courses.

For each candidate verify:

- course exists;
- GE code/family is official/current;
- units are correct;
- offering terms are plausible/current data;
- prerequisites are encoded correctly enough for scheduling.

**Important:** Do not claim all 4,233 courses are fully verified until this audit is complete.

---

### Task 7.2: Audit elective/interest category correctness for supported majors

**Objective:** Ensure the personalization feature chooses meaningful classes.

**Files:**

- Create: `scripts/audit_elective_interest_tags.js`
- Possibly modify: `js/data.js`, `js/courses.js` after official catalog checks.

**Scope:**

For each supported major:

- every `CONCENTRATIONS.major[major][*].courses` course exists;
- course is allowed/usable in that major's elective buckets, or clearly marked as broader interest-only;
- course tags match the interest name;
- no interest has too few valid choices;
- no invalid placeholder ids.

**Verification:** report has zero hard errors; warnings are documented with next official-catalog lookup tasks.

---

## Phase 8 — Broad regression and browser QA

### Task 8.1: Add focused regression suite

**Objective:** Freeze Artem's new policy into tests.

**Files:**

- Create/modify: `test_credit_first_policy.js`
- Create/modify: `test_credit_first_placement.js`
- Create/modify: `test_ge_priority.js`
- Create/modify: `test_schedule_policy_audit.js`
- Create/modify: `test_ui_profile_flow.js`

**Must-have assertions:**

- 15-17 credits preferred when feasible.
- <=19 cap enforced by default.
- 4-course/17-credit quarters allowed.
- lower-division major + WRIT early.
- GE families not duplicated unnecessarily.
- GE completion before generic elective/free padding.
- two GE interests and two elective interests affect recommendations.
- final audit catches violations.

---

### Task 8.2: Run full verification bundle

**Commands:**

```bash
cd "/home/artem/projects/ucsc-course-selection-automation/Prototype 4 Website - source code"
node tools/data-validator.js
node test_credit_first_policy.js
node test_credit_first_placement.js
node test_ge_priority.js
node test_schedule_policy_audit.js
node test_ui_profile_flow.js
node test_phase_a_preferences.js
node test_prerequisite_correctness.js
node test_schedule_regression.js
node test_combo_matrix.js
for t in test_*.js; do node "$t"; done
git diff --check
```

**Expected:** no hard failures. Warning count may change if the warnings become stricter; if so, document before/after and classify new warnings.

---

### Task 8.3: Browser QA

**Objective:** Confirm fake-DOM tests match the real site.

**Steps:**

1. Serve actual Prototype 4:

```bash
cd "/home/artem/projects/ucsc-course-selection-automation/Prototype 4 Website - source code"
python3 -m http.server 4174
```

2. Verify browser loads cache-busted Prototype 4 scripts.
3. Manually/fake-browser test:
   - choose two GE interests;
   - choose two elective interests;
   - generate schedule for representative majors;
   - inspect quarter loads and audit explanations.

**Caution:** WSL Playwright Chromium dependencies may still require user-run sudo deps, so use browser console if full Playwright cannot launch.

---

## Acceptance criteria

We are done only when all are true:

1. The UI supports up to 2 GE interests and up to 2 elective/major interests.
2. Scheduler profile carries both interest arrays into engine and recommendation flows.
3. Default quarter scoring is credit-first: target 15-17, normally <=19.
4. A 4-course/17-credit quarter is allowed and tested.
5. Lower-division major/prereq courses and WRIT 1/2 are prioritized in years 1-2 when feasible.
6. GE/UC requirements are completed before generic electives/FREE padding.
7. Duplicate GE categories are avoided unless a course is major-required or satisfies another unmet requirement.
8. Interest matching affects GE/elective choices but never overrides hard requirements, prerequisites, offerings, or unit caps.
9. Final audit/repair stage runs inside `generateWithExplanation` and reports diagnostics.
10. Full Node test suite and relevant diagnostics pass.
11. Handoff docs are updated with the final behavior and remaining known warnings.

---

## Implementation order recommendation

Do **not** start by rewriting the whole scheduler. The safest order is:

1. Policy helpers + tests.
2. GE family duplicate prevention.
3. Profile/UI two-interest support.
4. Interest scoring arrays.
5. Credit-first placement replacement for `majorCount < 2`.
6. GE-before-elective placement.
7. Final audit/repair.
8. Data/tag audits.
9. Broad matrix/browser verification.

This keeps every behavior change testable and prevents a huge unreviewable rewrite.
