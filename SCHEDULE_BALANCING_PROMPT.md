# Prompt for Claude Code — Fix Quarter Unit Balancing in Prototype 2

> Copy everything below the line into Claude Code as a single message.

---

<role>
You are a senior engineer tuning the schedule-placement logic in `Prototype 2 Website - source code/js/engine.js`. The tree-based selection engine and the course database are both working well — the remaining problem is **how courses are packed into quarters**. Read `CLAUDE.md` at the repo root and the current `engine.js` before changing anything.
</role>

<context>
**What works**: The new tree engine in `Prototype 2 Website - source code/js/engine.js` correctly picks courses for every major × concentration combination, and the refreshed course database has accurate units, quarters, prereqs, and `labCoreq` data.

**What's broken**: `Scheduler.placeIntoQuarters()` (engine.js, ~lines 408–552, ~145 lines) is **greedy with a cap but no floor**. It fills each quarter until `unitsLeft <= 0` and moves on. Concretely:

- It reads `profile.maxUnits` (default `15` in `app.js` line 27) as a hard cap.
- There is **no `minUnits` concept**.
- It places courses in topological order — no opinion about mixing "major" vs. "GE" vs. "elective" courses inside a single quarter.
- When a course doesn't fit, it overflows to later quarters and **extends the schedule past 4 years**.

**Symptoms the user is seeing**:
- Some quarters contain only 1 or 2 courses totaling 12–14 units (under-loaded).
- The schedule frequently exceeds 4 academic years because under-loaded early quarters push everything back.
- Some quarters are heavy on major courses (3+ technical classes), which is more workload than the student wants.

**Course-database facts that matter** (from the recent audit):
- ~95–100 courses at **5 units** (the majority — most GEs, most upper-div majors).
- ~10 courses at **7 units** (heavy CS cores: `CSE 12`, `CSE 30`, `CSE 120`, `CSE 130`, `CSE 150`, etc.).
- ~12 named courses at **2 units** plus 9 `FREE 2U*` filler slots.
- Almost no 3-unit GE options — most GEs are 5 units.

**Realistic unit combinations per quarter the user wants the engine to aim for**:
- 3 × 5 = 15 (standard)
- 2 × 7 + 1 × 5 = 19 (heavy but allowed)
- 2 × 5 + 1 × 7 = 17 (common)
- 1 × 7 + 1 × 5 + 1 × 2–3 = 14–15 (when a small "fun" elective fills the gap)
- 4 × 5 = 20 (allowed only when no 7-unit course is in the quarter)

**Soft vs. hard limits — read this carefully, the prompt depends on this distinction:**

| Constraint | Target (preferred) | Acceptable (allowed if target impossible) | Hard limit (never cross without explicit user override) |
|---|---|---|---|
| Units per quarter | **15–19** | 12–14 or 20–22 | < 12 or > 22 |
| Major-typed courses per quarter | **≤ 2** | 3 | 4+ |
| Total quarters to graduation | **≤ 12** (4 years × F/W/S) | 13 quarters | > 13 |

The engine should treat **15–19 units / ≤2 major-typed / ≤12 quarters as the goal** and only fall into the "acceptable" tier when the goal is provably impossible for that specific quarter (e.g. senior year, only 14 units of required courses remain and no filler fits the available terms; or a major-heavy term where 3 required courses all gate downstream prereqs). When the engine uses the acceptable tier, it must record why in `schedule.notes` so the user can see "Quarter X has 3 major courses because senior capstone, advanced systems, and DC all pin to this term." The hard limits are walls — the engine should never produce a schedule that breaches them unless the user has explicitly raised `profile.maxUnits` to 22 (which the UI already supports).
</context>

<goal>
Rewrite `placeIntoQuarters()` so it produces **compact, balanced 4-year schedules** that feel like good Tetris play: every quarter sits in a target unit range, courses are mixed by type so the workload is reasonable, and the schedule fits in **12 academic quarters (4 years, Fall/Winter/Spring × 4)** for any major × concentration combination of a freshman starting fresh.

The mental model is a constraint solver with **tiered preferences**, not a greedy filler:
- **First try the target tier**: 15–19 units per quarter, ≤ 2 major-typed courses per quarter.
- **Only fall back to the acceptable tier** (12–14 or 20–22 units, or 3 major-typed) when no arrangement satisfies the target — and log the reason in `schedule.notes`.
- **Never cross hard limits** (< 12, > 22, or 4+ major-typed) unless the user has explicitly opted in via `profile.maxUnits`.
- **Variety preference**: when room remains and major load is already at 2, prefer GE or low-unit electives over a 3rd major course.
- **Late-year filler**: in junior/senior quarters where all GE/UC requirements are already met, if the quarter is under 15 units, add a 2–5 unit "fun" elective (low-unit non-major course) rather than leaving the quarter light.
</goal>

<deliverables>
Track these phases with `TodoWrite`. Execute Phase 1 first, then pause for my approval on the design before writing code.

### Phase 1 — Design doc (no code yet)
Write `Prototype 2 Website - source code/PLACEMENT_DESIGN.md` describing the new placement algorithm in plain language. Cover:
1. The data structure each placed course carries (must include a `courseType` field: `"major_core" | "major_elective" | "ge" | "uc" | "filler"` — derived from why the course was selected, not from any one source of truth, so this requires threading the info through from `selectCourses()`).
2. The placement loop pseudocode — explicit about the order it considers courses, the target range check, the backtrack/swap behavior when a quarter is light, and the major-course cap per quarter.
3. The "filler pool" — how the engine identifies 2–5 unit courses suitable for filling gaps (e.g. low-unit courses in the catalog not already used, not already required, not prerequisites for unscheduled courses). Define the filtering rule precisely.
4. Edge cases: what to do if a 7-unit course only fits in one specific quarter, what to do if the schedule cannot finish in 12 quarters, what to do when the student is part-time (`maxUnits = 12`).

**Stop here and show me `PLACEMENT_DESIGN.md` before writing code.**

### Phase 2 — Tag selected courses with `courseType`
In `selectCourses()` (or wherever the tree walk emits the selected list), attach a `courseType` to each picked course as it's added. The category type in `majors.js` plus the GE/UC selection paths give you everything you need — don't re-derive it later.

The placed schedule should then expose this on each course so the validator and the UI can color-code by type.

### Phase 3 — Build the filler pool
Add a helper `buildFillerPool(profile, selected)` in `engine.js` that returns a ranked list of "fun" courses to use as gap-fillers. Rules:
- Units between 1 and 5 inclusive.
- Not already in `selected`.
- Not a prerequisite for anything currently in `selected` (so we don't accidentally double-place).
- Prefer courses with `rmpScore > 3.5` when available, then prefer those tagged with the student's GE concentration, then any course satisfying any GE code (in case GE is somehow under-met).
- **Exclude** graduate-level courses and courses with `enrollmentRestrictions` that exclude undergrads.

### Phase 4 — Rewrite `placeIntoQuarters()`
Replace lines ~408–552 of `engine.js`. Keep the same public signature (`placeIntoQuarters(selected, profile) -> schedule`). The new function should:

1. Topologically sort the `selected` queue by prerequisites (port the existing sort — it works).
2. For each quarter in order (`F Y1 → W Y1 → S Y1 → F Y2 → …` skipping summer unless `profile.includeSummer`):
   a. Compute a snapshot of completed courses (everything placed in strictly-earlier quarters).
   b. Collect candidates: courses whose prereqs are satisfied by the snapshot AND whose `quarters` array includes this quarter's term.
   c. Greedily pick courses using **two-tier preference**:
      - **Tier 1 (target)**: prefer fits that keep quarter units in `[15, 19]` AND keep major-typed count ≤ 2. Use these whenever possible.
      - **Tier 2 (acceptable)**: if no Tier 1 fit exists for a needed course, allow `[12, 14]` or `[20, 22]` units, or up to 3 major-typed courses. When this happens, push a short string into `quarter.notes` explaining why (e.g. `"3 major courses: CSE 130 / CSE 150 / CSE 115A all gate senior capstone"`).
      - **Hard wall**: never let a quarter exceed `profile.maxUnits` (default 19, hard ceiling 22 if user opts in) and never go below `profile.minUnits` (default 12).
      - Lab co-requisites (`labCoreq`) get placed in the same quarter as their parent — this can push a quarter slightly past target and that's fine, it's a Tier 2 acceptable case.
   d. After the greedy pass, **check the target floor**: if quarter units < 15, pull from the filler pool to top up toward the target — but only fillers whose prereqs are satisfied and whose `quarters` include this term.
   e. If after fillers the quarter is still under 15 but ≥ 12, that's acceptable — log a note. If it's still under 12, log a warning (this should be rare; usually only happens in a final near-graduation quarter).
3. After the main loop, if any `selected` courses remain unplaced, **try one rebalancing pass** before extending past 4 years:
   - For each unplaced course, find a placed quarter where it would fit if a same-type course were swapped out to an earlier or later quarter. Do up to 1 swap per unplaced course.
4. Only after the rebalancing pass, extend the schedule into a 5th year (cap at 1 extra year, matches the existing CLAUDE.md rule).

**Hard constraints on the code**:
- The function should fit in **under 200 lines**. The current 145-line version is fine size-wise; don't balloon it.
- No CS-specific branches.
- Pure functions — `placeIntoQuarters` doesn't mutate `profile` or the global course/major data.

### Phase 5 — Update the smoke test to verify balance
Extend `Prototype 2 Website - source code/test_smoke.js` to check both target and acceptable tiers separately:

**Target tier checks** (the engine should hit these for most quarters):
- `targetBalanceScore` = % of placed quarters with units in `[15, 19]` AND major-typed count ≤ 2. Goal: ≥ 80%.
- `quartersUsed` ≤ 12.

**Acceptable tier checks** (these are PASS/FAIL — failing means the engine produced something we shouldn't ship):
- Every quarter has units in `[12, 22]`.
- No quarter has 4+ major-typed courses.
- `quartersUsed` ≤ 13.
- Every Tier-2 quarter has a non-empty `quarter.notes` explaining why (so we can audit whether the fallback was justified).

**Universal checks**:
- Every placed course's prereqs sit in a strictly-earlier quarter.
- Total units ≥ the major's `totalUnitsRequired`.
- All major / GE / UC requirements met per the validator.

Print failing quarters with their unit counts and major-typed counts when any check fails.

Then **test multiple schedules per major**:
For each of the 10 majors, generate **at least 3 distinct schedules** by varying the concentration. For CS_BA specifically, test all 5 concentrations. Print a results table:

```
major     concentration   allMet  totalUnits  qtrsUsed  target%  acceptable%  notes
CS_BA     ai_ml           ✓       182         12        92%      100%         -
CS_BA     systems         ✓       180         12        83%      100%         1 tier-2 quarter (Y4Q3)
...
```

`target%` = percent of quarters in `[15, 19]` units AND ≤ 2 major-typed (the goal).
`acceptable%` = percent of quarters in `[12, 22]` units AND ≤ 3 major-typed (the hard floor for a passing schedule). This should be **100%** for every row.

### Phase 6 — UI: expose unit-load preference and show per-quarter units
In `Prototype 2 Website - source code/js/app.js` and `index.html`:
1. Default `profile.maxUnits` is currently `15` (app.js line ~27). Change the default to `19` — that's the top of the target range. The engine treats this as a ceiling the user is comfortable with, not a goal.
2. Introduce `profile.minUnits` (default `12`) — represents the absolute floor. Surface it in the wizard alongside `maxUnits` as a part-time/full-time toggle (don't make it a complex slider — full-time = 12 floor, part-time = 8 floor would be a future addition).
3. The graduation-preferences wizard step has a unit-load picker (existing options: 12 / 15 / 17 / 19 / 22). Re-label them: 12 = "Light", 15 = "Standard", 17 = "Full-time", 19 = "Target ceiling (default)", 22 = "Maximum (requires advising approval)". Show a subtle note when 22 is selected: "Most quarters at 22 units require academic advisor approval."
4. In the schedule view, render each quarter's total units in the quarter header (e.g. `Fall 2026 — 17 units`). Color-code based on tiers, using existing UCSC palette:
   - **Green** (target): units in `[15, 19]` AND ≤ 2 major-typed courses.
   - **Yellow** (acceptable): units in `[12, 14]` or `[20, 22]`, or 3 major-typed courses.
   - **Red** (out of bounds): units < 12 or > 22, or 4+ major-typed. This should never appear in a generated schedule.
   When a quarter is yellow, render its `quarter.notes` as a small tooltip or expandable annotation explaining why it's in the acceptable tier.
5. On each course card in the rendered schedule, add a small badge showing `courseType` (Major / GE / UC / Elective). Reuse existing badge styling.

### Phase 7 — Run, fix, report
1. Run `node test_smoke.js`. Iterate until **every** major × concentration combo passes the acceptable tier (100% of quarters in `[12, 22]` units, ≤ 3 major-typed, ≤ 13 quartersUsed). Then push for the target tier: at least 9 of 10 majors should hit **target% ≥ 80%** for at least one concentration each.
2. If one major can't hit the target tier (likely BMEB_BI or BIOTECH_BS — historically hard), report what's preventing it specifically (e.g. "Biotech requires 4 lab-coreq sequences that all pin to specific quarters; year 3 winter ends up at 21 units"). A schedule with a few tier-2 quarters and clear notes is acceptable — a schedule that breaches the hard wall is not.
3. Open `index.html` in headless verification — or print 2 sample schedules to the console — and confirm the UI changes from Phase 6 render correctly (especially the yellow tier-2 quarters showing their `quarter.notes`).
4. End with a short report: before/after comparison of average target% across all majors, count of tier-2 quarters introduced, and any caveats.
</deliverables>

<constraints>
- **Don't touch the selection logic** (`selectCourses` / `walk` / concentration matching). Only placement and the new `courseType` tagging.
- **Don't modify Prototype 1.** Work in `Prototype 2 Website - source code/` only.
- **Don't touch `majors.js` or `data.js`.** Requirement definitions and concentration data are fixed for this task.
- **Don't add new fields to course entries in `courses.js`.** All the fields you need are already there from the recent refresh. `courseType` is computed at selection time, not stored on the course.
- **Preserve XSS safety.** Any new `innerHTML` interpolation (unit counts, courseType badges) must go through `escHTML()`.
- **No new dependencies.** Pure JS, same `<script>` tag setup as the rest of Prototype 2.
- **Pause after Phase 1.** Show me `PLACEMENT_DESIGN.md` before any code lands.
- **Use plan mode if it's available** — the design phase benefits from upfront review.
</constraints>

<workflow>
1. Read `CLAUDE.md`, `Prototype 2 Website - source code/js/engine.js` (especially `placeIntoQuarters`), `js/app.js` (the AppState profile), and `test_smoke.js`.
2. Make a TodoWrite list for Phases 1–7.
3. Execute Phase 1. Stop. Show me `PLACEMENT_DESIGN.md`.
4. After my approval, execute Phases 2–6.
5. Execute Phase 7 and end with the before/after balanceScore report.
</workflow>

<success_criteria>
**Must hold for every schedule** (acceptable tier — non-negotiable):
- Every placed quarter has units in `[12, 22]`.
- No quarter has 4+ major-typed courses.
- `quartersUsed` ≤ 13.
- Every Tier-2 quarter (yellow) has a non-empty `quarter.notes` explaining the deviation.

**Should hold for most schedules** (target tier — the goal):
- ≥ 9 of 10 majors generate schedules with **target% ≥ 80%** for at least one concentration each.
- Sample inspection: pick CS_BA + AI/ML concentration and inspect quarter-by-quarter — most quarters should look like the patterns from `<context>` (3×5, 2×7+5, 7+5+small filler, etc.).

**UI verification**:
- Schedule UI shows per-quarter units in the header with tiered color coding (green/yellow/red).
- Each course has a `courseType` badge.
- `test_smoke.js` runs all 10 majors × multiple concentrations and prints the new results table with both target% and acceptable% columns.
</success_criteria>
