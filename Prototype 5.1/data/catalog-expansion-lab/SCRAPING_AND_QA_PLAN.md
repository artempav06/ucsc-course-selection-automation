# UCSC Course Database Expansion Scraping and QA Plan

> **For Hermes:** Use this as the active plan before expanding Prototype 5.1 course data. Keep candidate data in this lab folder until quality gates pass.

**Goal:** Expand the UCSC scheduler course database from the official UCSC General Catalog while preserving the current `COURSES` JSON schema and preventing inaccurate data from entering production.

**Architecture:** Use a script-first, evidence-preserving pipeline: crawl official catalog pages, save raw/indexed evidence, parse into normalized candidate JSON, validate candidate records against the existing schema, compare candidates to official text, then merge only approved records into `js/courses.js`. Browser/Chrome extensions may be useful for spot-checking awkward pages, but they should not be the main pipeline because the project needs repeatable diffs and regression tests.

**Tech Stack:** Node.js scripts, JSON audit artifacts, existing static JS `COURSES` object, focused validator tests, official UCSC Catalog HTML pages.

---

## Recommended approach

### Best option: repeatable Node scraper + QA reports

Use scripts as the primary extraction method because they are repeatable, diffable, and can be tested. The scraper should be conservative: if a field cannot be parsed confidently, it should store the raw official text and mark the field `needsReview` instead of guessing.

Why this is best:

- Same official source can be re-crawled later when the catalog changes.
- We can produce exact missing-course lists by department.
- We can preserve official evidence next to every parsed field.
- We can run automated quality gates before touching `js/courses.js`.
- We can review diffs before merge.

### Secondary option: Chrome/extension scraping

Chrome extensions can be useful for manual inspection, one-off table extraction, or pages whose HTML is weird. They are not ideal as the primary pipeline because they are harder to rerun, harder to test, and easier to accidentally mix manual clipboard edits with generated data.

Use Chrome/browser only for:

- Spot-checking pages where parser confidence is low.
- Visual confirmation of pages with unusual layout.
- Debugging why a parser missed fields.
- Exporting a small example page to design parser rules.

Do not use Chrome/extension output as the final source unless it is saved as raw evidence and passed through the same normalizer/validator.

---

## Existing `COURSES` schema to preserve

Candidate course records should match the current shape used in `js/courses.js`:

```js
"CSE 20": {
  concentrations: [],
  title: "...",
  units: 5,
  division: "lower" | "upper" | "graduate",
  prereqs: [["COURSE A", "COURSE B"], ["COURSE C"]],
  concurrentPrereqs: [["COURSE D"]],
  labCoreq: "COURSE L", // when applicable
  ge: "MF", // or null/empty when no GE
  quarters: ["F", "W", "S", "SU"],
  catalogUrl: "https://catalog.ucsc.edu/...",
  desc: "Official catalog description text...",
  section: ["FREE"],
  rmpScore: 0,
  officialPrereqText: "Official prerequisite text exactly as catalog states it.",
  prereqNotes: ["..."],
  enrollmentText: "...", // optional if current DB uses it for restrictions
  restrictedMajors: ["..."] // only when confidently mapped to local major IDs
}
```

Important: not every field is present on every existing course. The normalizer should preserve current conventions but avoid inventing values.

---

## Field extraction rules

### Required fields for every candidate

- `code`: exact course code, e.g. `CSE 20`.
- `title`: exact title from the official course page/link.
- `units`: numeric credits from the official page.
- `division`: derive from page path and course number.
- `catalogUrl`: exact official current catalog URL.
- `desc`: official description text, cleaned but not rewritten.
- `officialPrereqText`: exact prerequisite/eligibility text if present, otherwise empty string.
- `prereqNotes`: include notes for non-course eligibility such as placement exams, AP/IB, writing/composition satisfaction, instructor consent, or major restrictions.

### Optional fields to parse carefully

- `ge`: only if the page clearly lists a General Education code.
- `quarters`: only if official page clearly exposes terms/quarter offered; otherwise leave empty or preserve existing convention. Do not guess from historical offerings.
- `prereqs`: encode concrete course prerequisites only when the official text clearly names course alternatives.
- `concurrentPrereqs`: use only when official text says prior/concurrent or previous/concurrent.
- `labCoreq`: use only for explicit lecture/lab corequisite relationships.
- `restrictedMajors`: only map to local scheduler major IDs when exact mapping is known; otherwise preserve the official restriction text in notes.

### Non-course eligibility rule

Official prerequisites often include non-course eligibility language:

- placement exam / MPE
- AP / IB score
- Entry Level Writing Requirement
- Composition requirement satisfaction
- instructor consent
- major/senior standing restrictions

Do not turn those into fake course prerequisites unless we already have a project-approved local representation, such as ELWR/composition mapping through `WRIT 1`/`WRIT 2` in specific known cases. Preserve exact text in `officialPrereqText` and `prereqNotes`.

---

## Quality gates before merge

A candidate batch must pass all of these before merging into `js/courses.js`:

1. **Source gate:** every candidate has a live `catalogUrl` returning HTTP 200.
2. **Schema gate:** every candidate validates against the expected `COURSES` record shape.
3. **No hallucination gate:** every title, unit count, description, GE, and prerequisite text is traceable to raw official page text.
4. **Prerequisite reference gate:** every concrete prerequisite course mentioned in `prereqs`, `concurrentPrereqs`, or `labCoreq` must either exist in current local DB or be included in the same candidate batch.
5. **No fake prerequisites gate:** placement/AP/writing/major/permission language is not converted into hard course prerequisites unless explicitly approved by project policy.
6. **Duplicate/cross-list gate:** duplicate course codes and cross-listed pages are detected and represented once unless the scheduler intentionally needs separate records.
7. **Diff gate:** generated candidates produce a readable before/after coverage report by department.
8. **Scheduler regression gate:** after merge, existing tests still pass: `node tools/validate-data.js`, `node test_prerequisite_correctness.js`, `node test_smoke.js`, and relevant scheduler tests.
9. **Human review gate:** any low-confidence parser result remains in the lab and is not merged automatically.

---

## Implementation phases

### Phase 1: Lab setup and baseline reports

**Objective:** Create the lab holder and freeze a baseline of current coverage.

**Files:**
- Create: `data/catalog-expansion-lab/README.md`
- Create: `data/catalog-expansion-lab/SCRAPING_AND_QA_PLAN.md`
- Later create: `data/catalog-expansion-lab/local-vs-official-coverage-report.json`

**Verification:**

Run from `Prototype 5.1`:

```bash
git status --short -- 'data/catalog-expansion-lab'
```

Expected: new lab docs are visible as uncommitted files.

### Phase 2: Fresh official catalog indexer

**Objective:** Build or adapt a script that crawls the official catalog course root and all 87 department pages into lab artifacts.

**Files:**
- Create/modify: `scripts/catalog_expansion/build_live_catalog_index.js`
- Output: `data/catalog-expansion-lab/official-catalog-live-index.json`
- Output: `data/catalog-expansion-lab/missing-courses-by-department.json`

**Rules:**

- Use only `catalog.ucsc.edu/en/current/general-catalog/courses` URLs.
- Store department slug, department display text, course code, title, division path, and URL.
- Detect alternate pages for the same code.
- Compare against current `js/courses.js`.

**Verification:**

```bash
node scripts/catalog_expansion/build_live_catalog_index.js
```

Expected:

- Finds around 87 department pages.
- Finds around 6,172 official course codes based on current catalog.
- Reports around 4,194 exact local real matches and around 1,978 missing official courses.

### Phase 3: Detail fetcher with raw evidence

**Objective:** Fetch each missing course page and preserve raw/parsed evidence.

**Files:**
- Create: `scripts/catalog_expansion/fetch_missing_course_details.js`
- Output: `data/catalog-expansion-lab/official-course-details.json`
- Optional output: `data/catalog-expansion-lab/official-course-raw-pages/*.html`

**Parser should extract:**

- title
- units/credits
- description
- GE code if present
- prerequisite text exactly
- enrollment/restriction text exactly
- repeatability/credits notes if relevant

**Verification:**

```bash
node scripts/catalog_expansion/fetch_missing_course_details.js --department CSE --limit 5
```

Expected: five missing CSE courses produce detail records with raw official URLs and parser confidence flags.

### Phase 4: Candidate normalizer

**Objective:** Convert parsed official details into candidate `COURSES`-schema JSON without merging.

**Files:**
- Create: `scripts/catalog_expansion/normalize_candidate_courses.js`
- Output: `data/catalog-expansion-lab/candidate-expanded-courses.json`

**Rules:**

- Keep `section: ["FREE"]` only if current app convention requires general searchable electives by default; otherwise flag for review.
- Set `rmpScore: 0` by default to match existing DB convention.
- Encode only concrete course prerequisites.
- Put uncertain text in `prereqNotes` / `needsReview`.

**Verification:**

```bash
node scripts/catalog_expansion/normalize_candidate_courses.js --department CSE --limit 5
```

Expected: output records are valid JSON and match existing course field style.

### Phase 5: QA validator

**Objective:** Reject bad candidate records before merge.

**Files:**
- Create: `scripts/catalog_expansion/validate_candidate_courses.js`
- Output: `data/catalog-expansion-lab/qa-report.md`

**Checks:**

- Required fields present.
- URLs are current official URLs.
- Units numeric and plausible.
- Description non-empty unless official page genuinely lacks one.
- Prerequisite references exist locally or in candidate batch.
- Low-confidence prerequisite parsing is flagged.
- No candidate overwrites an existing local course unless explicitly in update mode.

**Verification:**

```bash
node scripts/catalog_expansion/validate_candidate_courses.js
```

Expected: report shows pass/fail counts and blocks merge if critical failures exist.

### Phase 6: Small pilot merge only after QA

**Objective:** Merge one small, low-risk department or subset after QA proves the pipeline works.

Good pilot choices:

- A tiny missing department like `MSE` or `FIL`, because review is small.
- Or a scheduler-relevant but small subset of missing `STAT`/`MATH`, if Artem wants planner impact first.

Avoid starting with all CSE/ECE/MATH because those have many prerequisites and high scheduler risk.

**Verification after merge:**

```bash
node tools/validate-data.js
node test_prerequisite_correctness.js
node test_smoke.js
git diff --check -- 'js/courses.js' 'data/catalog-expansion-lab'
```

Expected: no hard validation/test failures; any warnings are classified.

---

## Answer to “should Artem do this separately?”

No, Artem should not need to do this manually. Hermes can build the scripts and run the pipeline locally. Artem’s help is most useful for policy decisions and spot-review, not repetitive scraping.

Ask Artem only when:

- The official catalog text is ambiguous.
- A prerequisite includes non-course eligibility and we need a scheduler policy decision.
- A department should be prioritized for product value.
- A parser confidence report finds weird layouts that need human confirmation.

---

## Recommended first expansion order

1. Build the lab pipeline and QA report first.
2. Pilot on tiny missing departments: `FIL`, `MSE`, maybe `GRAD` only if graduate courses should matter.
3. Then prioritize scheduler/useful departments:
   - `STAT` because local coverage is very low and useful for many majors.
   - `MATH` because many prerequisites and major paths depend on it.
   - `PHYS`, `CHEM`, `BME`, `BIOE`, `BIOL` for STEM completeness.
   - `CSE`/`ECE` only after prerequisite parser QA is strong, because bad prereqs can seriously harm schedules.
4. Finally broaden to arts/humanities/social-science missing electives and GE options.

---

## Do not do

- Do not paste scraped data directly into `js/courses.js`.
- Do not use LLM guesses for prerequisites, units, GE, or descriptions.
- Do not infer quarter availability unless official text gives it clearly.
- Do not silently drop official prerequisite alternatives that refer to courses not yet local.
- Do not convert placement/AP/instructor consent into hard course prerequisites automatically.
- Do not merge a huge all-department batch without small pilot verification first.
