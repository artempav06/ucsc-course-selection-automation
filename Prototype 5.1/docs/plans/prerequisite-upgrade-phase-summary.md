# Prototype 4 Prerequisite Upgrade Phase Summary

Generated/updated: 2026-07-01

## Scope

Prototype 4 is the safe working copy for the high-confidence prerequisite-correctness upgrade. Official source rule: use UCSC General Catalog course pages for prerequisite text; do not use unofficial advising pages as primary evidence.

## Phase 1 — RED CS_BA CSE 101 regression

Added `test_prerequisite_correctness.js` to lock the originally reported bug: CS_BA schedules must not place `CSE 101` before the official `CSE 13S`/`ECE 13` prerequisite group.

## Phase 2 — Validator prerequisite chronology contract

`Validator.validateAll(...)` now exposes:

- `prereqViolations`
- `prerequisitesMet`

`allMet` is false when chronological prerequisites are violated, so a schedule cannot look fully valid while silently violating prerequisite order.

## Phase 3 — CSE 101 official prerequisite correction

Official page checked: `https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-101/`

Official prerequisite text captured in the regression:

> CSE 12 or BME 160; CSE 13E or ECE 13 or CSE 13S; and CSE 16; and CSE 30; and MATH 11B or MATH 19B or MATH 20B or AM 11B or ECON 11B.

Prototype 4 local encoding uses only existing local course entries:

```js
[
  ["CSE 12", "BME 160"],
  ["ECE 13", "CSE 13S"],
  ["CSE 16"],
  ["CSE 30"],
  ["MATH 11B", "MATH 19B", "MATH 20B", "AM 11B"]
]
```

Official alternatives intentionally omitted because they are not local `COURSES` entries yet:

- `CSE 13E`
- `ECON 11B`

## Phase 4 — CS_BA official prerequisite audit

Report: `docs/plans/prerequisite-audit-cs-ba.md`

Current report summary:

- CS_BA referenced courses: 53
- Missing local course entries: 0
- Missing catalog URLs: 2
- Official pages fetched: 51
- Official prerequisite text found: 49

Important modeling decision discovered during audit:

- `MATH 19A` official text allows `MATH 3` OR mathematics placement OR qualifying AP exam.
- Prototype 4 has no placement/AP evidence field yet.
- Therefore `MATH 19A` must not hard-require `MATH 3` for every generated plan; doing so incorrectly delays standard freshman schedules.

## Phase 5 — All-supported-major audit tooling/report

Report: `docs/plans/prerequisite-audit-all-supported.md`

Current report summary:

- All-supported-major referenced courses: 382
- Missing local course entries: 0
- Missing catalog URLs: 27
- Official pages fetched: 355
- Official prerequisite text found: 299

This broader report is evidence-only and intentionally does not auto-edit course data.

## Phase 6 — Prerequisite audit test layer

`test_prerequisite_correctness.js` now covers:

1. CSE 101 official prerequisite groups.
2. CS_BA generated schedule places CSE 13S before CSE 101.
3. Validator exposes/uses chronological prerequisite violations.
4. MATH 19A does not force MATH 3 without placement/AP modeling.
5. Reverse lab-corequisite placement, e.g. ECE 103 + ECE 103L can share a quarter.
6. CSE 186 allows official prior-or-concurrent CSE 180/CSE 182 in the same quarter.
7. CSE 186 still fails validation when neither CSE 180 nor CSE 182 is prior-or-same-quarter.
8. Supported-major default schedules have zero prerequisite chronology violations.

## Scheduler fix made while verifying stricter prerequisites

Stricter official prerequisite data exposed a placement issue with reverse lab corequisites: a lab like `ECE 103L` declares `labCoreq: "ECE 103"`, but the lecture did not declare the lab. The scheduler now opportunistically places reverse-linked lab corequisites in the same quarter when they are already selected, available, and fit within max units. This kept RE_BS default plans within 4 years while preserving prerequisite chronology.

## Verification snapshot

Phase 7 final verification completed:

```text
for f in test_*.js; do node "$f"; done  # all test files passed
node test_prerequisite_correctness.js    # 8/8 passed
node test_schedule_regression.js         # representative regressions passed; aggregate 12/12 <=4-year default plans
node test_smoke.js                       # 98 passed, 0 failed
node tools/validate-data.js              # passed with existing warning buckets reported
```

Independent review verdict: approved / no blocking issues found. One non-blocking suggestion was accepted immediately by adding the explicit CSE 186 missing-concurrent-prerequisite regression test above.
