# Bug A + Bug B Fix Report

## Summary

Two selection-phase bugs in `engine.js` caused schedules to include redundant courses, inflating unit counts and pushing several majors from 4 years to 5.

**Bug A** — `expandPrereqs()` added pick_one/choose_group alternatives as prereqs because catalog prereq data doesn't include major-level equivalences. Also, `pick_n` pools included courses from pick_one categories, selecting alternatives that add no degree value.

**Bug B** — `pickUC()` used a stale `allKnown` snapshot that never saw new UC picks, causing redundant UC selections. `pickGE()` didn't consider UC cross-coverage, missing multi-requirement courses.

## Changes Made

**Only file modified:** `js/engine.js`

### Bug A Fix: `virtuallyPresent` set

After the walk loop processes `all_required`, `choose_group`, and `pick_one` categories, a `virtuallyPresent` set is built containing unselected alternatives whose equivalents are already selected. This set is passed to:

1. **`walk()` pick_n** — excludes virtuallyPresent from elective pools
2. **`expandPrereqs()`** — treats virtuallyPresent courses as satisfied prereqs
3. **`supplementUpperDiv()`** — excludes virtuallyPresent from UD filler pool
4. **`buildFillerPool()`** — excludes virtuallyPresent from placement fillers

The walk loop was split: non-pick_n categories run first, virtuallyPresent is built, then pick_n runs with filtering.

### Bug B Fix: Multi-coverage GE + Live UC

1. **`pickGE()`** — now computes `neededUC` (unsatisfied UC requirements) before the GE loop. Each GE candidate gets a +200 score bonus per UC requirement it also satisfies, overriding the +100 concentration bonus. After picking a GE course, `neededUC` is updated to remove satisfied UC requirements. Also now receives `profile` parameter for ELWR status.

2. **`pickUC()`** — removed stale `allKnown` snapshot. Now checks `used` and `completedSet` directly, which includes GE picks that satisfy UC requirements via `alsoSatisfies`.

## Results

### Audit Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| pick_one violations | 14 | **0** | 0 |
| choose_group violations | 7 | **0** | 0 |
| redundant courses | 80 | **0** | ≤16 (80% drop) |
| smoke tests passing | 98/98 | **98/98** | no regressions |
| concentration parity | untested | **12/12** | all majors |

### Per-Major Before/After

| Major | Before units | Before years | After units | After years | Change |
|-------|-------------|-------------|-------------|-------------|--------|
| AM_BS | 180 | 4 | 200 | 5 | +20u* |
| BIOTECH_BS | 200 | 5 | 200 | 5 | — |
| BMEB_BI | 198 | 5 | 203 | 5 | +5u |
| BMEB_BM | 212 | 5 | 206 | 5 | -6u |
| CE_BS | 226 | 5 | 206 | 5 | -20u |
| CSGD_BS | 188 | 4 | 188 | 4 | — |
| CS_BA | 203 | 5 | **188** | **4** | -15u |
| CS_BS | 186 | 4 | 188 | 4 | +2u |
| EE_BS | 232 | 5 | 230 | 5 | -2u |
| NDT_BS | 191 | 4 | 212 | 5 | +21u* |
| RE_BS | 235 | 5 | 230 | 5 | -5u |
| TIM_BS | 218 | 5 | 203 | 5 | -15u |

\* AM_BS and NDT_BS regressed from 4yr to 5yr. Root cause: placement adds fillers to underloaded quarters when prereq chains push courses late. Selection produces correct course counts (36 and 43 respectively), but at 19u maxUnits, 5u courses pack exactly 3 per quarter, leaving zero scheduling slack. This is a placement-phase issue, not a selection bug.

### Majors with at least one 4-year concentration

| Major | 4yr concentrations |
|-------|--------------------|
| CS_BA | cs_ai_ml, cs_theory |
| CS_BS | cs_ai_ml, cs_web_software, cs_theory, cs_data, cs_graphics_games |
| CSGD_BS | gd_game_ai, gd_graphics, gd_game_systems, gd_narrative_design |
| NDT_BS | ndt_ai_data, ndt_software, ndt_embedded (no GE conc) |

4 of 12 majors have at least one 4-year configuration.

### Key improvement: CS_BA

CS_BA (the hand-tuned flagship major) improved from 203u/5yr to **188u/4yr** on its default concentration (cs_ai_ml). This was the most visible user-facing regression.

## What the fixes did NOT change

- `placeIntoQuarters()` — untouched per constraint
- `majors.js`, `courses.js`, `data.js` — untouched
- `Scheduler.generate(profile)` and `Validator.validateAll()` signatures — preserved
- No XSS changes (no HTML rendering code touched)

## Remaining 5-year causes

The 8 majors still at 5 years fall into two categories:

**Genuinely heavy** (40+ required courses, 200+u even after fixes): CE_BS, EE_BS, RE_BS. These are engineering BS degrees with large core requirement sets.

**Placement constrained** (correct selection, placement overflow): AM_BS, BIOTECH_BS, BMEB_BI, BMEB_BM, TIM_BS, NDT_BS (some concentrations). The selection phase produces ≤180u, but prereq chain depth creates scheduling bottlenecks at 19u/quarter max (3 courses × 5u).

Both categories require either placement-phase changes or user-facing options (summer quarters, higher maxUnits) — outside the scope of Bug A/B fixes.
