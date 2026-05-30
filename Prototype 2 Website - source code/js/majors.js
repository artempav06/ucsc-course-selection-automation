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
  catalogUrl: "https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/computer-science-and-engineering/computer-science-ba",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.8,

  categories: [
    {
      id: "LD_CORE",
      name: "Lower Division Programming",
      type: "all_required",
      courses: ["CSE 20", "CSE 12", "CSE 30"],
      description: "Complete all lower division programming courses."
    },
    {
      id: "MATH_CORE",
      name: "Math (Core)",
      type: "all_required",
      courses: ["CSE 40", "CSE 16"],
      description: "CSE 40 and CSE 16 are required."
    },
    {
      id: "CALC_A",
      name: "Calculus I",
      type: "pick_one",
      courses: ["MATH 19A", "MATH 20A"],
      description: "Choose one: MATH 19A or MATH 20A."
    },
    {
      id: "CALC_B",
      name: "Calculus II",
      type: "pick_one",
      courses: ["MATH 19B", "MATH 20B"],
      description: "Choose one: MATH 19B or MATH 20B."
    },
    {
      id: "LINEAR_ALGEBRA",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one linear algebra course."
    },
    {
      id: "PROGRAMMING_SEQ",
      name: "Programming Sequence",
      type: "choose_group",
      groups: [
        { label: "CSE 13S + CSE 101", courses: ["CSE 13S", "CSE 101"] },
        { label: "CSE 101P", courses: ["CSE 101P"] }
      ],
      description: "Choose one path: CSE 13S + CSE 101, or CSE 101P alone."
    },
    {
      id: "BREADTH",
      name: "Breadth Courses",
      type: "pick_n",
      n: 3,
      courses: [
        "CSE 101M", "CSE 102", "CSE 103", "CSE 112", "CSE 114A", "CSE 118",
        "CSE 120", "CSE 140", "CSE 142", "CSE 143", "CSE 144", "CSE 150",
        "CSE 183", "CSE 184", "CSE 110A", "CSE 130", "CSE 132", "CSE 134",
        "CSE 138", "CSE 160", "CSE 180", "CSE 186"
      ],
      description: "Choose three from breadth lists. List B courses (CSE 110A, 130, 132, 134, 138, 160, 180, 186) require CSE 101."
    },
    {
      id: "ELECTIVE",
      name: "Upper Division Electives",
      type: "pick_n",
      n: 3,
      courses: [
        "CSE 101M", "CSE 102", "CSE 103", "CSE 109", "CSE 110A", "CSE 111",
        "CSE 112", "CSE 113", "CSE 114A", "CSE 115C", "CSE 115D", "CSE 118",
        "CSE 120", "CSE 121", "CSE 122", "CSE 125", "CSE 130", "CSE 132",
        "CSE 134", "CSE 138", "CSE 140", "CSE 142", "CSE 143", "CSE 144",
        "CSE 145", "CSE 150", "CSE 156", "CSE 160", "CSE 163", "CSE 180",
        "CSE 181", "CSE 183", "CSE 184", "CSE 186", "CSE 187"
      ],
      description: "Three additional UD CSE courses (100-189, 5+ credits). At least one must satisfy the Comprehensive Requirement."
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["CSE 115A", "CSE 185S", "CSE 185E", "CSE 195"],
      description: "Choose one DC course. Cannot double-count as elective."
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement",
      type: "pick_one",
      courses: [
        "CSE 110A", "CSE 115C", "CSE 115D", "CSE 134", "CSE 138", "CSE 140",
        "CSE 143", "CSE 144", "CSE 145", "CSE 160", "CSE 163", "CSE 181",
        "CSE 183", "CSE 184", "CSE 187", "CSE 195"
      ],
      description: "Pass one capstone course or complete Senior Thesis (CSE 195). Can double-count as breadth or elective."
    }
  ]
};

// ------------------------------------------------------------
// MAJOR REGISTRY
// Maps major IDs to their requirements object.
// ------------------------------------------------------------

// === AUTO-GENERATED MAJOR REQUIREMENTS (do not hand-edit below) ===
// 11 majors extracted from curriculum chart PDFs via agent reading.

const AM_BS_REQUIREMENTS = {
  id: "AM_BS",
  name: "Applied Mathematics B.S.",
  catalogUrl: "https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/applied-mathematics/applied-mathematics-bs",
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/Applied-Math-Major_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "CALCULUS",
      name: "Calculus",
      type: "choose_group",
      groups: [
        { label: "MATH 19A + MATH 19B", courses: ["MATH 19A", "MATH 19B"] },
        { label: "MATH 20A + MATH 20B", courses: ["MATH 20A", "MATH 20B"] }
      ],
      description: "Complete one calculus sequence."
    },
    {
      id: "LINEAR_ALGEBRA",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one: AM 10 or MATH 21. AM 10 is preferred."
    },
    {
      id: "DIFFERENTIAL_EQUATIONS",
      name: "Differential Equations",
      type: "pick_one",
      courses: ["AM 20", "MATH 24"],
      description: "Choose one: AM 20 or MATH 24. AM 20 is preferred."
    },
    {
      id: "MULTIVARIABLE_CALCULUS",
      name: "Multivariable Calculus",
      type: "choose_group",
      groups: [
        { label: "MATH 23A + MATH 23B", courses: ["MATH 23A", "MATH 23B"] },
        { label: "AM 30 (Strongly Preferred)", courses: ["AM 30"] }
      ],
      description: "Complete one sequence. AM 30 is strongly preferred."
    },
    {
      id: "DISCRETE_MATH",
      name: "Discrete Math",
      type: "pick_one",
      courses: ["CSE 16", "MATH 100"],
      description: "Complete one. MATH 100 is preferred for upper division math electives."
    },
    {
      id: "PROGRAMMING",
      name: "Programming",
      type: "pick_one",
      courses: ["CSE 20", "CSE 13S", "ECE 13", "ASTR 19"],
      description: "Complete one programming course."
    },
    {
      id: "LD_ELECTIVES",
      name: "Lower Division Electives",
      type: "pick_n",
      courses: [
        "CSE 30", "ECON 1", "ECON 2", "STAT 7", "STAT 7L", "STAT 17", "STAT 17L",
        "PHYS 5A", "PHYS 5B", "PHYS 5C", "ASTR 21", "ECE 9", "BIOL 20A", "BIOE 20C"
      ],
      n: 2,
      description: "Complete 2 lower-division electives from the official catalog list. Lecture/lab combinations count as one course where the associated lab is required. Source: UCSC General Catalog Applied Mathematics B.S."
    },
    {
      id: "UD_REQUIRED",
      name: "Upper-Division Required Courses",
      type: "all_required",
      courses: ["AM 100", "AM 112", "AM 114", "AM 129"],
      description: "All four upper-division core courses are required: AM 100 (Mathematical Methods for Engineers), AM 112 (Introduction to Partial Differential Equations), AM 114 (Introduction to Dynamical Systems), AM 129 (Foundations of Scientific Computing for Scientists and Engineers)."
    },
    {
      id: "UD_ANALYSIS",
      name: "Upper-Division Analysis",
      type: "pick_one",
      courses: ["AM 147", "MATH 148"],
      description: "Choose one: AM 147 (Computational Methods & Applications) or MATH 148 (Computational Methods & Applications)."
    },
    {
      id: "UD_STATS",
      name: "Upper-Division Statistics",
      type: "pick_one",
      courses: ["STAT 131", "CSE 107"],
      description: "Choose one: STAT 131 (Introduction to Probability Theory) or CSE 107 (Probability & Statistics for Engineers)."
    },
    {
      id: "UD_ELECTIVES",
      name: "Upper-Division Electives",
      type: "pick_n",
      courses: [
        "AM 115", "AM 130", "TIM 150", "STAT 132", "AM 147",
        "ASTR 112", "ASTR 113", "ASTR 119", "BME 118", "BME 160",
        "CSE 101", "CSE 102", "CSE 104", "CSE 106", "CSE 108", "CSE 113", "CSE 140", "CSE 142", "CSE 144", "CSE 160", "CSE 161", "CSE 162",
        "ECE 101", "ECE 103", "ECE 115", "ECE 135", "ECE 136", "ECE 141", "ECE 145", "ECE 149", "ECE 151", "ECE 153", "ECE 163", "ECE 179",
        "ECON 100A", "ECON 100B", "ECON 100M", "ECON 100N", "ECON 101", "ECON 113", "ECON 114", "ECON 115", "ECON 124", "ECON 166A",
        "MATH 105A", "MATH 105B", "MATH 105C", "MATH 110", "MATH 111A", "MATH 111T", "MATH 114", "MATH 115", "MATH 116", "MATH 117", "MATH 118", "MATH 120", "MATH 121A", "MATH 121B", "MATH 124", "MATH 130", "MATH 134", "MATH 140", "MATH 152", "MATH 160",
        "PHYS 105", "PHYS 110A", "PHYS 110B", "PHYS 139A", "PHYS 139B", "PHYS 150", "PHYS 171", "STAT 108", "TIM 147"
      ],
      n: 3,
      description: "Complete 3 upper-division elective courses from the official catalog list. Any 5-credit AM 100-199/200-299 course that is not a core course may also count, with catalog exclusions. Source: UCSC General Catalog Applied Mathematics B.S."
    },
    {
      id: "DC",
      name: "Disciplinary Communication",
      type: "all_required",
      courses: ["AM 170A"],
      description: "AM 170A (Mathematical Modeling 1) serves as the Disciplinary Communication (DC) requirement."
    },
    {
      id: "COMPREHENSIVE",
      name: "Comprehensive Requirement",
      type: "pick_one",
      courses: ["AM 170B", "AM 195"],
      description: "Choose one: AM 170B (Mathematical Modeling 2) or AM 195 (Senior Thesis Research)."
    }
  ]
};

const BIOTECH_BS_REQUIREMENTS = {
  id: "BIOTECH_BS",
  name: "Biotechnology B.A.",
  catalogUrl: "https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/biomolecular-engineering/biotechnology-ba",
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/Biotechnology-25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "LD_CHEMISTRY",
      name: "Chemistry",
      type: "choose_group",
      groups: [
        { label: "CHEM 3A", courses: ["CHEM 3A"] },
        { label: "CHEM 4A + CHEM 4AL", courses: ["CHEM 4A", "CHEM 4AL"] }
      ],
      description: "Choose one: CHEM 3A or CHEM 4A/L."
    },
    {
      id: "LD_INTRODUCTORY",
      name: "Introductory Courses",
      type: "all_required",
      courses: ["BME 5", "CSE 20", "BIOL 20A"],
      description: "Complete all introductory courses."
    },
    {
      id: "LD_BIOTECH_SOCIETY_CHOICE",
      name: "Biotechnology and Society (Choice)",
      type: "pick_one",
      courses: ["BME 80H", "ECE 80B", "BME 18"],
      description: "Choose one: BME 80H, ECE 80B, or BME 18."
    },
    {
      id: "LD_BIOTECH_SOCIETY_REQ",
      name: "Biotechnology and Society (Required)",
      type: "all_required",
      courses: ["BME 80G"],
      description: "BME 80G (Bioethics) is required."
    },
    {
      id: "LD_STATISTICS",
      name: "Statistics",
      type: "choose_group",
      groups: [
        { label: "STAT 7 + STAT 7L", courses: ["STAT 7", "STAT 7L"] },
        { label: "STAT 5", courses: ["STAT 5"] },
        { label: "STAT 131 substitution", courses: ["STAT 131"] }
      ],
      description: "Choose one: STAT 7/L, STAT 5, or STAT 131 substitution."
    },
    {
      id: "UD_CORE",
      name: "Upper Division Core",
      type: "all_required",
      courses: ["BME 105", "BME 110", "BME 160"],
      description: "Complete all upper division core courses."
    },
    {
      id: "UD_ELECTIVES",
      name: "Upper Division Electives",
      type: "pick_n",
      n: 3,
      courses: [
        "BME 122H", "BME 128", "BME 130", "BME 132", "BME 140", "BME 177",
        "BME 178", "ECE 104", "FMST 124", "FMST 133", "METX 100", "SOCY 121",
        "SOCY 123", "SOCY 127P"
      ],
      description: "Choose three electives."
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "all_required",
      courses: ["BME 185"],
      description: "BME 185 satisfies the DC requirement."
    },
    {
      id: "COMPREHENSIVE",
      name: "Comprehensive Requirement",
      type: "all_required",
      courses: ["BME 175"],
      description: "BME 175 (Entrepreneurship in Biotechnology)."
    }
  ]
};

const BMEB_BI_REQUIREMENTS = {
  id: "BMEB_BI",
  name: "Biomolecular Engineering and Bioinformatics (Bioinformatics)",
  catalogUrl: "https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/biomolecular-engineering/biomolecular-engineering-and-bioinformatics-bs#degree-req-3",
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/BMEB-BINF-25-26-1.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "CALCULUS",
      name: "Calculus",
      type: "choose_group",
      groups: [
        { label: "MATH 19A + MATH 19B", courses: ["MATH 19A", "MATH 19B"] },
        { label: "MATH 20A + MATH 20B", courses: ["MATH 20A", "MATH 20B"] }
      ],
      description: "Complete one calculus sequence."
    },
    {
      id: "MATH_STATS_CORE",
      name: "Mathematics and Statistics (Core)",
      type: "all_required",
      courses: ["CSE 16", "STAT 131"],
      description: "Complete CSE 16 and STAT 131."
    },
    {
      id: "LINEAR_ALGEBRA",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one linear algebra course."
    },
    {
      id: "STATS_ML",
      name: "Statistics / Machine Learning",
      type: "pick_one",
      courses: ["STAT 132", "CSE 40"],
      description: "Choose one: STAT 132 or CSE 40."
    },
    {
      id: "MULTIVARIATE",
      name: "Multivariate Calculus",
      type: "pick_one",
      courses: ["AM 30", "MATH 23A"],
      description: "Choose one: AM 30 or MATH 23A."
    },
    {
      id: "ML_ADVANCED",
      name: "Machine Learning (Advanced)",
      type: "pick_one",
      courses: ["CSE 142", "CSE 144"],
      description: "Choose one: CSE 142 (Machine Learning) or CSE 144 (Applied Machine Learning)."
    },
    {
      id: "CHEMISTRY",
      name: "Chemistry",
      type: "choose_group",
      groups: [
        { label: "CHEM 3-series", courses: ["CHEM 3A", "CHEM 3B", "CHEM 3BL", "CHEM 3C", "CHEM 3CL"] },
        { label: "CHEM 4-series", courses: ["CHEM 4A", "CHEM 4AL", "CHEM 4B", "CHEM 4BL"] }
      ],
      description: "Choose one chemistry series."
    },
    {
      id: "BIO_CHEM_CORE",
      name: "Biology and Organic Chemistry (Core)",
      type: "all_required",
      courses: ["BIOL 20A", "CHEM 8A"],
      description: "Complete both BIOL 20A and CHEM 8A."
    },
    {
      id: "GENETICS",
      name: "Genetics",
      type: "pick_one",
      courses: ["BME 105", "BIOL 105"],
      description: "Choose one: BME 105 or BIOL 105."
    },
    {
      id: "ORGANIC_CHEM",
      name: "Organic Chemistry / Molecular Biology",
      type: "pick_one",
      courses: ["BME 101", "CHEM 8B"],
      description: "Choose one: BME 101 or CHEM 8B."
    },
    {
      id: "BIOCHEMISTRY",
      name: "Biochemistry",
      type: "pick_one",
      courses: ["CHEM 103", "BIOC 100A", "BIOL 100"],
      description: "Choose one biochemistry course."
    },
    {
      id: "BIOINFORMATICS_CORE",
      name: "Bioinformatics Core",
      type: "all_required",
      courses: ["BME 80G", "BME 185", "BME 110"],
      description: "Complete all bioinformatics core courses. BME 185 also satisfies DC requirement."
    },
    {
      id: "ELECTIVE",
      name: "Bioinformatics Elective",
      type: "pick_n",
      n: 1,
      courses: [
        "AM 115", "AM 147", "BME 118", "BME 122H", "BME 123L", "BME 128", "BME 128L",
        "BME 130", "BME 132", "BME 140", "BME 175", "BME 177", "BME 177L",
        "BME 178", "BIOC 100B", "CSE 142", "CSE 144", "CSE 182", "METX 100",
        "METX 140"
      ],
      description: "Choose one elective from this list. Any 5-unit BME grad course (BME 201-279) may also count."
    },
    {
      id: "PROGRAMMING_CORE",
      name: "Programming (Core)",
      type: "all_required",
      courses: ["BME 163", "CSE 30"],
      description: "Complete BME 163 and CSE 30."
    },
    {
      id: "BME160_SUBSTITUTION",
      name: "BME 160 / CSE 20 Substitution",
      type: "pick_one",
      courses: ["BME 160", "CSE 20"],
      description: "Choose BME 160 or CSE 20. BME 160 is strongly recommended."
    },
    {
      id: "PROGRAMMING_CHOICE",
      name: "Programming (Data Structures)",
      type: "choose_group",
      groups: [
        { label: "CSE 101P", courses: ["CSE 101P"] },
        { label: "CSE 13S + CSE 101", courses: ["CSE 13S", "CSE 101"] }
      ],
      description: "Choose one path: CSE 101P alone, or CSE 13S + CSE 101."
    },
    {
      id: "CAPSTONE",
      name: "Bioinformatics Capstone",
      type: "choose_group",
      groups: [
        { label: "Bioinformatics Capstone", courses: ["BME 205", "BME 230A", "BME 129C"] }
      ],
      description: "Complete the Bioinformatics Capstone sequence. The official Senior Thesis alternative requires 15 credits of repeatable BME 195 across three quarters and is deferred until the scheduler supports repeat-count requirements."
    }
  ]
};

const BMEB_BM_REQUIREMENTS = {
  id: "BMEB_BM",
  name: "Biomolecular Engineering and Bioinformatics (Biomolecular)",
  catalogUrl: "https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/biomolecular-engineering/biomolecular-engineering-and-bioinformatics-bs#degree-req-2",
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/BMEB-Biomoleular-25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "CALCULUS",
      name: "Calculus",
      type: "choose_group",
      groups: [
        { label: "MATH 19A + MATH 19B", courses: ["MATH 19A", "MATH 19B"] },
        { label: "MATH 20A + MATH 20B", courses: ["MATH 20A", "MATH 20B"] }
      ],
      description: "Complete one calculus sequence."
    },
    {
      id: "STATISTICS",
      name: "Statistics",
      type: "all_required",
      courses: ["STAT 131"],
      description: "STAT 131 is required."
    },
    {
      id: "MATH_LINEAR_ALGEBRA",
      name: "Mathematics (Linear Algebra)",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one: AM 10 or MATH 21 for the linear algebra requirement."
    },
    {
      id: "CHEMISTRY",
      name: "Chemistry",
      type: "choose_group",
      groups: [
        { label: "General Chemistry: CHEM 3A + CHEM 3B/BL + CHEM 3C/CL", courses: ["CHEM 3A", "CHEM 3B", "CHEM 3BL", "CHEM 3C", "CHEM 3CL"] },
        { label: "Advanced General Chemistry: CHEM 4A/AL + CHEM 4B/BL", courses: ["CHEM 4A", "CHEM 4AL", "CHEM 4B", "CHEM 4BL"] }
      ],
      description: "Select one of the following General Chemistry series."
    },
    {
      id: "LABORATORY",
      name: "Laboratory Courses",
      type: "all_required",
      courses: ["BME 21L", "BME 22L"],
      description: "Complete both laboratory courses: Introduction to Basic Laboratory Techniques (BME 21L) and Foundations of Design and Experimentation in Molecular Biology (BME 22L)."
    },
    {
      id: "PHYSICS_INTRO",
      name: "Physics I",
      type: "choose_group",
      groups: [
        { label: "PHYS 5A + PHYS 5L", courses: ["PHYS 5A", "PHYS 5L"] },
        { label: "PHYS 15A + PHYS 5L", courses: ["PHYS 15A", "PHYS 5L"] }
      ],
      description: "Complete PHYS 5L with either PHYS 5A or PHYS 15A."
    },
    {
      id: "PHYSICS_REQUIRED",
      name: "Physics (Required)",
      type: "all_required",
      courses: ["PHYS 5B", "PHYS 5M"],
      description: "Introduction to Physics II is required."
    },
    {
      id: "ORGANIC_CHEMISTRY",
      name: "Organic Chemistry",
      type: "all_required",
      courses: ["CHEM 8A", "CHEM 8B"],
      description: "Complete both Organic Chemistry courses."
    },
    {
      id: "BIOLOGY_REQUIRED",
      name: "Biology (Required)",
      type: "all_required",
      courses: ["BIOL 20A"],
      description: "Cell and Molecular Biology (BIOL 20A) is required."
    },
    {
      id: "GENETICS",
      name: "Genetics",
      type: "pick_one",
      courses: ["BME 105", "BIOL 105"],
      description: "Choose one: BME 105 (Genetics in the Genomics Era, strongly recommended) or BIOL 105 (Genetics)."
    },
    {
      id: "BIOCHEMISTRY",
      name: "Biochemistry",
      type: "choose_group",
      groups: [
        { label: "BIOC 100A + BIOC 100B", courses: ["BIOC 100A", "BIOC 100B"] },
        { label: "BME 101 + CHEM 103", courses: ["BME 101", "CHEM 103"] },
        { label: "BME 101 + BIOL 100", courses: ["BME 101", "BIOL 100"] }
      ],
      description: "Select one of the following Biochemistry series."
    },
    {
      id: "BIOINFORMATICS_BIOETHICS",
      name: "Bioinformatics and Bioethics",
      type: "all_required",
      courses: ["BME 80G", "BME 160", "BME 110", "BME 185", "BME 163"],
      description: "Complete all Bioinformatics and Bioethics courses. BME 80G (Bioethics), BME 160 (Research Programming in the Life Sciences, 6 units), BME 110 (Computational Biology Tools), BME 185 (Technical Writing for Biomolecular Engineers, also satisfies DC requirement), BME 163 (Applied Visualization and Analysis of Scientific Data)."
    },
    {
      id: "MODELING_DESIGN",
      name: "Modeling & Design Sequence",
      type: "choose_group",
      groups: [
        { label: "Engineering Stem Cells: BME 177 + BME 177L", courses: ["BME 177", "BME 177L"] },
        { label: "Protein Engineering: BME 128 + BME 128L", courses: ["BME 128", "BME 128L"] },
        { label: "Genomes / Long Read Sequencing: BME 130 + BME 123L", courses: ["BME 130", "BME 123L"] }
      ],
      description: "Choose one of the following Modeling & Design sequences."
    },
    {
      id: "ELECTIVE",
      name: "Elective",
      type: "pick_n",
      courses: [
        "AM 115", "AM 147", "BIOL 115", "METX 100", "METX 140", "BIOC 100C",
        "BME 118", "BME 122H", "BME 123L", "BME 128", "BME 128L", "BME 130",
        "BME 132", "BME 140", "BME 175", "BME 177", "BME 177L", "BME 178",
        "ECE 104"
      ],
      n: 1,
      description: "Choose one elective. Course used as an Elective cannot be used to satisfy other major requirements. Any 5-credit biomolecular engineering graduate course (BME 201-279) may also be used. *BIOL 115 and BME 178 have additional prerequisites not covered by the major requirements."
    },
    {
      id: "CAPSTONE",
      name: "Biomolecular Capstone",
      type: "choose_group",
      groups: [
        { label: "Bioinformatics Capstone", courses: ["BME 205", "BME 230A", "BME 129C"] },
        { label: "iGEM", courses: ["BME 180", "BME 188A", "BME 188B", "BME 188C"] },
        { label: "Senior Design", courses: ["BME 129A", "BME 129B", "BME 129C"] }
      ],
      description: "Students must complete one of the following capstone tracks. The Bioinformatics Capstone is programming heavy. The official Senior Thesis option consists of 15 credits of repeatable BME 195 split over three quarters and is deferred until the scheduler supports repeat-count requirements."
    }
  ]
};

const CE_BS_REQUIREMENTS = {
  id: "CE_BS",
  name: "Computer Engineering B.S.",
  catalogUrl: "https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/computer-science-and-engineering/computer-engineering-bs",
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/CE_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.8,

  categories: [
    {
      id: "MATH_CORE",
      name: "Math (Core)",
      type: "all_required",
      courses: ["MATH 19A", "MATH 19B", "CSE 16", "ECE 103", "ECE 103L"],
      description: "Complete all core math courses including signals and systems."
    },
    {
      id: "LINEAR_ALGEBRA",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one linear algebra course."
    },
    {
      id: "DIFF_EQ",
      name: "Differential Equations",
      type: "all_required",
      courses: ["AM 20"],
      description: "AM 20 is required for Computer Engineering B.S."
    },
    {
      id: "MULTIVAR",
      name: "Multivariable Calculus",
      type: "pick_one",
      courses: ["AM 30", "MATH 23A"],
      description: "Choose one multivariable calculus course."
    },
    {
      id: "PROB_STATS",
      name: "Probability/Statistics",
      type: "pick_one",
      courses: ["CSE 107", "STAT 131"],
      description: "Choose one probability/statistics course."
    },
    {
      id: "PHYSICS_CORE",
      name: "Physics (Core)",
      type: "all_required",
      courses: ["PHYS 5A", "PHYS 5L", "PHYS 5C", "PHYS 5N"],
      description: "Mechanics and Electricity & Magnetism with labs."
    },
    {
      id: "PHYSICS_CHOICE",
      name: "Physics / Statics",
      type: "choose_group",
      groups: [
        { label: "PHYS 5B + PHYS 5M", courses: ["PHYS 5B", "PHYS 5M"] },
        { label: "ECE 9", courses: ["ECE 9"] }
      ],
      description: "Choose one: PHYS 5B/M (Waves & Optics) or ECE 9 (Statics)."
    },
    {
      id: "CORE_COURSES",
      name: "Core Courses",
      type: "all_required",
      courses: ["CSE 20", "CSE 30", "CSE 12", "CSE 100", "CSE 100L", "CSE 101", "CSE 120", "CSE 121", "ECE 101", "ECE 101L"],
      description: "Complete all core CS/ECE courses."
    },
    {
      id: "CORE_SYSTEMS",
      name: "Systems & C Programming",
      type: "pick_one",
      courses: ["CSE 13S", "ECE 13"],
      description: "Choose one: CSE 13S or ECE 13."
    },
    {
      id: "CONCENTRATION",
      name: "Concentration (choose one)",
      type: "choose_group",
      groups: [
        { label: "System Programming", courses: ["CSE 130", "CSE 150", "CSE 111", "CSE 113"] },
        { label: "Computer Systems", courses: ["CSE 130", "CSE 111", "CSE 125"] },
        { label: "Networks", courses: ["CSE 130", "CSE 150", "CSE 156", "CSE 156L"] },
        { label: "Digital Hardware", courses: ["CSE 125", "ECE 171", "ECE 171L", "CSE 122"] }
      ],
      description: "Choose one concentration. Each also requires 1 elective from approved list. System Programming has OR choices: CSE 111/CSE 134, CSE 113/CSE 156L/CSE 110A. Computer Systems: CSE 111/CSE 134, CSE 125/CSE 122. Digital Hardware: ECE 171L/CSE 122, plus CSE 122/CSE 220/CSE 228A/ECE 171L/ECE 173."
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["CSE 185E", "CSE 185S", "CSE 195"],
      description: "Choose one: CSE 185E, CSE 185S, or CSE 195."
    },
    {
      id: "CAPSTONE",
      name: "Capstone",
      type: "choose_group",
      groups: [
        { label: "Engineering Design", courses: ["CSE 123A", "CSE 123B"] },
        { label: "Capstone Project", courses: ["CSE 129A", "CSE 129B", "CSE 129C"] },
        { label: "Mechatronics", courses: ["ECE 118"] },
        { label: "Senior Thesis", courses: ["CSE 195"] }
      ],
      description: "Choose one capstone option."
    }
  ]
};

const CSGD_BS_REQUIREMENTS = {
  id: "CSGD_BS",
  name: "Computer Science: Computer Game Design B.S.",
  catalogUrl: "https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/computational-media/computer-science-computer-game-design-bs",
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/CSGD_BS_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.8,

  categories: [
    {
      id: "FOUNDATIONS_CORE",
      name: "Math & Programming Foundations (Core)",
      type: "all_required",
      courses: ["CSE 16", "CSE 20", "CSE 30", "CSE 12", "CSE 101"],
      description: "Complete all core math and programming courses."
    },
    {
      id: "CALC_A",
      name: "Calculus I",
      type: "pick_one",
      courses: ["MATH 19A", "MATH 20A"],
      description: "Choose one: MATH 19A or MATH 20A."
    },
    {
      id: "CALC_B",
      name: "Calculus II",
      type: "pick_one",
      courses: ["MATH 19B", "MATH 20B"],
      description: "Choose one: MATH 19B or MATH 20B."
    },
    {
      id: "LINEAR_ALGEBRA",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one: AM 10 or MATH 21."
    },
    {
      id: "SYSTEMS",
      name: "Systems Programming",
      type: "pick_one",
      courses: ["CSE 13S", "ECE 13"],
      description: "Choose one: CSE 13S or ECE 13."
    },
    {
      id: "GAMES_FOUNDATIONS",
      name: "Games and Playable Media Foundations",
      type: "all_required",
      courses: ["CMPM 80J", "FILM 80V"],
      description: "Complete all games foundations courses."
    },
    {
      id: "GAME_DESIGN",
      name: "Game Design and Development",
      type: "all_required",
      courses: ["CMPM 80K", "CMPM 176", "CMPM 130", "CMPM 120", "CMPM 121"],
      description: "Complete all game design and development courses. CMPM 130 also satisfies DC."
    },
    {
      id: "CGE_ELECTIVES",
      name: "Computer Game Engineering Electives",
      type: "pick_n",
      n: 5,
      courses: [
        "CMPM 110", "CMPM 122", "CMPM 123", "CMPM 125", "CMPM 131", "CMPM 132",
        "CMPM 146", "CMPM 147", "CMPM 148", "CMPM 150", "CMPM 151", "CMPM 152",
        "CMPM 163", "CMPM 164", "CMPM 169", "CMPM 172", "CMPM 177", "CMPM 178",
        "CMPM 179", "CMPM 180", "CSE 102", "CSE 103", "CSE 104", "CSE 110A",
        "CSE 110B", "CSE 112", "CSE 113", "CSE 115A", "CSE 115B", "CSE 115C",
        "CSE 117", "CSE 118", "CSE 119", "CSE 120", "CSE 130", "CSE 132", "CSE 138",
        "CSE 140", "CSE 142", "CSE 144", "CSE 145", "CSE 146", "CSE 150",
        "CSE 156", "CSE 157", "CSE 160", "CSE 161", "CSE 162", "CSE 163",
        "CSE 180", "CSE 181", "CSE 183", "CSE 184", "CSE 186", "CSE 187",
        "ECON 166A", "CSE 166A", "ECE 118"
      ],
      description: "Choose five CGE electives from the approved list."
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement",
      type: "all_required",
      courses: ["CMPM 170", "CMPM 171"],
      description: "Complete both CMPM 170 and CMPM 171."
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "all_required",
      courses: ["CMPM 130"],
      description: "CMPM 130 satisfies the DC requirement."
    }
  ]
};

const CS_BS_REQUIREMENTS = {
  id: "CS_BS",
  name: "Computer Science B.S.",
  catalogUrl: "https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/computer-science-and-engineering/computer-science-bs",
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/CS_BS_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.8,

  categories: [
    {
      id: "MATH_CORE",
      name: "Math (Core)",
      type: "all_required",
      courses: ["CSE 16", "CSE 40", "ECE 30"],
      description: "Complete all core math/logic courses."
    },
    {
      id: "CALC_A",
      name: "Calculus I",
      type: "pick_one",
      courses: ["MATH 19A", "MATH 20A"],
      description: "Choose one: MATH 19A or MATH 20A."
    },
    {
      id: "CALC_B",
      name: "Calculus II",
      type: "pick_one",
      courses: ["MATH 19B", "MATH 20B"],
      description: "Choose one: MATH 19B or MATH 20B."
    },
    {
      id: "LINEAR_ALGEBRA",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one: AM 10 or MATH 21."
    },
    {
      id: "MULTIVAR",
      name: "Multivariable Calculus",
      type: "pick_one",
      courses: ["AM 30", "MATH 23A"],
      description: "Choose one: AM 30 or MATH 23A."
    },
    {
      id: "LD_PROGRAMMING",
      name: "Lower Division Programming",
      type: "all_required",
      courses: ["CSE 20", "CSE 12", "CSE 30", "CSE 13S", "CSE 101"],
      description: "Complete all lower division programming courses."
    },
    {
      id: "UD_CORE",
      name: "Upper Division CSE (Core)",
      type: "all_required",
      courses: ["CSE 120", "CSE 130", "CSE 101M"],
      description: "Complete all upper division core courses."
    },
    {
      id: "UD_LANGUAGES",
      name: "Programming Languages",
      type: "pick_one",
      courses: ["CSE 112", "CSE 114A"],
      description: "Choose one: CSE 112 or CSE 114A."
    },
    {
      id: "UD_THEORY",
      name: "Theory of Computation",
      type: "pick_one",
      courses: ["CSE 102", "CSE 103"],
      description: "Choose one: CSE 102 or CSE 103."
    },
    {
      id: "PROB_STATS",
      name: "Probability/Statistics",
      type: "pick_one",
      courses: ["CSE 107", "STAT 131"],
      description: "Choose one: CSE 107 or STAT 131."
    },
    {
      id: "UD_ELECTIVE",
      name: "Upper Division Electives",
      type: "pick_n",
      n: 4,
      courses: [
        "CSE 110B", "CSE 111", "CSE 112", "CSE 113", "CSE 115C", "CSE 115D",
        "CSE 118", "CSE 121", "CSE 122", "CSE 125", "CSE 132", "CSE 134",
        "CSE 138", "CSE 140", "CSE 142", "CSE 143", "CSE 144", "CSE 145",
        "CSE 150", "CSE 156", "CSE 157", "CSE 160", "CSE 161", "CSE 162",
        "CSE 163", "CSE 168", "CSE 180", "CSE 181", "CSE 183", "CSE 184",
        "CSE 186", "CSE 187", "CSE 195", "CMPM 120", "CMPM 131", "CMPM 146",
        "CMPM 163", "CMPM 164", "CMPM 171", "CMPM 172",
        "AM 114", "AM 147", "AM 148", "AM 160", "MATH 110", "MATH 115",
        "MATH 116", "MATH 117", "MATH 118", "MATH 134", "MATH 148", "STAT 132"
      ],
      description: "Choose four UD CSE courses (100-189), CSE 195, or Computational Media electives. Up to two may be math electives. CSE 115A, 185S, 185E cannot count here. Capstone can count as 1 of 4."
    },
    {
      id: "CAPSTONE",
      name: "Capstone / Comprehensive",
      type: "pick_one",
      courses: [
        "CSE 110B", "CSE 115C", "CSE 115D", "CSE 121", "CSE 134", "CSE 138",
        "CSE 140", "CSE 143", "CSE 144", "CSE 145", "CSE 156", "CSE 157",
        "CSE 160", "CSE 161", "CSE 162", "CSE 163", "CSE 168", "CSE 181",
        "CSE 183", "CSE 184", "CSE 187", "CMPM 172", "CSE 195"
      ],
      description: "Pass one capstone course or complete Senior Thesis (CSE 195)."
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["CSE 115A", "CSE 185E", "CSE 185S", "CSE 195"],
      description: "Choose one: CSE 115A, CSE 185E/185S, or CSE 195."
    }
  ]
};

const EE_BS_REQUIREMENTS = {
  id: "EE_BS",
  name: "Electrical Engineering B.S.",
  catalogUrl: "https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/electrical-and-computer-engineering/electrical-engineering-bs",
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/EE_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.5,

  categories: [
    {
      id: "MATH_CORE",
      name: "Math (Core)",
      type: "all_required",
      courses: ["MATH 19A", "MATH 19B"],
      description: "Complete calculus sequence."
    },
    {
      id: "MULTIVAR",
      name: "Multivariate/Vector Calculus",
      type: "choose_group",
      groups: [
        { label: "AM 30 + AM 100", courses: ["AM 30", "AM 100"] },
        { label: "MATH 23A + MATH 23B", courses: ["MATH 23A", "MATH 23B"] }
      ],
      description: "Choose one sequence: AM 30 + AM 100, or MATH 23A + MATH 23B."
    },
    {
      id: "LINEAR_ALGEBRA",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one: AM 10 or MATH 21."
    },
    {
      id: "DIFF_EQ",
      name: "Differential Equations",
      type: "pick_one",
      courses: ["AM 20", "MATH 24"],
      description: "Choose one: AM 20 or MATH 24."
    },
    {
      id: "PROB_STATS",
      name: "Probability/Statistics",
      type: "pick_one",
      courses: ["STAT 131", "CSE 107"],
      description: "Choose one: STAT 131 or CSE 107."
    },
    {
      id: "PHYSICS_A",
      name: "Physics (Mechanics)",
      type: "choose_group",
      groups: [
        { label: "PHYS 5A + PHYS 5L", courses: ["PHYS 5A", "PHYS 5L"] }
      ],
      description: "Complete PHYS 5A and PHYS 5L."
    },
    {
      id: "PHYSICS_C",
      name: "Physics (E&M)",
      type: "choose_group",
      groups: [
        { label: "PHYS 5C + PHYS 5N", courses: ["PHYS 5C", "PHYS 5N"] }
      ],
      description: "Complete PHYS 5C and PHYS 5N."
    },
    {
      id: "PHYSICS_CORE",
      name: "Physics (Core)",
      type: "all_required",
      courses: ["PHYS 5B", "PHYS 5M", "PHYS 5D"],
      description: "Complete PHYS 5B/M and PHYS 5D."
    },
    {
      id: "COMP_ENG_CHOICE",
      name: "Computer Engineering (Programming)",
      type: "pick_one",
      courses: ["CSE 20", "CSE 30"],
      description: "Choose one: CSE 20 or CSE 30."
    },
    {
      id: "COMP_ENG_CORE",
      name: "Computer Engineering (Core)",
      type: "all_required",
      courses: ["CSE 12", "ECE 13"],
      description: "Complete CSE 12 and ECE 13."
    },
    {
      id: "EE_CORE",
      name: "Electrical Engineering Courses",
      type: "all_required",
      courses: ["ECE 80T", "ECE 102", "ECE 102L", "ECE 103", "ECE 103L", "ECE 135", "ECE 135L", "ECE 151"],
      description: "Complete all EE core courses."
    },
    {
      id: "ELECTRONICS",
      name: "Electronics Courses",
      type: "all_required",
      courses: ["ECE 101", "ECE 101L", "CSE 100", "CSE 100L", "ECE 171", "ECE 171L"],
      description: "Complete all electronics courses."
    },
    {
      id: "DESIGN_ELECTIVE",
      name: "Design Elective",
      type: "pick_one",
      courses: ["ECE 118", "ECE 121", "ECE 157", "ECE 167", "ECE 173"],
      description: "Choose one design elective."
    },
    {
      id: "CONCENTRATION_ELECTIVES",
      name: "Concentration Electives",
      type: "pick_n",
      n: 3,
      courses: [
        "ECE 104", "ECE 110", "ECE 115", "ECE 118", "ECE 121", "ECE 122A",
        "ECE 122B", "ECE 130", "ECE 130L", "ECE 136", "ECE 141", "ECE 145", "ECE 149",
        "ECE 152", "ECE 153", "ECE 157", "ECE 163", "ECE 167", "ECE 169",
        "ECE 170", "ECE 172", "ECE 173", "ECE 174", "ECE 175", "ECE 175L", "ECE 176", "ECE 176L",
        "ECE 177", "ECE 177L", "ECE 178", "ECE 179", "ECE 180J", "ECE 181J", "ECE 183",
        "ECE 185"
      ],
      description: "Choose 3 additional concentration electives (minimum 3 from one track). At least one must be a Design Elective."
    },
    {
      id: "CAPSTONE",
      name: "Comprehensive Requirement",
      type: "choose_group",
      groups: [
        { label: "ECE 129A + 129B + 129C", courses: ["ECE 129A", "ECE 129B", "ECE 129C"] },
        { label: "ECE 129A + ECE 195", courses: ["ECE 129A", "ECE 195"] }
      ],
      description: "Choose one: ECE 129A/B/C sequence, or ECE 129A + Senior Thesis (ECE 195)."
    }
  ]
};

const NDT_BS_REQUIREMENTS = {
  id: "NDT_BS",
  name: "Network and Digital Technology B.A.",
  catalogUrl: "https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/computer-science-and-engineering/network-and-digital-technology-ba",
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/Network-Digital-Technology_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.0,

  categories: [
    {
      id: "MATH_CORE",
      name: "Math (Core)",
      type: "all_required",
      courses: ["MATH 19A", "MATH 19B", "CSE 16"],
      description: "Complete all core math courses."
    },
    {
      id: "LINEAR_ALGEBRA",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one: AM 10 or MATH 21."
    },
    {
      id: "DIFF_EQ",
      name: "Differential Equations",
      type: "pick_one",
      courses: ["AM 20", "MATH 24"],
      description: "Choose one: AM 20 or MATH 24."
    },
    {
      id: "MULTIVAR",
      name: "Multivariable Calculus",
      type: "pick_one",
      courses: ["AM 30", "MATH 23A"],
      description: "Choose one: AM 30 or MATH 23A."
    },
    {
      id: "PHYSICS_MECH",
      name: "Physics (Mechanics)",
      type: "choose_group",
      groups: [
        { label: "PHYS 5A + PHYS 5L", courses: ["PHYS 5A", "PHYS 5L"] },
        { label: "PHYS 6A + PHYS 6L", courses: ["PHYS 6A", "PHYS 6L"] }
      ],
      description: "Choose one: PHYS 5A/L or PHYS 6A/L."
    },
    {
      id: "PHYSICS_EM",
      name: "Physics (E&M)",
      type: "choose_group",
      groups: [
        { label: "PHYS 5C + PHYS 5N", courses: ["PHYS 5C", "PHYS 5N"] },
        { label: "PHYS 6C + PHYS 6N", courses: ["PHYS 6C", "PHYS 6N"] }
      ],
      description: "Choose one: PHYS 5C/N or PHYS 6C/N."
    },
    {
      id: "LD_CORE",
      name: "Lower Division Core",
      type: "all_required",
      courses: ["CSE 20", "CSE 30", "CSE 12"],
      description: "Complete all lower division core courses."
    },
    {
      id: "LD_SYSTEMS",
      name: "Systems Programming",
      type: "pick_one",
      courses: ["CSE 13S", "ECE 13"],
      description: "Choose one: CSE 13S or ECE 13."
    },
    {
      id: "UD_CORE",
      name: "Upper Division Core",
      type: "all_required",
      courses: ["CSE 101", "CSE 150"],
      description: "Complete all upper division core courses. DC is satisfied separately by CSE 185E or CSE 185S."
    },
    {
      id: "UD_ELECTIVES",
      name: "Upper Division Electives",
      type: "pick_n",
      n: 4,
      courses: [
        "AM 114", "AM 147", "AM 231", "CMPM 146", "CSE 100", "CSE 100L", "CSE 101M",
        "CSE 102", "CSE 103", "CSE 107", "CSE 110A", "CSE 110B", "CSE 111",
        "CSE 112", "CSE 113", "CSE 115A", "CSE 117", "CSE 118", "CSE 119",
        "CSE 120", "CSE 121", "CSE 125", "CSE 130", "CSE 132", "CSE 138",
        "CSE 140", "CSE 142", "CSE 144", "CSE 151", "CSE 151L", "CSE 156", "CSE 157",
        "CSE 160", "CSE 161", "CSE 165", "CSE 166A", "CSE 167", "CSE 180",
        "CSE 181", "CSE 182", "CSE 183", "CSE 186", "CSE 187",
        "ECE 101", "ECE 101L", "ECE 102", "ECE 102L", "ECE 103", "ECE 103L", "ECE 115",
        "ECE 118", "ECE 130", "ECE 130L", "ECE 135", "ECE 135L", "ECE 136", "ECE 141", "ECE 151",
        "ECE 152", "ECE 153", "ECE 167", "ECE 171", "ECE 171L", "ECE 172", "ECE 173",
        "ECE 175", "ECE 175L", "ECE 180J", "STAT 131", "STAT 132"
      ],
      description: "Choose four electives from the approved list."
    },
    {
      id: "CAPSTONE",
      name: "Capstone",
      type: "pick_one",
      courses: ["CSE 115A", "CSE 156", "CSE 157", "CSE 181", "CSE 183", "CSE 187"],
      description: "Choose one capstone course."
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "pick_one",
      courses: ["CSE 185E", "CSE 185S"],
      description: "Choose one: CSE 185E or CSE 185S satisfies the DC requirement."
    }
  ]
};

const RE_BS_REQUIREMENTS = {
  id: "RE_BS",
  name: "Robotics Engineering B.S.",
  catalogUrl: "https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/electrical-and-computer-engineering/robotics-engineering-bs",
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/RE_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.8,

  categories: [
    {
      id: "MATH_CORE",
      name: "Math (Core)",
      type: "all_required",
      courses: ["MATH 19A", "MATH 19B", "CSE 16"],
      description: "Complete all core math courses."
    },
    {
      id: "LINEAR_ALGEBRA",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one: AM 10 or MATH 21."
    },
    {
      id: "DIFF_EQ",
      name: "Differential Equations",
      type: "pick_one",
      courses: ["AM 20", "MATH 24"],
      description: "Choose one: AM 20 or MATH 24."
    },
    {
      id: "MULTIVAR",
      name: "Multivariable Calculus",
      type: "pick_one",
      courses: ["AM 30", "MATH 23A"],
      description: "Choose one: AM 30 or MATH 23A."
    },
    {
      id: "PROB_STATS",
      name: "Probability/Statistics",
      type: "pick_one",
      courses: ["CSE 107", "STAT 131"],
      description: "Choose one: CSE 107 or STAT 131."
    },
    {
      id: "PHYSICS_A",
      name: "Physics (Mechanics)",
      type: "choose_group",
      groups: [
        { label: "PHYS 5A + PHYS 5L", courses: ["PHYS 5A", "PHYS 5L"] },
        { label: "PHYS 15A", courses: ["PHYS 15A"] }
      ],
      description: "Choose one: PHYS 5A/L or PHYS 15A."
    },
    {
      id: "PHYSICS_C",
      name: "Physics (E&M)",
      type: "choose_group",
      groups: [
        { label: "PHYS 5C + PHYS 5N", courses: ["PHYS 5C", "PHYS 5N"] },
        { label: "PHYS 15C", courses: ["PHYS 15C"] }
      ],
      description: "Choose one: PHYS 5C/N or PHYS 15C."
    },
    {
      id: "ENG_MECHANICS",
      name: "Engineering Mechanics",
      type: "all_required",
      courses: ["ECE 9"],
      description: "ECE 9 (Statics and Mechanics of Materials)."
    },
    {
      id: "COMP_ENG",
      name: "Computer Engineering Courses",
      type: "all_required",
      courses: ["CSE 12", "CSE 20", "ECE 13", "CSE 30", "CSE 101"],
      description: "Complete all computer engineering courses."
    },
    {
      id: "ELECTRONICS",
      name: "Electronics Courses",
      type: "all_required",
      courses: ["CSE 100", "CSE 100L", "ECE 101", "ECE 101L", "ECE 121", "ECE 167"],
      description: "Complete all electronics courses."
    },
    {
      id: "ROBOTICS",
      name: "Robotics",
      type: "all_required",
      courses: ["ECE 118", "ECE 10"],
      description: "Complete both robotics courses."
    },
    {
      id: "EE_COURSES",
      name: "Electrical Engineering Courses",
      type: "all_required",
      courses: ["ECE 141", "ECE 103", "ECE 103L"],
      description: "Complete all EE courses."
    },
    {
      id: "ADV_ROBOTICS_ELECTIVE",
      name: "Advanced Robotics Elective",
      type: "pick_n",
      n: 1,
      courses: [
        "ECE 215", "ECE 216", "ECE 240", "ECE 242", "ECE 243", "ECE 244",
        "ECE 245", "ECE 246", "ECE 249"
      ],
      description: "Choose one advanced robotics elective from the approved list."
    },
    {
      id: "ROBOTICS_ELECTIVE",
      name: "Robotics Elective",
      type: "pick_n",
      n: 1,
      courses: [
        "AM 114", "AM 147", "CMPM 146", "CSE 118", "CSE 131", "CSE 140",
        "CSE 142", "CSE 156", "CSE 276", "ECE 102", "ECE 102L", "ECE 110", "ECE 130", "ECE 130L",
        "ECE 135", "ECE 135L", "ECE 141", "ECE 145", "ECE 149", "ECE 151", "ECE 152",
        "ECE 153", "ECE 163", "ECE 169", "ECE 171", "ECE 171L", "ECE 172", "ECE 173",
        "ECE 175", "ECE 175L", "ECE 193", "ECE 198", "ECE 222A", "ECE 215", "ECE 216",
        "ECE 240", "ECE 242", "ECE 243", "ECE 244", "ECE 245", "ECE 246",
        "ECE 249"
      ],
      description: "Choose one elective from the approved list."
    },
    {
      id: "CAPSTONE",
      name: "Capstone (also satisfies DC)",
      type: "choose_group",
      groups: [
        { label: "ECE 129A + 129B + 129C", courses: ["ECE 129A", "ECE 129B", "ECE 129C"] },
        { label: "ECE 129A + ECE 195", courses: ["ECE 129A", "ECE 195"] }
      ],
      description: "Choose one capstone option. Both satisfy the DC requirement."
    }
  ]
};

const TIM_BS_REQUIREMENTS = {
  id: "TIM_BS",
  name: "Technology and Information Management B.S.",
  catalogUrl: "https://catalog.ucsc.edu/en/current/general-catalog/academic-units/baskin-engineering/technology-and-information-management/technology-and-information-management-bs",
  pdfUrl: "https://undergrad.engineering.ucsc.edu/files/2025/09/TIM_25-26.pdf",
  totalUnitsRequired: 180,
  minUpperDivUnits: 60,
  minGPA: 2.0,
  majorGPA: 2.8,

  categories: [
    {
      id: "CALCULUS",
      name: "Calculus",
      type: "choose_group",
      groups: [
        { label: "MATH 19A + MATH 19B", courses: ["MATH 19A", "MATH 19B"] },
        { label: "MATH 20A + MATH 20B", courses: ["MATH 20A", "MATH 20B"] }
      ],
      description: "Complete one calculus sequence."
    },
    {
      id: "DISCRETE_MATH",
      name: "Discrete Mathematics",
      type: "all_required",
      courses: ["CSE 16"],
      description: "Complete CSE 16."
    },
    {
      id: "MULTIVAR",
      name: "Multivariable Calculus",
      type: "pick_one",
      courses: ["MATH 22", "MATH 23A", "AM 30"],
      description: "Choose one: MATH 22, MATH 23A, or AM 30."
    },
    {
      id: "LINEAR_ALGEBRA",
      name: "Linear Algebra",
      type: "pick_one",
      courses: ["AM 10", "MATH 21"],
      description: "Choose one: AM 10 or MATH 21."
    },
    {
      id: "DIFF_EQ",
      name: "Differential Equations",
      type: "pick_one",
      courses: ["AM 20", "MATH 24"],
      description: "Choose one: AM 20 or MATH 24."
    },
    {
      id: "PROGRAMMING",
      name: "Programming Courses",
      type: "all_required",
      courses: ["CSE 20", "CSE 30", "CSE 12", "CSE 13S", "CSE 182", "CSE 150"],
      description: "Complete all programming courses."
    },
    {
      id: "ECONOMICS",
      name: "Economics Courses",
      type: "choose_group",
      groups: [
        { label: "ECON 100A path", courses: ["ECON 1", "ECON 2", "ECON 10A", "ECON 100A", "ECON 113"] },
        { label: "ECON 100M path", courses: ["ECON 1", "ECON 2", "ECON 10A", "ECON 100M", "ECON 113"] }
      ],
      description: "Complete ECON 1, ECON 2, ECON 10A, ECON 113, and one intermediate microeconomics course: ECON 100A or ECON 100M."
    },
    {
      id: "STATISTICS",
      name: "Statistics",
      type: "all_required",
      courses: ["STAT 17", "STAT 17L"],
      description: "Complete STAT 17 and STAT 17L."
    },
    {
      id: "TIM_COURSES",
      name: "TIM Courses",
      type: "all_required",
      courses: ["TIM 170", "TIM 50", "TIM 58", "TIM 175", "TIM 172A", "TIM 172P", "TIM 172B", "TIM 172Q"],
      description: "Complete all TIM courses. TIM 175 satisfies DC. TIM 172A/P, 172B/Q, and 175 satisfy the comprehensive requirement."
    },
    {
      id: "BASKIN_ENGR_ELECTIVES",
      name: "Upper Division Baskin Engineering Electives",
      type: "pick_n",
      n: 2,
      courses: [
        "TIM 147", "TIM 150", "TIM 173", "STAT 131", "CSE 107", "CSE 120",
        "CSE 101", "CSE 102", "CSE 103", "CSE 104A", "CSE 105",
        "CSE 110A", "CSE 111", "CSE 112", "CSE 113", "CSE 114A", "CSE 115A",
        "CSE 115B", "CSE 115C", "CSE 115D", "CSE 116", "CSE 117", "CSE 118",
        "CSE 119", "CSE 120", "CSE 121", "CSE 122", "CSE 123A", "CSE 123B",
        "CSE 125", "CSE 130", "CSE 131", "CSE 132", "CSE 138", "CSE 140",
        "CSE 142", "CSE 143", "CSE 144", "CSE 145", "CSE 148", "CSE 151",
        "CSE 156", "CSE 157", "CSE 160", "CSE 161", "CSE 162", "CSE 163",
        "CSE 165", "CSE 168", "CSE 180", "CSE 183", "CSE 184", "CSE 185",
        "AM 100", "AM 112", "AM 114", "AM 115", "AM 129", "AM 130",
        "AM 147", "ECE 101", "ECE 103", "ECE 118", "ECE 121", "ECE 151",
        "ECE 153", "ECE 171"
      ],
      description: "Choose two UD Baskin Engineering courses from the approved list."
    },
    {
      id: "ECON_ELECTIVE",
      name: "Upper Division Economics Elective",
      type: "pick_n",
      n: 1,
      courses: [
        "ECON 100B", "ECON 101", "ECON 102", "ECON 104", "ECON 110A", "ECON 110B",
        "ECON 111A", "ECON 111B", "ECON 114", "ECON 115", "ECON 120", "ECON 122A",
        "ECON 128", "ECON 129", "ECON 130", "ECON 131", "ECON 133", "ECON 135",
        "ECON 136", "ECON 137", "ECON 140", "ECON 141", "ECON 150", "ECON 155",
        "ECON 160", "ECON 161A", "ECON 161B", "ECON 166", "ECON 170", "ECON 171",
        "ECON 172", "ECON 173", "ECON 175", "ECON 176", "ECON 177", "ECON 178",
        "ECON 180", "ECON 181", "ECON 182", "ECON 183", "ECON 185",
        "ECON 187", "ECON 188", "ECON 189"
      ],
      description: "Choose one UD Economics course from the approved list."
    },
    {
      id: "DC",
      name: "Disciplinary Communication (DC)",
      type: "all_required",
      courses: ["TIM 175"],
      description: "TIM 175 satisfies the DC requirement."
    }
  ]
};

// ------------------------------------------------------------
// MAJOR REGISTRY
// The wizard dropdown iterates this to populate major choices.
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
  "RE_BS": RE_BS_REQUIREMENTS,
  "TIM_BS": TIM_BS_REQUIREMENTS,
};
