# Scrape Log — 2026-05-12

## Summary

Full catalog refresh: all 87 departments attempted, 79 returned undergraduate courses (8 are grad-only or empty). Scraper default quarters changed from `["F","W","S"]` to `["F","W","S","SU"]`.

## Counts

| Metric | Value |
|--------|-------|
| Departments configured | 87 (100% of catalog) |
| Departments with courses | 79 |
| Departments grad-only/empty | 8 (CLST, GAME, GIST, GRAD, HCI, MSE, NLP, SOCD) |
| Total courses scraped | 4,207 |
| courses.js total entries | 4,287 (151 hand-tuned + 4,136 auto-generated) |
| Lower division | 1,130 |
| Upper division | 3,077 |

## Field Coverage

| Field | Count | % |
|-------|-------|---|
| Prerequisites | 1,392 | 33% |
| GE codes | 1,616 | 38% |
| Real quarter data | 666 | 16% |
| Defaulted quarters (F/W/S/SU) | 3,541 | 84% |
| Lab corequisites | 205 | — |
| Enrollment restrictions | 790 | — |
| Repeatable | 862 | — |
| catalogUrl | 4,207 | 100% |

## Priority Course Gap

451 priority courses (from 12 majors + prereq chains). 383 found in scrape. 68 missing:

- **17 graduate** (skipped by design): ECE 215-249, BME 205/230A, CSE 222A/225/276, AM 231
- **2 phantom "EE" dept**: EE 101, EE 101L — UCSC uses ECE prefix
- **49 not in current catalog**: Mostly discontinued CSE courses (104A, 109, 115, etc.), old ECON numbering (referenced by TIM_BS), and a few others (AM 130, TIM 171-178). All covered by hand-tuned entries above the marker.

## Scrape Agents

| Agent | Departments | Courses | Real Quarters |
|-------|-------------|---------|---------------|
| 1 | CSE, MATH, STAT, AM, ECE | 286 | 0 |
| 2 | PHYS, CHEM, BIOL, BME, BIOC, BIOE, METX | 373 | 22 |
| 3 | ECON, CMPM, TIM, WRIT, PSYC, POLI, SOCY, PHIL, LIT | 1,014 | 158 |
| 4 | ANTH, ART, FILM, HAVC, HIS, CRES, ENVS, FMST, LALS, ESCI, MUSC, THEA | 1,494 | 122 |
| 5 | ANCS, APLX, ARBC, ARTG, ASTR, CHIN, CLNI, CLST, CMMU, COWL, CRSN, CRWN, CSP, CT, DANM | 361 | 124 |
| 6 | EART through YIDD (39 depts incl. all Group C) | 810 | 262 |

730 duplicates removed during combination (cross-listed courses appearing in multiple departments).

## Regression Tests

| Test Suite | Before | After |
|------------|--------|-------|
| test_all_majors.js | 242/242 | 242/242 |
| test_edge_cases.js | 40/40 | 40/40 |
| test_integration.js | 125/125 | 125/125 |

One test fix: relaxed unit validation to allow 0-credit PE courses (PHYE department, 30 courses).

## Changes Made

1. `scripts/fetch_ucsc_courses.py`: Added 25 Group C departments to SUBJECTS list (87 total). Changed default quarters from `["F","W","S"]` to `["F","W","S","SU"]`.
2. `Prototype 1 Website - source code/js/courses.js`: Regenerated auto-gen section (4,136 entries, up from ~3,716).
3. `Prototype 1 Website - source code/test_integration.js`: Relaxed unit check from `> 0` to `>= 0` for PE courses.

## Known Issues / Next Steps

- **Quarter data**: Only 16% of courses have real quarter availability from the catalog. STEM departments (CSE, ECE, MATH, PHYS, AM, STAT, BME, CHEM) publish none. Real data available from pisa.ucsc.edu (Class Search API) — future enhancement.
- **8 grad-only departments**: GAME, GIST, GRAD, HCI, MSE, NLP, SOCD have only graduate courses. CLST has no courses listed.
- **Cross-listed detection**: Only 1 cross-listing detected by regex. Many cross-listings use structural indicators the scraper doesn't capture.
