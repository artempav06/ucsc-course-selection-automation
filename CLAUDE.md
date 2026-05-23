# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Client-side web app that generates complete 4-year academic schedules for UCSC students. Selects courses to fulfill major, GE, and UC requirements, then places them quarter-by-quarter respecting prerequisites, availability, and workload limits.

Pure static HTML/JS/CSS — no server, no build step, no bundler, no package.json.

## Running the app

Open `Prototype 1 Website - source code/index.html` in a browser, or:
```bash
cd "Prototype 1 Website - source code"
python3 -m http.server 8000
```

## Running tests

From `Prototype 1 Website - source code/`:
```bash
node test_all_majors.js       # Smoke test all 12 majors
node test_edge_cases.js       # Year/quarter timing scenarios
node test_integration.js      # Full flow: generate + validate, equivalences, swaps
node test_debug_schedule.js   # Debug: prints a full schedule (not pass/fail)
```

Tests load JS via `vm.runInThisContext` in this exact order: `courses.js → majors.js → data.js → engine.js`. This mirrors the browser `<script>` tag order and is required because there's no module system.

All tests pass: `test_all_majors.js` (242/242), `test_edge_cases.js` (40/40), `test_integration.js` (125/125).

## Scraper scripts

Python scripts in `scripts/` that populate course and major data. Dependencies: `beautifulsoup4`, `pdfplumber`.

```bash
# Courses: scrape UCSC catalog → merge into courses.js
python3 scripts/fetch_ucsc_courses.py
python3 scripts/merge_into_data_js.py

# Majors: download curriculum chart PDFs → parse → merge into majors.js
python3 scripts/fetch_ucsc_majors.py
python3 scripts/merge_majors_into_data_js.py

# AM_BS extraction test (compare against manually verified ground truth)
python3 scripts/test_am_bs_extraction.py
```

Mergers **never overwrite** hand-tuned entries (e.g. CS_BA courses). Use `--force` to override. Use `--dry-run` to preview.

`fetch_ucsc_majors.py` has two extraction modes: **spatial** (rectangle-based, using `pdfplumber` page rects) for verified majors (currently AM_BS), and **text fallback** (keyword-based) for the rest. Spatial extraction also scrapes elective web pages for `pick_n` course lists. Add verified majors to `SPATIAL_VERIFIED_MAJORS` in the script.

## Architecture

### JS globals and load order (dependency chain)

All JS files share global scope via `<script>` tags. Load order matters:

1. **`js/courses.js`** → `COURSES` object (~4300 entries from 79 departments). Each entry has: `title, units, division, prereqs, ge, quarters, desc, section, rmpScore`. Auto-scraped entries may also have: `labCoreq, enrollmentRestrictions, repeatable, maxUnits, catalogUrl`.
2. **`js/majors.js`** → `CS_BA_REQUIREMENTS` + `MAJOR_REQUIREMENTS` registry (12 majors).
3. **`js/data.js`** → `GE_REQUIREMENTS` (11 categories), `UC_REQUIREMENTS` (3), `INTEREST_AREAS`, `GE_INTEREST_AREAS`.
4. **`js/engine.js`** → `Scheduler` + `Validator`. The core logic — depends on all three data files above.
5. **`js/app.js`** → `AppState` + UI controller. Depends on engine + DOM.
6. **`js/export.js`** → PDF/Excel/Word export via CDN libs (jsPDF, SheetJS, docx).

### Schedule generation pipeline (engine.js)

`Scheduler.generate(profile)` is the entry point. Two phases:

**Phase 1 — Course Selection** → returns `{ core[], fill[] }`:
- CS_BA uses `selectCsBaSplit()` (hand-tuned). All other majors use `selectGenericSplit()`.
- Category priority: `all_required`(0) → `choose_group`(1) → `pick_one`(2) → `pick_n`(3).
- GE picked via `pickGECoursesFromDB()` (matches `ge` field). UC picked via `pickUCCourses()`.
- Missing prereqs auto-expanded by `expandWithPrereqs()` (multi-pass, up to 4 levels deep).

**Phase 2 — Quarter Placement** (`placeCoursesBalanced()`):
- Topological sort both queues by prereqs.
- Per quarter: 4 sub-phases — core → fill → overflow core → overflow fill.
- **Prereq rule:** `completedBefore` snapshot at quarter start — prereqs must be in a PRIOR quarter.
- Overflow: unplaced courses try prereq-aware placement, then force-place; capped at 1 year past graduation.

### Prerequisite format

AND-of-OR-groups: `[["A","B"], ["C"]]` means (A or B) AND C.

### Major requirement category types

| Type | Meaning | Engine behavior |
|------|---------|-----------------|
| `all_required` | Every course mandatory | Adds all; skips completed and `choose_group` alternatives |
| `choose_group` | Pick one group (e.g. calculus sequence) | Prefers group where student has completed courses |
| `pick_one` | Pick one alternative (e.g. AM 10 vs MATH 21) | Skips if any alternative already completed or selected |
| `pick_n` | Pick N from pool | Subtracts completed; picks top N by interest score |

### Validator

`Validator.validateAll(schedule, profile)` returns `{ major[], ge[], uc[], totalUnits, majorReqs, allMet }`. The `all_required` validator understands `pick_one` equivalences. The result includes `majorReqs` (the resolved major requirements object) — use `AppState.validation.majorReqs` instead of hardcoding `CS_BA_REQUIREMENTS`.

### UI flow (app.js)

Three views: landing → 4-step wizard (Academic Profile → Academic History → Graduation Preferences → Interests) → schedule display with sidebar requirement tracker.

`AppState` holds all UI state. Key profile fields: `major`, `currentLevel`, `completedCourses`, `targetGradYear`, `includeSummer`, `maxUnits` (default 15), `interests`, `gapEnabled`. Degree type (BA/BS) is derived from the major ID suffix — there is no separate `degreeType` field.

Unit load presets: 12 (minimum full-time), 15 (standard/default), 17 (heavy), 19 (heavier), 22 (max).

## Supported majors

CS_BA (hand-tuned), CS_BS, CE_BS, EE_BS, CSGD_BS, AM_BS, BMEB_BI, BMEB_BM, BIOTECH_BS, NDT_BS, RE_BS, TIM_BS.

CS_BA has its own selection path. The other 11 use `selectGenericSplit` with auto-scraped definitions.

## Security

`app.js` uses `innerHTML` for rendering course details, swap lists, and add-course lists. All course data (`title`, `desc`, `code`) must be escaped via `escHTML()` (defined at top of app.js) before interpolation. Course codes in inline `onclick` handlers must escape single quotes.

## Data conventions

- Auto-scraped courses in `courses.js` are below the `AUTO-GENERATED FROM UCSC CATALOG` marker — don't hand-edit below it.
- Auto-scraped courses default to `quarters: ["F","W","S","SU"]` (real availability unknown) and `section: ["FREE"]`.
- Hand-tuned courses (above the marker) have accurate `quarters`, `section`, and `prereqs`.
- `rmpScore: 0` means no RateMyProfessor data.
- `data.js` has a `deptSlugs` map for catalog URL generation — each department key must appear exactly once (JS silently overwrites duplicate object keys).

## Auto-scraped major data quality issues

The non-CS_BA majors in `majors.js` were auto-generated from PDF curriculum charts via Python scripts. AM_BS now uses spatial extraction (verified accurate). Known problems in other majors:

- **Missing categories** — CSGD_BS has only 5 categories, missing its CSE core and CMPM upper-div requirements.
- **Lower-div in upper-div lists** — NDT_BS UD_ELECTIVE includes `CSE 20`, `CSE 12`, `CSE 30`.
- **No `LD_CORE` for most majors** — `coursePriority()` is biased toward CS_BA section tags (`CS_LD_CORE`, `BREADTH_A`, etc.). Generic majors fall through to division-based ordering, which may not schedule foundational courses early enough.

Each major has a `pdfUrl` field linking to its source curriculum chart PDF for manual verification.

## Known limitations

- ~84% of auto-scraped courses default to all-quarter availability (`["F","W","S","SU"]`) — real quarter data only available from ~16% of courses (mostly humanities/social science departments). STEM departments (CSE, ECE, MATH, PHYS, AM, STAT, BME, CHEM) publish no quarter data in the catalog. Future enhancement: scrape pisa.ucsc.edu for real term offerings.
- Lab corequisites (e.g. CSE 100L for CSE 100) use the `labCoreq` field for same-quarter placement. The merger strips solo corequisite prereq groups to avoid circular dependencies. The engine's `placeCoReqLab` checks the corequisite's own prereqs before placing it in the same quarter.
- `expandWithPrereqs` caps at 4 passes — chains deeper than 4 levels are truncated (logged to console).
- All 87 catalog departments configured in scraper; 79 have undergraduate courses, 8 are grad-only/empty. See `scripts/scrape_plan.md`.
