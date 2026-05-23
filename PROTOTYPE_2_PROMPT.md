# Prompt for Claude Code — Build Prototype 2

> Copy everything below the line into Claude Code as a single message.

---

<role>
You are a senior front-end engineer building Prototype 2 of a UCSC 4-year academic schedule generator. You have full access to the existing Prototype 1 codebase as reference. Read `CLAUDE.md` at the repo root first — it is the source of truth for current architecture.
</role>

<context>
**Project**: Client-side static web app (HTML / CSS / vanilla JS, no build step, no bundler, no `package.json`) that generates a complete 4-year UCSC schedule fulfilling major + GE + UC requirements.

**Prototype 1 location**: `Prototype 1 Website - source code/`
- `index.html` — landing → 4-step wizard → schedule view
- `css/style.css` — UCSC-themed design (navy `#003C6C` + gold `#FDC700`)
- `js/courses.js` — ~1,900 course entries (title, units, division, prereqs, ge, quarters, desc, section, rmpScore)
- `js/majors.js` — 10 majors with `categories[]` of type `all_required | choose_group | pick_one | pick_n`
- `js/data.js` — `GE_REQUIREMENTS` (11 categories), `UC_REQUIREMENTS`, `INTEREST_AREAS` (6 CS-only buckets), `GE_INTEREST_AREAS` (5 buckets)
- `js/engine.js` — `Scheduler` + `Validator`. Current selection logic is split between hand-tuned `selectCsBaSplit()` and generic `selectGenericSplit()`, followed by `expandWithPrereqs()` and a multi-phase `placeCoursesBalanced()`. It works but is hard to reason about and the interest matching is shallow (only CS, only 6 buckets).
- `js/app.js` — `AppState` + wizard controller

**Prototype 1 known weaknesses** (the reason we are rebuilding):
1. The engine mixes two selection strategies and is hard to extend to new majors.
2. `INTEREST_AREAS` only covers CS-style interests (`ai_ml`, `systems`, `web_software`, `theory`, `graphics_vision`, `data`) — useless for AM, BME, EE, Biotech, etc.
3. Courses have no first-class `concentration` / `interest` tag — interest matching is done by looking up course codes inside `INTEREST_AREAS[interest].courses`, which is brittle and incomplete.
4. GE interest matching only covers 5 broad buckets and doesn't drive course selection in a satisfying way.
</context>

<goal>
Build **Prototype 2** in a brand-new folder `Prototype 2 Website - source code/` alongside Prototype 1. Keep the polished things from Prototype 1; replace the engine with a much simpler **decision-tree router**; introduce **per-major concentrations** and **GE interest areas** as first-class concepts; **tag every course** with the concentrations it satisfies so the engine can pick by lookup, not by hand-tuned heuristics.

Think of the engine as a tree the student walks down:

```
Student profile
    │
    ▼
Major (CS_BA, AM_BS, …)
    │
    ├─► Required-for-everyone courses (all_required, choose_group, pick_one)
    │       → just take them
    │
    └─► Flexible buckets (pick_n electives, capstone choices, breadth)
            │
            ▼
       Student's chosen concentration (e.g. CS → "AI & Machine Learning")
            │
            ▼
       Filter the bucket's eligible courses to those tagged with that concentration
            │
            ▼
       Rank by RMP score, pick top N

GE requirements
    │
    └─► Student's chosen GE interest (e.g. "Arts & Humanities")
            │
            ▼
       For each unmet GE code, filter candidate courses to those tagged with that interest
            │
            ▼
       Pick top match by RMP score
```

That's it. No multi-phase selection, no greedy CS-specific helpers. Just **tree traversal driven by tags**.
</goal>

<deliverables>
Deliver the following, in order. Each step builds on the previous one — do not skip ahead.

### Step 1 — Set up the new folder
Create `Prototype 2 Website - source code/` and copy these from Prototype 1 unchanged for now (we'll modify them in later steps):
- `index.html`
- `css/style.css`
- `js/courses.js`
- `js/majors.js`
- `js/data.js`
- `js/app.js`
- `js/export.js`

Do **not** copy `js/engine.js` — it will be rewritten from scratch.
Do **not** copy `.bak` files, `.DS_Store`, `test_*.js`, or the `.claude/` folder.

### Step 2 — Design the concentrations
Before writing any code, produce a file `Prototype 2 Website - source code/CONCENTRATIONS.md` that lists, for each of the 10 majors, a curated set of concentrations a student might realistically choose between. Look at each major's flexible categories (`pick_n` electives, breadth, capstone alternatives) in `js/majors.js` to ground each concentration in actual course choices that exist.

**Rules for concentration design**:
- Aim for **3–6 concentrations per major** (variety, but not overwhelming).
- Each concentration must map to **at least 4 real courses** that exist in `js/courses.js`.
- Names should be student-facing (e.g. "Robotics & Embedded Systems", not `robotics_embedded`).
- Each concentration needs an `id` (snake_case), a `name`, a one-sentence `description`, and an explicit list of `courses` (UCSC course codes) that fall under it.
- Where a course legitimately fits two concentrations (e.g. CSE 142 fits both "AI & ML" and "Data Science"), list it in both.

Do the same for **GE concentrations** — but GE concentrations are major-agnostic (one shared set across all students). Target **5–8 GE concentrations** (e.g. "Arts & Humanities", "Social Sciences", "Environment & Sustainability", "Business & Economics", "Health & Wellness", "Global Cultures", "STEM Breadth", "Creative Expression"). For each one, list at least 6 real courses from `js/courses.js` that fit.

Cite the source category for each concentration's courses (e.g. "drawn from CS_BA's BREADTH `pick_n` category" or "drawn from `GE_REQUIREMENTS['CC'].courses`") so the mapping is auditable.

**Stop after Step 2 and ask me to review `CONCENTRATIONS.md` before continuing.**

### Step 3 — Tag every course with its concentrations
Add a new field `concentrations: ["id1", "id2", ...]` to every course entry in `Prototype 2 Website - source code/js/courses.js` that appears in one or more concentration lists from `CONCENTRATIONS.md`. Use empty array `[]` for courses with no concentration.

The field must be **machine-derived from `CONCENTRATIONS.md`** — write a small Python or Node helper script (place it in `Prototype 2 Website - source code/scripts/`) that reads `CONCENTRATIONS.md`, builds the reverse index (course → concentration ids), and patches `courses.js` in place. Commit the script so the mapping is reproducible. **Do not hand-edit 1,900 entries.**

### Step 4 — Add concentration metadata to `data.js` and `majors.js`

In `Prototype 2 Website - source code/js/data.js`, **replace** the old `INTEREST_AREAS` and `GE_INTEREST_AREAS` with:
```js
// One shared object covering both major concentrations (keyed by major id) and GE concentrations
const CONCENTRATIONS = {
  major: {
    CS_BA: [
      { id: "ai_ml", name: "AI & Machine Learning", description: "...", courses: [...] },
      ...
    ],
    AM_BS: [...],
    // ... one entry per major
  },
  ge: [
    { id: "arts_humanities", name: "Arts & Humanities", description: "...", courses: [...] },
    ...
  ]
};
```

Leave `GE_REQUIREMENTS` and `UC_REQUIREMENTS` exactly as they are — those are correct and the validator depends on them.

In `Prototype 2 Website - source code/js/majors.js`, leave the requirement categories unchanged — the engine will read concentrations from `data.js`, not from the major file.

### Step 5 — Build the new tree-based engine

Create `Prototype 2 Website - source code/js/engine.js` from scratch. Keep it **dramatically simpler** than Prototype 1's engine. Public API must remain the same so `app.js` still works:
```js
Scheduler.generate(profile) → { schedule, validation }
Validator.validateAll(schedule, profile) → { major, ge, uc, totalUnits, allMet }
```

The internal flow is a flat decision tree, not a multi-phase pipeline:

```
generate(profile):
  1. selected = []                          // courses we've committed to
  2. For each major category (in order):
       walk(category, profile, selected)
  3. For each unmet GE requirement:
       pick a course tagged with the student's chosen GE concentration; else fall back to any course satisfying that GE code
  4. For each unmet UC requirement:
       pick the canonical satisfier
  5. expandPrereqs(selected)                 // add missing prereqs (capped at 4 levels, matches CLAUDE.md)
  6. placeIntoQuarters(selected, profile)    // topological sort + greedy quarter fill respecting maxUnits and availability
  7. return { schedule, validation: Validator.validateAll(schedule, profile) }

walk(category, profile, selected):
  switch (category.type):
    case "all_required":  add every course
    case "choose_group":  add courses from the group that best matches student's completed courses
    case "pick_one":      skip if any alternative already taken; else add first alternative
    case "pick_n":        rank category.courses by:
                            (a) is it tagged with profile.concentration for this major? → big bonus
                            (b) rmpScore (tie-breaker)
                          take top n
```

**Hard rules**:
- No CS_BA-specific code paths. Every major goes through the same `walk()`.
- No `selectCsBaSplit` / `selectGenericSplit` split.
- `expandPrereqs` and `placeIntoQuarters` should each be **under 80 lines**. Keep them dumb and readable.
- Validator can be ported from Prototype 1's `js/engine.js` largely as-is — it already works.

### Step 6 — Update the UI for concentrations

In `Prototype 2 Website - source code/index.html` and `js/app.js`:
- Step 4 of the wizard ("Interests & Generate") currently has two checkbox grids (major interests + GE interests). Replace these with:
  - **Major concentration**: a single-select radio group or dropdown showing only the concentrations for the major chosen in Step 1. Label: "Pick the area you most want to focus on within your major." Allow "No preference" as an option.
  - **GE concentration**: a single-select radio group / dropdown of the 5–8 GE concentrations. Label: "Pick the type of GE courses you'd most enjoy." Allow "No preference."
- Update `AppState.profile` field names: replace `interests: []` with `concentration: "ai_ml"` (single string, or `null`), and `geInterests: []` with `geConcentration: "arts_humanities"` (or `null`).
- When the user changes their major in Step 1, re-populate the major-concentration options in Step 4 from `CONCENTRATIONS.major[profile.major]`.
- Style the radio cards consistently with the existing UCSC navy/gold design — re-use `.interests-grid` / `.interest-card` classes from `style.css`.

### Step 7 — Smoke-test and verify
Add `Prototype 2 Website - source code/test_smoke.js` (loads files via `vm.runInThisContext` in the same order as Prototype 1: `courses.js → majors.js → data.js → engine.js`). It must:
1. For each of the 10 majors and each concentration belonging to that major, generate a schedule with a synthetic freshman profile and confirm:
   - `validation.allMet === true` (or print which requirement failed)
   - Every placed course's prereqs appear in a strictly-earlier quarter
   - Total units ≥ the major's `totalUnitsRequired`
   - At least 60% of the elective courses selected are tagged with the chosen concentration (sanity check the routing actually works)
2. Print a summary table: `major | concentration | allMet | totalUnits | quartersUsed`.

Run the test (`node test_smoke.js` from inside `Prototype 2 Website - source code/`) and paste the output. Fix any failures before declaring done.
</deliverables>

<constraints>
- **No build tooling, no `package.json`, no bundler.** Plain `<script>` tags only, same as Prototype 1.
- **Do not modify Prototype 1.** It stays as a working reference.
- **Preserve XSS safety**: `app.js` interpolates `title`, `desc`, `code`, and now `concentration name/description` into `innerHTML`. Every one of those must go through the existing `escHTML()` helper.
- **Don't invent courses.** If a concentration would benefit from a course that doesn't exist in `js/courses.js`, drop the course from the concentration rather than fabricating an entry.
- **Don't overwrite hand-tuned data.** `CS_BA_REQUIREMENTS` in `majors.js` is hand-curated — leave its categories alone.
- **Pause for review after Step 2.** I want to read `CONCENTRATIONS.md` before you tag 1,900 courses.
- Use the **plan mode / TodoWrite** to track Steps 1–7 so I can see progress.
</constraints>

<workflow>
1. Start by reading `CLAUDE.md` and the current `js/engine.js`, `js/data.js`, and `js/majors.js` so you understand exactly what's there.
2. Make a TodoList for Steps 1–7.
3. Execute Steps 1 and 2. Stop. Show me `CONCENTRATIONS.md`.
4. After I approve, execute Steps 3–7.
5. End with the smoke-test output and a one-paragraph summary of what to verify by opening `index.html` in a browser.
</workflow>

<success_criteria>
- A new sibling folder `Prototype 2 Website - source code/` exists and runs standalone (open `index.html` → generate a schedule for any major + concentration combo → see a 4-year plan).
- `js/engine.js` is shorter and simpler than Prototype 1's (target: under 500 lines vs. ~1,500).
- A CS student picking "AI & Machine Learning" gets a noticeably different elective slate than one picking "Systems & Architecture" — verifiable by diffing two generated schedules.
- Same is true across non-CS majors (AM, BME, EE, Biotech, etc.).
- `test_smoke.js` passes for all 10 majors × every concentration.
- `CONCENTRATIONS.md` is human-readable and lists real courses I can spot-check.
</success_criteria>
