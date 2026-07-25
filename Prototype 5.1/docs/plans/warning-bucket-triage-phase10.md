# Phase 10 Warning-Bucket Triage Report

**Goal:** Use Prototype 4's new `Scheduler.generateWithExplanation(...)` seam to classify the current combo-matrix warning buckets before changing scheduler behavior.

**Status:** Investigation complete. Follow-up Phase 11/12 behavior fix committed after this report: final placement-phase FREE padding now counts prior credits and completed-course units before adding extra FREE courses.

**Post-fix combo-matrix baseline:**

```text
Prototype 4 combo matrix checked 3531 student-choice scenarios
Hard failures: 0
Warnings: 1823

Warning buckets:
- schedule length exceeds selected window: 1546
- high total units: 1080
- major-course density exceeds target: 178
```

**Original baseline command:**

```bash
node test_combo_matrix.js
```

**Baseline result:**

```text
Prototype 4 combo matrix checked 3531 student-choice scenarios
Hard failures: 0
Warnings: 2510

Warning buckets:
- schedule length exceeds selected window: 2149
- high total units: 1764
- major-course density exceeds target: 178
```

## Tooling added

Added read-only diagnostic helper:

```bash
node scripts/phase10_warning_triage.js > scripts/output/phase10_warning_triage.json
```

The helper reproduces the combo-matrix profile set and records, for representative warnings:

- warning buckets
- expected vs generated schedule length
- validation units and prior credits
- selected units before placement
- phase-by-phase selected units/counts
- scheduled units/counts by course type
- max major-course quarter detail

The generated JSON and representative schedule dumps live under `scripts/output/` and are intentionally ignored/generated artifacts.

## Aggregate findings

### Bucket distribution by major

Top warning contributors from `scripts/output/phase10_warning_triage.json`:

```text
schedule length exceeds selected window :: CS_BA   264
schedule length exceeds selected window :: CS_BS   259
schedule length exceeds selected window :: CSGD_BS 222
high total units :: CS_BA                          216
high total units :: CS_BS                          216
schedule length exceeds selected window :: CE_BS   192
schedule length exceeds selected window :: TIM_BS  186
high total units :: CSGD_BS                        180
schedule length exceeds selected window :: EE_BS   180
schedule length exceeds selected window :: NDT_BS  174
schedule length exceeds selected window :: AM_BS   168
major-course density exceeds target :: TIM_BS      160
high total units :: AM_BS                          144
```

### Bucket distribution by start profile

```text
high total units :: sophomore-spring      882
high total units :: summer-start          882
schedule length :: summer-start           882
schedule length :: sophomore-spring       588
schedule length :: freshman-winter        570
schedule length :: freshman-fall          108
major density :: freshman-fall             48
major density :: freshman-winter           48
major density :: sophomore-spring          48
major density :: summer-start              33
```

The strongest signal is that **high-unit warnings are dominated by profiles with `priorCredits > 0`**:

- freshman-winter: `priorCredits = 15`
- sophomore-spring: `priorCredits = 45`
- summer-start: `priorCredits = 60`

## Representative repros

### Repro A — AM_BS freshman-winter length warning

Profile:

```text
AM_BS/***/none/freshman-winter/standard/no-gap
currentTerm=W currentYear=2027 target=S2030 maxUnits=19 priorCredits=15
```

Result:

```text
warnings: schedule length 5>window 4
years: 5 / expected 4
validation total units: 195
prior credits: 15
selected units before placement: 180
allMet: true
```

Phase units:

```text
major selection: 95
GE selection: 35
UC selection: 0
prerequisite expansion: 5
upper-division supplement: 10
FREE padding: 20
```

Observed schedule issue:

```text
Year 5 F: FREE 5, FREE 6, FREE 7
```

Root-cause classification:

```text
Avoidable unit-padding / final-padding bug.
```

Why:

The profile has 15 prior credits, so the scheduler should only need about 165 scheduled units to reach the 180-unit degree floor. Instead, final placement padding is filling the placed schedule up to 180 scheduled units and then validation adds prior credits on top, yielding 195 total units and a fifth-year FREE-only overflow.

Relevant code area:

```text
js/engine.js final unit padding around lines 1058-1089
```

Current final-padding logic computes only scheduled units:

```js
let totalUnits = schedule.reduce(...)
...
if (totalUnits >= 180) break;
```

It does not include:

- `profile.priorCredits`
- completed-course units
- `reqs.totalUnitsRequired` for non-180 catalog variants

Expected future behavior:

Final FREE padding should use the same degree-progress accounting as validation / `_countUnits(...)`: scheduled units + completed course units + prior credits, against the major's total-unit requirement.

Recommended regression test:

```text
AM_BS freshman-winter with 15 prior credits should not create a fifth year containing only FREE padding when all requirements and total units are already met within the selected window.
```

---

### Repro B — AM_BS sophomore-spring high-unit + length warning

Profile:

```text
AM_BS/***/none/sophomore-spring/standard/no-gap
currentTerm=S currentYear=2027 target=S2030 maxUnits=19 priorCredits=45
```

Result:

```text
warnings: schedule length 5>window 4, high total units 225
validation total units: 225
prior credits: 45
selected units before placement: 190
allMet: true
```

Phase units:

```text
major selection: 95
GE selection: 35
UC selection: 0
prerequisite expansion: 5
upper-division supplement: 10
FREE padding: 0
```

Observed schedule issue:

```text
Year 5 S: ECON 2, ECE 145, FREE 1
Year 6 F: FREE 2, FREE 3, FREE 4
Year 6 W: FREE 5, FREE 6, FREE 7
```

Root-cause classification:

```text
Same final-padding bug, amplified by higher prior credits and late start.
```

Why:

The actual selected real courses are about 145 scheduled units before final FREE padding. With 45 prior credits, the student already reaches about 190 total units. Final padding still pads scheduled units toward 180, adding unnecessary FREE placeholders and extra years.

Recommended regression test:

```text
AM_BS sophomore-spring with 45 prior credits should not add any FREE courses after validation total units already exceed the major's total-unit requirement.
```

---

### Repro C — AM_BS summer-start high-unit + length warning

Profile:

```text
AM_BS/***/none/summer-start/standard/no-gap
currentTerm=SU currentYear=2027 target=S2030 includeSummer=true maxUnits=19 priorCredits=60
```

Result:

```text
warnings: schedule length 4>window 3, high total units 240
validation total units: 240
prior credits: 60
allMet: true
```

Observed schedule issue:

```text
Year 5 F: AM 130, MUSC 11, FREE 1
Year 5 W: FREE 2, FREE 3, FREE 4
Year 5 S: FREE 5, FREE 6, FREE 7
```

Root-cause classification:

```text
Final-padding bug plus a legitimate late-start compression problem.
```

Why:

The profile starts in Summer 2027 but targets Spring 2030, so the selected planning window is only about three academic years. Some length pressure may be legitimate, but the FREE-only fifth-year quarters are not legitimate. The first fix should remove avoidable FREE padding before judging whether any remaining length warning is real.

Recommended regression test:

```text
Summer-start profiles with large priorCredits must not extend the schedule solely with FREE courses.
```

---

### Repro D — BMEB_BI major-course density warning

Profile:

```text
BMEB_BI/bi_computational/none/sophomore-spring/low-max-units/no-gap
currentTerm=S currentYear=2027 target=S2030 maxUnits=15 priorCredits=45
completedCourses=CSE 16, BIOL 20A, CHEM 8A, BME 80G
```

Result:

```text
warnings: schedule length 5>window 4, max major quarter 4>3, high total units 247
validation total units: 247
selected units before placement: 207
allMet: true
```

Density quarter:

```text
Year 4 S: 15 units
- BME 230A  5u major_core
- CHEM 3BL  2u major_core
- CHEM 3C   3u major_core
- BME 163   5u major_core
```

Root-cause classification:

```text
Mixed: final-padding high-unit bug + density metric/data/placement issue.
```

Important observations:

1. The high-unit / extra-year portion again includes unnecessary final FREE padding after prior credits are already counted.
2. The density warning is not just FREE padding. It occurs in a real required-course quarter.
3. The quarter contains a 3-unit chemistry lecture and 2-unit chemistry lab. The current density metric counts this as two separate major courses, even though this may be less workload than four 5-unit technical classes.
4. Chemistry metadata looks suspicious and should be audited before changing placement policy:
   - `CHEM 3B` has `labCoreq: 'CHEM 3B'`.
   - `CHEM 3C` has `labCoreq: 'CHEM 3C'`.
   - `CHEM 3BL` has no `labCoreq`.
   - `CHEM 3CL` has `labCoreq: 'CHEM 3C'`.

Recommended regression tests:

```text
1. Final padding should not add FREE courses when priorCredits already satisfy the total-unit floor.
2. Major-density warning should count lab/lecture pairs by workload-aware policy, not raw course-card count only.
3. Chemistry lab/coreq metadata should be audited with official catalog references before relying on it for density decisions.
```

Do **not** fix density before fixing final padding; high-unit/overflow noise makes density analysis harder.

## Test-harness finding: gap scenarios are not currently real gaps

`test_combo_matrix.js` creates gap profiles with:

```js
{ gapType: 'quarter', gapTerm: 'W', gapYear: 2028, label: 'winter-gap' }
{ gapType: 'year', gapTerm: 'F', gapYear: 2028, label: 'full-year-gap' }
```

But `Scheduler.placeIntoQuarters(...)` only activates gaps when:

```js
profile.gapEnabled && profile.gapTerm && profile.gapYear
```

So the combo matrix's `winter-gap` and `full-year-gap` labels are currently **not actually enabling gaps**. Existing edge tests do use `gapEnabled: true`, so the engine behavior itself is covered separately.

Root-cause classification:

```text
Combo-matrix scenario-construction bug, not scheduler placement behavior.
```

Recommended regression/tooling test:

```text
test_combo_matrix.js gap scenarios should set gapEnabled: true so warning statistics represent actual gap profiles.
```

Fix this after the final-padding regression, because enabling real gaps will probably change warning counts.

## Phase 10 root-cause map

### Bucket: high total units

Primary root cause:

```text
Final unit padding ignores priorCredits/completed-course units and pads scheduled courses to 180 by itself.
```

Evidence:

- High-unit warnings are dominated by sophomore/summer profiles with 45/60 prior credits.
- Representative AM_BS schedules have all requirements met but still append FREE-only quarters.
- Validation adds prior credits, but final padding uses scheduled units only.

First fix target:

```text
js/engine.js final unit padding block around lines 1058-1089.
```

Expected impact:

- Large reduction in high total units.
- Large reduction in schedule-length warnings caused by FREE-only overflow years.

### Bucket: schedule length exceeds selected window

Mixed root causes:

1. Avoidable FREE-only overflow from final padding.
2. Legitimate late-start / low-max-units / dense-major compression.
3. Potential placement limitations after padding is fixed.
4. Combo-matrix gap labels not currently applying real gaps.

First fix target:

```text
Remove avoidable FREE-only overflow first, then recompute bucket counts.
```

Expected impact:

Many AM_BS/CS/CSGD/etc. late-start length warnings should drop if their extra years are padding-only. Remaining length warnings should be re-triaged as placement or infeasible-profile cases.

### Bucket: major-course density exceeds target

Mixed root causes:

1. Some real dense-major quarters.
2. Raw course-count metric over-penalizes low-unit labs/discussions.
3. Some lab/coreq metadata may be wrong or incomplete.
4. TIM_BS dominates the bucket and needs a separate representative inspection after padding is fixed.

First fix target:

```text
Not first. Re-run density after final-padding fix, then inspect TIM_BS representative cases and chemistry lab metadata.
```

## Recommended Phase 11 test plan

Add focused regression tests before behavior changes:

1. **No final FREE padding beyond degree floor with prior credits**
   - AM_BS freshman-winter, priorCredits=15.
   - Assert no extra year consisting only of FREE courses.
   - Assert validation total units is not inflated by final padding.

2. **No final FREE padding when prior credits already satisfy unit floor**
   - AM_BS sophomore-spring, priorCredits=45.
   - Assert generated schedule does not add FREE courses merely to bring scheduled-only units to 180.

3. **Combo matrix gap profiles actually enable gaps**
   - Assert a generated `winter-gap` matrix profile contains `_GAP`.
   - Watch it fail first because `gapEnabled` is missing.

4. **Density triage fixture after padding fix**
   - BMEB_BI computational low-max profile remains useful, but don't force it green until lab/coreq policy is decided.
   - Use it as an inspection fixture, not a hard behavior test yet.

## Recommended Phase 12 first implementation target

Start with the smallest safe behavior fix:

```text
Final unit padding must use degree-progress accounting:
placed scheduled units + completed course units + profile.priorCredits >= major totalUnitsRequired.
```

Do this with strict TDD:

1. Write failing test for AM_BS prior-credit FREE-only overflow.
2. Verify RED.
3. Change only final unit-padding accounting.
4. Verify GREEN with focused tests.
5. Run adjacent schedule regression and full suite.
6. Compare warning buckets before/after.

Do **not** simultaneously rewrite placement, density scoring, or catalog data.
