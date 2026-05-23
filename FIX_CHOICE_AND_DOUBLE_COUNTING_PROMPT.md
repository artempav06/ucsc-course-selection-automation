# Prompt for Claude Code — Fix `pick_one` Over-Selection & Multi-Requirement Double-Counting

> Copy everything below the line into Claude Code as a single message.

---

<role>
You are a senior engineer fixing two specific selection bugs in `Prototype 2 Website - source code/js/engine.js`. The investigation report you produced previously narrowed the 5–6-year graduation symptom down to two root causes — this prompt addresses both. Re-read `INVESTIGATION_REPORT.md` and `CLAUDE.md` before starting.
</role>

<context>
The user reviewed `INVESTIGATION_REPORT.md` from the previous investigation pass and identified two specific bugs as the real culprits:

**Bug A — `pick_one` (and possibly `choose_group`) is treating alternatives as required.**
The user inspected a generated schedule and saw **all alternatives** of a "choose 1" category appearing as placed courses. Example: if a category says "Pick one of [AM 10, MATH 21, MATH 19A]," the engine schedules all three. This alone is responsible for a large chunk of the extra units that push graduation to 5–6 years.

**Bug B — One course can satisfy multiple requirements, but the engine doesn't recognize it.**
Some courses legitimately cover two or three requirements at once (e.g. `CSE 16` satisfies the major's discrete-math requirement AND the GE `MF` code; `HIS 10B` covers `ER`, `AH`, and `AI` in `geAll`). Currently the engine selects a course to satisfy one requirement, then **picks another course for the second requirement** even though the first course already covers it. The result is redundant courses on the schedule.

**Important constraint from the user**: concentration tags must remain a tie-breaker for **which** course to pick within a choice — they must **not** cause extra courses to be added. A student who picks the "AI & ML" concentration should get a *different* elective in the `pick_n` BREADTH category than a student who picks "Systems" — but **the same number** of electives, not more.
</context>

<goal>
Produce a clean fix for both bugs. The schedule for every major × concentration combo should drop from 5–6 years (15–18 quarters) toward the expected 4 years (12 quarters), with the same requirements coverage — just fewer redundant courses.

Bug A is mostly mechanical (the category-type switch is failing for `pick_one` / `choose_group`). Bug B requires a small architectural change: course selection has to be **requirement-aware** so that one course can fulfill multiple buckets in a single placement, instead of one-bucket-per-course.
</goal>

<deliverables>
Track these phases with `TodoWrite`.

### Phase 1 — Confirm both bugs with targeted tests
Write `Prototype 2 Website - source code/scripts/inspect_choices.js`. This script must:

1. **For each of the 10 majors**, generate a schedule with a default freshman profile and the first listed concentration.
2. **For Bug A (over-selection)**, for every `pick_one` and `choose_group` category in `majors.js`:
   - Count how many of its alternatives appear in the placed schedule.
   - If more than the allowed number (1 for `pick_one`, 1 group for `choose_group`) appear, print the violation with category id, allowed count, actual count, and the offending courses.
3. **For Bug B (double-counting)**, for every placed course:
   - Compute the full set of requirements (major categories + GE codes via `ge` and `geAll` + UC) that this single course could satisfy.
   - Then check whether any *other* placed course was selected to satisfy a requirement that the first course already covered.
   - Print every redundancy with the format: `Requirement <X> is satisfied by <Course1> already → but <Course2> was also placed to satisfy <X>`.
4. Print a summary table at the bottom: `major | concentration | pick_one_violations | choose_group_violations | redundant_courses | total_extra_units`.

Run it. Save output to `scripts/output/choice_audit.txt`. This is the **before** baseline.

### Phase 2 — Trace the code paths
Locate the exact functions responsible. The investigation report already pointed at these; confirm and write the file:line references in the fix plan:

- Where `pick_one` is handled in the tree walk (`walk` / `selectCourses` / similar).
- Where `choose_group` is handled.
- Where GE selection happens after major selection (e.g. `pickGECourses` / `selectGEs`).
- Where the validator checks `autoSatisfiedBy` (in `data.js`'s `GE_REQUIREMENTS`).
- Whether the selector ever consults `autoSatisfiedBy` *before* picking a GE course, or only the validator after the fact.

### Phase 3 — Write `FIX_PLAN.md`
Save to `Prototype 2 Website - source code/FIX_PLAN.md`. Cover:

1. **Bug A fix**:
   - Exact location and root cause (most likely the `pick_one` case is falling through to `all_required`, or the alternatives list is being iterated instead of singled).
   - The minimal diff to fix it (in prose, not code).
   - How concentration tags will be used: when `pick_one.courses` has multiple alternatives, score each by `course.concentrations.includes(profile.concentration[major])` first, then by `rmpScore`, then pick **exactly one**. Same logic for `choose_group`: score each group by how many of its courses match the student's concentration / completed list, lock the highest-scoring group, schedule only its courses.

2. **Bug B fix** — introduce a "covers" map:
   - When a course is selected, compute its full coverage set: every major category id it belongs to + every GE code in `ge`/`geAll` + any UC requirement it satisfies.
   - Maintain a `coveredRequirements: Set<string>` that accumulates as selection progresses.
   - Before picking a new course to satisfy a requirement, check if `coveredRequirements` already contains it. If yes, **skip**.
   - GE selection (`pickGECourses`) must consume this set: only iterate the GE codes that aren't already covered by major selections.
   - The validator should also respect `autoSatisfiedBy` and `geAll` so its "met" map matches reality.

3. **Concentration role clarification** (one paragraph): explicitly state that concentrations only affect *which* course is picked when there's a choice — never *how many* courses are picked. Any code path that adds extra concentration-tagged courses outside the categorical requirements is wrong and must be removed.

4. **Risk assessment**: which existing tests / generated schedules might change because of these fixes. Specifically: will any currently-passing requirement go unmet because the engine now skips a course it previously double-placed?

**Stop after Phase 3 and show me `FIX_PLAN.md`.** Quick review only — I just want to confirm you've identified the right code paths before you edit. If the plan looks right, I'll reply "go" and you move to Phase 4.

### Phase 4 — Implement the fixes
After my "go":
1. Make the minimal diff for Bug A. Run `scripts/inspect_choices.js`. Confirm `pick_one_violations` and `choose_group_violations` are zero for all 10 majors.
2. Make the diff for Bug B. Re-run the inspect script. Confirm `redundant_courses` drops to zero (or near-zero — there may be one or two unavoidable cases where two courses both legitimately cover a GE for distinct major reasons, and that's fine).
3. Run `node test_smoke.js`. Confirm:
   - `quartersUsed` ≤ 12 for at least 9 of 10 majors on at least one concentration each.
   - `target%` ≥ 80% for those same majors.
   - `acceptable%` is still 100% across the board (no quarter has slipped out of [12, 22] units or onto a 4th major-typed course).
   - All major / GE / UC requirements still meet `validation.allMet === true`.

If any of these regress, do **not** keep going — pause, print what regressed, and ask me how to proceed.

### Phase 5 — Before/after report
Append a section to `FIX_PLAN.md` (or write a separate `FIX_RESULTS.md`) showing:
- For each major: quartersUsed before / after, totalUnits before / after, target% before / after.
- Sample CS_BA + AI/ML quarter-by-quarter schedule before/after — visual proof the redundant courses are gone.
- Any majors that didn't drop to 12 quarters and a one-sentence explanation each.
</deliverables>

<constraints>
- **Do not touch selection logic outside of the two bug fixes.** No drive-by refactors of `placeIntoQuarters`, no rewrites of `expandPrereqs`, no changes to the filler pool. Both bugs live in the selection / GE-picking code path.
- **Do not modify `majors.js`, `courses.js`, or `data.js`.** If a requirement looks wrong in those files, surface it in `FIX_PLAN.md` as an open question — don't patch the data.
- **Concentration tags must remain "which not how many."** Verify by inspecting the code: if any path uses concentrations to expand a `pick_n` past its `n`, or to add a course outside of a categorical bucket, remove that behavior.
- **Preserve the API surface.** `Scheduler.generate(profile) → { schedule, validation }` and `Validator.validateAll(schedule, profile)` must keep their signatures so `app.js` is untouched.
- **No XSS regressions.** If any new fields are surfaced into UI in this pass, they must go through `escHTML()`.
- **Pause for review after Phase 3.** Quick confirmation — I'm not blocking the fix, just making sure you found the right lines.
</constraints>

<workflow>
1. Read `INVESTIGATION_REPORT.md`, `CLAUDE.md`, and the relevant sections of `engine.js`, `majors.js`, and `data.js`.
2. Make a TodoWrite list for Phases 1–5.
3. Execute Phases 1–3. Stop. Show me `FIX_PLAN.md`.
4. On "go", execute Phases 4 and 5.
</workflow>

<success_criteria>
- `scripts/output/choice_audit.txt` (after) shows zero `pick_one_violations` and zero `choose_group_violations` across all 10 majors.
- `redundant_courses` count drops by at least 80% (a few unavoidable overlaps may remain).
- `quartersUsed` ≤ 12 for ≥ 9 of 10 majors on at least one concentration.
- All previously-met requirements still pass `validation.allMet === true`.
- Two students of the same major picking different concentrations produce schedules with the **same number** of `pick_n` courses chosen — just different course identities, biased by their concentration.
- No regressions in `target%` or `acceptable%` for any schedule that was passing before.
</success_criteria>
