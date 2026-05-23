# Scrape Log — 2026-05-08

## Summary

Full catalog refresh covering Group A (35 priority departments) and Group B
(26 additional departments, A-H alphabetically). Group C (~22 depts, I-Z)
deferred to a future pass.

## Scrape runs

6 parallel agents, each with `--rate-limit 2`:

| Agent | Departments | Courses |
|-------|-------------|---------|
| 1 | CSE, MATH, AM, STAT | 264 |
| 2 | PHYS, CHEM, ECE, BME, BIOL | 460 |
| 3 | CMPM, ECON, BIOC, ASTR, METX, TIM, WRIT, SOCY, FILM, FMST + others | 1,190 |
| 4 | Group B first third (A-C depts) | 1,289 |
| 5 | Group B second third (D-F depts) | 305 |
| 6 | Group B final third (G-H depts + extras) | 356 |
| **Total** | **64 departments** | **3,796 raw / 3,725 merged** |

71 courses were skipped during merge (hand-tuned entries above the
AUTO-GENERATED marker in courses.js).

## Field coverage

| Field | Count | % of total |
|-------|-------|------------|
| catalogUrl | 3,796 | 100% |
| prereqs (non-empty) | 1,380 | 36% |
| ge (primary) | 1,502 | 40% |
| Real quarters (not defaulted) | 512 | 13% |
| labCoreq | 202 | 5% |
| enrollmentRestrictions | 732 | 19% |
| repeatable | 703 | 19% |
| crossListed | 1 | <1% |

### Quarter data

Most departments do NOT include quarter availability on their catalog pages.
512 courses (~13%) have real quarter data — primarily from departments like
LIT that include `<div class="quarter">` on their pages. The remaining 87%
default to `["F","W","S"]` and are flagged with `_flags.quarters_defaulted: true`.

Future work: scrape `pisa.ucsc.edu` (UCSC class schedule API) for real
per-quarter offerings.

## Division breakdown

| Division | Count |
|----------|-------|
| Upper | 2,881 |
| Lower | 915 |

## Regression test results

| Test Suite | Before merge | After merge | Delta |
|------------|-------------|-------------|-------|
| test_all_majors | 242 pass / 0 fail | 243 pass / 9 fail | +1 / +9 |
| test_edge_cases | 40 pass / 0 fail | 40 pass / 0 fail | no change |
| test_integration | 125 pass / 0 fail | 125 pass / 0 fail | no change |

### New failures (9)

All caused by the same data issue: the scraper correctly identifies lab
corequisites (e.g., "concurrent enrollment in CSE 100L") and adds them to
both `labCoreq` and `prereqs`. The engine treats prereqs as "must complete
in a prior quarter," creating unsatisfiable circular dependencies.

Affected majors: BIOTECH_BS, BMEB_BI, BMEB_BM, CE_BS, EE_BS, RE_BS.

Root cause: data issue (corequisites encoded as hard prerequisites), not an
engine bug. Fix options:
1. Remove corequisites from `prereqs` arrays (manual or automated post-processing)
2. Add corequisite support to the engine (same-quarter scheduling)

## Known issues

- **Group C departments not scraped**: ~22 departments (I-Z) deferred. Run
  `survey_catalog.py` to see the full list.
- **crossListed extraction low**: The regex-based extraction from description
  text only found 1 match. The catalog's `div.cross-listed` element is
  page-level, not per-course, so structured extraction isn't straightforward.
- **geAll always empty**: No courses had multiple GE codes in this scrape.
  The multi-GE extraction may need tuning if the catalog format changed.
