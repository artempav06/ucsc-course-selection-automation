# Prototype 3 Current Data Model

Prototype 3 starts as a safe copy of Prototype 2. The first foundation goal is not to rewrite the scheduler; it is to make the existing data shapes explicit, validated, and ready for gradual normalization.

## Runtime load order

The browser and Node tests currently load data in this order:

1. `js/courses.js` — defines global `COURSES`.
2. `js/majors.js` — defines global `MAJOR_REQUIREMENTS`.
3. `js/data.js` — defines GE/UC/global supporting data.
4. `js/engine.js` — consumes those globals to generate and validate schedules.

## `COURSES`

`COURSES` is an object keyed by UCSC-style course code, for example `CSE 101`.

Common course fields:

- `title`: string.
- `units`: number.
- `division`: `lower`, `upper`, or `graduate`.
- `prereqs`: array of prerequisite groups. Current convention: each inner array is an OR-list, and the outer array is AND across groups. Example: `[["CSE 12", "BME 160"], ["CSE 16"], ["CSE 30"]]` means `(CSE 12 or BME 160) and CSE 16 and CSE 30`.
- `ge`: GE code or `null`.
- `quarters`: array using `F`, `W`, `S`, `SU`; empty arrays mean no active modeled offerings and should not be selected automatically.
- `desc`: catalog/course description text.
- `section`: local tags used by requirement/elective selection.
- `rmpScore`: numeric professor-quality/preference score.
- `catalogUrl`: official UCSC catalog course URL when available.
- `enrollmentRestrictions`: official restriction text when known.
- `labCoreq`: linked lab/corequisite course when known.
- `repeatable`: repeatability marker from catalog data when known.

## `MAJOR_REQUIREMENTS`

`MAJOR_REQUIREMENTS` is an object keyed by local major ID, for example `CS_BS` or `TIM_BS`.

Major fields:

- `id`: local major ID.
- `name`: display name.
- `catalogUrl`: official UCSC Requirements and Planners source URL.
- `pdfUrl`: optional historical PDF/source URL.
- `totalUnitsRequired`: major/degree unit metadata when modeled.
- `minUpperDivUnits`: upper-division unit metadata when modeled.
- `minGPA`, `majorGPA`: GPA metadata.
- `categories`: ordered requirement categories.

Current category types:

### `all_required`

All listed courses are required.

```js
{
  id: "UD_CORE",
  name: "Upper-Division Core",
  type: "all_required",
  courses: ["CSE 101", "CSE 130"],
  description: "..."
}
```

### `pick_one`

Exactly one course should be selected from the list.

```js
{
  id: "STATISTICS",
  name: "Statistics",
  type: "pick_one",
  courses: ["STAT 7", "STAT 131"],
  description: "..."
}
```

### `pick_n`

Select `n` courses from the list.

```js
{
  id: "ELECTIVES",
  name: "Electives",
  type: "pick_n",
  n: 3,
  courses: ["CSE 102", "CSE 103", "CSE 114A"],
  description: "..."
}
```

### `choose_group`

Select one group. Each group has a label and a course list.

```js
{
  id: "CAPSTONE",
  name: "Capstone",
  type: "choose_group",
  groups: [
    { label: "ECE 129 sequence", courses: ["ECE 129A", "ECE 129B", "ECE 129C"] }
  ],
  description: "..."
}
```

## `GE_REQUIREMENTS`

`GE_REQUIREMENTS` is currently an array-like object of GE categories.

Common GE fields:

- `id`: GE code.
- `name`: display name.
- `needed`: number of courses/subrequirements needed.
- `courses`: candidate courses for the GE.
- `subcategories`: optional nested GE groups.
- `autoSatisfiedBy`: courses that automatically satisfy the GE through another requirement.
- `note`: explanatory text.

## Known model gaps to add later

These are official-catalog realities that need richer types after validation is in place:

- Repeatable-credit requirements, e.g. thesis/research credits across terms.
- Major-specific prerequisites.
- Course equivalencies and crosslists.
- Credit exclusions / duplicate-credit restrictions.
- Catalog-year variants.
- Advisory planner expectations from official 4-year sample planners.

## Validation philosophy

The initial Prototype 3 validator should be conservative:

- Errors: malformed structures, broken references, impossible category shapes.
- Warnings: missing source metadata, stale/no-offering courses in elective-like pools, graduate/restricted courses that may require later policy decisions.

Validation should run before schedule tests so data mistakes fail fast.
