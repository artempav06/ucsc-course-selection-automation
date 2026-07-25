# Concentrations Design — Prototype 2

This document defines per-major concentrations and GE concentrations for the decision-tree engine. Each concentration lists real courses from `js/courses.js` — no invented entries.

The engine uses concentrations to rank `pick_n` elective choices: courses tagged with the student's chosen concentration get a scoring bonus. Required courses (`all_required`, `choose_group`, `pick_one`) are unaffected.

---

## Major Concentrations

### CS_BA — Computer Science B.A.

Source categories: `BREADTH` (pick 3 from 22), `ELECTIVE` (pick 3 from 35)

| ID | Name | Description | Courses |
|----|------|-------------|---------|
| `cs_ai_ml` | AI & Machine Learning | Artificial intelligence, machine learning, and intelligent systems | CSE 140, CSE 142, CSE 143, CSE 144, CSE 145, CSE 150 |
| `cs_systems` | Systems & Architecture | Operating systems, compilers, distributed systems, and low-level architecture | CSE 120, CSE 130, CSE 132, CSE 134, CSE 138, CSE 110A |
| `cs_web_software` | Web Dev & Software Engineering | Web applications, software design, and engineering practices | CSE 183, CSE 184, CSE 186, CSE 187, CSE 115C, CSE 115D |
| `cs_theory` | Theory & Formal Methods | Algorithms, complexity, formal languages, and mathematical CS | CSE 101M, CSE 102, CSE 103, CSE 112, CSE 114A |
| `cs_graphics_vision` | Graphics, Vision & HCI | Computer graphics, visualization, human-computer interaction | CSE 160, CSE 163, CSE 118, CSE 150, CSE 180 |
| `cs_data` | Data Science & Databases | Data management, analytics, and applied ML for data | CSE 180, CSE 181, CSE 184, CSE 144, CSE 145 |

### CS_BS — Computer Science B.S.

Source category: `UD_ELECTIVE` (pick 4 from 52)

| ID | Name | Description | Courses |
|----|------|-------------|---------|
| `cs_ai_ml` | AI & Machine Learning | Artificial intelligence, machine learning, and intelligent systems | CSE 140, CSE 142, CSE 143, CSE 144, CSE 145, CMPM 146 |
| `cs_systems` | Systems & Architecture | Operating systems, compilers, distributed systems | CSE 132, CSE 134, CSE 138, CSE 125, CSE 121, CSE 122 |
| `cs_web_software` | Web Dev & Software Engineering | Web applications, software engineering, and full-stack development | CSE 183, CSE 184, CSE 186, CSE 187, CSE 115C, CSE 115D |
| `cs_theory` | Theory & Formal Methods | Algorithms, formal methods, and mathematical CS | CSE 112, CSE 111, CSE 157, MATH 110, MATH 115, MATH 116, MATH 117 |
| `cs_graphics_games` | Graphics, Games & Vision | Computer graphics, game engineering, and visualization | CSE 160, CSE 161, CSE 162, CSE 163, CSE 168, CMPM 163, CMPM 164 |
| `cs_data` | Data Science & Databases | Data management, analytics, and ML applications | CSE 180, CSE 181, CSE 184, CSE 144, CSE 145, STAT 132 |

### CE_BS — Computer Engineering B.S.

Source category: `CONCENTRATION` (choose_group with 4 tracks, each 3-4 courses)

CE_BS already has formal concentration tracks in its curriculum. These concentrations mirror them, plus courses from the elective-adjacent space.

| ID | Name | Description | Courses |
|----|------|-------------|---------|
| `ce_system_prog` | System Programming | Low-level systems software, compilers, and OS internals | CSE 130, CSE 150, CSE 111, CSE 113, CSE 134, CSE 110A |
| `ce_computer_sys` | Computer Systems | Computer architecture, digital systems, and hardware-software interfaces | CSE 130, CSE 111, CSE 125, CSE 134, CSE 122, CSE 121 |
| `ce_networks` | Networks & Security | Network protocols, distributed systems, and security | CSE 130, CSE 150, CSE 156, CSE 156L, CSE 138 |
| `ce_digital_hw` | Digital Hardware | Digital logic design, VLSI, and hardware engineering | CSE 125, ECE 171, ECE 171L, CSE 122, ECE 173 |

### EE_BS — Electrical Engineering B.S.

Source category: `CONCENTRATION_ELECTIVES` (pick 3 from 35)

| ID | Name | Description | Courses |
|----|------|-------------|---------|
| `ee_signals_comm` | Signals & Communications | Signal processing, wireless communications, and RF design | ECE 152, ECE 153, ECE 157, ECE 136, ECE 183 |
| `ee_power_energy` | Power & Energy Systems | Power electronics, energy generation, renewable energy, and smart grids | ECE 169, ECE 170, ECE 175, ECE 175L, ECE 176, ECE 176L, ECE 177, ECE 177L, ECE 180J, ECE 181J, ECE 185 |
| `ee_embedded_controls` | Embedded Systems & Controls | Mechatronics, feedback control, UAVs, and cyber-physical systems | ECE 118, ECE 121, ECE 141, ECE 145, ECE 149, ECE 163, ECE 167 |
| `ee_electronics_photonics` | Electronics & Photonics | Analog/digital circuits, optoelectronics, and semiconductor devices | ECE 130, ECE 130L, ECE 172, ECE 173, ECE 174, ECE 178, ECE 104 |

### CSGD_BS — CS: Computer Game Design B.S.

Source category: `CGE_ELECTIVES` (pick 5 from 56)

| ID | Name | Description | Courses |
|----|------|-------------|---------|
| `gd_game_ai` | Game AI & Simulation | AI for games, procedural content generation, and simulation | CMPM 146, CMPM 147, CMPM 148, CSE 140, CSE 142, CSE 144, CSE 145 |
| `gd_graphics` | Graphics & Rendering | Real-time graphics, shaders, and visual computing | CMPM 163, CMPM 164, CSE 160, CSE 161, CSE 162, CSE 163 |
| `gd_game_systems` | Game Systems & Engineering | Game engine architecture, networking, and systems programming | CMPM 122, CMPM 123, CMPM 125, CSE 113, CSE 118, CSE 120, CSE 130, CSE 138, ECE 118 |
| `gd_narrative_design` | Narrative & Experience Design | Game narrative, interactive media, and player experience | CMPM 110, CMPM 131, CMPM 132, CMPM 150, CMPM 151, CMPM 152, CMPM 169, CMPM 172 |
| `gd_data_web` | Data & Web Games | Data-driven design, web applications, and analytics | CSE 180, CSE 181, CSE 183, CSE 184, CSE 186, CSE 187 |

### AM_BS — Applied Mathematics B.S.

Source categories: `UD_ELECTIVES` (pick 3, pool empty in majors.js), `LD_ELECTIVES` (pick 2, pool empty)

Note: AM_BS advising website lists electives not encoded in majors.js. Concentrations below are built from AM/MATH/STAT courses that exist in `courses.js` and are not already required by AM_BS.

| ID | Name | Description | Courses |
|----|------|-------------|---------|
| `am_computational` | Computational Mathematics | Scientific computing, numerical methods, and GPU programming | AM 148, AM 160, MATH 148, MATH 152, CSE 107, STAT 132 |
| `am_modeling` | Mathematical Modeling & Dynamics | Dynamical systems, fluid dynamics, chaos theory, and differential equations | AM 107, AM 115, AM 130, MATH 106, MATH 107, MATH 145 |
| `am_pure_math` | Pure & Discrete Mathematics | Algebra, analysis, topology, and number theory | MATH 100, MATH 105A, MATH 110, MATH 111A, MATH 115, MATH 116, MATH 117, MATH 124 |
| `am_data_stats` | Data Science & Statistics | Probability, inference, regression, and applied statistics | STAT 131, STAT 132, STAT 108, MATH 114, CSE 107 |

### BMEB_BI — Biomolecular Engineering (Bioinformatics)

Source category: `ELECTIVE` (pick 1 from 19)

| ID | Name | Description | Courses |
|----|------|-------------|---------|
| `bi_computational` | Computational Genomics & ML | Bioinformatics algorithms, machine learning for biology | CSE 142, CSE 144, CSE 182, AM 147, BME 132 |
| `bi_molecular` | Molecular & Structural Biology | Biochemistry, protein engineering, stem cells | BME 128, BME 128L, BME 177, BME 177L, BIOC 100B, BME 140 |
| `bi_ecology_micro` | Ecology & Microbiology | Environmental biology and microbiology applications | AM 115, BME 118, BME 130, METX 100, METX 140, BME 175 |

### BMEB_BM — Biomolecular Engineering (Biomolecular)

Source category: `ELECTIVE` (pick 1 from 19)

| ID | Name | Description | Courses |
|----|------|-------------|---------|
| `bm_molecular_eng` | Molecular Engineering | Protein engineering, stem cells, and synthetic biology | BME 128, BME 128L, BME 177, BME 177L, BME 140, BME 175 |
| `bm_genomics` | Genomics & Bioinformatics | Computational genomics, data analysis, and sequencing | BME 130, BME 132, BME 178, CSE 142, AM 147 |
| `bm_quantitative` | Quantitative & Computational Biology | Mathematical modeling, stochastic methods, and applied computation | AM 115, AM 147, BME 118, BME 122H, ECE 104, METX 100 |

### BIOTECH_BS — Biotechnology B.S.

Source category: `UD_ELECTIVES` (pick 3 from 14)

| ID | Name | Description | Courses |
|----|------|-------------|---------|
| `bt_molecular` | Molecular Biology & Genetics | Genetics, biochemistry, and molecular research techniques | BME 122H, BME 128, BME 130, BME 132, BME 140, METX 100 |
| `bt_society_ethics` | Biotech, Ethics & Society | Social and ethical dimensions of biotechnology | FMST 124, FMST 133, SOCY 121, SOCY 123, SOCY 127P |
| `bt_computational` | Computational Biotechnology | Programming, data analysis, and computational tools for biotech | BME 177, BME 178, ECE 104 |

### NDT_BS — Network & Digital Technology B.S.

Source category: `UD_ELECTIVES` (pick 4 from 70)

| ID | Name | Description | Courses |
|----|------|-------------|---------|
| `ndt_networks` | Networks & Security | Network protocols, security, and distributed systems | CSE 150, CSE 156, CSE 157, CSE 138, CSE 132, ECE 152, ECE 153 |
| `ndt_ai_data` | AI & Data Science | Machine learning, data processing, and intelligent systems | CSE 140, CSE 142, CSE 144, CSE 180, CSE 181, CSE 182, CMPM 146, STAT 131, STAT 132 |
| `ndt_embedded` | Embedded Systems & Hardware | Digital design, electronics, and hardware-software co-design | ECE 101, ECE 101L, ECE 103, ECE 103L, ECE 118, ECE 135, ECE 135L, ECE 171, ECE 171L, CSE 100, CSE 100L, CSE 125 |
| `ndt_software` | Software Engineering | Software design, web development, and programming languages | CSE 183, CSE 186, CSE 187, CSE 110A, CSE 110B, CSE 111, CSE 112, CSE 113, CSE 115A, CSE 120, CSE 121 |

### RE_BS — Robotics Engineering B.S.

Source categories: `ADV_ROBOTICS_ELECTIVE` (pick 1 from 9), `ROBOTICS_ELECTIVE` (pick 1 from 42)

| ID | Name | Description | Courses |
|----|------|-------------|---------|
| `re_autonomous` | Autonomous Systems | UAVs, motion planning, and autonomous navigation | ECE 163, ECE 149, ECE 118, CSE 150, CSE 156, ECE 240, ECE 242, ECE 243 |
| `re_controls_sensing` | Controls & Sensing | Feedback control, estimation, sensor technologies, and signal processing | ECE 141, ECE 145, ECE 167, ECE 153, ECE 152, ECE 135, ECE 135L, ECE 130, ECE 130L |
| `re_ai_vision` | AI & Computer Vision | Machine learning, intelligent perception, and brain-inspired computing | CSE 140, CSE 142, ECE 110, CMPM 146, AM 114, AM 147, ECE 215, ECE 216 |

### TIM_BS — Technology & Information Management B.S.

Source categories: `BASKIN_ENGR_ELECTIVES` (pick 2 from 68), `ECON_ELECTIVE` (pick 1 from 46)

| ID | Name | Description | Courses |
|----|------|-------------|---------|
| `tim_entrepreneurship` | Tech Entrepreneurship | Startup creation, product management, and business strategy | TIM 171, TIM 174, TIM 176, TIM 177, TIM 178, ECON 166A, ECON 135, ECON 136 |
| `tim_data_analytics` | Data Analytics & AI | Data science, machine learning, and statistical modeling | CSE 140, CSE 142, CSE 144, CSE 145, CSE 180, CSE 183, STAT 131, ECON 113, ECON 114, ECON 131 |
| `tim_systems_eng` | Systems & Infrastructure | Operating systems, networks, distributed systems, and hardware | CSE 120, CSE 130, CSE 132, CSE 138, CSE 156, ECE 101, ECE 103, ECE 118, ECE 151 |
| `tim_finance_econ` | Finance & Economics | Financial mathematics, econometrics, and economic policy | ECON 100B, ECON 101, ECON 102, ECON 104, ECON 110A, ECON 110B, ECON 111A, ECON 111B, ECON 114, ECON 115, ECON 120, ECON 128, ECON 129 |

---

## GE Concentrations (shared across all majors)

GE concentrations guide the engine when picking courses to satisfy GE codes (CC, ER, IM, MF, SI, SR, TA, PE, PR, C). For each unmet GE code, the engine prefers courses tagged with the student's chosen GE concentration.

| ID | Name | Description | Target GE codes | Courses |
|----|------|-------------|-----------------|---------|
| `ge_arts_humanities` | Arts & Humanities | Literature, philosophy, art history, music, film | TA, IM | LIT 1, PHIL 9, PHIL 11, HAVC 1, MUSC 11, FILM 20A, THEA 10, ART 10, LIT 61H, PHIL 22, PHIL 28 |
| `ge_social_sciences` | Social Sciences | Sociology, psychology, anthropology, political science, history | CC, ER, PE-H | ANTH 1, SOCY 1, SOCY 15, PSYC 1, CRES 10, HIS 10B, POLI 1, POLI 20, POLI 21, LALS 1 |
| `ge_natural_sciences` | Natural Sciences | Physics, chemistry, biology, astronomy, earth sciences | SI, MF | PHYS 6A, CHEM 1A, BIOE 20B, ASTR 1, ASTR 2, PHYS 5A, EART 1, EART 5, OCEA 1 |
| `ge_environment` | Environment & Sustainability | Environmental studies, climate, ecology, conservation | PE-E | ENVS 23, ENVS 24, ENVS 100, PHIL 28, BIOE 85, ECON 50, PHYS 80A, ECE 80J, ECE 80H |
| `ge_tech_society` | Technology & Society | Technology ethics, data literacy, societal impacts of tech | PE-T, SR | CSE 80N, CSE 3, CSE 80A, CSE 80L, CSE 80S, CSE 40, GCH 41, ECE 80E, ECE 80S, STAT 5, STAT 7, MATH 4 |
| `ge_creative` | Creative Expression | Studio art, performance, creative writing, filmmaking | PR-C, PR-E | ART 10, THEA 10, LIT 90, LIT 61L, FILM 20A, CMPM 17, MUSC 80A, MATH 50, WRIT 30, CMPM 80J |
| `ge_global_cultures` | Global Cultures & Identity | Cross-cultural studies, race/ethnicity, global perspectives | CC, ER | ANTH 1, LALS 1, CRES 10, SOCY 15, HIS 10B, POLI 21, LIT 61J, LIT 61R, LIT 80H, FMST 1 |
| `ge_health_wellness` | Health & Wellness | Psychology, public health, biology, and human behavior | PE-H, SI | PSYC 1, PSYC 2, SOCY 1, BIOL 20A, GCH 41, ECON 1, ECON 2, BIOL 80J |

---

## How the Engine Uses Concentrations

1. **Major electives** (`pick_n` categories): The engine scores each candidate course. Courses tagged with the student's chosen concentration get +100 to their score. Courses are then ranked by `concentrationBonus + rmpScore`. Top N are selected.

2. **GE courses**: For each unmet GE code, the engine filters candidates (courses with matching `ge` field). Among candidates, those tagged with the student's chosen GE concentration are preferred. Tie-break by `rmpScore`.

3. **No preference**: If the student picks "No preference," no concentration bonus is applied — the engine falls back to `rmpScore` ranking only.

4. **Course tagging**: Every course in `courses.js` gets a `concentrations: [...]` field listing all concentration IDs it belongs to. A course can appear in multiple concentrations (both within a major and across majors). Courses not in any concentration get `concentrations: []`.

---

## Summary

| Major | # Concentrations | Source pick_n categories |
|-------|-----------------|-------------------------|
| CS_BA | 6 | BREADTH, ELECTIVE |
| CS_BS | 6 | UD_ELECTIVE |
| CE_BS | 4 | CONCENTRATION (choose_group tracks) |
| EE_BS | 4 | CONCENTRATION_ELECTIVES |
| CSGD_BS | 5 | CGE_ELECTIVES |
| AM_BS | 4 | UD_ELECTIVES, LD_ELECTIVES (populated from catalog) |
| BMEB_BI | 3 | ELECTIVE |
| BMEB_BM | 3 | ELECTIVE |
| BIOTECH_BS | 3 | UD_ELECTIVES |
| NDT_BS | 4 | UD_ELECTIVES |
| RE_BS | 3 | ADV_ROBOTICS_ELECTIVE, ROBOTICS_ELECTIVE |
| TIM_BS | 4 | BASKIN_ENGR_ELECTIVES, ECON_ELECTIVE |
| **GE** | **8** | GE_REQUIREMENTS courses by ge field |
| **Total** | **57** | |
