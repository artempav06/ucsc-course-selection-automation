# Prompt for Claude Code — Refresh & Expand the Course Database

> Copy everything below the line into Claude Code as a single message.

---

<role>
You are a data engineer responsible for the UCSC course catalog that powers our schedule-generator engine. You have access to the existing scraper scripts in `scripts/` and the merged output in `Prototype 1 Website - source code/js/courses.js`. Read `CLAUDE.md` and `scripts/README.md` first.
</role>

<context>
**Source of truth**: https://catalog.ucsc.edu/en/current/general-catalog/courses — the official UCSC course catalog, organized by department/subject.

**What we already have**:
- `scripts/fetch_ucsc_courses.py` — current scraper. Pulls course code, title, units, description, prereqs.
- `scripts/merge_into_data_js.py` — merges scraper output into `js/courses.js`. **Never overwrites hand-tuned entries** above the `AUTO-GENERATED FROM UCSC CATALOG` marker. Use `--force` to override, `--dry-run` to preview.
- `Prototype 1 Website - source code/js/courses.js` — ~1,900 entries.
- `scripts/output/courses_raw.json` and `courses_by_subject.json` — last scrape's intermediate JSON.

**Known data-quality gaps (from `CLAUDE.md`)**:
1. All auto-scraped courses default to `quarters: ["F","W","S"]` — **real quarter availability is unknown**. The engine can't enforce real quarter restrictions.
2. All auto-scraped courses default to `section: ["FREE"]` — no semantic categorization.
3. Prereq parsing is wrong for ~5 courses (trailing "or" parsed as a separate AND-group).
4. No lab co-requisite field — the engine has logic to place lectures with their labs together, but the data isn't there.
5. No repeatability flag, no cross-listing field, no instruction-mode info.

**The 10 majors currently in our database** (defined in `Prototype 1 Website - source code/js/majors.js`):
`CS_BA, CS_BS, CE_BS, EE_BS, CSGD_BS, AM_BS, BMEB_BI, BMEB_BM, BIOTECH_BS, NDT_BS`

**Course entry shape we need to fill out** (current → target):
```js
"CSE 20": {
  title: "Beginning Programming in Python",
  units: 5,
  division: "lower" | "upper" | "graduate",
  prereqs: [["MATH 19A", "MATH 20A"]],     // AND-of-OR groups
  ge: "MF" | null,                          // single GE code (current schema)
  geAll: ["MF", "SR"],                      // NEW — full list when a course covers multiple
  quarters: ["F", "W"],                     // NEW — REAL availability, not defaulted
  desc: "...",
  section: ["FREE"],
  rmpScore: 4.0,
  // NEW fields below
  labCoreq: "CSE 20L" | null,               // co-required lab section if any
  crossListed: ["AM 10"] | [],              // cross-listings
  repeatable: false,                        // can earn credit multiple times
  maxUnits: null,                           // for variable-unit / repeatable courses
  instructionMode: ["in-person", "online"], // when listed
  enrollmentRestrictions: "..." | null,     // e.g. "CS majors only"
  catalogUrl: "https://catalog.ucsc.edu/.../CSE-20"   // for verification
}
```

If a field isn't on the catalog page for a given course, omit it or set `null` — never invent values.
</context>

<goal>
Refresh and expand `Prototype 1 Website - source code/js/courses.js` using the official UCSC catalog. **Priority is depth over breadth**: get rich, accurate data for the courses our 10 majors actually use, then do half of the remaining departments on the catalog. The other half will be scraped later in a second pass.

Use **parallel sub-agents** (Task tool) to work through department chunks concurrently — the catalog is large and serial scraping wastes time.
</goal>

<deliverables>
Execute in this order. Use `TodoWrite` to track each phase.

### Phase 1 — Build the priority course list
Read every file in `Prototype 1 Website - source code/js/majors.js` and produce `scripts/priority_courses.json`: the complete deduplicated list of course codes referenced by **any** category of **any** of the 10 majors (`all_required`, `choose_group.groups[].courses`, `pick_one.courses`, `pick_n.courses`, plus any prereqs those courses transitively need — walk prereq chains up to 4 levels deep using the existing `courses.js`).

Also produce `scripts/priority_departments.json`: the deduplicated list of department prefixes that appear in `priority_courses.json` (e.g. `CSE`, `MATH`, `AM`, `STAT`, `PHYS`, `BIOE`, `BME`, `EE`, `CHEM`, `WRIT`, etc.).

Report counts: total priority courses, total priority departments.

### Phase 2 — Survey the catalog and split work
WebFetch https://catalog.ucsc.edu/en/current/general-catalog/courses and enumerate every department/subject listed. Output `scripts/all_departments.json` with one entry per department: `{ code, name, url }`.

Compute three groups:
- **Group A (priority)**: departments from `priority_departments.json`.
- **Group B (this pass)**: half of `all_departments` minus Group A, chosen alphabetically by code (first half — A through roughly M). Specify the exact split in the file `scripts/scrape_plan.md`.
- **Group C (skipped this pass)**: the other half — record them in `scrape_plan.md` so the second pass picks them up.

### Phase 3 — Upgrade the scraper
Extend `scripts/fetch_ucsc_courses.py` to extract the new fields listed in `<context>`:
- Real `quarters` (parse the "Quarter Offered" / "Offered" line — often values like "Fall", "Winter, Spring", "Summer only", or sometimes a year code).
- `geAll` (multiple GE codes per course where listed).
- `labCoreq` (when a course lists a corequisite ending in `L` or labeled as a lab section).
- `crossListed` (when the catalog says "Same as [DEPT NUM]").
- `repeatable` and `maxUnits` (when description says "May be repeated for credit" or has variable units).
- `instructionMode`, `enrollmentRestrictions`, `catalogUrl`.

Before running it widely, **WebFetch 3 sample course pages** from different departments (one CSE, one MATH, one HAVC or LIT) and confirm the parser extracts each new field correctly. Print a sample of the JSON output and pause so I can spot-check.

Also fix the trailing-`or` prereq bug mentioned in `CLAUDE.md` — when the prereq string ends in `or X`, that `X` should be part of the previous OR-group, not a new AND-group.

### Phase 4 — Parallel scrape
Spawn **multiple sub-agents in parallel** (one Task tool call per agent, all dispatched in a single message). Suggested split:

- Agent 1: Group A departments — chunk 1 (e.g. CSE, AM, STAT, MATH).
- Agent 2: Group A departments — chunk 2 (e.g. PHYS, CHEM, BIOE, BME, EE).
- Agent 3: Group A departments — chunk 3 (the rest of Group A: WRIT, LIT, etc., whatever priority needs).
- Agent 4: Group B — first third alphabetically.
- Agent 5: Group B — second third.
- Agent 6: Group B — final third.

Each agent runs the upgraded `fetch_ucsc_courses.py` against its assigned departments and writes its output to `scripts/output/scrape_<agent_id>.json`. Each agent must also produce a short report listing any courses where parsing was uncertain (e.g. unrecognized quarter strings, malformed prereqs) so we can manually review.

Don't bundle network calls inside a single Python process — keep each agent's scrape isolated so failures don't cascade.

### Phase 5 — Merge & cross-check
Combine all `scrape_<agent_id>.json` files into a single `scripts/output/courses_raw.json`. Then:

1. Update `scripts/merge_into_data_js.py` to handle the new fields (`geAll`, `labCoreq`, `crossListed`, `repeatable`, `maxUnits`, `instructionMode`, `enrollmentRestrictions`, `catalogUrl`).
2. Run merge with `--dry-run` first. Show me the diff summary: how many courses added, how many updated, how many skipped (hand-tuned).
3. After my approval, run merge for real against `Prototype 1 Website - source code/js/courses.js`.
4. **Verify hand-tuned entries are untouched** — `grep` for a few known hand-tuned codes (e.g. `CSE 20`, `CSE 12`, `CSE 30`, anything with `section: ["CS_LD_CORE"]`) and confirm `quarters`, `section`, and `prereqs` match what was there before.

### Phase 6 — Regression test the engine
From `Prototype 1 Website - source code/`:
```bash
node test_all_majors.js
node test_edge_cases.js
node test_integration.js
```

Compare against the baseline failures noted in `CLAUDE.md` (the 5 known prereq-violation failures in `CS_BS, BIOTECH_BS, BMEB_BI, BMEB_BM, EE_BS`). The new scrape may:
- **Fix some** of those failures (richer prereqs / real quarters → better placement). 
- **Surface new ones** (real quarter availability can make courses harder to schedule).

Print a clear before/after table. For any new failures, investigate one example and propose whether it's a data issue or an engine issue.

### Phase 7 — Document what changed
Update `scripts/README.md` with:
- The new fields the scraper now extracts.
- The Group A / B / C split and what's left for the second pass.
- How to run the upgraded merger.

Add `scripts/scrape_log_$(date +%Y-%m-%d).md` summarizing: total courses scraped, by group, total updates to `courses.js`, known issues, and any departments that failed and need a retry.
</deliverables>

<constraints>
- **Do not rewrite `fetch_ucsc_courses.py` from scratch** — extend it. Preserve its existing department-loop and HTML-parsing structure.
- **Never overwrite hand-tuned course entries.** Hand-tuned entries live above the `AUTO-GENERATED FROM UCSC CATALOG` marker in `courses.js`. The merger must continue to respect this.
- **Don't invent data.** If the catalog doesn't list quarters for a course, leave `quarters` as the old default (`["F","W","S"]`) and flag it in the agent's report. Same for any other missing field.
- **Be polite to the catalog server**: add a 0.5–1 second delay between page fetches inside the scraper, and use a clear `User-Agent` string. Don't run all six agents fetching simultaneously against the same host without rate-limiting — stagger them or have each agent throttle itself.
- **Use the existing dependencies** (`beautifulsoup4`, `pdfplumber`) — don't add new packages without asking.
- **No edits to Prototype 1's engine.js, majors.js, or data.js** — this task is purely a course-database refresh. Engine work is out of scope.
- **Stop and ask** before running the real merge (Phase 5 step 3) — I want to review the dry-run diff first.
</constraints>

<workflow>
1. Read `CLAUDE.md`, `scripts/README.md`, the top of `js/courses.js` (to see the marker and a few sample entries), and `scripts/fetch_ucsc_courses.py`.
2. Make a `TodoWrite` list covering Phases 1–7.
3. Execute Phase 1 (priority course list) and Phase 2 (catalog survey) sequentially.
4. Execute Phase 3 (scraper upgrade) and show me 3 sample course JSONs before going wider.
5. After my OK on the sample, execute Phase 4 with **all sub-agents dispatched in a single message** (parallel).
6. Execute Phase 5 — pause for my OK on the dry-run diff.
7. Execute Phases 6 and 7. End with the regression-test before/after table and the scrape log.
</workflow>

<success_criteria>
- Every course referenced by our 10 majors has real (non-default) `quarters` data, populated `labCoreq` where applicable, and a `catalogUrl` for verification.
- At least half of all departments on the UCSC catalog are covered in this pass; the other half is documented in `scrape_plan.md` for the next pass.
- Hand-tuned entries in `courses.js` are byte-for-byte unchanged.
- The three test scripts still run; any change in failure count is explained.
- `scripts/scrape_log_YYYY-MM-DD.md` gives me a one-glance summary of what changed.
</success_criteria>
