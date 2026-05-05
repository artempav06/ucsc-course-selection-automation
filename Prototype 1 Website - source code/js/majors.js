// ============================================================
// majors.js  --  UCSC Course Selection Automation
// Major requirement definitions. Each major has categories
// that list required/elective courses.
//
// To add more majors, run:
//   python3 scripts/fetch_ucsc_majors.py
//   python3 scripts/merge_majors_into_data_js.py
// ============================================================


// ------------------------------------------------------------
// CS BA MAJOR REQUIREMENTS (hand-tuned, verified against catalog)
// ------------------------------------------------------------

const CS_BA_REQUIREMENTS = {
  id: "CS_BA",
  name: "Computer Science B.A.",
  catalogUrl: "https://catalog.ucsc.edu/current/general-catalog/academic-units/baskin-engineering/computer-science-and-engineering/computer-science-ba/",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.8,

  categories: [
    {
      id: "LD_CORE",
      name: "Lower Division CS Core",
      type: "all_required",
      courses: ["CSE 12", "CSE 16", "CSE 20", "CSE 30", "CSE 40"],
      description: "All five lower-division CS core courses are required."
    },
    {
      id: "MATH_CALC",
      name: "Calculus Sequence",
      type: "choose_group",
      groups: [
        { label: "19-series", courses: ["MATH 19A", "MATH 19B"] },
        { label: "20-series (Honors)", courses: ["MATH 20A", "MATH 20B"] }
      ],
      description: "Choose one calculus sequence: MATH 19A+19B or MATH 20A+20B."
    },
    {
      id: "MATH_LIN_ALG",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one linear algebra course."
    },
    {
      id: "UD_CORE",
      name: "Upper Division Core (Algorithms)",
      type: "pick_one",
      courses: ["CSE 101", "CSE 101P"],
      description: "Choose CSE 101 or CSE 101P (practice-based)."
    },
    {
      id: "BREADTH",
      name: "Breadth Courses",
      type: "pick_n",
      n: 3,
      coursesA: ["CSE 101M","CSE 102","CSE 103","CSE 112","CSE 114A","CSE 118",
                 "CSE 120","CSE 140","CSE 142","CSE 143","CSE 144","CSE 150","CSE 183","CSE 184"],
      coursesB: ["CSE 110A","CSE 130","CSE 132","CSE 134","CSE 138","CSE 160","CSE 180","CSE 186"],
      description: "Pick 3 courses total from Breadth Lists A and B combined."
    },
    {
      id: "DC",
      name: "Disciplinary Communication",
      type: "pick_one",
      courses: ["CSE 115A", "CSE 185E", "CSE 185S", "CSE 195"],
      description: "Pick one DC course. Cannot also count as an elective.",
      note: "DC course cannot double-count as an upper-division elective."
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement (Capstone/Exit)",
      type: "pick_one",
      courses: ["CSE 110A","CSE 115C","CSE 115D","CSE 134","CSE 138","CSE 140",
                "CSE 143","CSE 144","CSE 145","CSE 160","CSE 163","CSE 183",
                "CSE 184","CSE 181","CSE 187","CSE 195"],
      description: "Complete one capstone course or senior thesis for the exit requirement.",
      note: "A capstone course can also count toward breadth or elective requirements."
    },
    {
      id: "ELECTIVE",
      name: "Upper Division Electives",
      type: "pick_n",
      n: 2,
      courses: ["CSE 109","CSE 101M","CSE 102","CSE 103","CSE 110A","CSE 112",
                "CSE 114A","CSE 118","CSE 120","CSE 130","CSE 132","CSE 134",
                "CSE 138","CSE 140","CSE 142","CSE 143","CSE 144","CSE 145",
                "CSE 150","CSE 160","CSE 163","CSE 180","CSE 181","CSE 183",
                "CSE 184","CSE 186","CSE 187",
                "MATH 110","MATH 115","MATH 116","LING 112","FILM 170A"],
      description: "Two additional upper-division elective courses from the approved list.",
      note: "DC course cannot be used here. Capstone CAN double-count."
    }
  ]
};


// ------------------------------------------------------------
// MAJOR REGISTRY
// Maps major IDs to their requirements object.
// The wizard dropdown and engine use this to find the right
// requirements for whatever major the student selects.
// ------------------------------------------------------------

// === AUTO-GENERATED MAJOR REQUIREMENTS (do not hand-edit below) ===
// 9 majors auto-merged from curriculum chart PDFs.
// Re-run scripts/fetch_ucsc_majors.py + merge_majors_into_data_js.py to refresh.
// These are best-effort parses — review _flags in majors_raw.json
// and hand-edit any incorrect categories.

const AM_BS_REQUIREMENTS = {
  id: "AM_BS",
  name: "Applied Mathematics B.S.",
  catalogUrl: null,
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/Applied-Math-Major_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "MATH_CALC",
      name: "Calculus Sequence",
      type: "choose_group",
      groups: [
        { label: "19-series", courses: ["MATH 19A", "MATH 19B"] },
        { label: "20-series (Honors)", courses: ["MATH 20A", "MATH 20B"] },
      ],
      description: "Choose one calculus sequence: 19-series or 20-series.",
    },
    {
      id: "MATH_LIN_ALG",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one linear algebra course.",
    },
    {
      id: "MATH_MULTIVAR",
      name: "Multivariable Calculus",
      type: "pick_one",
      courses: ["AM 30", "MATH 23A", "MATH 23B", "MATH 22"],
      description: "Choose one multivariable calculus course/sequence.",
    },
    {
      id: "MATH_DIFFEQ",
      name: "Differential Equations",
      type: "pick_one",
      courses: ["AM 20", "MATH 24"],
      description: "Choose one differential equations course.",
    },
    {
      id: "MATH_DISCRETE",
      name: "Discrete Mathematics",
      type: "all_required",
      courses: ["CSE 16"],
      description: "Discrete mathematics is required.",
    },
    {
      id: "STAT",
      name: "Statistics / Probability",
      type: "all_required",
      courses: ["STAT 131"],
      description: "Required statistics/probability courses.",
    },
    {
      id: "PROGRAMMING",
      name: "Programming",
      type: "all_required",
      courses: ["CSE 20", "CSE 13S", "ECE 13"],
      description: "Required programming courses.",
      note: "Some may be pick-one alternatives — see PDF.",
    },
    {
      id: "UD_CORE",
      name: "Upper Division Core",
      type: "all_required",
      courses: ["ECON 22P", "AM 100", "AM 112", "AM 114", "AM 129", "STAT 131", "AM 10"],
      description: "All upper-division core courses are required.",
    },
    {
      id: "UD_ELECTIVE",
      name: "Upper Division Electives",
      type: "pick_n",
      courses: ["AM 129", "AM 209", "AM 112", "AM 147", "AM 195", "AM 170A"],
      n: 3,
      description: "Choose 3 upper-division elective courses.",
    },
    {
      id: "LD_ELECTIVE",
      name: "Lower Division Electives",
      type: "pick_n",
      courses: ["AM 30", "CSE 20", "CSE 13S", "MATH 23B", "ECE 13", "ASTR 19", "ECON 22P"],
      n: 2,
      description: "Choose lower-division elective courses.",
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["AM 170A"],
      description: "Complete one DC course. Cannot double-count as elective.",
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement (Capstone)",
      type: "pick_one",
      courses: ["AM 195"],
      description: "Complete one capstone course or senior thesis.",
    },
  ]
};

const BMEB_BM_REQUIREMENTS = {
  id: "BMEB_BM",
  name: "Biomolecular Engineering and Bioinformatics (Biomolecular)",
  catalogUrl: null,
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/BMEB-Biomoleular-25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "MATH_CALC",
      name: "Calculus",
      type: "all_required",
      courses: ["MATH 19A", "MATH 19B"],
      description: "Required calculus courses.",
    },
    {
      id: "MATH_LIN_ALG",
      name: "Linear Algebra",
      type: "all_required",
      courses: ["AM 10"],
      description: "Linear algebra is required.",
    },
    {
      id: "STAT",
      name: "Statistics / Probability",
      type: "all_required",
      courses: ["STAT 131"],
      description: "Required statistics/probability courses.",
    },
    {
      id: "PROGRAMMING",
      name: "Programming",
      type: "all_required",
      courses: ["CSE 20"],
      description: "Required programming courses.",
      note: "Some may be pick-one alternatives — see PDF.",
    },
    {
      id: "PHYS_CORE",
      name: "Physics",
      type: "all_required",
      courses: ["PHYS 5A", "PHYS 5L", "PHYS 15A", "PHYS 5B", "PHYS 5M"],
      description: "Required physics courses.",
    },
    {
      id: "CHEM_CORE",
      name: "Chemistry",
      type: "all_required",
      courses: ["CHEM 3A", "CHEM 3B", "CHEM 3BL", "CHEM 8A", "CHEM 8B"],
      description: "Required chemistry courses.",
      note: "Biomolecular track requires organic chemistry through CHEM 8B.",
    },
    {
      id: "BIO_CORE",
      name: "Biology & Bioengineering",
      type: "all_required",
      courses: ["BIOL 20A", "BIOE 20B", "BME 80G", "BME 101", "BME 105", "BME 122H", "BME 128", "BME 130", "BME 132", "BME 140", "BME 175", "BME 185"],
      description: "Required biology and bioengineering courses.",
      note: "Some courses may be pick-one alternatives — see PDF.",
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["BME 185", "CSE 185E"],
      description: "Complete one DC course. Cannot double-count as elective.",
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement (Capstone)",
      type: "pick_one",
      courses: ["BME 160", "STAT 131", "CSE 185E", "BME 205", "BME 129A", "BME 180", "BME 175", "BME 195"],
      description: "Complete one capstone course or senior thesis.",
    },
  ]
};

const BMEB_BI_REQUIREMENTS = {
  id: "BMEB_BI",
  name: "Biomolecular Engineering and Bioinformatics (Bioinformatics)",
  catalogUrl: null,
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/BMEB-BINF-25-26-1.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "MATH_CALC",
      name: "Calculus",
      type: "all_required",
      courses: ["MATH 19A", "MATH 19B"],
      description: "Required calculus courses.",
    },
    {
      id: "MATH_LIN_ALG",
      name: "Linear Algebra",
      type: "all_required",
      courses: ["AM 10"],
      description: "Linear algebra is required.",
    },
    {
      id: "MATH_MULTIVAR",
      name: "Multivariable Calculus",
      type: "all_required",
      courses: ["AM 30"],
      description: "Required multivariable calculus courses.",
    },
    {
      id: "MATH_DISCRETE",
      name: "Discrete Mathematics",
      type: "all_required",
      courses: ["CSE 16"],
      description: "Discrete mathematics is required.",
    },
    {
      id: "STAT",
      name: "Statistics / Probability",
      type: "all_required",
      courses: ["STAT 131", "STAT 132"],
      description: "Required statistics/probability courses.",
    },
    {
      id: "PROGRAMMING",
      name: "Programming",
      type: "all_required",
      courses: ["CSE 20", "CSE 13S", "CSE 30", "CSE 12"],
      description: "Required programming courses.",
      note: "Some may be pick-one alternatives — see PDF.",
    },
    {
      id: "CHEM_CORE",
      name: "Chemistry",
      type: "all_required",
      courses: ["CHEM 3A", "CHEM 3B", "CHEM 3BL"],
      description: "Required chemistry courses.",
      note: "Bioinformatics track requires introductory chemistry.",
    },
    {
      id: "BIO_CORE",
      name: "Biology & Bioengineering",
      type: "all_required",
      courses: ["BIOL 20A", "BME 101", "BME 105", "BME 110", "BME 122H", "BME 130", "BME 132", "BME 140", "BME 175", "BME 185"],
      description: "Required biology and bioengineering courses.",
      note: "Some courses may be pick-one alternatives — see PDF.",
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["BME 185"],
      description: "Complete one DC course. Cannot double-count as elective.",
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement (Capstone)",
      type: "pick_one",
      courses: ["BME 175", "BME 195"],
      description: "Complete one capstone course or senior thesis.",
    },
  ]
};

const BIOTECH_BS_REQUIREMENTS = {
  id: "BIOTECH_BS",
  name: "Biotechnology B.S.",
  catalogUrl: null,
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/Biotechnology-25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "LD_CORE",
      name: "Lower Division Required",
      type: "all_required",
      courses: ["BME 5", "BME 80H", "MATH 2", "AM 3", "CHEM 3A", "ECE 80B", "BME 18", "CHEM 4A", "CHEM 4AL", "BIOL 20A", "BME 80G"],
      description: "Required lower-division courses.",
    },
    {
      id: "STAT",
      name: "Statistics / Probability",
      type: "all_required",
      courses: ["STAT 7", "STAT 7L"],
      description: "Required statistics/probability courses.",
    },
    {
      id: "PROGRAMMING",
      name: "Programming",
      type: "all_required",
      courses: ["CSE 20"],
      description: "Required programming courses.",
      note: "Some may be pick-one alternatives — see PDF.",
    },
    {
      id: "CHEM_CORE",
      name: "Chemistry",
      type: "all_required",
      courses: ["CHEM 3A", "CHEM 4A", "CHEM 4AL"],
      description: "Required chemistry courses.",
      note: "Some majors allow choosing between CHEM 3-series and CHEM 4-series.",
    },
    {
      id: "BIO_CORE",
      name: "Biology & Bioengineering",
      type: "all_required",
      courses: ["BME 5", "BME 18", "BIOL 20A", "BME 80G", "BME 110", "BME 122H", "BME 128", "BME 130"],
      description: "Required biology and bioengineering courses.",
      note: "Some courses may be pick-one alternatives — see PDF.",
    },
    {
      id: "UD_CORE",
      name: "Upper Division Core",
      type: "all_required",
      courses: ["BME 122H", "BME 128", "BME 130", "BME 132", "BME 140", "BME 105", "BME 177", "BME 178", "ECE 104", "METX 100", "SOCY 121", "BME 110"],
      description: "All upper-division core courses are required.",
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["BME 185"],
      description: "Complete one DC course. Cannot double-count as elective.",
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement (Capstone)",
      type: "pick_one",
      courses: ["BME 175"],
      description: "Complete one capstone course or senior thesis.",
    },
  ]
};

const CE_BS_REQUIREMENTS = {
  id: "CE_BS",
  name: "Computer Engineering B.S.",
  catalogUrl: null,
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/CE_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "MATH_CALC",
      name: "Calculus",
      type: "all_required",
      courses: ["MATH 19A", "MATH 19B"],
      description: "Required calculus courses.",
    },
    {
      id: "MATH_LIN_ALG",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one linear algebra course.",
    },
    {
      id: "MATH_DIFFEQ",
      name: "Differential Equations",
      type: "pick_one",
      courses: ["AM 20", "MATH 24"],
      description: "Choose one differential equations course.",
    },
    {
      id: "STAT",
      name: "Statistics / Probability",
      type: "all_required",
      courses: ["STAT 131"],
      description: "Required statistics/probability courses.",
    },
    {
      id: "PROGRAMMING",
      name: "Programming",
      type: "all_required",
      courses: ["CSE 20", "CSE 13S", "ECE 13", "CSE 30", "CSE 12"],
      description: "Required programming courses.",
      note: "Some may be pick-one alternatives — see PDF.",
    },
    {
      id: "CORE",
      name: "Core Courses",
      type: "all_required",
      courses: ["CSE 20", "CSE 30", "CSE 12", "CSE 13S", "ECE 13", "CSE 100", "CSE 100L", "CSE 101", "CSE 120", "CSE 121", "ECE 101", "ECE 101L"],
      description: "All core courses are required.",
    },
    {
      id: "PHYS_CORE",
      name: "Physics",
      type: "all_required",
      courses: ["PHYS 5A", "PHYS 5L", "PHYS 5C", "PHYS 5N", "PHYS 5B", "PHYS 5M"],
      description: "Required physics courses.",
    },
    {
      id: "CONCENTRATION",
      name: "Concentration Courses",
      type: "pick_n",
      courses: ["CSE 125", "CSE 130", "CSE 225", "ECE 171", "ECE 171L", "CSE 150", "CSE 111", "CSE 122", "CSE 134", "CSE 222A", "CSE 156", "CSE 156L", "CSE 220", "CSE 228A", "CSE 113", "ECE 173", "ECE 174", "CSE 110A", "CSE 123A", "CSE 127A", "ECE 118", "CSE 195", "CSE 121", "CSE 185E", "CSE 100", "CSE 100L", "ECE 13"],
      n: 4,
      description: "Choose one concentration track and complete its courses.",
      note: "Concentration-specific — see PDF for track details.",
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["CSE 185E", "CSE 195"],
      description: "Complete one DC course. Cannot double-count as elective.",
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement (Capstone)",
      type: "pick_one",
      courses: ["CSE 123A", "CSE 127A", "ECE 118", "CSE 195", "CSE 121", "CSE 125", "CSE 185E", "CSE 100", "CSE 100L", "ECE 13"],
      description: "Complete one capstone course or senior thesis.",
    },
  ]
};

const CS_BS_REQUIREMENTS = {
  id: "CS_BS",
  name: "Computer Science B.S.",
  catalogUrl: null,
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/CS_BS_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "LD_CORE",
      name: "Lower Division Required",
      type: "all_required",
      courses: ["CSE 16", "CSE 20", "CSE 12", "CSE 40", "CSE 30", "CSE 13S", "ECE 30", "CSE 101"],
      description: "Required lower-division courses (math alternatives handled by separate categories).",
    },
    {
      id: "MATH_CALC",
      name: "Calculus Sequence",
      type: "choose_group",
      groups: [
        { label: "19-series", courses: ["MATH 19A", "MATH 19B"] },
        { label: "20-series (Honors)", courses: ["MATH 20A", "MATH 20B"] },
      ],
      description: "Choose one calculus sequence: 19-series or 20-series.",
    },
    {
      id: "MATH_LIN_ALG",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one linear algebra course.",
    },
    {
      id: "MATH_MULTIVAR",
      name: "Multivariable Calculus",
      type: "pick_one",
      courses: ["AM 30", "MATH 23A"],
      description: "Choose one multivariable calculus course/sequence.",
    },
    {
      id: "MATH_DISCRETE",
      name: "Discrete Mathematics",
      type: "all_required",
      courses: ["CSE 16"],
      description: "Discrete mathematics is required.",
    },
    {
      id: "STAT",
      name: "Statistics / Probability",
      type: "all_required",
      courses: ["STAT 131", "STAT 132"],
      description: "Required statistics/probability courses.",
    },
    {
      id: "PROGRAMMING",
      name: "Programming",
      type: "all_required",
      courses: ["CSE 20", "CSE 13S", "CSE 30", "CSE 12"],
      description: "Required programming courses.",
      note: "Some may be pick-one alternatives — see PDF.",
    },
    {
      id: "UD_ELECTIVE",
      name: "Upper Division Electives",
      type: "pick_n",
      courses: ["CSE 101M", "AM 30", "CSE 195", "CSE 115A", "CSE 185S", "CSE 185E", "CSE 110B", "CSE 115C", "CSE 115D", "CSE 121", "CSE 134", "CSE 138", "CSE 140"],
      n: 2,
      description: "Choose 2 upper-division elective courses.",
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["CSE 115A", "CSE 115", "CSE 185E", "CSE 185S", "CSE 195"],
      description: "Complete one DC course. Cannot double-count as elective.",
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement (Capstone)",
      type: "pick_one",
      courses: ["CSE 115A", "CSE 185S", "CSE 185E", "CSE 110B", "CSE 115C", "CSE 115D", "CSE 121", "CSE 134", "CSE 138", "CSE 140", "CSE 143", "CSE 144", "CSE 145", "CSE 156", "CSE 156L", "CSE 157", "AM 114", "CSE 195"],
      description: "Complete one capstone course or senior thesis.",
    },
  ]
};

const CSGD_BS_REQUIREMENTS = {
  id: "CSGD_BS",
  name: "Computer Science: Computer Game Design B.S.",
  catalogUrl: null,
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/CSGD_BS_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "MATH_CALC",
      name: "Calculus",
      type: "all_required",
      courses: ["MATH 19A", "MATH 19B"],
      description: "Required calculus courses.",
    },
    {
      id: "MATH_DISCRETE",
      name: "Discrete Mathematics",
      type: "all_required",
      courses: ["CSE 16"],
      description: "Discrete mathematics is required.",
    },
    {
      id: "PROGRAMMING",
      name: "Programming",
      type: "all_required",
      courses: ["CSE 13S", "ECE 13", "CSE 30", "CSE 12"],
      description: "Required programming courses.",
      note: "Some may be pick-one alternatives — see PDF.",
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["CMPM 170", "CMPM 171"],
      description: "Complete one DC course. Cannot double-count as elective.",
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement (Capstone)",
      type: "pick_one",
      courses: ["CMPM 170", "CMPM 171", "CMPM 120", "CMPM 121", "CMPM 176", "CMPM 130"],
      description: "Complete one capstone course or senior thesis.",
    },
  ]
};

const EE_BS_REQUIREMENTS = {
  id: "EE_BS",
  name: "Electrical Engineering B.S.",
  catalogUrl: null,
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/EE_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "MATH_CALC",
      name: "Calculus",
      type: "all_required",
      courses: ["MATH 19A", "MATH 19B"],
      description: "Required calculus courses.",
    },
    {
      id: "MATH_LIN_ALG",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one linear algebra course.",
    },
    {
      id: "MATH_MULTIVAR",
      name: "Multivariable Calculus",
      type: "pick_one",
      courses: ["AM 30", "MATH 23A", "MATH 23B"],
      description: "Choose one multivariable calculus course/sequence.",
    },
    {
      id: "MATH_DIFFEQ",
      name: "Differential Equations",
      type: "pick_one",
      courses: ["AM 20", "MATH 24"],
      description: "Choose one differential equations course.",
    },
    {
      id: "MATH_DISCRETE",
      name: "Discrete Mathematics",
      type: "all_required",
      courses: ["CSE 16"],
      description: "Discrete mathematics is required.",
    },
    {
      id: "STAT",
      name: "Statistics / Probability",
      type: "all_required",
      courses: ["STAT 131"],
      description: "Required statistics/probability courses.",
    },
    {
      id: "PROGRAMMING",
      name: "Programming",
      type: "all_required",
      courses: ["CSE 20", "ECE 13", "CSE 30", "CSE 12"],
      description: "Required programming courses.",
      note: "Some may be pick-one alternatives — see PDF.",
    },
    {
      id: "PHYS_CORE",
      name: "Physics",
      type: "all_required",
      courses: ["PHYS 5B", "PHYS 5M", "PHYS 5A", "PHYS 5L", "PHYS 5C", "PHYS 5N", "PHYS 5D"],
      description: "Required physics courses.",
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["CSE 185E", "CSE 195"],
      description: "Complete one DC course (required for all UCSC engineering majors).",
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement (Capstone)",
      type: "pick_one",
      courses: ["ECE 129A", "ECE 195", "CSE 100", "CSE 100L", "ECE 129B", "ECE 118"],
      description: "Complete one capstone course or senior thesis.",
    },
  ]
};

const NDT_BS_REQUIREMENTS = {
  id: "NDT_BS",
  name: "Network and Digital Technology B.S.",
  catalogUrl: null,
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/Network-Digital-Technology_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "MATH_CALC",
      name: "Calculus",
      type: "all_required",
      courses: ["MATH 19A", "MATH 19B"],
      description: "Required calculus courses.",
    },
    {
      id: "MATH_LIN_ALG",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one linear algebra course.",
    },
    {
      id: "MATH_MULTIVAR",
      name: "Multivariable Calculus",
      type: "pick_one",
      courses: ["AM 30", "MATH 23A"],
      description: "Choose one multivariable calculus course/sequence.",
    },
    {
      id: "MATH_DIFFEQ",
      name: "Differential Equations",
      type: "pick_one",
      courses: ["AM 20", "MATH 24"],
      description: "Choose one differential equations course.",
    },
    {
      id: "MATH_DISCRETE",
      name: "Discrete Mathematics",
      type: "all_required",
      courses: ["CSE 16"],
      description: "Discrete mathematics is required.",
    },
    {
      id: "PROGRAMMING",
      name: "Programming",
      type: "all_required",
      courses: ["CSE 20", "CSE 13S", "ECE 13", "CSE 30", "CSE 12"],
      description: "Required programming courses.",
      note: "Some may be pick-one alternatives — see PDF.",
    },
    {
      id: "PHYS_CORE",
      name: "Physics",
      type: "all_required",
      courses: ["PHYS 5A", "PHYS 5L", "PHYS 5C", "PHYS 5N"],
      description: "Required physics courses.",
    },
    {
      id: "UD_ELECTIVE",
      name: "Upper Division Electives",
      type: "pick_n",
      courses: ["CSE 20", "CSE 12", "CSE 30", "CSE 13S", "ECE 13", "MATH 3", "MATH 19A", "CSE 101", "CSE 150", "CSE 12", "CSE 16", "CSE 185E", "CSE 115A", "CSE 156", "CSE 156L", "CSE 157", "CSE 181", "CSE 183", "CSE 187"],
      n: 2,
      description: "Choose 2 upper-division elective courses.",
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["CSE 115A", "CSE 185E"],
      description: "Complete one DC course. Cannot double-count as elective.",
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement (Capstone)",
      type: "pick_one",
      courses: ["CSE 115A", "CSE 156", "CSE 156L", "CSE 157", "CSE 181", "CSE 183", "CSE 187", "CSE 101", "CSE 150", "CSE 121", "CSE 180", "CSE 186"],
      description: "Complete one capstone course or senior thesis.",
    },
  ]
};

// ------------------------------------------------------------
// MAJOR REGISTRY
// Auto-regenerated on every merge run. Lists every
// _REQUIREMENTS const declared above. The wizard dropdown
// iterates this object to populate major choices.
// ------------------------------------------------------------

const MAJOR_REQUIREMENTS = {
  "AM_BS": AM_BS_REQUIREMENTS,
  "BIOTECH_BS": BIOTECH_BS_REQUIREMENTS,
  "BMEB_BI": BMEB_BI_REQUIREMENTS,
  "BMEB_BM": BMEB_BM_REQUIREMENTS,
  "CE_BS": CE_BS_REQUIREMENTS,
  "CSGD_BS": CSGD_BS_REQUIREMENTS,
  "CS_BA": CS_BA_REQUIREMENTS,
  "CS_BS": CS_BS_REQUIREMENTS,
  "EE_BS": EE_BS_REQUIREMENTS,
  "NDT_BS": NDT_BS_REQUIREMENTS,
};
