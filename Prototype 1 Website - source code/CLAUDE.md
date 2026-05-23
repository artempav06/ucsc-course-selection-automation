# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

Pure static HTML/JS/CSS — no build step, no bundler, no package.json. JS files execute in order via `<script>` tags and share global scope.

**Run locally:** `python3 -m http.server 8000` from this directory, or open `index.html` directly.

**Run tests** (Node.js, from this directory):
```
node test_all_majors.js      # Smoke test all 12 majors: schedule gen, units, prereqs, duplicates
node test_edge_cases.js       # Year/quarter timing scenarios (CS_BA: sophomore, mid-year, gap, summer)
node test_integration.js      # Full flow: generate + validate, equivalences, course swaps, catalog integrity
node test_debug_schedule.js   # Debug: prints a full schedule (not pass/fail)
```

Tests load JS via `vm.runInThisContext` in this exact order: `courses.js → majors.js → data.js → engine.js`. This mirrors the browser load order and is required because there's no module system.

All tests pass: `test_all_majors.js` (242/242), `test_edge_cases.js` (40/40), `test_integration.js` (125/125).

## Architecture

Single-page app with three views: landing → 4-step wizard → schedule display.

### JS load order and globals (dependency chain)

```
js/courses.js   → COURSES object (~4300 entries, ~40K lines)
js/majors.js    → MAJOR_REQUIREMENTS registry (12 majors), CS_BA_REQUIREMENTS
js/data.js      → GE_REQUIREMENTS, UC_REQUIREMENTS, INTEREST_AREAS, GE_INTEREST_AREAS
js/engine.js    → Scheduler, Validator (depends on all three above)
js/app.js       → UI controller (depends on engine + DOM)
js/export.js    → PDF/Excel/Word export via CDN libs (jsPDF, SheetJS, docx)
```

### Schedule generation pipeline (engine.js)

`Scheduler.generate(profile)` is the entry point. The pipeline has two phases:

**Phase 1 — Course Selection** → returns `{ core[], fill[] }`:
- CS_BA: `selectCsBaSplit()` — hand-tuned, iterates `MAJOR_REQUIREMENTS.CS_BA.categories`
- All others: `selectGenericSplit()` — generic category walker
- Categories processed in priority order: `all_required`(0) → `choose_group`(1) → `pick_one`(2) → `pick_n`(3)
- GE courses picked via `pickGECoursesFromDB()` (matches `ge` field on course objects)
- UC courses picked via `pickUCCourses()` (ELWR, AH, AI)
- Missing prereqs auto-added by `expandWithPrereqs()` (multi-pass, up to 4 levels deep)

**Phase 2 — Quarter Placement** (`placeCoursesBalanced()`):
- Builds academic year skeleton from profile dates/level
- Topological sort both core and fill queues
- Per quarter: 4 phases (core → fill → overflow core → overflow fill)
- **Strict prereq rule:** uses `completedBefore` snapshot at quarter start — prereqs must be in a PRIOR quarter, not the same quarter
- Overflow: unplaced courses try prereq-aware placement first, then force-place as fallback; capped at 1 year past graduation

### Prerequisite format

Prerequisites are AND-of-OR-groups: `[["A","B"], ["C"]]` means (A or B) AND C. `Validator.prereqsMet(prereqs, completedSet)` checks this.

### Course equivalence handling

Equivalences are modeled through major requirement categories, not a separate mapping:
- `choose_group`: MATH 19-series vs 20-series — engine prefers group where student completed courses
- `pick_one`: AM 10 vs MATH 21 — engine skips if any alternative is completed or already in `used` set
- `all_required`: skips courses that appear in `choose_group` alternatives (handled by dedicated handler)
- WRIT 1E recognized as WRIT 1 equivalent (via `ge: "TA"` on course object + inclusion in GE TA and UC ELWR lists; WRIT 2 prereqs accept both)

### Validator

`Validator.validateAll(schedule, profile)` returns `{ major[], ge[], uc[], totalUnits, allMet }`. Each array contains per-requirement `{ id, name, fulfilled, ... }` objects. The `all_required` validator understands `pick_one` equivalences — if AM 10 is required but MATH 21 (its `pick_one` alternative) is in the plan, the requirement is marked fulfilled.

## Data model

**Course object** (in `COURSES`):
```js
{ title, units, division, prereqs, ge, quarters, desc, section, rmpScore }
```
- `ge`: GE category code ("TA", "MF", "C", etc.) or null
- `quarters`: ["F","W","S"] availability (auto-scraped courses default to all three)
- `section`: ["CS_LD_CORE", "MATH", "GE", "FREE", etc.] — used for UI color coding

**Major requirement category types:**
| Type | Meaning | `selectGenericSplit` behavior |
|------|---------|------------------------------|
| `all_required` | Every course mandatory | Adds all; skips completed and `choose_group` alternatives |
| `choose_group` | Pick one group | Prefers group with student's completed courses |
| `pick_one` | Pick one alternative | Skips entirely if any alternative completed or in `used` |
| `pick_n` | Pick N from pool | Subtracts completed count; picks top N by interest score |

## Supported majors

CS_BA (hand-tuned), CS_BS, CE_BS, EE_BS, CSGD_BS, AM_BS, BMEB_BI, BMEB_BM, BIOTECH_BS, NDT_BS, RE_BS, TIM_BS

CS_BA has its own selection path (`selectCsBaSplit`). The other 11 use `selectGenericSplit` with auto-scraped requirement definitions.

## Known issues

- ~84% of auto-scraped courses default to `["F","W","S","SU"]` quarter availability — real quarter data only from ~16% of courses (mostly humanities/social science depts). STEM departments publish no quarter data in the catalog.
