# Five-Year-Bug Investigation Report

## TL;DR

**Confirmed root cause**: `supplementUpperDiv()` in `engine.js` (line 402) counts existing upper-division units starting from 0 instead of from the courses already selected in Phases 1-4. This happens because `generate()` passes an empty `udAdded[]` array (line 225) as the counting source. The function then adds ~60 units of unnecessary UD courses to reach `minUpperDivUnits: 60`, even though `selected[]` already has 40-52 UD units. This was introduced by the placement rewrite which changed the first argument from `core[]` (all major courses) to empty `udAdded[]`. **Confidence: Confirmed** with two independent diagnostic dumps.

The fix is a 1-2 line change to make the UD count start from `used` or `selected` instead of the empty accumulator.

## Reproduction Summary

| Major | Concentration | Total Units | Expected | Excess | Years | Phase 5 UD Added | Actually Needed | Wasted |
|-------|---------------|-------------|----------|--------|-------|-------------------|-----------------|--------|
| CS_BA | AI/ML | 223 | ~180 | 43 | 5 | 60 units (12 courses) | 8 units | 52 units |
| AM_BS | Computational | 210 | ~180 | 30 | 5 | 60 units (13 courses) | 20 units | 40 units |

Full dumps: `scripts/output/cs_ba_ai_ml_dump.txt`, `scripts/output/am_bs_computational_dump.txt`

### Smoke test baseline (all 12 majors)

Every major spans 5-6 years. Units range 210-295. Zero 4-year schedules.

| Major | Min Units | Max Units | Years | Notes |
|-------|-----------|-----------|-------|-------|
| CS_BA | 221 | 227 | 5 | All pass |
| CS_BS | 253 | 264 | 6 | All pass |
| CE_BS | 276 | 276 | 6 | All pass |
| EE_BS | 290 | 295 | 6 | allMet=false (data quality) |
| CSGD_BS | 233 | 239 | 5 | All pass |
| AM_BS | 210 | 210 | 5 | allMet=false (empty pick_n pools) |
| BMEB_BI | 259 | 259 | 6 | All pass |
| BMEB_BM | 248 | 253 | 6 | All pass |
| BIOTECH_BS | 219 | 236 | 5 | All pass |
| NDT_BS | 230 | 256 | 5-6 | Some pass |
| RE_BS | 282 | 288 | 6 | allMet=false (data quality) |
| TIM_BS | 279 | 281 | 6 | All pass |

## Hypotheses

### H1 — Duplicate Placement
**Status: Ruled Out**

Evidence: Both dumps show "Duplicates: None found." The `placeWithCoreq()` helper (line 517) has a `!quarterArr.includes(labCode)` guard. The `pushTagged()` function (line 192) checks `!used.has(code)`. The `placed` Set in `placeIntoQuarters` prevents re-placement. Zero duplicates across all 98 smoke test scenarios.

### H2 — pick_one Not Detecting Completed Equivalents
**Status: Ruled Out**

Evidence: `walk()` line 267 — `if ((cat.courses || []).some(c => completedSet.has(c) || used.has(c))) break;` — correctly skips the entire category if ANY alternative is already selected or completed. CS_BA dump shows CAPSTONE was correctly skipped because CSE 110A (from BREADTH) was already in `used`. No duplicate pick_one selections in either dump.

### H3 — choose_group Adding All Groups
**Status: Ruled Out**

Evidence: `walk()` lines 257-263 — selects exactly one group via `const best = groups.find(...)`. CS_BA dump shows PROGRAMMING_SEQ selected only "CSE 13S + CSE 101", not both groups. AM_BS dump shows CALCULUS selected only "MATH 19A + MATH 19B".

### H4 — pick_n Over-picking
**Status: Ruled Out**

Evidence: `walk()` line 279 — `ranked.slice(0, needed)` strictly limits to `n` courses. CS_BA dump: BREADTH picked 3, ELECTIVE picked 3 (matching n=3 for both). No over-picking observed.

### H5 — expandPrereqs Cascade
**Status: Ruled Out**

Evidence: CS_BA added 1 prereq (CSE 130, 5 units). AM_BS added 1 prereq (AM 30, 5 units). The 6-pass loop (line 376) has an `if (!added) break` early exit. For both majors, expansion completed in 1 pass. Not a contributor to the 5-year problem.

### H6 — GE Auto-Satisfied Not Respected
**Status: Ruled Out**

Evidence: `pickGE()` lines 310-316 checks three conditions: `c.ge === ge.id`, subcategory match, and `autoSatisfiedBy`. CS_BA dump: GE picked only 8 courses (CC, ER, IM, SI, TA, PE, PR, C). MF was auto-satisfied by CSE 16/CSE 20, SR by CSE 40, DC by CSE 115A. This is correct — 3 auto-satisfied, 8 picked.

### H7 — completedCourses Not Respected
**Status: Ruled Out (fresh-freshman profile)**

Evidence: Both test profiles have `completedCourses: []`. The `used` set is initialized from `completedSet` at line 181 and passed through all phases. This hypothesis cannot cause the 5-year bug in the test scenario. For non-empty completed courses, the dedup path is correct (`!used.has(code)` in pushTagged, `!completedSet.has(c)` in walk).

### H8 — Concentration-Driven Over-Selection
**Status: Ruled Out**

Evidence: `rankByConcentration()` (lines 285-298) only affects sort ORDER within pick_n pools, never the count. `ranked.slice(0, needed)` at line 279 is the sole count limiter. Concentration adds a +100 score bonus, not extra courses.

### H9 — Filler Pool Over-Adding
**Status: Ruled Out as primary cause (minor contributor)**

Evidence: Phase D filler additions during placement:
- CS_BA: 1 filler (FREE 1, 5 units)
- AM_BS: 3 fillers (STAT 132, FILM 20A, FREE 1 — 15 units)

Phase D only triggers when `unitsUsed < minUnits` (12). Most quarters fill to 15-19 from selected[] courses. The filler pool contributes 5-15 units — not the 30-60 unit excess.

### H-UD — supplementUpperDiv Counts from 0 (THE PRIMARY BUG)
**Status: CONFIRMED**

Evidence chain:

1. `generate()` line 225: `const udAdded = [];` — empty array
2. `generate()` line 226: `this.supplementUpperDiv(udAdded, [], used, completedSet, reqs, majorId);`
3. `supplementUpperDiv()` line 402: `let curUD = target.reduce((s, c) => ..., 0);` — `target` IS `udAdded` (empty) → `curUD = 0`
4. Line 404: `if (curUD >= minUD) return;` — 0 < 60, so always proceeds
5. Lines 411-415: adds courses until `curUD >= 60` — always adds ~60 units

From dumps:
- CS_BA: 52 UD units already in selected[], supplementUpperDiv adds 60 more (should add 8) → **52 units wasted**
- AM_BS: 40 UD units already in selected[], supplementUpperDiv adds 60 more (should add 20) → **40 units wasted**

The bug was introduced by the placement rewrite. Previously, `core[]` (containing all major courses) was passed as the first argument, so the UD count was accurate. The rewrite changed this to an empty accumulator array, breaking the count.

### H10 — Cross-Listed Courses Counted Twice
**Status: Ruled Out**

Evidence: CS_BA dump shows AM 10 selected for LINEAR_ALGEBRA, MATH 21 not present. No cross-listed duplicates in either dump. The `used` Set prevents double-selection regardless of cross-listing.

### H11 — Validator Mismatch Causing Rescheduling
**Status: Ruled Out**

Evidence: The validator runs AFTER placement (`validateAll` is called on the final schedule). It does not feed back into the selector or placer. There is no re-scheduling loop. The validator's results match expectations: CS_BA allMet=true, AM_BS allMet=false (LD_ELECTIVES and UD_ELECTIVES empty — pre-existing data quality issue unrelated to the 5-year bug).

### H12 — Wrong Major Definition (P1 vs P2)
**Status: Ruled Out**

Evidence: `diff` between P1 and P2 `majors.js` shows 0 lines of difference. The files are identical.

### H13 — totalUnitsRequired Over-Padding
**Status: Ruled Out**

Evidence: All majors have `totalUnitsRequired: 180`. Phase 6 FREE padding (lines 230-237) calls `_countUnits(selected, completedSet, profile)`, which correctly sums all courses in `selected[]`. After the supplementUpperDiv bug inflates `selected[]` to 195-218 units, the total exceeds 180 and **zero FREE courses are added** in Phase 6 for both CS_BA and AM_BS. The over-padding comes from supplementUpperDiv, not from FREE logic.

## Recommended Fix Scope

### Fix 1: supplementUpperDiv UD counting (PRIMARY — mechanical, 1-2 lines)

**Risk: Low.** Change `supplementUpperDiv()` line 402 to count UD units from the `used` set (which contains all Phase 1-4 courses) instead of from the empty `target` array.

```javascript
// engine.js line 402 — BEFORE:
let curUD = target.reduce(
  (s, c) => s + (COURSES[c]?.division === "upper" ? COURSES[c].units : 0), 0);

// AFTER:
let curUD = [...used, ...completedSet].reduce(
  (s, c) => s + (COURSES[c]?.division === "upper" ? COURSES[c].units : 0), 0);
```

**Expected impact**: CS_BA drops from 223 to ~171 units (12 quarters, 4 years). AM_BS drops from 210 to ~170 units. All majors should fit in 4 years except possibly the heaviest (CE_BS, EE_BS) which have genuinely large requirement sets.

### Fix 2: Overflow year cap (SECONDARY — tightening, 1 line)

**Risk: Low.** Line 633: change `gradAcad + 2` to `gradAcad + 1`. Currently allows 6-year schedules silently. After Fix 1, overflow should be rare, but the cap should still be tighter.

### Fix 3: Empty-quarter FREE fill scope (COSMETIC — optional)

**Risk: Very low.** Lines 659-674 fill empty quarters in overflow years with FREE courses. After Fix 1, this is mostly moot. Could optionally limit to only filling quarters within the original graduation target, not overflow years.

## Open Questions for User

1. **AM_BS data quality**: `LD_ELECTIVES` (pick_n, n=2) and `UD_ELECTIVES` (pick_n, n=3) have **empty `courses` arrays** in `majors.js`. This is why AM_BS shows allMet=false. The engine correctly picks 0 courses from empty pools. Should these be populated from the AM curriculum chart PDF, or is this a known gap?

2. **supplementUpperDiv department preference**: After the fix, supplementUpperDiv may still add a few UD courses. Currently it prefers same-department courses (line 398 DEPT_MAP, lines 406-409). For AM_BS, this adds AM upper-div like AM 130, AM 107 — reasonable. But for CS_BA, it added CSE 101P which is an alternative to CSE 101 already in the plan (not a duplicate, but semantically redundant). Should the UD supplement skip courses from pools that the student has already drawn from (BREADTH, ELECTIVE)?

3. **Year 5 for heavy majors**: CE_BS has 276 units even with the bug-fix estimate of ~216 units after removing ~60 excess. That's still potentially 5 years. CE_BS may genuinely require more than 12 quarters at 19 max. Should the engine warn about majors that can't fit in 4 years, or is 5 years acceptable for engineering BS degrees?

4. **AM_BS: CSE courses as UD fillers**: The supplementUpperDiv adds CSE 101, CSE 101P, CSE 101M, CSE 102 for AM_BS. After the fix, it will add ~4 fewer courses, but the remaining ones may still be CSE courses (since AM upper-div in the COURSES database is limited). Is this acceptable, or should UD supplement prefer courses from the major's department only?
