#!/usr/bin/env python3
"""
fetch_ucsc_majors.py
====================

Downloads major curriculum chart PDFs from Baskin Engineering Undergraduate
Advising (2025-26) and extracts requirement categories + course codes into
a JSON file that mirrors the CS_BA_REQUIREMENTS schema in js/data.js.

USAGE
-----
    python3 fetch_ucsc_majors.py                # fetch ALL configured majors
    python3 fetch_ucsc_majors.py am_bs ce_bs    # fetch specific ones by id
    python3 fetch_ucsc_majors.py --list         # show configured majors
    python3 fetch_ucsc_majors.py --offline      # reparse cached PDFs only

ACCURACY NOTE
-------------
Curriculum chart PDFs are visual flowcharts. pdfplumber text extraction is
inherently noisy, so this parser uses targeted regex mining for specific
requirement keywords (DC, Capstone, Breadth, Elective, etc.) rather than
trying to reconstruct the visual layout. Each output includes _raw_text
and _flags so humans can review edge cases.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    import pdfplumber
except ImportError:
    print("ERROR: pdfplumber is not installed.")
    print("Install it with:  python3 -m pip install pdfplumber")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

HERE = Path(__file__).parent
OUTPUT_DIR = HERE / "output"
PDF_DIR = HERE / "sample_pdfs"

RATE_LIMIT_SECONDS = 1.0

# Every major from the BE curriculum charts 2025-26 page.
# Tuple: (internal_id, display_name, pdf_url)
MAJORS: List[Tuple[str, str, str]] = [
    (
        "AM_BS",
        "Applied Mathematics B.S.",
        "https://undergrad.engineering.ucsc.edu/files/2025/09/Applied-Math-Major_25-26.pdf",
    ),
    (
        "BMEB_BM",
        "Biomolecular Engineering and Bioinformatics (Biomolecular)",
        "https://undergrad.engineering.ucsc.edu/files/2025/09/BMEB-Biomoleular-25-26.pdf",
    ),
    (
        "BMEB_BI",
        "Biomolecular Engineering and Bioinformatics (Bioinformatics)",
        "https://undergrad.engineering.ucsc.edu/files/2025/09/BMEB-BINF-25-26-1.pdf",
    ),
    (
        "BIOTECH_BS",
        "Biotechnology B.S.",
        "https://undergrad.engineering.ucsc.edu/files/2025/09/Biotechnology-25-26.pdf",
    ),
    (
        "CE_BS",
        "Computer Engineering B.S.",
        "https://undergrad.engineering.ucsc.edu/files/2025/09/CE_25-26.pdf",
    ),
    (
        "CS_BA",
        "Computer Science B.A.",
        "https://undergrad.engineering.ucsc.edu/files/2025/09/CS_BA_25-26.pdf",
    ),
    (
        "CS_BS",
        "Computer Science B.S.",
        "https://undergrad.engineering.ucsc.edu/files/2025/09/CS_BS_25-26.pdf",
    ),
    (
        "CSGD_BS",
        "Computer Science: Computer Game Design B.S.",
        "https://undergrad.engineering.ucsc.edu/files/2025/09/CSGD_BS_25-26.pdf",
    ),
    (
        "EE_BS",
        "Electrical Engineering B.S.",
        "https://undergrad.engineering.ucsc.edu/files/2025/09/EE_25-26.pdf",
    ),
    (
        "NDT_BS",
        "Network and Digital Technology B.S.",
        "https://undergrad.engineering.ucsc.edu/files/2025/09/Network-Digital-Technology_25-26.pdf",
    ),
    (
        "RE_BS",
        "Robotics Engineering B.S.",
        "https://undergrad.engineering.ucsc.edu/files/2025/09/RE_25-26.pdf",
    ),
    (
        "TIM_BS",
        "Technology and Information Management B.S.",
        "https://undergrad.engineering.ucsc.edu/files/2025/09/TIM_25-26.pdf",
    ),
]


# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Matches UCSC course codes: "CSE 101", "MATH 19A", "PHYS 5A/L", "AM 30"
COURSE_CODE_RE = re.compile(
    r"\b([A-Z]{2,5})\s+(\d{1,3}[A-Z]?(?:/[A-Z]+)?)\b"
)

# False-positive tokens that look like subject codes but aren't.
BAD_SUBJECTS = {
    "OR", "AND", "AP", "GPA", "MPE", "IB", "UC", "BS", "BA", "MS",
    "PHD", "NOTE", "LD", "UD", "NOT", "GE", "IN", "TO", "AT", "UP",
    "AN", "IF", "ON", "AS", "BY", "BE", "DO", "SO", "NO", "AL",
    "II", "MAY", "THE", "FOR", "ARE", "CAN", "HAS", "ALL",
    "OUT", "PER", "DUE", "KEY", "ANY", "ONE", "TWO", "HIS",
    "FALL", "SUM", "YEAR", "MUST", "ALSO", "EACH", "FIVE",
}


# ---------------------------------------------------------------------------
# PDF download
# ---------------------------------------------------------------------------

def download_pdf(url: str, dest: Path) -> None:
    """Download a PDF using curl (preferred) or urllib fallback."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    curl = shutil.which("curl")
    if curl:
        try:
            subprocess.run(
                [curl, "-sSL", "--fail", "--max-time", "30",
                 "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0 Safari/537.36",
                 "-o", str(dest), url],
                check=True, capture_output=True,
            )
            return
        except subprocess.CalledProcessError as exc:
            stderr = (exc.stderr or b"").decode("utf-8", errors="replace")
            raise RuntimeError(f"curl failed: {stderr.strip()}") from exc
    # Fallback
    req = urllib.request.Request(url, headers={
        "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                       "AppleWebKit/537.36 (KHTML, like Gecko) "
                       "Chrome/120.0 Safari/537.36"),
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        dest.write_bytes(resp.read())


# ---------------------------------------------------------------------------
# Text extraction helpers
# ---------------------------------------------------------------------------

def extract_pdf_text(pdf_path: Path) -> str:
    """Return the full joined text from all pages."""
    pages = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages:
            pages.append(page.extract_text() or "")
    return "\n\n".join(pages)


def extract_codes(text: str) -> List[str]:
    """Return de-duped, order-preserving list of course codes from text."""
    seen = set()
    result = []
    for m in COURSE_CODE_RE.finditer(text):
        subj, num = m.group(1), m.group(2)
        if subj in BAD_SUBJECTS:
            continue
        code = f"{subj} {num}"
        if code not in seen:
            seen.add(code)
            result.append(code)
    return result


def extract_codes_near(text: str, keyword_re: str, window: int = 600) -> List[str]:
    """Find all course codes within `window` chars after `keyword_re` match."""
    codes = []
    for m in re.finditer(keyword_re, text, re.IGNORECASE):
        start = m.start()
        end = min(len(text), start + window)
        codes.extend(extract_codes(text[start:end]))
    return _dedup(codes)


def _dedup(lst: List[str]) -> List[str]:
    """De-dup preserving order."""
    seen = set()
    out = []
    for x in lst:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


# ---------------------------------------------------------------------------
# Category extractors
# ---------------------------------------------------------------------------
# Each function mines one type of requirement from the raw text and returns
# a category dict (or None). They're designed to be conservative — they only
# fire when a clear keyword pattern is found.

def _find_dc(text: str) -> Optional[Dict]:
    """Disciplinary Communication requirement.

    Strategy: look for the DC section header OR the (DC) annotation on a
    specific course, then extract only the courses in that tight region.
    PDF text is noisy, so we use a small extraction window.
    """
    candidates = []

    # Strategy 1: look for "Disciplinary Communication" section header
    for m in re.finditer(r"Disciplinary\s+Communication", text, re.IGNORECASE):
        # Small window — DC lists are short (2-4 courses)
        region = text[m.start():min(len(text), m.end() + 350)]
        codes = extract_codes(region)
        if codes:
            candidates.extend(codes)

    # Strategy 2: look for "(DC)" or "(D C)" annotation anywhere, then grab
    # course codes in a tight window around it.
    for m in re.finditer(r"\(D\s*C\)", text):
        start = max(0, m.start() - 100)
        end = min(len(text), m.end() + 250)
        codes = extract_codes(text[start:end])
        candidates.extend(codes)

    # Strategy 3: look for "DC Requirement" header (CE-style) — tight window
    for m in re.finditer(r"DC\s+Requirement", text, re.IGNORECASE):
        region = text[m.start():min(len(text), m.end() + 200)]
        codes = extract_codes(region)
        candidates.extend(codes)

    # Strategy 4: look for known DC course codes directly in the text
    dc_known = ["CSE 115A", "CSE 185E", "CSE 185S", "CSE 195",
                "BME 185", "AM 170A", "ECE 185"]
    for code in dc_known:
        if code in text:
            candidates.append(code)

    candidates = _dedup(candidates)
    if not candidates:
        return None
    # Post-filter: DC courses follow specific patterns. Remove obvious
    # false positives like PHYS, STAT, ECE 103, CSE 107 etc.
    dc_prefixes = ("CSE 115", "CSE 185", "CSE 195", "BME 185",
                   "AM 170", "ECE 185", "BME 18")
    filtered = [c for c in candidates
                if any(c.startswith(p) for p in dc_prefixes)]
    # If filtering removed everything, keep original (may be a new major pattern)
    if not filtered:
        filtered = candidates
    return {
        "id": "DC",
        "name": "Disciplinary Communication (DC)",
        "type": "pick_one",
        "courses": filtered,
        "description": "Complete one DC course. Cannot double-count as elective.",
    }


def _find_capstone(text: str) -> Optional[Dict]:
    """Comprehensive / Capstone requirement.

    Looks for explicit "Capstone" or "Comprehensive Requirement" headings.
    Skips "Exit Requirements" that describe portfolio/survey procedures
    rather than courses.
    """
    candidates = []

    # Strategy 1: "Capstone (choose one option)" or "Capstone Courses:"
    for m in re.finditer(
        r"Capstone\s*(?:\(choose\s*one|Course|:|\s*Students\s*must\s*complete)",
        text, re.IGNORECASE
    ):
        region = text[m.start():min(len(text), m.end() + 600)]
        candidates.extend(extract_codes(region))

    # Strategy 2: "Comprehensive Requirement" (may be split across lines)
    for m in re.finditer(r"Comprehensive\s+Requirement", text, re.IGNORECASE):
        region = text[m.start():min(len(text), m.end() + 400)]
        candidates.extend(extract_codes(region))

    # Strategy 3: look for known capstone course codes directly
    cap_known = ["CSE 123A", "CSE 123B", "CSE 127A", "CSE 127B",
                 "CSE 115C", "CSE 115D", "BME 175", "BME 180",
                 "BME 195", "AM 195", "CSE 195", "ECE 118"]
    for code in cap_known:
        if code in text:
            candidates.append(code)

    candidates = _dedup(candidates)
    if not candidates:
        return None
    return {
        "id": "CAPSTONE",
        "name": "Comprehensive Requirement (Capstone)",
        "type": "pick_one",
        "courses": candidates,
        "description": "Complete one capstone course or senior thesis.",
    }


def _find_breadth(text: str) -> Optional[Dict]:
    """Breadth requirement (CS majors)."""
    pat = r"Breadth\s*(?:course|list|elective)"
    m = re.search(pat, text, re.IGNORECASE)
    if not m:
        return None
    # Breadth lists can be long — grab a big window
    start = max(0, m.start() - 50)
    end = min(len(text), m.end() + 1500)
    codes = extract_codes(text[start:end])
    if not codes:
        return None
    # Try to detect pick_n
    n = 3  # default for CS
    n_match = re.search(r"(?:three|3)\s*courses?\s*from", text[start:end], re.IGNORECASE)
    if n_match:
        n = 3
    return {
        "id": "BREADTH",
        "name": "Breadth Courses",
        "type": "pick_n",
        "n": n,
        "courses": codes,
        "description": f"Pick {n} courses from the breadth lists.",
    }


def _find_ud_electives(text: str) -> Optional[Dict]:
    """Upper-division elective requirement."""
    pat = (r"Upper[- ]?Division\s*Elective|"
           r"upper\s*division\s*.*?elective\s*course|"
           r"additional\s*.*?upper\s*division")
    m = re.search(pat, text, re.IGNORECASE)
    if not m:
        return None
    start = max(0, m.start() - 50)
    end = min(len(text), m.end() + 1200)
    region = text[start:end]
    codes = extract_codes(region)
    if not codes:
        return None
    # Detect pick count
    n = 2  # default
    for word, val in [("two", 2), ("three", 3), ("four", 4), ("five", 5),
                      ("six", 6), ("2", 2), ("3", 3), ("4", 4), ("5", 5)]:
        if re.search(rf"\b{word}\b\s*(?:additional\s*)?.*?(?:elective|upper)", region, re.IGNORECASE):
            n = val
            break
    return {
        "id": "UD_ELECTIVE",
        "name": "Upper Division Electives",
        "type": "pick_n",
        "n": n,
        "courses": codes,
        "description": f"Choose {n} upper-division elective courses.",
    }


def _find_ld_electives(text: str) -> Optional[Dict]:
    """Lower-division elective requirement."""
    pat = r"Lower\s*Division\s*Elective"
    m = re.search(pat, text, re.IGNORECASE)
    if not m:
        return None
    start = max(0, m.start() - 50)
    end = min(len(text), m.end() + 600)
    codes = extract_codes(text[start:end])
    if not codes:
        return None
    return {
        "id": "LD_ELECTIVE",
        "name": "Lower Division Electives",
        "type": "pick_n",
        "n": 2,
        "courses": codes,
        "description": "Choose lower-division elective courses.",
    }


def _find_concentration(text: str) -> Optional[Dict]:
    """Concentration track (e.g. CE has multiple concentrations)."""
    pat = r"Concentrations?\s*\(choose\s*one\)"
    m = re.search(pat, text, re.IGNORECASE)
    if not m:
        return None
    start = max(0, m.start() - 50)
    end = min(len(text), m.end() + 2000)
    codes = extract_codes(text[start:end])
    if not codes:
        return None
    return {
        "id": "CONCENTRATION",
        "name": "Concentration Courses",
        "type": "pick_n",
        "n": 4,
        "courses": codes,
        "description": "Choose one concentration track and complete its courses.",
        "note": "Concentration-specific — see PDF for track details.",
    }


def _find_calculus(text: str) -> Optional[Dict]:
    """Calculus sequence (usually choose_group between 19-series and 20-series).

    Looks at the full text for MATH 19A/B and MATH 20A/B presence, since
    the PDF layout often scatters them across columns. Both series present
    means choose_group; only one means all_required.
    """
    has_19a = "MATH 19A" in text
    has_19b = "MATH 19B" in text
    has_20a = "MATH 20A" in text
    has_20b = "MATH 20B" in text

    if not (has_19a or has_20a):
        return None

    groups = []
    if has_19a:
        courses_19 = ["MATH 19A"]
        if has_19b:
            courses_19.append("MATH 19B")
        groups.append({"label": "19-series", "courses": courses_19})
    if has_20a:
        courses_20 = ["MATH 20A"]
        if has_20b:
            courses_20.append("MATH 20B")
        groups.append({"label": "20-series (Honors)", "courses": courses_20})

    if len(groups) == 2:
        return {
            "id": "MATH_CALC",
            "name": "Calculus Sequence",
            "type": "choose_group",
            "groups": groups,
            "description": "Choose one calculus sequence: 19-series or 20-series.",
        }
    elif len(groups) == 1:
        return {
            "id": "MATH_CALC",
            "name": "Calculus",
            "type": "all_required",
            "courses": groups[0]["courses"],
            "description": "Required calculus courses.",
        }
    return None


def _find_linear_algebra(text: str) -> Optional[Dict]:
    """Linear algebra requirement (AM 10 or MATH 21)."""
    if "AM 10" not in text and "MATH 21" not in text:
        return None
    courses = []
    if "AM 10" in text:
        courses.append("AM 10")
    if "MATH 21" in text:
        courses.append("MATH 21")
    if len(courses) < 2:
        # Single option means it's just required, not pick_one
        return {
            "id": "MATH_LIN_ALG",
            "name": "Linear Algebra",
            "type": "all_required",
            "courses": courses,
            "description": "Linear algebra is required.",
        }
    return {
        "id": "MATH_LIN_ALG",
        "name": "Linear Algebra",
        "type": "pick_one",
        "courses": courses,
        "description": "Choose one linear algebra course.",
    }


def _find_ud_core(text: str) -> Optional[Dict]:
    """Upper division core / required courses.

    Looks for 'Upper Division Courses' or 'Complete all of the following'
    near upper-division context. Truncates at elective/comprehensive
    boundaries to avoid bleeding into other sections.
    """
    candidates = []

    # Pattern 1: explicit "Upper-Division Courses" header
    for m in re.finditer(r"Upper[- ]?Division\s+Courses", text, re.IGNORECASE):
        start = m.start()
        end = min(len(text), m.end() + 600)
        region = text[start:end]
        # Truncate at boundaries
        for stop_pat in [r"Elective", r"Comprehensive", r"Capstone", r"DC\s"]:
            stop_m = re.search(stop_pat, region[60:], re.IGNORECASE)
            if stop_m:
                region = region[:60 + stop_m.start()]
                break
        candidates.extend(extract_codes(region))

    # Pattern 2: "Complete all of the following" near upper division
    for m in re.finditer(r"Complete\s+all\s+of\s+the\s+following", text, re.IGNORECASE):
        start = max(0, m.start() - 100)
        end = min(len(text), m.end() + 500)
        region = text[start:end]
        # Only use if it's actually in an upper-division context
        if re.search(r"Upper|upper|UD", region[:100]):
            candidates.extend(extract_codes(region))

    candidates = _dedup(candidates)
    if not candidates:
        return None
    return {
        "id": "UD_CORE",
        "name": "Upper Division Core",
        "type": "all_required",
        "courses": candidates,
        "description": "All upper-division core courses are required.",
    }


def _find_biology(text: str) -> Optional[Dict]:
    """Biology/BME courses (common in BMEB/Biotech majors)."""
    # Look for BIOL and BME course codes throughout the text
    all_codes = extract_codes(text)
    bio_codes = [c for c in all_codes
                 if c.startswith(("BIOL ", "BME ", "BIOC ", "BIOE "))]
    if len(bio_codes) < 3:
        return None
    return {
        "id": "BIO_CORE",
        "name": "Biology & Bioengineering",
        "type": "all_required",
        "courses": bio_codes,
        "description": "Required biology and bioengineering courses.",
        "note": "Some courses may be pick-one alternatives — see PDF.",
    }


def _find_statistics(text: str) -> Optional[Dict]:
    """Statistics requirement (STAT 131, CSE 107, CSE 40, etc.)."""
    all_codes = extract_codes(text)
    stat_codes = [c for c in all_codes if c.startswith("STAT ")]
    if not stat_codes:
        return None
    # Only report if there's 1-2 stats courses (not a stats-heavy major)
    if len(stat_codes) > 3:
        return None
    return {
        "id": "STAT",
        "name": "Statistics / Probability",
        "type": "all_required",
        "courses": stat_codes,
        "description": "Required statistics/probability courses.",
    }


def _find_discrete_math(text: str) -> Optional[Dict]:
    """Discrete math (CSE 16)."""
    if "CSE 16" not in text:
        return None
    return {
        "id": "MATH_DISCRETE",
        "name": "Discrete Mathematics",
        "type": "all_required",
        "courses": ["CSE 16"],
        "description": "Discrete mathematics is required.",
    }


def _find_multivariable_calc(text: str) -> Optional[Dict]:
    """Multivariable calculus (AM 30, MATH 23A/B, MATH 22)."""
    courses = []
    for code in ["AM 30", "MATH 23A", "MATH 23B", "MATH 22"]:
        if code in text:
            courses.append(code)
    if not courses:
        return None
    # If both AM 30 and MATH 23A present, it's typically pick_one
    if "AM 30" in courses and "MATH 23A" in courses:
        return {
            "id": "MATH_MULTIVAR",
            "name": "Multivariable Calculus",
            "type": "pick_one",
            "courses": courses,
            "description": "Choose one multivariable calculus course/sequence.",
        }
    return {
        "id": "MATH_MULTIVAR",
        "name": "Multivariable Calculus",
        "type": "all_required",
        "courses": courses,
        "description": "Required multivariable calculus courses.",
    }


def _find_diff_eq(text: str) -> Optional[Dict]:
    """Differential equations (AM 20, MATH 24)."""
    courses = []
    for code in ["AM 20", "MATH 24"]:
        if code in text:
            courses.append(code)
    if not courses:
        return None
    if len(courses) == 2:
        return {
            "id": "MATH_DIFFEQ",
            "name": "Differential Equations",
            "type": "pick_one",
            "courses": courses,
            "description": "Choose one differential equations course.",
        }
    return {
        "id": "MATH_DIFFEQ",
        "name": "Differential Equations",
        "type": "all_required",
        "courses": courses,
        "description": "Required differential equations.",
    }


def _find_programming(text: str) -> Optional[Dict]:
    """Programming courses (CSE 20, CSE 13S, ECE 13, etc.)."""
    all_codes = extract_codes(text)
    prog_codes = []
    for code in ["CSE 20", "CSE 13S", "ECE 13", "CSE 30", "CSE 12"]:
        if code in all_codes:
            prog_codes.append(code)
    if not prog_codes:
        return None
    return {
        "id": "PROGRAMMING",
        "name": "Programming",
        "type": "all_required",
        "courses": prog_codes,
        "description": "Required programming courses.",
        "note": "Some may be pick-one alternatives — see PDF.",
    }


def _find_physics(text: str) -> Optional[Dict]:
    """Physics courses (common in engineering majors)."""
    pat = r"Physics\s*Courses|Science\s*Courses"
    m = re.search(pat, text, re.IGNORECASE)
    if not m:
        # Check for PHYS codes directly
        phys_codes = [c for c in extract_codes(text) if c.startswith("PHYS ")]
        if len(phys_codes) >= 2:
            return {
                "id": "PHYS_CORE",
                "name": "Physics",
                "type": "all_required",
                "courses": phys_codes,
                "description": "Required physics courses.",
            }
        return None
    start = max(0, m.start() - 30)
    end = min(len(text), m.end() + 500)
    codes = extract_codes(text[start:end])
    phys_codes = [c for c in codes if c.startswith("PHYS ")]
    if not phys_codes:
        return None
    return {
        "id": "PHYS_CORE",
        "name": "Physics",
        "type": "all_required",
        "courses": phys_codes,
        "description": "Required physics courses.",
    }


def _find_chemistry(text: str) -> Optional[Dict]:
    """Chemistry courses."""
    chem_codes = [c for c in extract_codes(text) if c.startswith("CHEM ")]
    if len(chem_codes) < 2:
        return None
    return {
        "id": "CHEM_CORE",
        "name": "Chemistry",
        "type": "all_required",
        "courses": chem_codes,
        "description": "Required chemistry courses.",
        "note": "Some majors allow choosing between CHEM 3-series and CHEM 4-series.",
    }


# ---------------------------------------------------------------------------
# Core course extraction
# ---------------------------------------------------------------------------

def _find_core_courses(text: str, major_id: str) -> Optional[Dict]:
    """Major-specific core (lower division + upper division required)."""
    pat = r"Core\s*Courses"
    m = re.search(pat, text, re.IGNORECASE)
    if not m:
        return None
    start = max(0, m.start() - 30)
    end = min(len(text), m.end() + 1000)
    region = text[start:end]
    # Stop at "Concentration" or "Elective" if present
    for stop in [r"Concentration", r"Elective", r"Comprehensive"]:
        stop_m = re.search(stop, region[80:], re.IGNORECASE)
        if stop_m:
            end = start + 80 + stop_m.start()
            region = text[start:end]
            break
    codes = extract_codes(region)
    if not codes:
        return None
    return {
        "id": "CORE",
        "name": "Core Courses",
        "type": "all_required",
        "courses": codes,
        "description": "All core courses are required.",
    }


def _find_ld_required(text: str) -> Optional[Dict]:
    """Lower division required courses (when explicitly stated)."""
    pat = (r"Lower\s*Division\s*Courses|"
           r"All\s*of\s*the\s*following\s*lower\s*division|"
           r"Lower\s*Division\s*Programming\s*Courses")
    m = re.search(pat, text, re.IGNORECASE)
    if not m:
        return None
    start = max(0, m.start() - 30)
    end = min(len(text), m.end() + 1200)
    region = text[start:end]
    # Stop at "Upper Division" if present
    ud_m = re.search(r"Upper[- ]?Division", region[80:], re.IGNORECASE)
    if ud_m:
        end = start + 80 + ud_m.start()
        region = text[start:end]
    codes = extract_codes(region)
    if not codes:
        return None
    return {
        "id": "LD_CORE",
        "name": "Lower Division Required",
        "type": "all_required",
        "courses": codes,
        "description": "Required lower-division courses.",
    }


# ---------------------------------------------------------------------------
# All-courses fallback
# ---------------------------------------------------------------------------

def _all_courses_in_pdf(text: str) -> List[str]:
    """Extract every unique course code from the entire PDF text."""
    return extract_codes(text)


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def parse_major_pdf(
    major_id: str, name: str, pdf_url: str, pdf_path: Path
) -> Dict:
    """Parse one major's curriculum chart PDF into a structured dict."""
    flags: List[str] = []
    text = extract_pdf_text(pdf_path)

    if not text.strip():
        flags.append("empty_extracted_text")
        return _empty_result(major_id, name, pdf_url, flags)

    all_codes = _all_courses_in_pdf(text)

    # Run all category extractors. Each returns None if it doesn't match.
    # Order matters — earlier extractors claim codes first.
    extractors = [
        _find_ld_required,
        _find_calculus,
        _find_linear_algebra,
        _find_multivariable_calc,
        _find_diff_eq,
        _find_discrete_math,
        _find_statistics,
        _find_programming,
        _find_core_courses,
        _find_physics,
        _find_chemistry,
        _find_biology,
        _find_ud_core,
        _find_breadth,
        _find_ud_electives,
        _find_ld_electives,
        _find_concentration,
        _find_dc,
        _find_capstone,
    ]

    categories: List[Dict] = []
    categorized_codes = set()

    for extractor in extractors:
        if extractor == _find_core_courses:
            result = extractor(text, major_id)
        else:
            result = extractor(text)
        if result:
            categories.append(result)
            for c in result.get("courses", []):
                categorized_codes.add(c)
            # Also check groups (for choose_group types)
            for g in result.get("groups", []):
                for c in g.get("courses", []):
                    categorized_codes.add(c)

    # Collect uncategorized codes
    uncategorized = [c for c in all_codes if c not in categorized_codes]
    if uncategorized:
        flags.append(f"uncategorized_courses: {len(uncategorized)}")

    # Stats
    if not categories:
        flags.append("no_categories_extracted")

    return {
        "id": major_id,
        "name": name,
        "pdfUrl": pdf_url,
        "catalogUrl": None,
        "totalUnitsRequired": 180,
        "minUpperDivUnits": 60,
        "minGPA": 2.0,
        "majorGPA": 2.0,
        "categories": categories,
        "allCourseCodes": all_codes,
        "uncategorizedCodes": uncategorized,
        "_raw_text": text,
        "_flags": flags,
    }


def _empty_result(major_id, name, pdf_url, flags):
    return {
        "id": major_id,
        "name": name,
        "pdfUrl": pdf_url,
        "catalogUrl": None,
        "totalUnitsRequired": 180,
        "minUpperDivUnits": 60,
        "minGPA": 2.0,
        "majorGPA": 2.0,
        "categories": [],
        "allCourseCodes": [],
        "uncategorizedCodes": [],
        "_raw_text": "",
        "_flags": flags,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("majors", nargs="*",
                    help="IDs of majors to fetch (default: all)")
    ap.add_argument("--list", action="store_true",
                    help="Print the configured major list and exit")
    ap.add_argument("--offline", action="store_true",
                    help="Parse already-downloaded PDFs only")
    args = ap.parse_args()

    if args.list:
        print(f"{'ID':<14} {'Name':<58} URL")
        print("-" * 120)
        for mid, nm, url in MAJORS:
            print(f"{mid:<14} {nm:<58} {url}")
        return

    wanted_ids = [m.upper() for m in args.majors] if args.majors else None
    selected = [
        (mid, nm, url) for (mid, nm, url) in MAJORS
        if wanted_ids is None or mid in wanted_ids
    ]
    if not selected:
        print("ERROR: no matching IDs. Use --list to see valid ones.")
        sys.exit(1)

    PDF_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    results: List[Dict] = []
    for i, (mid, nm, url) in enumerate(selected):
        pdf_path = PDF_DIR / f"{mid}.pdf"
        print(f"[{i+1}/{len(selected)}] {mid}  {nm}")

        # Download if needed
        if not args.offline:
            if not pdf_path.exists():
                print(f"    downloading...")
                try:
                    download_pdf(url, pdf_path)
                except Exception as exc:
                    print(f"    DOWNLOAD FAILED: {exc}")
                    continue
                time.sleep(RATE_LIMIT_SECONDS)
            else:
                print(f"    using cached PDF")
        elif not pdf_path.exists():
            print(f"    SKIP (offline, no cached PDF)")
            continue

        # Parse
        try:
            entry = parse_major_pdf(mid, nm, url, pdf_path)
        except Exception as exc:
            print(f"    PARSE FAILED: {exc}")
            continue

        n_cat = len(entry["categories"])
        n_all = len(entry["allCourseCodes"])
        n_uncat = len(entry["uncategorizedCodes"])
        flag_str = f"  FLAGGED: {', '.join(entry['_flags'])}" if entry["_flags"] else ""
        print(f"    -> {n_cat} categories | {n_all} total courses | "
              f"{n_uncat} uncategorized{flag_str}")
        for cat in entry["categories"]:
            ct = cat["type"]
            n_extra = f" n={cat['n']}" if "n" in cat else ""
            courses_preview = cat.get("courses", [])[:8]
            groups = cat.get("groups", [])
            if groups:
                g_preview = "; ".join(
                    f"{g['label']}: {','.join(g['courses'])}" for g in groups
                )
                print(f"      [{cat['id']}] {cat['name']} ({ct}{n_extra})  {g_preview}")
            else:
                extra = f"... +{len(courses_preview) - 8}" if len(cat.get('courses', [])) > 8 else ""
                print(f"      [{cat['id']}] {cat['name']} ({ct}{n_extra})  "
                      f"{', '.join(courses_preview)}{extra}")

        results.append(entry)

    if not results:
        print("\nNo majors parsed.")
        return

    # Write outputs
    raw_json = OUTPUT_DIR / "majors_raw.json"
    raw_json.write_text(json.dumps(results, indent=2))
    print(f"\nWrote {raw_json}  ({len(results)} majors)")

    by_id = {m["id"]: m for m in results}
    by_id_json = OUTPUT_DIR / "majors_by_id.json"
    by_id_json.write_text(json.dumps(by_id, indent=2))
    print(f"Wrote {by_id_json}")

    # Compact JS view (no _raw_text)
    js_out = OUTPUT_DIR / "majors.data.js"
    slim = [{k: v for k, v in m.items() if k != "_raw_text"} for m in results]
    js_out.write_text(
        "// Auto-generated by fetch_ucsc_majors.py\n"
        f"const ALL_MAJORS = {json.dumps(slim, indent=2)};\n"
    )
    print(f"Wrote {js_out}")

    # Summary
    print(f"\n{'='*50}")
    print(f"SUMMARY")
    print(f"{'='*50}")
    print(f"  Majors parsed:       {len(results)}")
    print(f"  Total categories:    {sum(len(m['categories']) for m in results)}")
    print(f"  Total unique codes:  {sum(len(m['allCourseCodes']) for m in results)}")
    print(f"  Uncategorized codes: {sum(len(m['uncategorizedCodes']) for m in results)}")
    print(f"  Majors with flags:   {sum(1 for m in results if m['_flags'])}")


if __name__ == "__main__":
    main()
