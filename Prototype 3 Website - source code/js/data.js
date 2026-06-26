// ============================================================
// data.js  --  UCSC Course Selection Automation
// Shared data: GE requirements, UC requirements, interest areas,
// display config, and helper functions.
//
// Course catalog is in courses.js
// Major requirements are in majors.js
// ============================================================


// ------------------------------------------------------------
// GENERAL EDUCATION REQUIREMENTS (UCSC 2025-26)
// Each category requires 1 course (5 credits min)
// Some major courses satisfy GE codes automatically.
// ------------------------------------------------------------

const GE_REQUIREMENTS = [
  {
    id: "CC", name: "Cross-Cultural Analysis",
    needed: 1,
    courses: ["ANTH 1", "SOCY 15", "LALS 1"],
    note: "One 5-credit course."
  },
  {
    id: "ER", name: "Ethnicity and Race",
    needed: 1,
    courses: ["CRES 10", "HIS 10B"],
    note: "One 5-credit course."
  },
  {
    id: "IM", name: "Interpreting Arts and Media",
    needed: 1,
    courses: ["HAVC 1", "FILM 20A", "MUSC 11"],
    note: "One 5-credit course."
  },
  {
    id: "MF", name: "Mathematical and Formal Reasoning",
    needed: 1,
    courses: ["CSE 16", "CSE 20", "MATH 19A", "MATH 20A", "AM 10", "MATH 21"],
    note: "Usually satisfied by CS major courses (CSE 16 or MATH 19A).",
    autoSatisfiedBy: ["CSE 16", "MATH 19A", "MATH 20A", "CSE 20"]
  },
  {
    id: "SI", name: "Scientific Inquiry",
    needed: 1,
    courses: ["PHYS 6A", "CHEM 1A", "BIOE 20B"],
    note: "One 5-credit lab science course."
  },
  {
    id: "SR", name: "Statistical Reasoning",
    needed: 1,
    courses: ["CSE 40"],
    note: "Usually satisfied by CSE 40.",
    autoSatisfiedBy: ["CSE 40"]
  },
  {
    id: "TA", name: "Textual Analysis",
    needed: 1,
    courses: ["WRIT 1", "WRIT 1E", "LIT 1", "PHIL 9"],
    note: "One 5-credit course."
  },
  {
    id: "PE", name: "Perspectives",
    needed: 1,
    courses: ["ENVS 23", "PSYC 1", "SOCY 1", "CSE 80N"],
    subcategories: ["PE-E", "PE-H", "PE-T"],
    note: "One course from PE-E (Environmental), PE-H (Human Behavior), or PE-T (Technology)."
  },
  {
    id: "PR", name: "Practice",
    needed: 1,
    courses: ["ART 10", "THEA 10", "CSE 183", "CSE 115D", "FILM 170A", "CSE 187"],
    subcategories: ["PR-E", "PR-C"],
    note: "One course from PR-E (Collaborative), PR-C (Creative), or PR-S (Service)."
  },
  {
    id: "C", name: "Composition",
    needed: 1,
    courses: ["WRIT 2"],
    note: "Rhetoric and Inquiry (WRIT 2). Prereq: WRIT 1 or equivalent."
  },
  {
    id: "DC", name: "Disciplinary Communication",
    needed: 1,
    // Covers DC courses across all supported majors:
    //   CS/CE/NDT     → CSE 115A / 185E / 185S / 195
    //   EE/RE         → ECE 129A/B/C senior capstone sequence
    //   TIM           → TIM 175
    //   CSGD          → CMPM 170 / 171
    //   Bioengineering → BME 185
    //   Applied Math  → AM 170A
    courses: ["CSE 115A", "CSE 185E", "CSE 185S", "CSE 195",
              "ECE 129A", "ECE 129B", "ECE 129C", "TIM 175",
              "CMPM 170", "CMPM 171", "BME 185", "AM 170A"],
    note: "Satisfied by your major's DC requirement.",
    autoSatisfiedBy: ["CSE 115A", "CSE 185E", "CSE 185S", "CSE 195",
                      "ECE 129A", "ECE 129B", "ECE 129C", "TIM 175",
                      "CMPM 170", "CMPM 171", "BME 185", "AM 170A"]
  }
];


// ------------------------------------------------------------
// UC SYSTEM REQUIREMENTS
// Required for all UC students regardless of major.
// ------------------------------------------------------------

const UC_REQUIREMENTS = [
  {
    id: "ELWR",
    name: "Entry Level Writing",
    needed: 1,
    courses: ["WRIT 1", "WRIT 1E"],
    note: "Satisfied by placement exam, AP score, or WRIT 1 / WRIT 1E.",
    canBeSatisfiedByPlacement: true
  },
  {
    id: "AH",
    name: "American History",
    needed: 1,
    courses: ["HIS 10B", "HIS 80A"],
    note: "One course in American History."
  },
  {
    id: "AI",
    name: "American Institutions",
    needed: 1,
    courses: ["HIS 10B", "HIS 80A", "POLI 20"],
    note: "One course in American Institutions. HIS 10B satisfies both AH and AI."
  }
];


// ------------------------------------------------------------
// CONCENTRATIONS
// Per-major concentrations and GE concentrations.
// The engine uses these to rank pick_n elective choices:
// courses tagged with the student's chosen concentration get a bonus.
// ------------------------------------------------------------

const CONCENTRATIONS = {
  major: {
    CS_BA: [
      { id: "cs_ai_ml", name: "AI & Machine Learning", description: "Artificial intelligence, machine learning, and intelligent systems", courses: ["CSE 140","CSE 142","CSE 143","CSE 144","CSE 145","CSE 150"] },
      { id: "cs_systems", name: "Systems & Architecture", description: "Operating systems, compilers, distributed systems, and low-level architecture", courses: ["CSE 120","CSE 130","CSE 132","CSE 134","CSE 138","CSE 110A"] },
      { id: "cs_web_software", name: "Web Dev & Software Engineering", description: "Web applications, software design, and engineering practices", courses: ["CSE 183","CSE 184","CSE 186","CSE 187","CSE 115C","CSE 115D"] },
      { id: "cs_theory", name: "Theory & Formal Methods", description: "Algorithms, complexity, formal languages, and mathematical CS", courses: ["CSE 101M","CSE 102","CSE 103","CSE 112","CSE 114A"] },
      { id: "cs_graphics_vision", name: "Graphics, Vision & HCI", description: "Computer graphics, visualization, human-computer interaction", courses: ["CSE 160","CSE 163","CSE 118","CSE 150","CSE 180"] },
      { id: "cs_data", name: "Data Science & Databases", description: "Data management, analytics, and applied ML for data", courses: ["CSE 180","CSE 181","CSE 184","CSE 144","CSE 145"] }
    ],
    CS_BS: [
      { id: "cs_ai_ml", name: "AI & Machine Learning", description: "Artificial intelligence, machine learning, and intelligent systems", courses: ["CSE 140","CSE 142","CSE 143","CSE 144","CSE 145","CMPM 146"] },
      { id: "cs_systems", name: "Systems & Architecture", description: "Operating systems, compilers, distributed systems", courses: ["CSE 132","CSE 134","CSE 138","CSE 125","CSE 121","CSE 122"] },
      { id: "cs_web_software", name: "Web Dev & Software Engineering", description: "Web applications, software engineering, and full-stack development", courses: ["CSE 183","CSE 184","CSE 186","CSE 187","CSE 115C","CSE 115D"] },
      { id: "cs_theory", name: "Theory & Formal Methods", description: "Algorithms, formal methods, and mathematical CS", courses: ["CSE 112","CSE 111","CSE 157","MATH 110","MATH 115","MATH 116","MATH 117"] },
      { id: "cs_graphics_games", name: "Graphics, Games & Vision", description: "Computer graphics, game engineering, and visualization", courses: ["CSE 160","CSE 161","CSE 162","CSE 163","CSE 168","CMPM 163","CMPM 164"] },
      { id: "cs_data", name: "Data Science & Databases", description: "Data management, analytics, and ML applications", courses: ["CSE 180","CSE 181","CSE 184","CSE 144","CSE 145","STAT 132"] }
    ],
    CE_BS: [
      { id: "ce_system_prog", name: "System Programming", description: "Low-level systems software, compilers, and OS internals", courses: ["CSE 130","CSE 150","CSE 111","CSE 113","CSE 134","CSE 110A"] },
      { id: "ce_computer_sys", name: "Computer Systems", description: "Computer architecture, digital systems, and hardware-software interfaces", courses: ["CSE 130","CSE 111","CSE 125","CSE 134","CSE 122","CSE 121"] },
      { id: "ce_networks", name: "Networks & Security", description: "Network protocols, distributed systems, and security", courses: ["CSE 130","CSE 150","CSE 156","CSE 156L","CSE 138"] },
      { id: "ce_digital_hw", name: "Digital Hardware", description: "Digital logic design, VLSI, and hardware engineering", courses: ["CSE 125","ECE 171","ECE 171L","CSE 122","ECE 173"] }
    ],
    EE_BS: [
      { id: "ee_signals_comm", name: "Signals & Communications", description: "Signal processing, wireless communications, and RF design", courses: ["ECE 152","ECE 153","ECE 157","ECE 136","ECE 183"] },
      { id: "ee_power_energy", name: "Power & Energy Systems", description: "Power electronics, energy generation, renewable energy, and smart grids", courses: ["ECE 169","ECE 170","ECE 175","ECE 175L","ECE 176","ECE 176L","ECE 177","ECE 177L","ECE 180J","ECE 181J","ECE 185"] },
      { id: "ee_embedded_controls", name: "Embedded Systems & Controls", description: "Mechatronics, feedback control, UAVs, and cyber-physical systems", courses: ["ECE 118","ECE 121","ECE 141","ECE 145","ECE 149","ECE 163","ECE 167"] },
      { id: "ee_electronics_photonics", name: "Electronics & Photonics", description: "Analog/digital circuits, optoelectronics, and semiconductor devices", courses: ["ECE 130","ECE 130L","ECE 172","ECE 173","ECE 174","ECE 178","ECE 104"] }
    ],
    CSGD_BS: [
      { id: "gd_game_ai", name: "Game AI & Simulation", description: "AI for games, procedural content generation, and simulation", courses: ["CMPM 146","CMPM 147","CMPM 148","CSE 140","CSE 142","CSE 144","CSE 145"] },
      { id: "gd_graphics", name: "Graphics & Rendering", description: "Real-time graphics, shaders, and visual computing", courses: ["CMPM 163","CMPM 164","CSE 160","CSE 161","CSE 162","CSE 163"] },
      { id: "gd_game_systems", name: "Game Systems & Engineering", description: "Game engine architecture, networking, and systems programming", courses: ["CMPM 122","CMPM 123","CMPM 125","CSE 113","CSE 118","CSE 120","CSE 130","CSE 138","ECE 118"] },
      { id: "gd_narrative_design", name: "Narrative & Experience Design", description: "Game narrative, interactive media, and player experience", courses: ["CMPM 110","CMPM 131","CMPM 132","CMPM 150","CMPM 151","CMPM 152","CMPM 169","CMPM 172"] },
      { id: "gd_data_web", name: "Data & Web Games", description: "Data-driven design, web applications, and analytics", courses: ["CSE 180","CSE 181","CSE 183","CSE 184","CSE 186","CSE 187"] }
    ],
    AM_BS: [
      { id: "am_computational", name: "Computational Mathematics", description: "Scientific computing, numerical methods, and GPU programming", courses: ["AM 148","AM 160","MATH 148","MATH 152","CSE 107","STAT 132"] },
      { id: "am_modeling", name: "Mathematical Modeling & Dynamics", description: "Dynamical systems, fluid dynamics, chaos theory, and differential equations", courses: ["AM 107","AM 115","AM 130","MATH 106","MATH 107","MATH 145"] },
      { id: "am_pure_math", name: "Pure & Discrete Mathematics", description: "Algebra, analysis, topology, and number theory", courses: ["MATH 100","MATH 105A","MATH 110","MATH 111A","MATH 115","MATH 116","MATH 117","MATH 124"] },
      { id: "am_data_stats", name: "Data Science & Statistics", description: "Probability, inference, regression, and applied statistics", courses: ["STAT 131","STAT 132","STAT 108","MATH 114","CSE 107"] }
    ],
    BMEB_BI: [
      { id: "bi_computational", name: "Computational Genomics & ML", description: "Bioinformatics algorithms, machine learning for biology", courses: ["CSE 142","CSE 144","CSE 182","AM 147","BME 132"] },
      { id: "bi_molecular", name: "Molecular & Structural Biology", description: "Biochemistry, protein engineering, stem cells", courses: ["BME 128","BME 128L","BME 177","BME 177L","BIOC 100B","BME 140"] },
      { id: "bi_ecology_micro", name: "Ecology & Microbiology", description: "Environmental biology and microbiology applications", courses: ["AM 115","BME 118","BME 130","METX 100","METX 140","BME 175"] }
    ],
    BMEB_BM: [
      { id: "bm_molecular_eng", name: "Molecular Engineering", description: "Protein engineering, stem cells, and synthetic biology", courses: ["BME 128","BME 128L","BME 177","BME 177L","BME 140","BME 175"] },
      { id: "bm_genomics", name: "Genomics & Bioinformatics", description: "Computational genomics, data analysis, and sequencing", courses: ["BME 130","BME 132","BME 178","CSE 142","AM 147"] },
      { id: "bm_quantitative", name: "Quantitative & Computational Biology", description: "Mathematical modeling, stochastic methods, and applied computation", courses: ["AM 115","AM 147","BME 118","BME 122H","ECE 104","METX 100"] }
    ],
    BIOTECH_BS: [
      { id: "bt_molecular", name: "Molecular Biology & Genetics", description: "Genetics, biochemistry, and molecular research techniques", courses: ["BME 122H","BME 128","BME 130","BME 132","BME 140","METX 100"] },
      { id: "bt_society_ethics", name: "Biotech, Ethics & Society", description: "Social and ethical dimensions of biotechnology", courses: ["FMST 124","FMST 133","SOCY 121","SOCY 123","SOCY 127P"] },
      { id: "bt_computational", name: "Computational Biotechnology", description: "Programming, data analysis, and computational tools for biotech", courses: ["BME 177","BME 178","ECE 104"] }
    ],
    NDT_BS: [
      { id: "ndt_networks", name: "Networks & Security", description: "Network protocols, security, and distributed systems", courses: ["CSE 150","CSE 156","CSE 157","CSE 138","CSE 132","ECE 152","ECE 153"] },
      { id: "ndt_ai_data", name: "AI & Data Science", description: "Machine learning, data processing, and intelligent systems", courses: ["CSE 140","CSE 142","CSE 144","CSE 180","CSE 181","CSE 182","CMPM 146","STAT 131","STAT 132"] },
      { id: "ndt_embedded", name: "Embedded Systems & Hardware", description: "Digital design, electronics, and hardware-software co-design", courses: ["ECE 101","ECE 101L","ECE 103","ECE 103L","ECE 118","ECE 135","ECE 135L","ECE 171","ECE 171L","CSE 100","CSE 100L","CSE 125"] },
      { id: "ndt_software", name: "Software Engineering", description: "Software design, web development, and programming languages", courses: ["CSE 183","CSE 186","CSE 187","CSE 110A","CSE 110B","CSE 111","CSE 112","CSE 113","CSE 115A","CSE 120","CSE 121"] }
    ],
    RE_BS: [
      { id: "re_autonomous", name: "Autonomous Systems", description: "UAVs, motion planning, and autonomous navigation", courses: ["ECE 163","ECE 149","ECE 118","CSE 150","CSE 156","ECE 240","ECE 242","ECE 243"] },
      { id: "re_controls_sensing", name: "Controls & Sensing", description: "Feedback control, estimation, sensor technologies, and signal processing", courses: ["ECE 141","ECE 145","ECE 167","ECE 153","ECE 152","ECE 135","ECE 135L","ECE 130","ECE 130L"] },
      { id: "re_ai_vision", name: "AI & Computer Vision", description: "Machine learning, intelligent perception, and brain-inspired computing", courses: ["CSE 140","CSE 142","ECE 110","CMPM 146","AM 114","AM 147","ECE 215","ECE 216"] }
    ],
    TIM_BS: [
      { id: "tim_entrepreneurship", name: "Tech Entrepreneurship", description: "Startup creation, product management, and business strategy", courses: ["TIM 171","TIM 174","TIM 176","TIM 177","TIM 178","ECON 166A","ECON 135","ECON 136"] },
      { id: "tim_data_analytics", name: "Data Analytics & AI", description: "Data science, machine learning, and statistical modeling", courses: ["CSE 140","CSE 142","CSE 144","CSE 145","CSE 180","CSE 183","STAT 131","ECON 113","ECON 114","ECON 131"] },
      { id: "tim_systems_eng", name: "Systems & Infrastructure", description: "Operating systems, networks, distributed systems, and hardware", courses: ["CSE 120","CSE 130","CSE 132","CSE 138","CSE 156","ECE 101","ECE 103","ECE 118","ECE 151"] },
      { id: "tim_finance_econ", name: "Finance & Economics", description: "Financial mathematics, econometrics, and economic policy", courses: ["ECON 100B","ECON 101","ECON 102","ECON 104","ECON 110A","ECON 110B","ECON 111A","ECON 111B","ECON 114","ECON 115","ECON 120","ECON 128","ECON 129"] }
    ]
  },
  ge: [
    { id: "ge_arts_humanities", name: "Arts & Humanities", description: "Literature, philosophy, art history, music, film", geCodes: ["TA","IM"], courses: ["LIT 1","PHIL 9","PHIL 11","HAVC 1","MUSC 11","FILM 20A","THEA 10","ART 10","LIT 61H","PHIL 22","PHIL 28"] },
    { id: "ge_social_sciences", name: "Social Sciences", description: "Sociology, psychology, anthropology, political science, history", geCodes: ["CC","ER","PE-H"], courses: ["ANTH 1","SOCY 1","SOCY 15","PSYC 1","CRES 10","HIS 10B","HIS 80A","POLI 1","POLI 20","POLI 21","LALS 1"] },
    { id: "ge_natural_sciences", name: "Natural Sciences", description: "Physics, chemistry, biology, astronomy, earth sciences", geCodes: ["SI","MF"], courses: ["PHYS 6A","CHEM 1A","BIOE 20B","ASTR 1","ASTR 2","PHYS 5A","EART 1","EART 5","OCEA 1"] },
    { id: "ge_environment", name: "Environment & Sustainability", description: "Environmental studies, climate, ecology, conservation", geCodes: ["PE-E"], courses: ["ENVS 23","ENVS 24","ENVS 100","PHIL 28","BIOE 85","ECON 50","PHYS 80A","ECE 80J","ECE 80H"] },
    { id: "ge_tech_society", name: "Technology & Society", description: "Technology ethics, data literacy, societal impacts of tech", geCodes: ["PE-T","SR"], courses: ["CSE 80N","CSE 3","CSE 80A","CSE 80L","CSE 80S","CSE 40","GCH 41","ECE 80E","ECE 80S","STAT 5","STAT 7","MATH 4"] },
    { id: "ge_creative", name: "Creative Expression", description: "Studio art, performance, creative writing, filmmaking", geCodes: ["PR-C","PR-E"], courses: ["ART 10","THEA 10","LIT 90","LIT 61L","FILM 20A","CMPM 17","MUSC 80A","MATH 50","WRIT 30","CMPM 80J"] },
    { id: "ge_global_cultures", name: "Global Cultures & Identity", description: "Cross-cultural studies, race/ethnicity, global perspectives", geCodes: ["CC","ER"], courses: ["ANTH 1","LALS 1","CRES 10","SOCY 15","HIS 10B","POLI 21","LIT 61J","LIT 61R","LIT 80H","FMST 1"] },
    { id: "ge_health_wellness", name: "Health & Wellness", description: "Psychology, public health, biology, and human behavior", geCodes: ["PE-H","SI"], courses: ["PSYC 1","PSYC 2","SOCY 1","BIOL 20A","GCH 41","ECON 1","ECON 2","BIOL 80J"] }
  ]
};


// ------------------------------------------------------------
// QUARTER LABELS (for schedule display)
// ------------------------------------------------------------

const QUARTER_LABELS = {
  "F": "Fall",
  "W": "Winter",
  "S": "Spring",
  "SU": "Summer"
};


// ------------------------------------------------------------
// COLOR MAP for course cards (by requirement type)
// ------------------------------------------------------------

const SECTION_COLORS = {
  "CS_LD_CORE":  { bg: "#E3F2FD", border: "#1565C0", label: "CS Core" },
  "MATH_CALC":   { bg: "#E8F5E9", border: "#2E7D32", label: "Math" },
  "MATH_LIN_ALG":{ bg: "#E8F5E9", border: "#2E7D32", label: "Math" },
  "UD_CORE":     { bg: "#E3F2FD", border: "#1565C0", label: "CS Core" },
  "BREADTH_A":   { bg: "#FFF3E0", border: "#E65100", label: "Breadth" },
  "BREADTH_B":   { bg: "#FFF3E0", border: "#E65100", label: "Breadth" },
  "DC":          { bg: "#F3E5F5", border: "#6A1B9A", label: "DC" },
  "CAPSTONE":    { bg: "#FCE4EC", border: "#AD1457", label: "Capstone" },
  "ELECTIVE":    { bg: "#E0F7FA", border: "#00695C", label: "Elective" },
  "GE":          { bg: "#FFFDE7", border: "#F9A825", label: "GE" },
  "FREE":        { bg: "#F5F5F5", border: "#9E9E9E", label: "Free" }
};


// Helper: get the catalog URL for any course
function getCatalogUrl(courseCode) {
  const parts = courseCode.split(" ");
  if (parts.length < 2) return "https://catalog.ucsc.edu/en/current/general-catalog";
  const dept = parts[0].toLowerCase();
  const num  = parts[1].toLowerCase();

  const deptSlugs = {
    "cse":  "computer-science-and-engineering",
    "math": "mathematics",
    "am":   "applied-mathematics",
    "phys": "physics",
    "chem": "chemistry-and-biochemistry",
    "bioe": "ecology-and-evolutionary-biology",
    "writ": "writing",
    "lit":  "literature",
    "phil": "philosophy",
    "anth": "anthropology",
    "socy": "sociology",
    "lals": "latin-american-and-latino-studies",
    "cres": "critical-race-and-ethnic-studies",
    "havc": "history-of-art-and-visual-culture",
    "film": "film-and-digital-media",
    "musc": "music",
    "envs": "environmental-studies",
    "psyc": "psychology",
    "art":  "art",
    "thea": "theater-arts",
    "his":  "history",
    "poli": "politics",
    "ling": "linguistics",
    "econ": "economics",
    "bme":  "biomolecular-engineering",
    "biol": "molecular-cell-and-developmental-biology",
    "bioc": "chemistry-and-biochemistry",
    "ece":  "electrical-and-computer-engineering",
    "stat": "statistics",
    "cmpm": "computational-media",
    "eart": "earth-and-planetary-sciences",
    "artg": "art-and-design-games-and-playable-media",
    "metx": "microbiology-and-environmental-toxicology",
    "tim":  "technology-information-management",
    "astr": "astronomy-and-astrophysics",
    "aplx": "applied-linguistics"
  };

  const slug = deptSlugs[dept] || dept;
  return `https://catalog.ucsc.edu/en/current/general-catalog/courses/${slug}/${dept}-${num}/`;
}
