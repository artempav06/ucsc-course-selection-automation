# Credit-First Scheduling Plan

Updated: 2026-07-11

## Artem's clarified rule

The scheduler should optimize primarily around **quarter credits/units**, not raw number of courses.

Preferred quarter load:

- Target: about **15–17 credits** when feasible.
- Normal ceiling: avoid going above **19 credits**.
- Course count is secondary: 4 courses can be good if the credits fit, e.g. `5 + 5 + 2 + 5 = 17`.
- Low-unit labs/companions should be treated as workload add-ons, not as equal to full 5-credit lecture courses.

## Current state

Prototype 4 already has unit-aware placement and validation, and the latest regression gates pass:

- `node tools/data-validator.js`: exit 0.
- `node test_prerequisite_correctness.js`: 7/7 passed.
- `node test_schedule_regression.js`: aggregate 12/12 supported majors have <=4-year default plans.

However, the latest rulebook still contains a course-count heuristic: default normal placement usually caps at two full major/prereq courses per quarter, with rescue placement available. That was meant to avoid overloaded quarters, but Artem clarified that the better rule is credit-first load shaping.

## Important correction to previous framing

Do **not** treat "number of classes per quarter" as the main quality signal. A quarter with 4 courses and 17 credits can be better than a quarter with 3 courses and 19 credits. The scheduler should reason in units/credits, plus prerequisite urgency and requirement importance.

## Proposed implementation phases

### Phase 1 — Add credit-load scoring instrumentation

For every generated schedule scenario, compute per-quarter diagnostics:

- total credits;
- number of 5-credit courses;
- number of low-unit labs/companions;
- whether credits are below target, ideal, high-but-allowed, or over cap;
- whether high-credit quarters are avoidable by moving flexible GE/elective courses.

Expected buckets:

- `underTarget`: below 12/15 depending on profile minimum and remaining requirements;
- `target`: 15–17 credits;
- `acceptable`: 12–14 or 18–19 when justified;
- `overCap`: >19 unless an explicit user profile permits it;
- `softEngineeringException`: only if we intentionally preserve an official dense engineering path and no better <=19 placement exists.

### Phase 2 — Replace course-count pressure with credit-first placement

Modify normal placement so quarter selection prefers:

1. prerequisite-critical required courses;
2. quarters that land near 15–17 credits;
3. adding low-unit labs/coreqs with their lectures when credits remain reasonable;
4. flexible GE/elective courses only when they improve the credit balance and do not block major progress.

Raw course count should be only a tie-breaker, not a hard throttle.

### Phase 3 — Rebalance >4-year warning scenarios

Use the combo matrix warning buckets to find schedules that run long even though earlier quarters have room under 19 credits. For each case:

- inspect quarter-by-quarter credits;
- identify movable GE/elective/major courses;
- move flexible courses earlier if it keeps quarters around 15–17 and <=19;
- preserve prerequisite correctness and offering-term constraints.

### Phase 4 — Tighten the engineering soft-20 exception

The current rule allows a soft 20-unit cap for CE_BS, EE_BS, and RE_BS default profiles. Re-check this under Artem's clarified rule:

- Prefer <=19 whenever possible.
- Allow 20 only as a last resort if official catalog/sample-plan density truly requires it.
- Emit/track a diagnostic when 20 is used so it is not hidden.

### Phase 5 — Add regression tests

Add tests that assert:

- default profiles prefer 15–17 credit quarters when feasible;
- no default quarter exceeds 19 unless explicitly justified;
- low-unit labs do not block a useful 4-course/17-credit quarter;
- GE/elective padding improves balance without delaying graduation;
- supported-major default schedules remain <=4 years.

## Data correctness status

Current confidence is strong for the supported-major paths and specific prerequisite fixes already covered by tests, but it is **not honest to claim every one of the 4,233 catalog courses has been manually verified against the official catalog for prerequisites, GE tags, and elective categories**.

What has been verified:

- supported-major default schedules have no chronological prerequisite violations in tests;
- the explicit prerequisite fixes from recent work are covered by `test_prerequisite_correctness.js`;
- supported-major requirement structures pass validator tests;
- 4,207 concrete UCSC catalog links passed the link audit;
- data validator exits 0 for the current configured validation mode.

What still needs a separate audit before claiming full database correctness:

- every imported course's official prerequisite text vs local encoded prerequisite groups;
- every imported course's GE tag(s);
- every course's units/offering metadata;
- every major elective bucket against official requirements and planners.

## Next recommended batch

Implement credit-first schedule quality in Prototype 4, then run:

```bash
cd "/home/artem/projects/ucsc-course-selection-automation/Prototype 4 Website - source code"
node tools/data-validator.js
node test_prerequisite_correctness.js
node test_schedule_regression.js
node test_combo_matrix.js
for t in test_*.js; do node "$t"; done
```

Then update the handoff with specific scenarios improved and any remaining warnings.
