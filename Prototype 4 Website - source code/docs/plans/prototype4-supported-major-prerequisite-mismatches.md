# Prototype 4 — Supported-Major Prerequisite Mismatches / Review List

This is a user-facing handoff document generated from the official UCSC catalog audit artifacts. It is for review only; no database edits are implied by this file.

## Scope

- Exact current local courses reviewed overall: **4151**
- Supported-major exact-current courses needing human prerequisite review: **177**
- Rows currently listed under the generated “highest-priority” section: **160**
- Note: the earlier summary headline said 162 high-priority candidates, but the generated markdown section currently contains 160 rows. To avoid missing anything, this document includes **all 177** supported-major courses that need review, with a Yes/No marker for whether each appeared in the generated high-priority section.

## How to read this

- **Local prereqs** = what Prototype 4 currently encodes.
- **Official prereq text** = text fetched from the current UCSC General Catalog course page.
- **Flags** = conditions that need careful interpretation, e.g. placement exam, writing requirement, prior-or-concurrent, consent/permission, major/enrollment restrictions.
- **Missing official alternatives locally** = official prerequisite alternatives mentioned by UCSC but not present as local `COURSES` entries; these should not be auto-added without a decision.

## Review rows

### 1. AM 10 — Mathematical Methods for Engineers I

- Majors impacted: AM_BS, BMEB_BI, BMEB_BM, CE_BS, CSGD_BS, CS_BA, CS_BS, EE_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (MATH 3 OR AM 11A OR MATH 11A OR MATH 19A OR MATH 20A)
- Official prereq text: MATH 19A or MATH 20A .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/am-applied-mathematics/lower-division/am-10

### 2. AM 100 — Mathematical Methods for Engineers

- Majors impacted: AM_BS, EE_BS, TIM_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (AM 20 OR MATH 24 OR AM 30 OR MATH 23B)
- Official prereq text: AM 20 or MATH 24 , and AM 30 or MATH 23B , or by permission of instructor.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/am-applied-mathematics/upper-division/am-100

### 3. AM 112 — Introduction to Partial Differential Equations

- Majors impacted: AM_BS, TIM_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (AM 100)
- Official prereq text: AM 100 or by permission of the instructor.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/am-applied-mathematics/upper-division/am-112

### 4. AM 114 — Introduction to Dynamical Systems

- Majors impacted: AM_BS, CS_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (AM 10 OR PHYS 116A) AND (AM 20 OR PHYS 116A) AND (AM 30 OR PHYS 116A)
- Official prereq text: AM 10 or MATH 21 ; and AM 20 or MATH 24 ; and AM 30 or MATH 23A or MATH 22 ; or PHYS 116A .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/am-applied-mathematics/upper-division/am-114

### 5. AM 115 — Stochastic Modeling in Biology

- Majors impacted: AM_BS, BMEB_BI, BMEB_BM, TIM_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (STAT 131) AND (AM 20)
- Official prereq text: STAT 131 and AM 20 ; a university-level course in biology, and operational knowledge of a programming language; or consent of instructor.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/am-applied-mathematics/upper-division/am-115

### 6. AM 129 — Foundations of Scientific Computing for Scientists and Engineers

- Majors impacted: AM_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (AM 10 OR MATH 21) AND (MATH 11A OR MATH 19A OR MATH 20A)
- Official prereq text: CSE 20 or CSE 13S or CSE 30 or ECE 13 or ASTR 19 ; and AM 10 or MATH 21 ; and MATH 11A or MATH 19A or MATH 20A ; and AM 20 or MATH 24 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/am-applied-mathematics/upper-division/am-129

### 7. AM 148 — GPU Programming for Scientific Computations

- Majors impacted: CS_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (AM 147 OR MATH 148 OR PHYS 115)
- Official prereq text: CSE 20 or CSE 13S or CSE 30 or ECE 13 or ASTR 19 ; and AM 147 or MATH 148 or PHYS 115 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/am-applied-mathematics/upper-division/am-148

### 8. AM 170A — Mathematical Modeling 1

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (AM 30 OR AM 114 OR STAT 131 OR CSE 107)
- Official prereq text: satisfaction of the Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/am-applied-mathematics/upper-division/am-170a

### 9. AM 170B — Mathematical Modeling 2

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (AM 129 OR AM 112) AND (AM 147) AND (AM 170A)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/am-applied-mathematics/upper-division/am-170b

### 10. AM 195 — Senior Thesis Research

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (none encoded)
- Official prereq text: AM 129 or AM 209, and AM 112 , and AM 147 , and AM 170A .
- Flags: none
- Official alternatives missing locally: AM 209
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/am-applied-mathematics/upper-division/am-195

### 11. ASTR 21 — The Diverse Universe: Stars, Planets, and Galaxies

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5A)
- Official prereq text: PHYS 5A or PHYS 15A .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/astr-astronomy-and-astrophysics/1-99/astr-21

### 12. ASTR 119 — Introduction to Scientific Computing

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (MATH 11A OR MATH 19A OR MATH 20A OR AM 15A)
- Official prereq text: MATH 11A or MATH 19A or MATH 20A or AM 15A.
- Flags: none
- Official alternatives missing locally: AM 15A
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/astr-astronomy-and-astrophysics/100/astr-119

### 13. BME 101 — Molecular Biology for Biomolecular Engineers

- Majors impacted: BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (BIOL 20A)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-101

### 14. BME 110 — Computational Biology Tools

- Majors impacted: BIOTECH_BS, BMEB_BI, BMEB_BM
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (BME 105 OR BIOL 100 OR BIOL 105 OR BIOC 100A OR CHEM 103)
- Official prereq text: BME 105 , or BIOL 100 , or BIOL 105 , or BIOC 100A , or CHEM 103, or bioinformatics majors, or biomolecular engineering and bioinformatics majors.
- Flags: contains-major-or-enrollment-condition
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-110

### 15. BME 118 — Mathematics of the Mind

- Majors impacted: AM_BS, BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (MATH 19A) AND (MATH 19B) AND (MATH 20B) AND (MATH 21) AND (CSE 20)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-118

### 16. BME 123L — Long Read Sequencing

- Majors impacted: BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (BME 22L)
- Official prereq text: BME 22L, and previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-123l

### 17. BME 128 — Protein Engineering

- Majors impacted: BIOTECH_BS, BMEB_BI, BMEB_BM
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (BIOL 100 OR BIOC 100A OR CHEM 103)
- Official prereq text: BIOL 100 or BIOC 100A or CHEM 103, or by permission of instructor.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-128

### 18. BME 128L — Protein Engineering Laboratory

- Majors impacted: BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (BME 22L)
- Official prereq text: BME 22L; and previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-128l

### 19. BME 129A — Project Design and Implementation in Biomolecular Engineering I

- Majors impacted: BMEB_BM
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (BME 22L) AND (BIOL 100 OR BIOC 100A OR CHEM 103 OR BME 101)
- Official prereq text: BME 22L; BIOL 100 or BIOC 100A or CHEM 103 or BME 101; and previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-129a

### 20. BME 129B — Project Design and Implementation in Biomolecular Engineering II

- Majors impacted: BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (BME 129A OR BME 150)
- Official prereq text: BME 129A or BME 150.
- Flags: none
- Official alternatives missing locally: BME 150
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-129b

### 21. BME 129C — Project Design and Implementation in Biomolecular Engineering III

- Majors impacted: BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (BME 129B OR BME 230A) AND (BME 185)
- Official prereq text: BME 129B or BME 230A .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-129c

### 22. BME 130 — Genomes

- Majors impacted: BIOTECH_BS, BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (BIOL 105)
- Official prereq text: BIOL 105 or BME 105 or METX 140 ; or permission of the instructor.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-130

### 23. BME 140 — Bioinstrumentation

- Majors impacted: BIOTECH_BS, BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (BME 5 OR BME 51A OR EE 101 OR BIOL 100 OR BIOC 100A) AND (BME 51B OR EE 101L OR BME 5 OR BIOL 100 OR BIOC 100A)
- Official prereq text: BME 5; or BME 51A and BME 51B ; or EE 101 and EE 101L; or BIOL 100 ; or BIOC 100A .
- Flags: none
- Official alternatives missing locally: EE 101, EE 101L
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-140

### 24. BME 160 — Research Programming in the Life Sciences

- Majors impacted: AM_BS, BIOTECH_BS, BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (BIOL 20A OR BIOL 21A)
- Official prereq text: BIOL 20A or BIOL 21A.
- Flags: none
- Official alternatives missing locally: BIOL 21A
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-160

### 25. BME 163 — Applied Visualization and Analysis of Scientific Data

- Majors impacted: BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (BME 160 OR BME 205 OR CSE 20)
- Official prereq text: BME 160 or BME 205 or CSE 20 . Prerequisites can be waived in cases where students have the required programming skills, or who have passed the CSE 20 test-out exam. See CSE 20 Testout Exam (https://undergrad.engineering.ucsc.edu/advising/policies-forms-petitions/cse/) for resources and further information.
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-163

### 26. BME 177 — Engineering Stem Cells

- Majors impacted: BIOTECH_BS, BMEB_BI, BMEB_BM
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (BIOL 20A)
- Official prereq text: BIOL 20A or by consent of instructor. Basic knowledge of molecular and cellular biology is required.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-177

### 27. BME 177L — Engineering Stem Cell Laboratory

- Majors impacted: BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (BME 22L)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-177l

### 28. BME 178 — Stem Cell Biology

- Majors impacted: BIOTECH_BS, BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (BIOL 110 OR BME 101 OR BIOC 100A OR BIOL 100 OR CHEM 103) AND (BIOL 115)
- Official prereq text: BIOL 110 or BME 101 or BIOC 100A or BIOL 100 or CHEM 103; BIOL 115 recommended.
- Flags: contains-recommended-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-178

### 29. BME 180 — Professional Practice in Bioengineering

- Majors impacted: BMEB_BM
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (none encoded)
- Official prereq text: previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-180

### 30. BME 185 — Technical Writing for Biomolecular Engineers

- Majors impacted: BIOTECH_BS, BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (BIOL 20A)
- Official prereq text: BIOL 20A ; satisfaction of Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-185

### 31. BME 188A — Synthetic Biology--Mentored Research A

- Majors impacted: BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (none encoded)
- Official prereq text: BME 180.
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-188a

### 32. BME 188B — Synthetic Biology--Mentored Research B

- Majors impacted: BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (none encoded)
- Official prereq text: BME 188A.
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-188b

### 33. BME 188C — Synthetic Biology Mentored Research C

- Majors impacted: BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (none encoded)
- Official prereq text: BME 188B.
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/100/bme-188c

### 34. BME 205 — Bioinformatics: Molecular Biology and Genomics

- Majors impacted: BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (BME 160 OR CSE 20) AND (BME 185)
- Official prereq text: BME 160 or CSE 20 ; and CSE 107 or STAT 131 ; and BME 105 or BIOL 105 ; and previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/200/bme-205

### 35. BME 230A — Computational Genomics

- Majors impacted: BMEB_BI, BMEB_BM
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (BME 205) AND (BME 185)
- Official prereq text: BME 205 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/bme-biomolecular-engineering/200/bme-230a

### 36. CMPM 80J — Games as Technical Culture

- Majors impacted: CSGD_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (none encoded)
- Official prereq text: Satisfaction of the Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cmpm-computational-media/lower-division/cmpm-80j

### 37. CMPM 110 — Writing for Game Technologies

- Majors impacted: CSGD_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (CMPM 120)
- Official prereq text: CMPM 120 , or by permission of the instructor.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cmpm-computational-media/upper-division/cmpm-110

### 38. CMPM 123 — Advanced Programming

- Majors impacted: CSGD_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 101 OR CMPM 35)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cmpm-computational-media/upper-division/cmpm-123

### 39. CMPM 130 — User Interface and User Experience Design

- Majors impacted: CSGD_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (none encoded)
- Official prereq text: satisfaction of the Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cmpm-computational-media/upper-division/cmpm-130

### 40. CMPM 152 — Musical Data

- Majors impacted: CSGD_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CMPM 35 OR CMPM 120 OR CMPM 150 OR CMPM 151)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cmpm-computational-media/upper-division/cmpm-152

### 41. CMPM 163 — Game Graphics and Real-Time Rendering

- Majors impacted: CSGD_BS, CS_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (CMPM 120)
- Official prereq text: CMPM 120 (exceptions granted in special cases with permission of the instructor).
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cmpm-computational-media/upper-division/cmpm-163

### 42. CMPM 164 — Game Engines

- Majors impacted: CSGD_BS, CS_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CMPM 163 OR CSE 160)
- Official prereq text: CMPM 163 or CSE 160 . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cmpm-computational-media/upper-division/cmpm-164

### 43. CMPM 169 — Creative Coding

- Majors impacted: CSGD_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CMPM 35 OR CMPM 120 OR CMPM 163)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cmpm-computational-media/upper-division/cmpm-169

### 44. CMPM 170 — Rapid Prototyping

- Majors impacted: CSGD_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CMPM 120 OR CMPM 121)
- Official prereq text: CMPM 120 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cmpm-computational-media/upper-division/cmpm-170

### 45. CMPM 171 — Game Design Studio

- Majors impacted: CSGD_BS, CS_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CMPM 121 OR CMPM 130 OR CMPM 170 OR CMPM 176)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cmpm-computational-media/upper-division/cmpm-171

### 46. CMPM 172 — Game Production Studio

- Majors impacted: CSGD_BS, CS_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (none encoded)
- Official prereq text: CMPM 171 , or by instructor permission.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cmpm-computational-media/upper-division/cmpm-172

### 47. CSE 30 — Programming Abstractions: Python

- Majors impacted: AM_BS, BMEB_BI, CE_BS, CSGD_BS, CS_BA, CS_BS, EE_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CSE 20 OR BME 160) AND (MATH 3 OR MATH 11A OR MATH 19A OR MATH 20A OR AM 3 OR AM 11A)
- Official prereq text: CSE 20 or BME 160 ; and MATH 3 or MATH 11A or MATH 19A or MATH 20A or AM 3 or AM 11A or ECON 11A, or a score of 400 or higher on the mathematics placement examination (MPE).
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: ECON 11A
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/lower-division/cse-30

### 48. CSE 100 — Logic Design

- Majors impacted: CE_BS, EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CSE 12)
- Official prereq text: CSE 12 ; previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-100

### 49. CSE 100L — Logic Design Laboratory

- Majors impacted: CE_BS, EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CSE 12)
- Official prereq text: CSE 12 ; previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-100l

### 50. CSE 101P — Data Structures and Algorithms (Practice-based)

- Majors impacted: BMEB_BI, CS_BA
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CSE 16) AND (BME 160 OR CSE 20) AND (CSE 30) AND (MATH 11B OR MATH 19B OR MATH 20B OR AM 11B)
- Official prereq text: CSE 16 ; and BME 160 or CSE 20 or CSE 20 Test Out; and CSE 30 ; and MATH 11B or MATH 19B or MATH 20B or AM 11B .
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-101p

### 51. CSE 105 — Modern Algorithmic Toolbox

- Majors impacted: TIM_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (CSE 101M OR CSE 102)
- Official prereq text: CSE 101M , or CSE 102 , or equivalent with instructor permission. Students need a solid background in analysis of algorithms, discrete math, probability theory, graph theory, and overall mathematical maturity.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-105

### 52. CSE 113 — Parallel and Concurrent Programming

- Majors impacted: AM_BS, CE_BS, CSGD_BS, CS_BA, CS_BS, NDT_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 12) AND (CSE 101)
- Official prereq text: CSE 12 and CSE 101 . CSE 120 recommended.
- Flags: contains-recommended-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-113

### 53. CSE 115A — Introduction to Software Engineering

- Majors impacted: CSGD_BS, CS_BA, CS_BS, NDT_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 101) AND (CSE 130)
- Official prereq text: satisfaction of the Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-115a

### 54. CSE 117 — Open Source Programming

- Majors impacted: CSGD_BS, NDT_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 101) AND (CSE 102 OR CSE 111 OR CSE 115A)
- Official prereq text: CSE 101 ; and CSE 111 or CSE 115A .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-117

### 55. CSE 118 — Mobile Applications

- Majors impacted: CSGD_BS, CS_BA, CS_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 101)
- Official prereq text: CSE 101 or CSE 101P .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-118

### 56. CSE 120 — Computer Architecture

- Majors impacted: CE_BS, CSGD_BS, CS_BA, CS_BS, NDT_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 12) AND (CSE 13S OR ECE 13)
- Official prereq text: CSE 12 ; and CSE 13E, or CSE 13S , or ECE 13 , or CSE 15 and CSE 15L. CSE 16 recommended.
- Flags: contains-recommended-language
- Official alternatives missing locally: CSE 13E, CSE 15, CSE 15L
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-120

### 57. CSE 123A — Engineering Design Project I

- Majors impacted: CE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CSE 121)
- Official prereq text: CSE 121 ; previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-123a

### 58. CSE 129A — Capstone Project I

- Majors impacted: CE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (none encoded)
- Official prereq text: previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-129a

### 59. CSE 129B — Capstone Project II

- Majors impacted: CE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (none encoded)
- Official prereq text: CSE 121 , CSE 121L, and CSE 129A . Previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: CSE 121L
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-129b

### 60. CSE 129C — Capstone Project III

- Majors impacted: CE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (none encoded)
- Official prereq text: CSE 129B and CSE 185.
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-129c

### 61. CSE 132 — Computer Security

- Majors impacted: CSGD_BS, CS_BA, CS_BS, NDT_BS, TIM_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (CSE 130 OR CSE 131)
- Official prereq text: CSE 130 or CSE 131 or permission of instructor.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-132

### 62. CSE 144 — Applied Machine Learning

- Majors impacted: AM_BS, BMEB_BI, CSGD_BS, CS_BA, CS_BS, NDT_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CSE 40 OR STAT 132) AND (CSE 101 OR CSE 101P)
- Official prereq text: CSE 40 , CSE 40 test-out, or STAT 132 ; and CSE 101 or CSE 101P .
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-144

### 63. CSE 146 — Ethics and Algorithms

- Majors impacted: CSGD_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CSE 101) AND (CSE 107 OR STAT 131) AND (CSE 40 OR CSE 142) AND (CSE 140)
- Official prereq text: CSE 101 ; and CSE 107 or STAT 131 ; and CSE 40 . CSE 142 and CSE 140 are recommended.
- Flags: contains-recommended-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-146

### 64. CSE 151 — Advanced Computer Networks

- Majors impacted: NDT_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CSE 150)
- Official prereq text: CSE 150 . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-151

### 65. CSE 151L — Advanced Computer Networks Laboratory

- Majors impacted: NDT_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CSE 150)
- Official prereq text: CSE 150 . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-151l

### 66. CSE 156 — Network Programming

- Majors impacted: CE_BS, CSGD_BS, CS_BA, CS_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 150) AND (CSE 101)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-156

### 67. CSE 156L — Network Programming Laboratory

- Majors impacted: CE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 150) AND (CSE 101)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-156l

### 68. CSE 161 — Introduction to Data Visualization

- Majors impacted: AM_BS, CSGD_BS, CS_BS, NDT_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CSE 160)
- Official prereq text: CSE 160 or equivalent. Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-161

### 69. CSE 162 — Advanced Computer Graphics and Animation

- Majors impacted: AM_BS, CSGD_BS, CS_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CSE 160)
- Official prereq text: CSE 160 or equivalent. Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-162

### 70. CSE 167 — Mobile Sensing and Interaction

- Majors impacted: NDT_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 13S OR CSE 13E OR CSE 15) AND (CSE 15L OR CSE 13S OR CSE 13E) AND (PHYS 5A OR CSE 13S OR CSE 13E) AND (AM 10 OR CSE 13S OR CSE 13E)
- Official prereq text: CSE 13S ; or CSE 13E or ECE 13 ; or CSE 15 and CSE 15L; and PHYS 5A or PHYS 15A or PHYS 6A ; and AM 10 or MATH 21 .
- Flags: none
- Official alternatives missing locally: CSE 13E, CSE 15, CSE 15L
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-167

### 71. CSE 182 — Introduction to Database Management Systems

- Majors impacted: BMEB_BI, NDT_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 16 OR BME 160) AND (CSE 30)
- Official prereq text: CSE 16 or BME 160 ; and CSE 30 . Course restricted to juniors and seniors and intended for non-majors; computer science majors should enroll in CSE 180 .
- Flags: contains-major-or-enrollment-condition
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-182

### 72. CSE 185E — Technical Writing for Computer Engineering

- Majors impacted: CE_BS, CS_BA, CS_BS, NDT_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (none encoded)
- Official prereq text: satisfaction of Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-185e

### 73. CSE 186 — Full Stack Web Development I

- Majors impacted: CSGD_BS, CS_BA, CS_BS, NDT_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 101 OR CSE 101P); prior-or-concurrent: (CSE 180 OR CSE 182)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-186

### 74. CSE 195 — Senior Thesis

- Majors impacted: CE_BS, CS_BA, CS_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (none encoded)
- Official prereq text: satisfaction of the Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/cse-computer-science-and-engineering/upper-division/cse-195

### 75. ECE 9 — Statics and Mechanics of Materials

- Majors impacted: AM_BS, CE_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (MATH 19A OR MATH 20A) AND (PHYS 5A OR PHYS 5L OR PHYS 6A OR PHYS 6L) AND (AM 10 OR MATH 21)
- Official prereq text: MATH 19A or MATH 20A ; and PHYS 5A or PHYS 15A and PHYS 5L ; or PHYS 6A and PHYS 6L ; and AM 10 or MATH 21 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/lower-division/ece-9

### 76. ECE 13 — Computer Systems and C Programming

- Majors impacted: AM_BS, CE_BS, CSGD_BS, EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (CSE 12 OR CSE 20 OR CSE 30)
- Official prereq text: CSE 12 . CSE 20 or CSE 30 (Python programming background) is recommended but not required. Programming experience in any other language is also acceptable.
- Flags: contains-recommended-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/lower-division/ece-13

### 77. ECE 101 — Introduction to Electronic Circuits

- Majors impacted: AM_BS, CE_BS, EE_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5C OR PHYS 6C) AND (PHYS 5N OR PHYS 6N) AND (AM 20 OR MATH 24)
- Official prereq text: PHYS 5C or PHYS 15C and PHYS 5N ; or PHYS 6C and PHYS 6N ; and MATH 24 or PHYS 116A , or previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-101

### 78. ECE 101L — Introduction to Electronic Circuits Laboratory

- Majors impacted: CE_BS, EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5C OR PHYS 6C) AND (PHYS 5N OR PHYS 6N) AND (AM 20 OR MATH 24)
- Official prereq text: PHYS 5C or PHYS 15C and PHYS 5N ; or PHYS 6C and PHYS 6N ; and MATH 24 or PHYS 116A , or previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-101l

### 79. ECE 102 — Properties of Materials

- Majors impacted: EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5A OR PHYS 6A) AND (PHYS 5L OR PHYS 6L) AND (PHYS 5M OR PHYS 6M) AND (PHYS 5C OR PHYS 6C) AND (PHYS 5N OR PHYS 6N)
- Official prereq text: PHYS 5A or PHYS 15A and PHYS 5L , PHYS 5B and PHYS 5M , and PHYS 5C or PHYS 15C and 5N; or PHYS 6A and PHYS 6L , PHYS 6B and PHYS 6M , and PHYS 6C and PHYS 6N . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-102

### 80. ECE 102L — Properties of Materials Laboratory

- Majors impacted: EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5A OR PHYS 6A) AND (PHYS 5L OR PHYS 6L) AND (PHYS 5M OR PHYS 6M) AND (PHYS 5C OR PHYS 6C) AND (PHYS 5N OR PHYS 6N)
- Official prereq text: PHYS 5A or PHYS 15A and PHYS 5L , PHYS 5B and PHYS 5M , and PHYS 5C or PHYS 15C and 5N; or PHYS 6A and PHYS 6L , PHYS 6B and PHYS 6M , and PHYS 6C and PHYS 6N . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-102l

### 81. ECE 103L — Signals and Systems Laboratory

- Majors impacted: CE_BS, EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (ECE 101) AND (ECE 101L) AND (AM 20 OR MATH 24)
- Official prereq text: ECE 101 and ECE 101L and AM 20 or MATH 24 . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-103l

### 82. ECE 118 — Introduction to Mechatronics

- Majors impacted: CE_BS, CSGD_BS, EE_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 101) AND (ECE 101L) AND (CSE 100) AND (CSE 100L) AND (ECE 13 OR CSE 13E)
- Official prereq text: ECE 101 and ECE 101L ; and CSE 100 and CSE 100L ; and ECE 13 or CSE 13S or CSE 13E. ECE 121 and ECE 167 are highly recommended (but not required).
- Flags: contains-recommended-language
- Official alternatives missing locally: CSE 13E
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-118

### 83. ECE 121 — Microcontroller System Design

- Majors impacted: EE_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 12) AND (ECE 13 OR CSE 13E)
- Official prereq text: CSE 12 ; and ECE 13 or CSE 13E. Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: CSE 13E
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-121

### 84. ECE 122B — Collaborative Sustainability Project Implementation

- Majors impacted: EE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (none encoded)
- Official prereq text: ECE 122A . Students apply online; selected applicants complete in-person interviews.
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-122b

### 85. ECE 129A — Capstone Project I

- Majors impacted: EE_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 100) AND (ECE 118 OR ECE 171) AND (ECE 121 OR ECE 157 OR ECE 173)
- Official prereq text: satisfaction of the Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-129a

### 86. ECE 129B — Capstone Project II

- Majors impacted: EE_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 129A)
- Official prereq text: satisfaction of the Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-129b

### 87. ECE 129C — Capstone Project III

- Majors impacted: EE_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 129B)
- Official prereq text: satisfaction of the Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-129c

### 88. ECE 130 — Introduction to Optoelectronics and Photonics

- Majors impacted: EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5B OR PHYS 5C OR PHYS 6B OR PHYS 6C)
- Official prereq text: PHYS 5B and PHYS 5C , or PHYS 15C , or PHYS 6B and PHYS 6C ; and concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-130

### 89. ECE 130L — Introduction to Optoelectronics Laboratory

- Majors impacted: EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (PHYS 5L OR PHYS 5M OR PHYS 5N OR PHYS 6L OR PHYS 6M OR PHYS 6N)
- Official prereq text: PHYS 5L , PHYS 5M , and PHYS 5N , or PHYS 6L , PHYS 6M , and PHYS 6N ; concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-130l

### 90. ECE 135 — Electromagnetic Fields and Waves

- Majors impacted: AM_BS, EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 101 OR ECE 101L OR PHYS 102) AND (AM 20 OR PHYS 116A OR MATH 24)
- Official prereq text: ECE 101 and ECE 101L , or PHYS 102 ; and AM 20 or PHYS 116A or MATH 24 . Students must concurrently enroll in ECE 135L .
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-135

### 91. ECE 135L — Electromagnetic Fields and Waves Laboratory

- Majors impacted: EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 101 OR ECE 101L OR PHYS 102) AND (AM 20 OR PHYS 116A OR MATH 24)
- Official prereq text: ECE 101 and ECE 101L , or PHYS 102 ; and AM 20 or PHYS 116A or MATH 24 . Students must concurrently enroll in ECE 135 .
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-135l

### 92. ECE 141 — Feedback Control Systems

- Majors impacted: AM_BS, EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 103)
- Official prereq text: ECE 103 , and majors in the School of Engineering and Division of Physical and Biological Sciences programs, with the exception of physics majors. Prerequisites for physics majors: PHYS 116A , PHYS 116C , and PHYS 133 .
- Flags: contains-major-or-enrollment-condition
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-141

### 93. ECE 149 — Introduction to Cyber-physical Systems

- Majors impacted: AM_BS, EE_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 100 OR CSE 100L OR ECE 13 OR CSE 13E)
- Official prereq text: CSE 100 and CSE 100L or equivalent, and ECE 13 or CSE 13E or equivalent.
- Flags: none
- Official alternatives missing locally: CSE 13E
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-149

### 94. ECE 152 — Introduction to Wireless Communications

- Majors impacted: EE_BS, NDT_BS, RE_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (CSE 107 OR ECE 151)
- Official prereq text: CSE 107 and ECE 151 , or by consent of instructor.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-152

### 95. ECE 157 — RF Hardware Design

- Majors impacted: EE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 101) AND (ECE 101L) AND (ECE 171) AND (ECE 174)
- Official prereq text: ECE 101 and ECE 101L , ECE 103 , and ECE 171 , and ECE 174 ; or consent of instructor. Concurrent
- Flags: contains-permission-or-consent-exception, contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-157

### 96. ECE 163 — Introduction to Small-Scale UAV Theory and Practice

- Majors impacted: AM_BS, EE_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 141 OR ECE 241 OR ECE 242) AND (CSE 30 OR ECE 13 OR CSE 13E OR CSE 13S OR ECE 121 OR ECE 167 OR ECE 145)
- Official prereq text: ECE 141 or ECE 241 or ECE 242 ; and CSE 30 or ECE 13 or CSE 13E or CSE 13S . ECE 121 , ECE 167 , and ECE 145 recommended but not required.
- Flags: contains-recommended-language
- Official alternatives missing locally: ECE 241, CSE 13E
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-163

### 97. ECE 167 — Sensing and Sensor Technologies

- Majors impacted: EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 13E OR ECE 13) AND (ECE 103) AND (ECE 103L)
- Official prereq text: CSE 13E or ECE 13 ; and ECE 103 and ECE 103L .
- Flags: none
- Official alternatives missing locally: CSE 13E
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-167

### 98. ECE 169 — Electric Machinery and Control

- Majors impacted: EE_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 176 OR ECE 176L)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-169

### 99. ECE 170 — Advanced Power Electronics

- Majors impacted: EE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 177)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-170

### 100. ECE 171 — Analog Electronics

- Majors impacted: CE_BS, EE_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (ECE 101) AND (ECE 101L)
- Official prereq text: ECE 101 and ECE 101L ; previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-171

### 101. ECE 171L — Analog Electronics Laboratory

- Majors impacted: CE_BS, EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (ECE 101) AND (ECE 101L)
- Official prereq text: ECE 101 and ECE 101L ; previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-171l

### 102. ECE 173 — High-Speed Digital Design

- Majors impacted: EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (ECE 101 OR ECE 101L OR ECE 174 OR ECE 171 OR ECE 121)
- Official prereq text: ECE 101 and ECE 101L and ECE 174 , or by permission of the instructor. ECE 171 and ECE 121 are recommended.
- Flags: contains-recommended-language, contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-173

### 103. ECE 174 — Introduction to EDA Tools for PCB Design

- Majors impacted: EE_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (ECE 101 OR ECE 101L)
- Official prereq text: ECE 101 and ECE 101L or consent of instructor.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-174

### 104. ECE 175 — Energy Generation and Control

- Majors impacted: EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (ECE 101)
- Official prereq text: ECE 101 . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-175

### 105. ECE 175L — Energy Generation and Control Laboratory

- Majors impacted: EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (ECE 101)
- Official prereq text: ECE 101 . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-175l

### 106. ECE 176 — Energy Conservation and Control

- Majors impacted: EE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 103) AND (ECE 171)
- Official prereq text: ECE 101 . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-176

### 107. ECE 176L — Energy Conversion and Control Laboratory

- Majors impacted: EE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 103) AND (ECE 171)
- Official prereq text: ECE 101 . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-176l

### 108. ECE 177 — Power Electronics

- Majors impacted: EE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (ECE 103)
- Official prereq text: ECE 103 . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-177

### 109. ECE 177L — Power Electronics Laboratory

- Majors impacted: EE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (ECE 103)
- Official prereq text: ECE 103 . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-177l

### 110. ECE 180J — Advanced Renewable Energy Sources, Storage, and Smart Grids

- Majors impacted: EE_BS, NDT_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (AM 11A OR MATH 11A OR MATH 19A OR MATH 19B OR MATH 20A OR MATH 20B) AND (STAT 5 OR STAT 7 OR STAT 17 OR STAT 131 OR CSE 107 OR PHYS 5C OR PHYS 5N OR PHYS 6C OR PHYS 6N)
- Official prereq text: AM 11A or MATH 11A or MATH 19A or MATH 19B or MATH 20A or MATH 20B ; and STAT 5 or STAT 7 or STAT 17 or STAT 131 or CSE 107 . PHYS 5C or PHYS 15C and PHYS 5N or PHYS 6C and PHYS 6N are recommended.
- Flags: contains-recommended-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-180j

### 111. ECE 185 — Introduction to the US Electricity Industry

- Majors impacted: EE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5C OR PHYS 6C) AND (PHYS 5N OR PHYS 6N)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-185

### 112. ECE 195 — Senior Thesis Research

- Majors impacted: EE_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (none encoded)
- Official prereq text: satisfaction of the Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/upper-division/ece-195

### 113. ECE 215 — Models of Robotic Manipulation

- Majors impacted: RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 141) AND (AM 10 OR MATH 21)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/graduate/ece-215

### 114. ECE 216 — Bio-Inspired Locomotion

- Majors impacted: RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (none encoded)
- Official prereq text: ECE 9 or equivalent.
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/graduate/ece-216

### 115. ECE 222A — Advances in Agriculture Technology

- Majors impacted: RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (none encoded)
- Official prereq text: previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/graduate/ece-222a

### 116. ECE 240 — Introduction to Linear Dynamical Systems

- Majors impacted: RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 103)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/graduate/ece-240

### 117. ECE 243 — System Identification

- Majors impacted: RE_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (ECE 240)
- Official prereq text: ECE 240 , or by permission of instructor.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/graduate/ece-243

### 118. ECE 246 — Hybrid Dynamical Systems

- Majors impacted: RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECE 240)
- Official prereq text: ECE 240 or ECE 241 or ECE 242 .
- Flags: none
- Official alternatives missing locally: ECE 241
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/graduate/ece-246

### 119. ECE 249 — Introduction to Cyber-physical Systems

- Majors impacted: RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 100) AND (ECE 13 OR CSE 13E)
- Official prereq text: CSE 100 and CSE 100L or equivalent, and ECE 13 or CSE 13E or equivalent.
- Flags: none
- Official alternatives missing locally: CSE 13E
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/ece-electrical-and-computer-engineering/graduate/ece-249

### 120. ECON 100A — Intermediate Microeconomics

- Majors impacted: AM_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECON 1) AND (ECON 2) AND (AM 11B OR ECON 11B OR MATH 22 OR MATH 23A OR AM 30)
- Official prereq text: ECON 1 and ECON 2 ; and AM 11B or ECON 11B or MATH 22 or MATH 23A or AM 30 .
- Flags: none
- Official alternatives missing locally: ECON 11B
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/econ-economics/upper-division/econ-100a

### 121. ECON 100B — Intermediate Macroeconomics

- Majors impacted: AM_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECON 1) AND (ECON 2) AND (AM 11B OR ECON 11B OR MATH 22 OR MATH 23A OR AM 30)
- Official prereq text: ECON 1 and ECON 2 ; and AM 11B or ECON 11B or MATH 22 or MATH 23A or AM 30 .
- Flags: none
- Official alternatives missing locally: ECON 11B
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/econ-economics/upper-division/econ-100b

### 122. ECON 100M — Intermediate Microeconomics, Math Intensive

- Majors impacted: AM_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECON 1) AND (ECON 2) AND (AM 11B OR ECON 11B OR MATH 22 OR MATH 23A)
- Official prereq text: ECON 1 and ECON 2 ; and AM 11B or ECON 11B or MATH 22 or MATH 23A .
- Flags: none
- Official alternatives missing locally: ECON 11B
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/econ-economics/upper-division/econ-100m

### 123. ECON 100N — Intermediate Macroeconomics, Math Intensive

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECON 1) AND (ECON 2) AND (AM 11B OR ECON 11B OR MATH 22 OR MATH 23A)
- Official prereq text: ECON 1 and ECON 2 ; and AM 11B or ECON 11B or MATH 22 or MATH 23A .
- Flags: none
- Official alternatives missing locally: ECON 11B
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/econ-economics/upper-division/econ-100n

### 124. ECON 104 — Is There Truth in Numbers: The Role of Statistics in Economics

- Majors impacted: TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (ECON 100A OR ECON 100M) AND (ECON 113)
- Official prereq text: ECON 100A or ECON 100M ; and ECON 113 , and Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/econ-economics/upper-division/econ-104

### 125. ECON 113 — Introduction to Econometrics

- Majors impacted: AM_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECON 1) AND (ECON 2) AND (STAT 17) AND (STAT 17L) AND (AM 11B OR ECON 11B OR MATH 22 OR MATH 23A OR AM 30 OR ECON 100A OR ECON 100B)
- Official prereq text: ECON 1 and ECON 2 ; STAT 17 and STAT 17L ; and one of the following: AM 11B or ECON 11B, or MATH 22 , or MATH 23A , or AM 30 . ECON 100A or ECON 100B strongly recommended as preparation.
- Flags: contains-recommended-language
- Official alternatives missing locally: ECON 11B
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/econ-economics/upper-division/econ-113

### 126. ECON 124 — Machine Learning for Economists

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECON 113 OR ECON 216)
- Official prereq text: ECON 113 or ECON 216 .
- Flags: none
- Official alternatives missing locally: ECON 216
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/econ-economics/upper-division/econ-124

### 127. ECON 166A — Game Theory and Applications I

- Majors impacted: AM_BS, CSGD_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (STAT 5 OR STAT 7 OR STAT 17 OR ECON 113) AND (AM 11B OR ECON 11B OR MATH 11B OR MATH 19B OR STAT 131 OR CSE 107)
- Official prereq text: STAT 5 , STAT 7 , STAT 17 or ECON 113 ; and AM 11B or ECON 11B, or MATH 11B , MATH 19B , STAT 131 or CSE 107 .
- Flags: none
- Official alternatives missing locally: ECON 11B
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/econ-economics/upper-division/econ-166a

### 128. ECON 183 — Women in the Economy

- Majors impacted: TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (ECON 100A OR ECON 100M) AND (ECON 113)
- Official prereq text: ECON 100A or ECON 100M ; and ECON 113 is strongly recommended.
- Flags: contains-recommended-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/econ-economics/upper-division/econ-183

### 129. ECON 188 — Management in the Global Economy

- Majors impacted: TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (ECON 113 OR ECON 100A OR ECON 100M)
- Official prereq text: ECON 100A or ECON 100M ; and STAT 5 or STAT 7 or STAT 17 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/econ-economics/upper-division/econ-188

### 130. FMST 133 — Science and the Body

- Majors impacted: BIOTECH_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (none encoded)
- Official prereq text: FMST 1 and FMST 100 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/fmst-feminist-studies/upper-division/fmst-133

### 131. MATH 19A — Calculus for Science, Engineering, and Mathematics

- Majors impacted: AM_BS, BMEB_BI, BMEB_BM, CE_BS, CSGD_BS, CS_BA, CS_BS, EE_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (none encoded)
- Official prereq text: MATH 3 ; or mathematics placement (MP) score of 400 or higher; or qualifying AP exam. See the UCSC Exam Equivalency Chart in the Undergraduate Academic Program section of the catalog for details.
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/lower-division/math-19a

### 132. MATH 19B — Calculus for Science, Engineering, and Mathematics

- Majors impacted: AM_BS, BMEB_BI, BMEB_BM, CE_BS, CSGD_BS, CS_BA, CS_BS, EE_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (MATH 19A OR MATH 20A OR MATH 11A)
- Official prereq text: MATH 11A or MATH 19A or MATH 20A or qualifying exam. See the UCSC Exam Equivalency Chart in the Undergraduate Academic Program section of the catalog for details.
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/lower-division/math-19b

### 133. MATH 20A — Honors Calculus

- Majors impacted: AM_BS, BMEB_BI, BMEB_BM, CSGD_BS, CS_BA, CS_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (none encoded)
- Official prereq text: mathematics placement (MP) score of 500 higher; or qualifying exam. See the UCSC Exam Equivalency Chart in the Undergraduate Academic Program section of the catalog for details.
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/lower-division/math-20a

### 134. MATH 21 — Linear Algebra

- Majors impacted: AM_BS, BMEB_BI, BMEB_BM, CE_BS, CSGD_BS, CS_BA, CS_BS, EE_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (MATH 19A OR MATH 20A OR MATH 3 OR AM 11A OR MATH 11A)
- Official prereq text: score of 400 or higher on the mathematics placement examination (MPE) or MATH 3 or AM 11A or MATH 11A or MATH 19A or MATH 20A .
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/lower-division/math-21

### 135. MATH 22 — Introduction to Calculus of Several Variables

- Majors impacted: TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (MATH 11B OR MATH 19B OR MATH 20B OR AM 15B)
- Official prereq text: MATH 11B or MATH 19B or MATH 20B or AM 15B or qualifying AP exam. See the UCSC Exam Equivalency Chart in the Undergraduate Academic Program section of the catalog for details.
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: AM 15B
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/lower-division/math-22

### 136. MATH 23A — Vector Calculus

- Majors impacted: AM_BS, BMEB_BI, CE_BS, CS_BS, EE_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (MATH 19B OR MATH 20B)
- Official prereq text: MATH 19B or MATH 20B or qualifying AP exam. See the UCSC Exam Equivalency Chart in the Undergraduate Academic Program section of the catalog for details.
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/lower-division/math-23a

### 137. MATH 24 — Ordinary Differential Equations

- Majors impacted: AM_BS, EE_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (MATH 22 OR MATH 23A OR AM 30) AND (MATH 21)
- Official prereq text: MATH 22 or MATH 23A or AM 30 ; MATH 21 is recommended as preparation.
- Flags: contains-recommended-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/lower-division/math-24

### 138. MATH 105A — Real Analysis

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (MATH 22 OR MATH 23B OR MATH 100 OR CSE 101)
- Official prereq text: MATH 22 or MATH 23B or AM 30 , and either MATH 100 or CSE 101 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/upper-division/math-105a

### 139. MATH 110 — Introduction to Number Theory

- Majors impacted: AM_BS, CS_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 101)
- Official prereq text: MATH 100 or CSE 101 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/upper-division/math-110

### 140. MATH 114 — Introduction to Financial Mathematics

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (STAT 131 OR CSE 107)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/upper-division/math-114

### 141. MATH 115 — Graph Theory

- Majors impacted: AM_BS, CS_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (MATH 21 OR AM 10) AND (CSE 101)
- Official prereq text: MATH 21 or AM 10 and either MATH 100 or CSE 101 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/upper-division/math-115

### 142. MATH 116 — Combinatorics

- Majors impacted: AM_BS, CS_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 101)
- Official prereq text: MATH 100 or CSE 101 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/upper-division/math-116

### 143. MATH 121A — Differential Geometry

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (MATH 21 OR AM 10 OR MATH 23B OR MATH 100 OR CSE 101 OR MATH 105A)
- Official prereq text: MATH 21 or AM 10 , and MATH 23B , and either MATH 100 or CSE 101 . MATH 105A strongly recommended.
- Flags: contains-recommended-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/upper-division/math-121a

### 144. MATH 124 — Introduction to Topology

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (MATH 100) AND (MATH 111A)
- Official prereq text: MATH 100 ; MATH 111A recommended.
- Flags: contains-recommended-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/upper-division/math-124

### 145. MATH 130 — Celestial Mechanics

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (MATH 19A) AND (MATH 23A OR PHYS 5A OR PHYS 6A) AND (MATH 21) AND (MATH 24)
- Official prereq text: MATH 19A and 19B; and MATH 23A or PHYS 5A or PHYS 6A ; MATH 21 and MATH 24 strongly recommended.
- Flags: contains-recommended-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/upper-division/math-130

### 146. MATH 134 — Cryptography

- Majors impacted: AM_BS, CS_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (MATH 100 OR CSE 101) AND (MATH 110)
- Official prereq text: MATH 100 or CSE 101 ; MATH 110 is recommended as preparation.
- Flags: contains-recommended-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/upper-division/math-134

### 147. MATH 148 — Numerical Analysis

- Majors impacted: AM_BS, CS_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (MATH 22 OR MATH 23A) AND (MATH 21 OR AM 10) AND (MATH 24 OR AM 20) AND (MATH 103A OR MATH 105A OR MATH 152 OR AM 147 OR CSE 101)
- Official prereq text: MATH 22 or MATH 23A or AM 30 ; and MATH 21 or AM 10 ; and MATH 24 or AM 20 ; and MATH 100 or AM 147 or CSE 101 . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/upper-division/math-148

### 148. MATH 160 — Mathematical Logic I

- Majors impacted: AM_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (MATH 100 OR CSE 101)
- Official prereq text: MATH 100 or CSE 101 or by permission of instructor.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/math-mathematics/upper-division/math-160

### 149. PHYS 5A — Introduction to Physics I

- Majors impacted: AM_BS, BMEB_BM, CE_BS, EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (MATH 19A OR MATH 20A)
- Official prereq text: MATH 19A or MATH 20A . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-5a

### 150. PHYS 5B — Introduction to Physics II

- Majors impacted: AM_BS, BMEB_BM, CE_BS, EE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5A OR MATH 19B OR MATH 20B)
- Official prereq text: PHYS 5A or PHYS 15A , and MATH 19B or MATH 20B ; concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-5b

### 151. PHYS 5C — Introduction to Physics III

- Majors impacted: AM_BS, CE_BS, EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5A OR MATH 19B OR MATH 20B)
- Official prereq text: PHYS 5A or PHYS 15A , and MATH 19B or MATH 20B . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-5c

### 152. PHYS 5D — Introduction to Physics IV

- Majors impacted: EE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5A OR PHYS 5L OR PHYS 6A OR PHYS 6L) AND (PHYS 5B OR PHYS 6B) AND (MATH 19B OR MATH 20B)
- Official prereq text: PHYS 5A or PHYS 15A , and PHYS 5L , or PHYS 6A and PHYS 6L ; and PHYS 5B or PHYS 6B ; and MATH 19B or MATH 20B .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-5d

### 153. PHYS 5L — Introduction to Physics I Laboratory

- Majors impacted: BMEB_BM, CE_BS, EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5A OR PHYS 15A)
- Official prereq text: concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-5l

### 154. PHYS 5M — Introduction to Physics II Laboratory

- Majors impacted: BMEB_BM, CE_BS, EE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (PHYS 5L)
- Official prereq text: PHYS 5L ; concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-5m

### 155. PHYS 5N — Introduction to Physics Laboratory III

- Majors impacted: CE_BS, EE_BS, NDT_BS, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (PHYS 5L)
- Official prereq text: PHYS 5L . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-5n

### 156. PHYS 6A — Introductory Physics I

- Majors impacted: NDT_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (MATH 19A OR MATH 20A)
- Official prereq text: MATH 11B or 16B or 19B or 20B or AM 15B.
- Flags: none
- Official alternatives missing locally: AM 15B
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-6a

### 157. PHYS 6C — Introductory Physics III

- Majors impacted: NDT_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5A OR PHYS 6A OR PHYS 7A) AND (MATH 11B OR MATH 16B OR MATH 19B OR MATH 20B OR AM 15B)
- Official prereq text: PHYS 5A or PHYS 15A or PHYS 6A or PHYS 7A ; and MATH 11B or MATH 16B or MATH 19B or MATH 20B or AM 15B.
- Flags: none
- Official alternatives missing locally: AM 15B
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-6c

### 158. PHYS 6L — Introductory Physics I Laboratory

- Majors impacted: NDT_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (none encoded)
- Official prereq text: Previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-6l

### 159. PHYS 6N — Introductory Physics III Laboratory

- Majors impacted: NDT_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (none encoded)
- Official prereq text: Previous or concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-6n

### 160. PHYS 15A — Honors Introduction to Physics I

- Majors impacted: BMEB_BM, RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (MATH 19A OR MATH 20A)
- Official prereq text: MATH 19A or MATH 20A . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-15a

### 161. PHYS 15C — Honors Introduction to Physics - III

- Majors impacted: RE_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (PHYS 5A OR PHYS 15A OR MATH 19B OR MATH 20B)
- Official prereq text: PHYS 5A or PHYS 15A , and MATH 19B or MATH 20B . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/lower-division/phys-15c

### 162. PHYS 105 — Mechanics

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5A) AND (PHYS 5L) AND (PHYS 116A OR MATH 21 OR MATH 24 OR AM 10 OR AM 20) AND (ASTR 119 OR CSE 20)
- Official prereq text: PHYS 5A or PHYS 15A , plus PHYS 5L ; and PHYS 116A , or MATH 21 plus MATH 24 , or AM 10 plus AM 20 ; and ASTR 119 or CSE 20 . Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/upper-division/phys-105

### 163. PHYS 110A — Electricity, Magnetism, and Optics

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 5C) AND (PHYS 116A OR MATH 21 OR MATH 24) AND (PHYS 116C OR MATH 107)
- Official prereq text: PHYS 5C or PHYS 15C ; and PHYS 116A or MATH 21 and MATH 24 ; and PHYS 116C or MATH 107 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/upper-division/phys-110a

### 164. PHYS 150 — Quantum Computing

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (PHYS 116A OR MATH 21 OR AM 10)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/phys-physics/upper-division/phys-150

### 165. STAT 5 — Statistics

- Majors impacted: BIOTECH_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (STAT 7 OR STAT 17)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/stat-statistics/lower-division/stat-5

### 166. STAT 7 — Statistical Methods for the Biological, Environmental, and Health Sciences

- Majors impacted: AM_BS, BIOTECH_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (AM 3 OR AM 11A OR AM 15A OR MATH 3 OR MATH 11A OR MATH 16A OR MATH 19A OR MATH 20A)
- Official prereq text: Mathematics placement (MP) score of 300 or higher or AM 3 or AM 11A or AM 15A or MATH 3 or MATH 11A or MATH 16A or MATH 19A or MATH 20A . Concurrent
- Flags: contains-prior-or-concurrent-language, contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: AM 15A
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/stat-statistics/lower-division/stat-7

### 167. STAT 7L — Statistical Methods for the Biological, Environmental, and Health Sciences Laboratory

- Majors impacted: AM_BS, BIOTECH_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (AM 3 OR AM 11A OR AM 15A OR MATH 3 OR MATH 11A OR MATH 16A OR MATH 19A OR MATH 20A)
- Official prereq text: score of 300 or higher on the mathematics placement examination (MPE), AM 3 or AM 11A or AM 15A or MATH 3 or MATH 11A or MATH 16A or MATH 19A or MATH 20A . Concurrent
- Flags: contains-prior-or-concurrent-language, contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: AM 15A
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/stat-statistics/lower-division/stat-7l

### 168. STAT 17 — Statistical Methods for Business and Economics

- Majors impacted: AM_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (AM 3 OR AM 11A OR ECON 11A OR MATH 3 OR MATH 11A OR MATH 16A OR MATH 19A OR MATH 20A)
- Official prereq text: Mathematics placement (MP) score of 300 or higher or completion of AM 3 or AM 11A or ECON 11A or MATH 3 or MATH 11A or MATH 16A or MATH 19A or MATH 20A . Concurrent
- Flags: contains-prior-or-concurrent-language, contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: ECON 11A
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/stat-statistics/lower-division/stat-17

### 169. STAT 17L — Statistical Methods for Business and Economics Laboratory

- Majors impacted: AM_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (AM 3 OR AM 11A OR ECON 11A OR MATH 3 OR MATH 11A OR MATH 16A OR MATH 19A OR MATH 20A)
- Official prereq text: (none found / none listed)
- Flags: no-official-prereq-text-found
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/stat-statistics/lower-division/stat-17l

### 170. STAT 108 — Linear Regression

- Majors impacted: AM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (STAT 132)
- Official prereq text: STAT 132 and satisfaction of the Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/stat-statistics/upper-division/stat-108

### 171. STAT 131 — Introduction to Probability Theory

- Majors impacted: AM_BS, BIOTECH_BS, BMEB_BI, BMEB_BM, CE_BS, CS_BS, EE_BS, NDT_BS, RE_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (AM 11B OR ECON 11B OR MATH 11B OR MATH 19B OR MATH 20B)
- Official prereq text: MATH 22 ; or MATH 23B ; or AM 30 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/stat-statistics/upper-division/stat-131

### 172. TIM 147 — Introduction to Data Mining for Business

- Majors impacted: AM_BS, TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (CSE 20) AND (CSE 30) AND (CSE 16) AND (MATH 22 OR MATH 23A OR AM 30) AND (STAT 5 OR STAT 7) AND (AM 10 OR MATH 21) AND (AM 20 OR MATH 24)
- Official prereq text: CSE 30 ; and MATH 22 or MATH 23A or AM 30 ; and STAT 5 , or STAT 7 and 7L, or STAT 17 and STAT 17L , or STAT 131 , or CSE 107 .
- Flags: none
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/tim-technology-information-management/upper-division/tim-147

### 173. TIM 172A — Introduction to Management of Technology I

- Majors impacted: TIM_BS
- In generated high-priority section: yes
- Mention set differs: yes
- Local prereqs: (MATH 19B OR MATH 20B OR MATH 11B OR AM 11B OR ECON 11B)
- Official prereq text: MATH 19B or MATH 20B or MATH 11B or AM 11B or ECON 11B.
- Flags: none
- Official alternatives missing locally: ECON 11B
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/tim-technology-information-management/upper-division/tim-172a

### 174. TIM 172P — Management of Technology Project I

- Majors impacted: TIM_BS
- In generated high-priority section: yes
- Mention set differs: no
- Local prereqs: (none encoded)
- Official prereq text: concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/tim-technology-information-management/upper-division/tim-172p

### 175. TIM 172Q — Management of Technology Project II

- Majors impacted: TIM_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (TIM 172A) AND (TIM 172P)
- Official prereq text: TIM 172A and TIM 172P. Concurrent
- Flags: contains-prior-or-concurrent-language
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/tim-technology-information-management/upper-division/tim-172q

### 176. TIM 173 — Financial Engineering and Management in High Technology Firms

- Majors impacted: TIM_BS
- In generated high-priority section: no
- Mention set differs: no
- Local prereqs: (ECON 113 OR STAT 131 OR CSE 107)
- Official prereq text: ECON 113 or STAT 131 or CSE 107 or by instructor permission.
- Flags: contains-permission-or-consent-exception
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/tim-technology-information-management/upper-division/tim-173

### 177. TIM 175 — Business Strategy and Information Systems

- Majors impacted: TIM_BS
- In generated high-priority section: no
- Mention set differs: yes
- Local prereqs: (WRIT 2) AND (TIM 50)
- Official prereq text: satisfaction of the Entry Level Writing and Composition
- Flags: contains-placement-exam-or-writing-requirement
- Official alternatives missing locally: none
- Official URL: https://catalog.ucsc.edu/en/current/general-catalog/courses/tim-technology-information-management/upper-division/tim-175
