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
    //   CS/CE/EE/NDT → CSE 115A / 115 / 185E / 185S / 195
    //   CSGD          → CMPM 170 / 171
    //   Bioengineering → BME 185
    //   Applied Math  → AM 170A
    courses: ["CSE 115A", "CSE 115", "CSE 185E", "CSE 185S", "CSE 195",
              "CMPM 170", "CMPM 171", "BME 185", "AM 170A"],
    note: "Satisfied by your major's DC requirement.",
    autoSatisfiedBy: ["CSE 115A", "CSE 115", "CSE 185E", "CSE 185S", "CSE 195",
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
// INTEREST AREAS (major elective suggestions)
// Maps student major interests to recommended upper-division courses.
// ------------------------------------------------------------

const INTEREST_AREAS = {
  "ai_ml": {
    name: "AI & Machine Learning",
    icon: "brain",
    courses: ["CSE 140", "CSE 142", "CSE 143", "CSE 144", "CSE 145", "CSE 240"]
  },
  "systems": {
    name: "Systems & Architecture",
    icon: "server",
    courses: ["CSE 120", "CSE 130", "CSE 132", "CSE 134", "CSE 138", "ECE 103"]
  },
  "web_software": {
    name: "Web Dev & Software Engineering",
    icon: "globe",
    courses: ["CSE 183", "CSE 184", "CSE 186", "CSE 187", "CSE 115A", "CSE 115C"]
  },
  "theory": {
    name: "Theory & Formal Methods",
    icon: "math",
    courses: ["CSE 101M", "CSE 102", "CSE 103", "CSE 112", "CSE 114A", "MATH 110", "MATH 115", "MATH 116"]
  },
  "graphics_vision": {
    name: "Graphics, Vision & HCI",
    icon: "monitor",
    courses: ["CSE 160", "CSE 163", "CSE 118", "CSE 150"]
  },
  "data": {
    name: "Data Science & Databases",
    icon: "database",
    courses: ["CSE 180", "CSE 181", "CSE 184", "CSE 144", "CSE 145", "STAT 131", "STAT 132"]
  }
};


// ------------------------------------------------------------
// GE INTEREST AREAS (for GE course suggestions)
// Maps student GE preferences to favored GE codes + courses.
// Used by engine.pickGECoursesFromDB to rank candidates.
// ------------------------------------------------------------

const GE_INTEREST_AREAS = {
  "ge_arts_humanities": {
    name: "Arts & Humanities",
    description: "Literature, philosophy, art, music, theater",
    geCodes: ["TA", "IM"],
    courses: [
      "LIT 1", "PHIL 9", "HAVC 1", "ART 10", "MUSC 11", "THEA 10",
      "PHIL 1", "PHIL 11", "LIT 10", "LIT 25", "LIT 26"
    ]
  },
  "ge_social_sciences": {
    name: "Social Sciences",
    description: "Sociology, psychology, anthropology, political science, history",
    geCodes: ["CC", "ER", "PE-H"],
    courses: [
      "SOCY 1", "PSYC 1", "ANTH 1", "POLI 1", "HIS 10B", "HIS 80A",
      "SOCY 15", "PSYC 2", "ANTH 2", "LALS 1", "CRES 10"
    ]
  },
  "ge_natural_sciences": {
    name: "Natural Sciences",
    description: "Physics, chemistry, biology, earth sciences, astronomy",
    geCodes: ["SI", "MF"],
    courses: [
      "PHYS 6A", "CHEM 1A", "BIOE 20B", "ASTR 1", "ASTR 2",
      "PHYS 5A", "PHYS 5B", "CHEM 1B", "BIOE 20A"
    ]
  },
  "ge_ethics_environment": {
    name: "Ethics & Environment",
    description: "Environmental studies, technology ethics, social justice",
    geCodes: ["PE-E", "PE-T", "PR-E"],
    courses: [
      "ENVS 23", "CSE 80N", "SOCY 30", "ANTH 148",
      "ENVS 24", "ENVS 100", "POLI 40"
    ]
  },
  "ge_writing_comm": {
    name: "Writing & Communication",
    description: "Composition, rhetoric, linguistics, technical writing",
    geCodes: ["C", "PR-C"],
    courses: [
      "WRIT 1", "WRIT 2", "WRIT 10", "LING 1", "LING 50",
      "CSE 185E", "APLX 20"
    ]
  }
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
