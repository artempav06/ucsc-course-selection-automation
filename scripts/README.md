# UCSC Catalog Scraper

Two Python scripts that download UCSC's official General Catalog and merge new
courses into `js/data.js` — so the schedule planner knows about more than just
CS major courses.

---

## TL;DR — running it locally

From this `scripts/` folder:

```bash
# One-time: install BeautifulSoup (the HTML parser)
python3 -m pip install beautifulsoup4

# Step 1: fetch ALL configured subjects and save raw JSON
python3 fetch_ucsc_courses.py

# Step 2: merge new courses into the website's data.js
python3 merge_into_data_js.py

# Step 3: open index.html in your browser — the new courses are now searchable
```

That's it. The whole process takes about 15 seconds for 12 subjects.

---

## Why run it locally instead of asking Claude?

1. **Speed**: local scraping takes ~1 second per subject. A Claude agent doing
   the same work takes 2–4 minutes per subject and sometimes times out.
2. **Zero token cost**: everything happens on your machine.
3. **Repeatable**: re-run it any time UCSC updates the catalog.
4. **Transparent**: you can read the parser and tune it yourself.

---

## What gets scraped

Every course block on a subject page, including:

| Field        | Source in catalog                          |
|--------------|--------------------------------------------|
| `code`       | `<h2 class="course-name">` → `<span>`      |
| `title`      | `<h2 class="course-name">` → text after span |
| `units`      | `<div class="credits">`                    |
| `division`   | URL segment (`lower-division`/`upper-division`) |
| `prereqs`    | `<div class="extraFields">` → "Prerequisite(s):" sentence |
| `ge`         | `<div class="genEd">` → code inside `<p>`   |
| `desc`       | First `<div class="desc">` block            |
| `catalogUrl` | The course's `<a href="...">`               |

### What's NOT scraped (yet)

- **Typical quarters offered**: The catalog subject page does **not** list
  when each course typically runs. Every course is defaulted to `["F","W","S"]`
  with a `_flags.quarters_defaulted: true` marker so you know which ones need
  review. The real offerings live on `courses.engineering.ucsc.edu` and a few
  department sites, which have a completely different structure.
- **Rate-My-Professor scores**: These are per-instructor, not per-course, and
  come from a third-party site. Left at `0`.
- **Section/requirement bucket**: All merged courses are tagged
  `section: ["FREE"]`. If a course should count toward BREADTH_A, BREADTH_B,
  CAPSTONE, DC, ELECTIVE, or a specific GE slot, you edit that by hand.
  (The scraper has no way to know which courses count for the CS major —
   that's from a totally separate document.)

---

## File layout

```
scripts/
├── fetch_ucsc_courses.py    # scraper: catalog → JSON
├── merge_into_data_js.py    # merger: JSON → data.js
├── README.md                # this file
└── output/                  # generated, gitignored if you want
    ├── courses_raw.json          # flat list of all parsed courses
    ├── courses_by_subject.json   # same data grouped by subject
    └── courses.data.js           # standalone JS view for inspection
```

After running the merger, `Prototype 1 Website - source code/js/data.js`
will have a clearly-marked block at the bottom of the `COURSES` object:

```js
// === AUTO-GENERATED FROM UCSC CATALOG (do not hand-edit below) ===
// 523 courses auto-merged from UCSC General Catalog
"AM 3": { ... },
"AM 6": { ... },
...
```

Everything above that marker stays untouched. A backup is saved to
`data.js.bak` on every merge.

---

## Command reference

### `fetch_ucsc_courses.py`

```bash
python3 fetch_ucsc_courses.py                  # fetch all configured subjects
python3 fetch_ucsc_courses.py am anth bme      # fetch specific ones by code
python3 fetch_ucsc_courses.py --list           # show the configured subject list
```

To add more subjects, edit the `SUBJECTS` list at the top of the script.
Find the slug by visiting the subject page and copying the last segment
of the URL, e.g. `chem-chemistry-and-biochemistry`.

### `merge_into_data_js.py`

```bash
python3 merge_into_data_js.py                  # merge new courses into data.js
python3 merge_into_data_js.py --dry-run        # preview only, no file writes
python3 merge_into_data_js.py --force          # also overwrite existing entries
```

By default the merger **never touches a course that's already in data.js**,
so your hand-tuned CS courses (with proper `section: ["CS_LD_CORE"]` etc.)
are safe. Use `--force` only if you want to wipe and re-import everything.

---

## Parser accuracy

Tested on AM through BME (650 courses):

| Metric | Result |
|---|---|
| Courses successfully parsed | 650 / 650 (100%) |
| Prereqs detected | 286 (44% of courses) |
| GE codes detected | 188 (all 13 GE categories present) |
| Upper/lower split | 544 / 106 |

### Known edge cases

1. **Complex prereq logic** — UCSC sometimes writes things like
   `"A or B; C or D; or PHYS 116A"` where the trailing `"or PHYS 116A"` is an
   alternative to the **entire** clause. The parser treats it as a separate
   AND-group, which is slightly wrong. This affects ~5 courses across all 12
   subjects.
2. **Placement exam scores** — text like `"score of 400 on the MPE"` is
   correctly ignored (the parser excludes MPE as a fake course code).
3. **Permission-only prereqs** — text like `"permission of instructor"`
   produces an empty `prereqs: []`, which is the correct schema behavior.
4. **Cross-listed courses** — if a course appears under two subjects
   (e.g. CMPM 179 = ARTG 179), it gets parsed twice. The merger de-duplicates
   by code, keeping the first one seen.

If you find a course with badly-parsed prereqs, just edit data.js by hand —
the auto-generated block is human-readable and the merger won't overwrite
your edits unless you pass `--force`.

---

## Expanding coverage

To add a new subject:

1. Visit `https://catalog.ucsc.edu/en/current/general-catalog/courses`
2. Click the subject you want (e.g. Chemistry)
3. Copy the URL slug (`chem-chemistry-and-biochemistry`)
4. Add a line to `SUBJECTS` in `fetch_ucsc_courses.py`:

   ```python
   ("CHEM", "chem-chemistry-and-biochemistry"),
   ```

5. Re-run `fetch_ucsc_courses.py` and `merge_into_data_js.py`.

---

---

## Script 2: Major Curriculum Chart Parser

### TL;DR

```bash
# One-time: install pdfplumber (PDF text extraction)
python3 -m pip install pdfplumber

# Step 1: download + parse curriculum chart PDFs → JSON
python3 fetch_ucsc_majors.py                  # all 12 majors
python3 fetch_ucsc_majors.py am_bs ce_bs      # specific ones by ID

# Step 2: merge into data.js as new REQUIREMENTS objects
python3 merge_majors_into_data_js.py
python3 merge_majors_into_data_js.py --dry-run  # preview first
```

### What it does

Downloads the official curriculum chart PDFs from
[undergrad.engineering.ucsc.edu](https://undergrad.engineering.ucsc.edu/curriculum-charts/curriculum-charts-2025-2026/)
and extracts major requirement categories (calculus, core courses, breadth,
DC, capstone, electives, etc.) into a JSON structure matching the
`CS_BA_REQUIREMENTS` schema already in `data.js`.

### Configured majors (12)

| ID | Major |
|---|---|
| `AM_BS` | Applied Mathematics B.S. |
| `BMEB_BM` | Biomolecular Engineering (Biomolecular) |
| `BMEB_BI` | Biomolecular Engineering (Bioinformatics) |
| `BIOTECH_BS` | Biotechnology B.S. |
| `CE_BS` | Computer Engineering B.S. |
| `CS_BA` | Computer Science B.A. |
| `CS_BS` | Computer Science B.S. |
| `CSGD_BS` | CS: Computer Game Design B.S. |
| `EE_BS` | Electrical Engineering B.S. |
| `NDT_BS` | Network and Digital Technology B.S. |
| `RE_BS` | Robotics Engineering B.S. |
| `TIM_BS` | Technology and Information Management B.S. |

### Command reference

```bash
python3 fetch_ucsc_majors.py                  # fetch all
python3 fetch_ucsc_majors.py am_bs ce_bs      # fetch specific IDs
python3 fetch_ucsc_majors.py --list           # show configured majors
python3 fetch_ucsc_majors.py --offline        # reparse cached PDFs only

python3 merge_majors_into_data_js.py          # merge into data.js
python3 merge_majors_into_data_js.py --dry-run
python3 merge_majors_into_data_js.py --force  # overwrite existing entries
```

### Output files

```
scripts/output/
├── majors_raw.json      # full parse results (includes _raw_text, _flags)
├── majors_by_id.json    # same data keyed by major ID
└── majors.data.js       # compact JS view for inspection
```

### Accuracy and limitations

Curriculum chart PDFs are **visual flowcharts**, not linear text. The parser
uses pdfplumber for text extraction, which is inherently noisy. The approach
is to mine for specific requirement keywords (DC, Capstone, Breadth, etc.)
rather than reconstruct the visual layout.

| Metric | Result (5 majors tested) |
|---|---|
| Categories extracted | 49 |
| Total courses found | 229 |
| Uncategorized courses | 28 (~12%) |
| Majors with 0 uncategorized | 1 (Biotech) |

**What works well:**
- Calculus sequences (19-series vs 20-series)
- Linear algebra, differential equations, discrete math
- DC and Capstone courses
- Physics, chemistry, biology/BME blocks
- Programming course requirements

**What needs manual review:**
- Upper-division elective lists (PDF layout scrambles them)
- Concentration tracks (CE has 4 sub-tracks)
- `_flags` field in the JSON tells you which majors need attention
- `uncategorizedCodes` lists courses the parser couldn't bucket

After merging, the new `REQUIREMENTS` objects appear at the bottom of
`data.js`. The merger **never touches existing objects** like
`CS_BA_REQUIREMENTS`, so your hand-tuned entries are safe.

---

## Troubleshooting

**"No module named bs4"** → Install it: `python3 -m pip install beautifulsoup4`

**"HTTP 404"** → The subject slug is wrong. Use `--list` to see what's configured,
or visit the catalog page and copy the URL.

**"Could not find const COURSES"** → Something modified `data.js` in a way
that removed the declaration. Restore from the `.bak` backup.

**Script feels slow** → It's rate-limited to 1 request/second to be polite
to UCSC's server. Remove or lower `RATE_LIMIT_SECONDS` in the script if you
understand the implications.

**"No module named pdfplumber"** → Install it:
`python3 -m pip install pdfplumber`

**Major parser output looks wrong** → Check `output/majors_raw.json` for the
`_flags` and `_raw_text` fields. The raw text shows exactly what pdfplumber
extracted, and `uncategorizedCodes` lists courses the parser couldn't bucket.
Edit the generated `REQUIREMENTS` object in `data.js` by hand — the merger
won't overwrite your edits unless you pass `--force`.
