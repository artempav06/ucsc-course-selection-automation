# Data-warning triage — Phase 6

Updated: 2026-06-26

## Goal

Classify the remaining runtime data-validation warning buckets by whether they directly touch courses that appear in supported-major requirement categories. This is an investigation-only checkpoint before official-catalog fixes.

Source of truth for future fixes remains the official UCSC General Catalog course pages and Requirements and Planners pages. The counts below do **not** justify deleting prerequisites or adding placeholder courses without catalog verification.

## Current command

```bash
node tools/validate-data.js
```

Current output summary:

```text
Data validation warnings: 373
WARN_BUCKET unknownPrerequisiteReference: 213
WARN_BUCKET missingCatalogUrl: 160
WARN_IMPACT unknownPrerequisiteReference: directSupportedMajor=39 outsideSupportedMajor=174
WARN_IMPACT missingCatalogUrl: directSupportedMajor=92 outsideSupportedMajor=68
Data validation passed: 4296 courses, 12 majors, 11 GE requirements
```

## Classification method

`tools/data-validator.js` now exposes `summarizeWarningImpact(warnings, data)`. It builds a map of courses directly referenced by supported-major requirement categories and splits each warning bucket into:

- `directSupportedMajor`: the warning is on a course that appears directly in at least one supported major's requirement categories.
- `outsideSupportedMajor`: the warning is on a broader imported catalog course that is not directly listed in supported-major requirements.

Limitations:

- This first pass is direct-reference only. It does not yet trace prerequisite closure or elective/filler reachability.
- A direct-supported warning can still be legitimate if the official catalog currently lists an older/nonlocal prerequisite option.
- An outside-supported warning can still matter if the course is reachable as a filler, GE option, replacement, or prerequisite of a required course.

## Unknown prerequisite references

Current bucket:

```text
unknownPrerequisiteReference: total=213 directSupportedMajor=39 outsideSupportedMajor=174
```

Direct supported-major examples printed by the triage helper include:

```text
ECE 249 -> CSE 13E :: RE_BS
CSE 111 -> CSE 15 :: CE_BS,CS_BA,CS_BS,NDT_BS,TIM_BS
CSE 111 -> CSE 13E :: CE_BS,CS_BA,CS_BS,NDT_BS,TIM_BS
CSE 111 -> CSE 15L :: CE_BS,CS_BA,CS_BS,NDT_BS,TIM_BS
CSE 121 -> CSE 13E :: CE_BS,CS_BA,CS_BS,NDT_BS,TIM_BS
MATH 22 -> AM 15B :: TIM_BS
ECE 118 -> CSE 13E :: CE_BS,CSGD_BS,EE_BS,NDT_BS,RE_BS,TIM_BS
STAT 131 -> ECON 11B :: AM_BS,BIOTECH_BS,BMEB_BI,BMEB_BM,CE_BS,CS_BS,EE_BS,NDT_BS,RE_BS,TIM_BS
BME 140 -> EE 101 :: BIOTECH_BS,BMEB_BI,BMEB_BM
BME 160 -> BIOL 21A :: AM_BS,BIOTECH_BS,BMEB_BI,BMEB_BM
```

Interpretation:

- Many direct-supported examples look like historic course numbers or cross-major prerequisites that the local imported catalog does not contain (`CSE 13E`, `CSE 15`, `CSE 15L`, `AM 15A/B`, `ECON 11A/B`, etc.).
- Because some of these strings still appear in current official catalog prerequisite prose, the next safe step is not blanket removal. Instead, verify representative clusters against official course pages and decide whether to add catalog-backed placeholder/equivalency records, remove stale alternatives, or model legacy prerequisites differently.

## Missing catalog URLs

Current bucket:

```text
missingCatalogUrl: total=160 directSupportedMajor=92 outsideSupportedMajor=68
```

Direct supported-major examples include foundational courses used by many supported majors:

```text
CSE 12, CSE 16, CSE 20, CSE 30, CSE 40,
MATH 19A, MATH 19B, MATH 20A, MATH 20B, AM 10,
MATH 21, CSE 101, CSE 101P, CSE 101M, CSE 102,
CSE 103, CSE 112, CSE 114A, CSE 118, CSE 120,
CSE 140, CSE 142, CSE 143, CSE 144, CSE 150
```

Interpretation:

- URL cleanup is likely safer than prerequisite cleanup because it does not affect scheduling behavior.
- Still, add URLs only when the current official catalog page exists and matches the local course code.
- A useful next isolated TDD target is a small direct-supported URL cluster such as foundational CSE lower-division courses, with a runtime regression that those selected course codes no longer appear in the missingCatalogUrl direct-supported impact list.

## Next safe steps

1. Add a focused regression for one small, official-catalog-backed cluster.
2. Prefer missing-catalog-url cleanup before prerequisite semantics because URL fixes are behavior-neutral.
3. For unknown prerequisites, start with one high-impact cluster (for example CSE lower/upper legacy prereq alternatives) and verify each touched course page first.
4. Keep scheduler warning triage separate from data-warning cleanup unless a failing focused test ties a data warning to schedule behavior.
