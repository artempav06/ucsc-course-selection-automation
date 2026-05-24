# UCSC Course Selection Automation

A browser-based academic schedule planner for UC Santa Cruz students. The app builds a multi-year course plan from a student's major, concentration/interests, completed courses, prior credits, GE status, workload preferences, and target graduation timeline.

The current active app is Prototype 2, a static JavaScript site with no build step or backend.

## Current Status

Prototype 2 is the maintained version of the scheduler. It includes:

- Major-aware schedule generation for 12 UCSC engineering/science programs
- Concentration or interest-track course selection where local data supports it
- Prerequisite, corequisite, quarter-availability, senior-standing, unit-load, and graduation-requirement checks
- GE and UC requirement tracking
- Optional unofficial transcript PDF parsing in the browser
- Manual completed-course search and quick-add controls
- Export to PDF, Word, and Excel from the browser
- Node-based regression tests for the scheduling engine

Important note: this is a planning aid, not an official advising tool. Always verify final schedules with the UCSC catalog and an academic advisor.

## Supported Majors in Prototype 2

- Applied Mathematics B.S. (`AM_BS`)
- Bioinformatics B.S. (`BMEB_BI`)
- Biomolecular Engineering B.S. (`BMEB_BM`)
- Biotechnology B.A. (`BIOTECH_BS`)
- Computer Engineering B.S. (`CE_BS`)
- Computer Science B.A. (`CS_BA`)
- Computer Science B.S. (`CS_BS`)
- Computer Science: Computer Game Design B.S. (`CSGD_BS`)
- Electrical Engineering B.S. (`EE_BS`)
- Network and Digital Technology B.A. (`NDT_BS`)
- Robotics Engineering B.S. (`RE_BS`)
- Technology and Information Management B.S. (`TIM_BS`)

## Quick Start

Clone the repo and open the active app:

```bash
git clone https://github.com/artempav06/ucsc-course-selection-automation.git
cd ucsc-course-selection-automation
cd "Prototype 2 Website - source code"
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

You can also open `Prototype 2 Website - source code/index.html` directly in a browser, but the local server path is usually more reliable for transcript parsing and browser security behavior.

## Running Tests

The app has no package install step. Tests use Node.js and load the same static JavaScript files as the browser app.

```bash
cd "Prototype 2 Website - source code"
node test_toposort.js
node test_smoke.js
node test_schedule_regression.js
```

Or run everything in one command:

```bash
node test_toposort.js && node test_smoke.js && node test_schedule_regression.js
```

The regression suite currently covers the most important recent fixes, including EE, RE, and TIM schedules that previously slipped into 5-year plans or invalid prerequisite orderings.

## Project Structure

```text
.
├── Prototype 2 Website - source code/     # Active static web app
│   ├── index.html                         # App shell and wizard UI
│   ├── css/style.css                      # Styling
│   ├── js/
│   │   ├── courses.js                     # Course catalog and prereq/coreq metadata
│   │   ├── majors.js                      # Major requirements and concentration data
│   │   ├── data.js                        # GE/UC requirement metadata
│   │   ├── engine.js                      # Schedule-generation and validation engine
│   │   ├── app.js                         # Browser UI/controller logic
│   │   └── export.js                      # PDF/Word/Excel export helpers
│   ├── test_toposort.js                   # Ordering/prerequisite regression checks
│   ├── test_smoke.js                      # Broad schedule-generation smoke tests
│   └── test_schedule_regression.js        # Focused 4-year schedule regressions
│
├── scripts/                               # Catalog scraping/merge utilities and source data
├── Prototype 1 Website - source code/     # Legacy reference prototype
├── CS BA classes/                         # Early CS requirement research data
├── scripts/sample_pdfs/                   # Catalog PDFs used for extraction/reference
└── README.md
```

## How the Scheduler Works

Prototype 2 loads files in this order:

```text
courses.js → majors.js → data.js → engine.js → app.js/export.js
```

At a high level, the engine:

1. Reads the selected major and optional concentration/interest preferences.
2. Subtracts completed courses and prior credits from the remaining plan.
3. Expands major requirements, GE requirements, university requirements, and electives.
4. Chooses among `pick_one`, `pick_n`, and grouped requirement options using preference and prerequisite-cost scoring.
5. Topologically orders courses so prerequisites and corequisites are respected.
6. Places courses into future quarters while checking availability, unit limits, senior-only restrictions, capstones, and graduation targets.
7. Validates the resulting schedule and reports any missing or risky requirements.

## Recent Accuracy Improvements

Recent work focused on official-catalog alignment for EE, RE, and TIM:

- Fixed several ECE prerequisite/corequisite records that created fake chains or circular behavior.
- Recognized the EE/RE ECE 129A/B/C capstone sequence as satisfying DC.
- Recognized TIM 175 as satisfying DC.
- Improved elective choice scoring so the engine avoids unnecessarily expensive prerequisite paths when a cleaner catalog-valid option exists.
- Added regression coverage for TIM systems, TIM finance, RE autonomous, and EE signals/communications.

## Development Notes

- Keep Prototype 2 as the active implementation.
- Keep Prototype 1 only as historical/reference code unless deliberately migrating something.
- Do not add a bundler unless the project is intentionally converted away from static script tags.
- When changing requirements or course metadata, run all three Node tests before committing.
- Generated OS/editor/build artifacts should stay out of Git (`.DS_Store`, swap files, `__pycache__`, local `output/`, and `.dSYM` bundles are ignored).

## Data Sources

The project uses UCSC catalog information and local extraction scripts as its base data. Course and requirement data may still need manual verification because catalog pages, prerequisites, and enrollment restrictions can change.

Useful source/reference locations:

- UCSC General Catalog: https://catalog.ucsc.edu/en/current/general-catalog/
- `scripts/` for catalog scraping and merge utilities
- `scripts/sample_pdfs/` for saved catalog PDFs used during extraction
- `Prototype 2 Website - source code/CONCENTRATIONS.md` for local concentration/interest-track notes

## Roadmap Ideas

- Improve remaining majors/concentrations that still occasionally produce 5-year smoke-test schedules.
- Add more official catalog cross-check tests for every major.
- Add a lightweight GitHub Pages deployment workflow.
- Add advisor-facing explanations for why the engine chose each elective.
- Add clearer warnings when a generated schedule is valid but unusually heavy.

## License

No license has been selected yet.
