# Phase C Schedule-Quality Warning Triage

Date: 2026-06-28

## Scope

This pass triaged the current `test_combo_matrix.js` schedule-quality warning buckets after Phase C UI work. It was intentionally mostly diagnostic: classify warning sources before attempting scheduler behavior changes.

Commands used:

```bash
node test_combo_matrix.js
node scripts/phase_c_warning_triage.js > scripts/output/phase_c_warning_triage.json
```

## Changes made during triage

1. Fixed the combo-matrix warning-window helper for Summer starts.
   - Old helper counted Summer 2027 → Spring 2030 as `3` year buckets because Spring sorts before Summer in the same calendar year comparison.
   - The engine schedule skeleton correctly treats Summer 2027 as part of academic year 2026-27, so the selected window spans four displayed academic-year buckets: 2026-27 SU, 2027-28, 2028-29, 2029-30.
   - `test_combo_matrix.js` now uses the same academic-year framing as `Scheduler.buildYearSkeleton(...)` and includes a self-check for this case.
2. Updated stale `scripts/phase10_warning_triage.js` helper:
   - Same academic-year warning-window helper.
   - Gap scenarios now set `gapEnabled: true`, matching the current matrix.
3. Added `scripts/phase_c_warning_triage.js`, a read-only current diagnostic that writes richer aggregate/root-cause clues.

Important: the warning count increased after the metric correction because freshman Fall → Spring graduation is now correctly treated as four academic-year buckets, not five. This is a stricter and more accurate warning signal, not a scheduler regression.

## Current warning baseline after metric correction

```text
Prototype 3 combo matrix checked 3531 student-choice scenarios
Hard failures: 0
Warnings: 2616
Warning buckets:
- schedule length exceeds selected window: 2034
- high total units: 1074
- major-course density exceeds target: 299
```

Detailed diagnostic output:

```text
scripts/output/phase_c_warning_triage.json
```

## Bucket classification

### 1. Schedule length exceeds selected window — 2034 occurrences

Top contributors:

```text
CS_BS: 248
CS_BA: 245
CE_BS: 200
EE_BS: 200
CSGD_BS: 189
TIM_BS: 180
NDT_BS: 162
AM_BS: 151
RE_BS: 141
```

By scenario dimension:

```text
freshman-winter: 605
freshman-fall: 570
sophomore-spring: 468
summer-start: 390

low-max-units: 986
standard: 676
summer-ok: 372

full-year-gap: 1143
winter-gap: 591
no-gap: 300
```

Overrun size:

```text
1 year over: 1429
2 years over: 526
3 years over: 79
```

Classification:

- Mixed real constraint + scheduler quality target.
- Full-year gaps and low max units are expected to create many legitimate overruns.
- The `no-gap` subset is the highest-value target for schedule-quality fixes because it is less explainable by user constraints.
- CS_BS/CS_BA dominate after the corrected window metric, so a CS no-gap representative should be the first focused regression target.

### 2. High total units — 1074 occurrences

Top contributors:

```text
CE_BS: 144
EE_BS: 144
TIM_BS: 144
CS_BS: 120
CS_BA: 108
RE_BS: 108
CSGD_BS: 90
NDT_BS: 90
BMEB_BI: 54
BMEB_BM: 54
AM_BS: 18
```

Input pattern:

```text
summer-start: 774
sophomore-spring: 300

prior=60 completedUnits=20: 360
prior=60 completedUnits=24: 270
prior=45 completedUnits=20: 156
prior=45 completedUnits=16: 72
prior=45 completedUnits=24: 72
prior=60 completedUnits=16: 72
prior=60 completedUnits=11: 54
prior=60 completedUnits=0: 18
```

Representative severe case:

```text
EE_BS/ee_power_energy/.../summer-start/.../full-year-gap
Total units: 255
Prior credits: 60
Completed-course units: 16
Scheduled units: 179
Phase units: major 147, GE 30, prereq 2, FREE padding 0
```

Classification:

- Mostly real/expected unit-accounting from dense BS requirements plus student profiles that combine high prior-credit counts with completed lower-division courses.
- Not caused by FREE-elective padding in the severe examples: `freePadding` is 0 and `freeUnits` is 0.
- This bucket is still useful, but the next fix is probably not “remove filler”; instead the project needs more realistic transfer profile semantics and/or UI copy that distinguishes prior credits not already represented by completed courses.

### 3. Major-course density exceeds target — 299 occurrences

Top contributors:

```text
TIM_BS: 170
BMEB_BI: 72
BMEB_BM: 57
```

Representative cases:

```text
TIM_BS/tim_entrepreneurship/.../freshman-fall/standard/no-gap
Max quarter: Year 4 Fall
Major courses: CSE 150, TIM 170, TIM 172B, TIM 172Q
Major units: 17
All units: 17

BMEB_BI/bi_computational/.../freshman-fall/standard/full-year-gap
Max quarter: Year 4 Spring
Major courses: CHEM 3BL, MATH 21, BME 110, BME 129C
Major units: 17
All units: 19 including CHEM 3CL lab
```

Classification:

- Mixed real schedule density + warning-policy roughness.
- TIM_BS and BMEB cases often show four major-type courses but 15-19 units, so “more than three major courses” is a useful caution but not always a clear bug.
- BMEB density often involves lab/coreq courses; the current metric already ignores lab courses with `units <= 2 && labCoreq`, but paired science/lab-heavy quarters can still be intense.
- Keep this bucket as a lower-priority quality target after no-gap schedule-length triage.

## Recommended next TDD target

Pick a representative `schedule length exceeds selected window` case from the `no-gap` subset, preferably CS_BS or CS_BA because they now dominate the corrected warning baseline and are important to Artem/users.

Suggested next process:

1. Use `scripts/phase_c_warning_triage.js` and/or a focused schedule dump to select one no-gap CS_BS/CS_BA overrun case.
2. Inspect whether the selected course set is inherently too large or whether placement/backfill caused avoidable overflow.
3. Add a focused RED regression for the exact scenario and expectation.
4. Fix only the isolated root cause.
5. Rerun focused test, combo matrix, smoke, and data/engine regressions.

Do **not** change the high-unit or density warning thresholds just to reduce counts. They are diagnostic signals; suppress only after a focused investigation proves the warning policy itself is wrong.
