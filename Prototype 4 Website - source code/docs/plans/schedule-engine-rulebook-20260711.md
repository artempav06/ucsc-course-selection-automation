# Prototype 4 Schedule Engine Rulebook

Updated: 2026-07-11

This is the working rulebook for the Prototype 4 UCSC schedule generator after the full-link audit, browser QA, and regression fixes.

## Source-of-truth rules

1. Official UCSC General Catalog pages are the canonical source for requirements, courses, prerequisites, units, GE tags, enrollment limits, and catalog links.
2. Concrete catalog links must use `https://catalog.ucsc.edu/en/current/general-catalog/...` while UCSC's current catalog represents 2026-27.
3. Local data should preserve exact official prerequisite text in `officialPrereqText` and encode only course-code prerequisites in `prereqs` / `concurrentPrereqs`.
4. Non-course eligibility language such as placement, directed self-placement, or satisfaction of ELWR belongs in notes unless the UI has a reliable way to model it.

## Requirement selection rules

1. Select all required major courses first.
2. For `choose_group` categories, select one coherent group and mark the unchosen alternatives as virtually present so alternate capstones do not get double-counted.
3. For `pick_one` / `pick_n`, rank by concentration fit, availability in the student's planning window, prerequisite burden, term flexibility, restrictions, and explicit preferred/avoided courses.
4. Do not satisfy a non-DC elective bucket by accidentally reusing a DC/capstone course unless the requirement explicitly allows it.
5. After major selection, add GE, UC, prerequisite, upper-division supplement, and only then free-elective padding.

## Writing / composition rules

1. WRIT 1 and WRIT 2 are progress/declaration-sensitive and should be scheduled as early as prerequisites and unit caps allow.
2. Regular `WRIT 2` is preferred for the Composition GE over summer-only/global-seminar variants because it is offered in Fall/Winter/Spring and is much less likely to be stranded.
3. If ELWR is marked satisfied, the engine may skip ELWR satisfaction, but Composition still requires a C-course such as WRIT 2 unless already satisfied by completed coursework.

## GE selection rules

1. Prefer GE courses that are broadly available in the remaining planning window and have low/no prerequisite burden.
2. Do not choose chemistry/biology/physics lab-science chains as generic SI fillers for non-lab majors unless the student explicitly selected a natural-science/health GE focus or the major itself requires that science path.
3. Prefer courses that satisfy both GE and UC requirements when this does not create prerequisite or availability problems.
4. Avoid summer-only GE choices when a regular F/W/S alternative is available and the student's plan is already dense.

## Prerequisite and corequisite rules

1. Ordinary prerequisites must be completed before the quarter starts.
2. Explicit concurrent prerequisites and lab/corequisite pairs may share a quarter only when encoded as `concurrentPrereqs` or `labCoreq`.
3. Lab/corequisite partners must be placed together unless the partner was already completed.
4. Final validation must report any chronological prerequisite violation rather than silently accepting it.

## Quarter placement rules

1. Topologically sort by prerequisite chain depth first, then requirement type, then lower-division before upper-division where appropriate.
2. Place WRIT 1/2 before normal major placement in early years so writing does not get crowded out.
3. Default major/prerequisite placement should usually cap at two full required/major courses per quarter; a third is allowed as a rescue to hit minimum units or handle dense official engineering paths.
4. Labs and 1-2 unit companions are workload add-ons and should not be counted like full 5-unit required courses when judging major-course density.
5. FREE electives are padding only. They must never displace real requirements, create fake fifth years, or be added beyond what is needed for degree-unit minimums.
6. For CE_BS, EE_BS, and RE_BS, a requested 19-unit default is treated as a soft 20-unit cap because official engineering planners often require occasional 20-credit quarters. User-requested lower caps, such as 15, remain hard.

## Completion and validation rules

1. A schedule is valid only if all major, GE, UC, total-unit, upper-division, and prerequisite checks pass.
2. If requirements are satisfied before the requested target term, trim empty trailing quarters/years instead of rendering blank schedule columns.
3. If a profile is infeasible within the requested window because of low unit caps, gaps, late starts, or very dense majors, extending the schedule is acceptable; dropping requirements is not.
4. Link validation should check all concrete catalog URLs and ignore JS template literals such as the dynamic `catalogUrlFor` pattern.

## Current QA gates

Before declaring a schedule-engine change complete, run:

```bash
cd "/home/artem/projects/ucsc-course-selection-automation/Prototype 4 Website - source code"
for t in test_*.js; do node "$t"; done
```

Also run an actual browser/server smoke check to confirm the page is serving Prototype 4 and not a stale Prototype 3 server/cache:

```bash
python3 -m http.server 4174
# visit http://127.0.0.1:4174/index.html
```

Browser verification should confirm:

- cache-busted Prototype 4 script URLs are loaded;
- `COURSES` count is about 4233;
- `MAJOR_REQUIREMENTS` has 12 supported majors;
- generated scenarios have no hard unmet requirements;
- WRIT 1/2 appear early for normal freshmen/winter-start/summer-start profiles;
- default non-lab majors do not get unrelated CHEM/BIOL/BIOE/PHYS SI chains.
