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
# Elective page URLs (per major)
# ---------------------------------------------------------------------------

ELECTIVE_URLS: Dict[str, str] = {
    "AM_BS": "https://undergrad.engineering.ucsc.edu/curriculum-charts/curriculum-charts-2025-2026/applied-mathematics-electives-2025-2026/",
    "CE_BS": "https://undergrad.engineering.ucsc.edu/curriculum-charts/curriculum-charts-2025-2026/computer-engineering-electives-2025-2026/",
}

# Per-major configuration for spatial extraction edge cases
MAJOR_CONFIG: Dict[str, Dict] = {
    "CS_BS": {
        "structure": "flat",
        "ld_core_codes": ["CSE 20", "CSE 12", "CSE 30", "CSE 13S", "CSE 16", "CSE 40",
                          "ECE 30"],
        "ud_core_codes": ["CSE 101", "CSE 102", "CSE 103", "CSE 120", "CSE 130",
                          "CSE 114A", "CSE 101M"],
        "stats_codes": ["CSE 107", "STAT 131"],
        "dc_codes": ["CSE 115A", "CSE 185E", "CSE 195"],
        "math_choose_groups": [
            (["AM 10", "AM 30"], ["MATH 21", "MATH 23A"]),
        ],
    },
    "CE_BS": {
        "structure": "flat",
        "ld_core_codes": ["CSE 20", "CSE 12", "CSE 30", "CSE 13S", "ECE 13", "CSE 16"],
        "ud_core_codes": ["CSE 100/L", "CSE 101", "CSE 120", "CSE 121", "CSE 125",
                          "ECE 101/L", "ECE 103/L", "ECE 171/L"],
        "stats_codes": ["CSE 107", "STAT 131"],
        "physics_codes": ["PHYS 5A/L", "PHYS 5B/M"],
        "dc_codes": ["CSE 115A", "CSE 185E", "CSE 195"],
        "math_choose_groups": [
            (["AM 10", "AM 20", "AM 30"], ["MATH 21", "MATH 24", "MATH 23A"]),
        ],
    },
    "EE_BS": {
        "structure": "flat",
        "elective_in_chart": True,
        "physics_codes": ["PHYS 5A/L", "PHYS 5B/M", "PHYS 5C/N", "PHYS 5D"],
        "ld_core_codes": ["CSE 12", "ECE 13", "CSE 20", "ECE 80T"],
        "ud_core_codes": ["ECE 101/L", "ECE 102/L", "ECE 103/L", "ECE 135/L",
                          "ECE 151", "ECE 171/L", "CSE 100/L"],
        "stats_codes": ["STAT 131"],
        "dc_codes": ["ECE 185"],
        "math_choose_groups": [
            (["AM 10", "AM 20", "AM 30"], ["MATH 21", "MATH 24", "MATH 23A"]),
        ],
    },
    "NDT_BS": {
        "structure": "flat",
        "ld_core_codes": ["CSE 20", "CSE 12", "CSE 30", "CSE 13S", "CSE 16",
                          "PHYS 5A/L", "PHYS 5C/N"],
        "ud_core_codes": ["CSE 101", "CSE 150", "CSE 156/L", "CSE 157",
                          "CSE 160", "CSE 180", "CSE 181", "CSE 183", "CSE 187"],
        "stats_codes": ["CSE 107", "STAT 131"],
        "dc_codes": ["CSE 115A", "CSE 185E", "CSE 195"],
    },
    "RE_BS": {
        "structure": "flat",
        "physics_codes": ["PHYS 5A/L", "PHYS 5C/N"],
        "ld_core_codes": ["CSE 20", "CSE 12", "CSE 30", "ECE 13"],
        "ud_core_codes": ["ECE 101/L", "ECE 103/L", "ECE 121", "ECE 167",
                          "CSE 100/L", "CSE 101"],
        "stats_codes": ["CSE 107", "STAT 131"],
        "dc_codes": ["ECE 185"],
    },
    "TIM_BS": {
        "structure": "flat",
        "ld_core_codes": ["CSE 20", "CSE 12", "CSE 13S", "CSE 16", "CSE 30"],
        "ud_core_codes": ["TIM 50", "TIM 170", "TIM 172A/P", "TIM 172B/Q", "TIM 175"],
        "stats_codes": ["STAT 17/L"],
        "dc_codes": ["CSE 115A", "CSE 185E"],
    },
    "CSGD_BS": {
        "structure": "flat",
        "ld_core_codes": ["CSE 20", "CSE 12", "CSE 13S", "ECE 13", "CSE 16", "CSE 30",
                          "CMPM 80K", "CMPM 80J", "FILM 80V"],
        "ud_core_codes": ["CSE 101", "CMPM 120", "CMPM 121", "CMPM 170", "CMPM 171"],
        "dc_codes": ["CSE 115A", "CSE 185E", "CSE 195"],
    },
    "BMEB_BI": {
        "structure": "hierarchical",
        "dc_codes": ["BME 185"],
    },
    "BMEB_BM": {
        "structure": "hierarchical",
        "dc_codes": ["BME 185"],
    },
    "BIOTECH_BS": {
        "structure": "sparse",
        "dc_codes": ["BME 185"],
    },
}

# Majors verified for spatial extraction. Will be expanded as each major is validated.
SPATIAL_VERIFIED_MAJORS = {"AM_BS"}


# ---------------------------------------------------------------------------
# Spatial PDF extraction  (NEW — rectangle-based)
# ---------------------------------------------------------------------------

def _normalize_dept_case(text: str) -> str:
    """Normalize mixed-case department names from PDF extraction to uppercase."""
    for dept in ["Math", "Stat", "Phys", "Chem", "Biol", "Econ", "Astr",
                 "Bioe", "Eart", "Ocea", "Cmpm", "Cmps",
                 "Am", "Cse", "Ece", "Bme"]:
        text = re.sub(rf"\b{dept}\b", dept.upper(), text)
    return text


def _course_num(code: str) -> int:
    """Extract the numeric part of a course code (e.g. 'MATH 19A' -> 19)."""
    if " " not in code:
        return 0
    m = re.match(r"(\d+)", code.split()[-1])
    return int(m.group(1)) if m else 0


def _split_by_or(text: str) -> List[str]:
    """Split rect text into segments separated by OR (course alternatives).

    Handles both uppercase 'OR' and lowercase 'or' on their own line.
    Only splits on lowercase 'or' if followed by a course code.
    """
    # Uppercase OR on its own line — definitive split
    segments = re.split(r"\n\s*OR\s*\n", text)
    if len(segments) > 1:
        return segments

    # Lowercase 'or' on its own line — split only if followed by course code
    parts = re.split(r"\n\s*or\s*\n", text)
    if len(parts) > 1:
        result = [parts[0]]
        for part in parts[1:]:
            first_line = part.split("\n")[0].strip()
            normalized = _normalize_dept_case(first_line)
            if COURSE_CODE_RE.search(normalized):
                result.append(part)
            else:
                result[-1] += "\nor\n" + part
        if len(result) > 1:
            return result

    return [text]


def _split_by_and(text: str) -> List[str]:
    """Split rect text into segments connected by & (courses required together)."""
    segments = re.split(r"\n\s*&\s*\n", text)
    return segments if len(segments) > 1 else [text]


def _first_course_in(text: str) -> Optional[str]:
    """Return the first course code in the text, with dept-case normalization."""
    codes = extract_codes(_normalize_dept_case(text))
    return codes[0] if codes else None


def _extract_main_codes(text: str) -> List[str]:
    """Extract course codes from the main part of text (before prerequisites).

    Filters out codes that only appear in prerequisite descriptions.
    """
    parts = re.split(r"(?i)Prerequisite[s]?\s*:", text, maxsplit=1)
    main_text = parts[0] if parts else text
    return extract_codes(_normalize_dept_case(main_text))


def extract_pdf_boxes(pdf_path: Path) -> List[Dict]:
    """Extract visual boxes and their text from page 1 of a curriculum chart PDF.

    Returns a list of box dicts: {x0, top, x1, bottom, text, children, parent_idx}
    """
    with pdfplumber.open(str(pdf_path)) as pdf:
        if not pdf.pages:
            return []
        page = pdf.pages[0]
        pw, ph = page.width, page.height

        raw_rects = page.rects
        if not raw_rects:
            return []

        # Deduplicate rects (many PDFs have identical rects at same position)
        seen_keys = set()
        deduped = []
        for r in raw_rects:
            key = (round(r["x0"]), round(r["top"]), round(r["x1"]), round(r["bottom"]))
            if key not in seen_keys:
                seen_keys.add(key)
                deduped.append(r)

        # Filter: skip page boundaries and tiny rects
        filtered = []
        for r in deduped:
            w = r["x1"] - r["x0"]
            h = r["bottom"] - r["top"]
            if w > pw * 0.8 and h > ph * 0.4:
                continue
            if w * h < 400:
                continue
            filtered.append(r)

        # Crop and extract text for each rect
        boxes = []
        for r in filtered:
            bbox = (r["x0"], r["top"], r["x1"], r["bottom"])
            try:
                cropped = page.crop(bbox)
                text = cropped.extract_text() or ""
            except Exception as exc:
                print(f"    WARNING: crop failed for rect ({r['x0']:.0f},{r['top']:.0f}): {exc}")
                text = ""
            boxes.append({
                "x0": r["x0"], "top": r["top"],
                "x1": r["x1"], "bottom": r["bottom"],
                "text": text,
                "children": [],
                "parent_idx": None,
            })

        # Build containment tree (larger rects contain smaller ones)
        boxes.sort(key=lambda b: (b["x1"] - b["x0"]) * (b["bottom"] - b["top"]),
                   reverse=True)

        for i, outer in enumerate(boxes):
            for j, inner in enumerate(boxes):
                if i == j or inner["parent_idx"] is not None:
                    continue
                margin = 5
                if (inner["x0"] >= outer["x0"] - margin and
                    inner["top"] >= outer["top"] - margin and
                    inner["x1"] <= outer["x1"] + margin and
                    inner["bottom"] <= outer["bottom"] + margin):
                    area_outer = (outer["x1"] - outer["x0"]) * (outer["bottom"] - outer["top"])
                    area_inner = (inner["x1"] - inner["x0"]) * (inner["bottom"] - inner["top"])
                    if area_inner < area_outer * 0.95:
                        inner["parent_idx"] = i
                        outer["children"].append(j)

    return boxes


def _boxes_to_sections(boxes: List[Dict]) -> Dict[str, Dict]:
    """Identify requirement sections from extracted boxes.

    Returns a dict mapping section_id -> {text, children_texts, box_indices, header_hint}
    """
    if not boxes:
        return {}

    # Section header patterns — order matters (more specific patterns first)
    HEADER_PATTERNS = [
        ("MULTIVAR",        r"(?i)Multivariab"),
        ("LIN_ALG_DIFFEQ",  r"(?i)Linear\s+Algebra|Differential\s+Equation"),
        ("CALC",            r"(?i)\bCalculus\b"),
        ("PROGRAMMING",     r"(?i)Complete\s+One\n.*(?:CSE\s+20|Programming)"),
        ("COMPREHENSIVE",   r"(?i)Choose\s+One\n.*(?:AM\s+17|Senior\s+Thesis|Capstone)"),
    ]

    sections: Dict[str, Dict] = {}

    # --- Pass 1: Identify parent rects (those with children) ---
    for i, box in enumerate(boxes):
        if box["parent_idx"] is not None:
            continue
        text = box["text"]
        children_texts = [boxes[c]["text"] for c in box["children"]]

        for section_id, pattern in HEADER_PATTERNS:
            if section_id in sections:
                continue
            if re.search(pattern, text):
                sections[section_id] = {
                    "text": text,
                    "children_texts": children_texts,
                    "box_indices": [i] + box["children"],
                    "is_parent": len(box["children"]) > 0,
                }
                break

    # --- Pass 2: Identify standalone rects by content ---
    categorized_indices = set()
    for s in sections.values():
        categorized_indices.update(s["box_indices"])

    # Group uncategorized rects by content
    dc_boxes = []
    ud_required_boxes = []
    ud_or_boxes = []
    discrete_boxes = []
    ld_elective_boxes = []
    ud_elective_boxes = []

    for i, box in enumerate(boxes):
        if i in categorized_indices or box["parent_idx"] is not None:
            continue
        text = box["text"]
        text_norm = _normalize_dept_case(text)
        codes = extract_codes(text_norm)

        if not codes and re.search(r"(?i)ELECTIVE", text):
            # Elective placeholder — classify by y-position
            if box["top"] > 600:
                ud_elective_boxes.append(i)
            else:
                ld_elective_boxes.append(i)
            continue

        if "(D C)" in text or "(DC)" in text:
            dc_boxes.append(i)
            continue

        # Discrete math: first course is CSE 16 or MATH 100
        if codes and codes[0] in ("CSE 16", "MATH 100"):
            discrete_boxes.append(i)
            continue

        # Upper-division individual course boxes
        or_segments = _split_by_or(text_norm)
        if len(or_segments) > 1:
            first_codes = [_first_course_in(seg) for seg in or_segments]
            first_codes = [c for c in first_codes if c]
            if first_codes and any(_course_num(c) >= 100 for c in first_codes):
                ud_or_boxes.append(i)
                continue
        elif codes:
            if _course_num(codes[0]) >= 100:
                ud_required_boxes.append(i)
                continue

    # Build sections from grouped standalone rects
    if dc_boxes:
        texts = [boxes[i]["text"] for i in dc_boxes]
        sections["DC"] = {
            "text": "\n".join(texts),
            "children_texts": [],
            "box_indices": dc_boxes,
            "is_parent": False,
        }

    if discrete_boxes:
        texts = [boxes[i]["text"] for i in discrete_boxes]
        sections["DISCRETE"] = {
            "text": "\n---\n".join(texts),
            "children_texts": texts,
            "box_indices": discrete_boxes,
            "is_parent": False,
        }

    if ud_required_boxes or ud_or_boxes:
        all_ud_indices = ud_required_boxes + ud_or_boxes
        texts = [boxes[i]["text"] for i in all_ud_indices]
        sections["UD_COURSES"] = {
            "text": "\n---\n".join(texts),
            "children_texts": texts,
            "box_indices": all_ud_indices,
            "ud_required_indices": ud_required_boxes,
            "ud_or_indices": ud_or_boxes,
            "is_parent": False,
        }

    if ld_elective_boxes:
        sections["LD_ELECTIVE"] = {
            "text": "Lower Division Electives",
            "children_texts": [],
            "box_indices": ld_elective_boxes,
            "is_parent": False,
        }

    if ud_elective_boxes:
        sections["UD_ELECTIVE"] = {
            "text": "Upper Division Electives",
            "children_texts": [],
            "box_indices": ud_elective_boxes,
            "is_parent": False,
        }

    return sections


def _parse_parent_section(section_id: str, text: str,
                          children_texts: List[str]) -> List[Dict]:
    """Parse a parent-rect section (with child rects) into categories.

    Handles choose_group, pick_one patterns based on text cues and
    child rect structure.
    """
    text_norm = _normalize_dept_case(text)
    has_complete_one_seq = bool(re.search(r"(?i)Complete\s+one\s+sequence", text))
    has_complete_one = bool(re.search(r"(?i)Complete\s+One(?!\s+sequence)", text))
    has_choose_one = bool(re.search(r"(?i)Choose\s+One", text))

    if not children_texts:
        # No children — parse the box itself
        return _parse_standalone_box(section_id, text)

    # Check if children have OR within them (cross-product grouping needed)
    children_have_or = any(
        len(_split_by_or(_normalize_dept_case(ct))) > 1 for ct in children_texts
    )

    if has_choose_one or (has_complete_one and not has_complete_one_seq):
        # "Choose One" or "Complete One" → pick_one from child courses
        courses = []
        for ct in children_texts:
            ct_norm = _normalize_dept_case(ct)
            for seg in _split_by_or(ct_norm):
                c = _first_course_in(seg)
                if c:
                    courses.append(c)
        # Also check parent text for additional courses
        parent_segments = _split_by_or(text_norm)
        for seg in parent_segments:
            c = _first_course_in(seg)
            if c and c not in courses:
                courses.append(c)

        name_map = {
            "PROGRAMMING": "Programming",
            "COMPREHENSIVE": "Comprehensive Requirement",
        }
        return [{
            "id": section_id,
            "name": name_map.get(section_id, section_id.replace("_", " ").title()),
            "type": "pick_one",
            "courses": _dedup(courses),
            "description": f"Complete one of the listed courses.",
        }]

    if has_complete_one_seq or children_have_or:
        # "Complete one sequence" OR children have OR (cross-product)
        groups = []

        if children_have_or:
            # Cross-product: first option from each child = group 1,
            # second option = group 2
            group1 = []
            group2 = []
            for ct in children_texts:
                ct_norm = _normalize_dept_case(ct)
                segments = _split_by_or(ct_norm)
                if len(segments) >= 2:
                    if len(segments) > 2:
                        print(f"    WARNING: {len(segments)} OR segments in child, only using first 2")
                    c1 = _first_course_in(segments[0])
                    c2 = _first_course_in(segments[1])
                    if c1:
                        group1.append(c1)
                    if c2:
                        group2.append(c2)
                elif len(segments) == 1:
                    # No OR — this course is in both groups? No — it's shared.
                    # Actually, for & connected courses, all go into one group
                    and_segs = _split_by_and(ct_norm)
                    for aseg in and_segs:
                        c = _first_course_in(aseg)
                        if c:
                            group1.append(c)
                            group2.append(c)
            if group1 and group2 and group1 != group2:
                groups = [
                    {"label": "Option A (Preferred)", "courses": _dedup(group1)},
                    {"label": "Option B", "courses": _dedup(group2)},
                ]
        else:
            # Each child is a complete group (e.g., Calculus 19-series vs 20-series)
            for idx, ct in enumerate(children_texts):
                ct_norm = _normalize_dept_case(ct)
                # First try & separation, then fall back to all main codes
                and_segments = _split_by_and(ct_norm)
                if len(and_segments) > 1:
                    group_courses = []
                    for aseg in and_segments:
                        c = _first_course_in(aseg)
                        if c:
                            group_courses.append(c)
                else:
                    group_courses = _extract_main_codes(ct_norm)
                if group_courses:
                    groups.append({
                        "label": f"Option {chr(65 + idx)}",
                        "courses": group_courses,
                    })

        if groups:
            name_map = {
                "CALC": ("MATH_CALC", "Calculus Sequence"),
                "MULTIVAR": ("MATH_MULTIVAR", "Multivariable Calculus"),
                "LIN_ALG_DIFFEQ": ("LIN_ALG_DIFFEQ", "Linear Algebra & Differential Equations"),
            }
            cat_id, cat_name = name_map.get(section_id, (section_id, section_id))
            return [{
                "id": cat_id,
                "name": cat_name,
                "type": "choose_group",
                "groups": groups,
                "description": f"Choose one sequence/group.",
            }]

    # Fallback: all courses required
    courses = []
    for ct in children_texts:
        ct_norm = _normalize_dept_case(ct)
        c = _first_course_in(ct_norm)
        if c:
            courses.append(c)
    if courses:
        return [{
            "id": section_id,
            "name": section_id.replace("_", " ").title(),
            "type": "all_required",
            "courses": _dedup(courses),
            "description": "All courses are required.",
        }]
    return []


def _parse_standalone_box(section_id: str, text: str) -> List[Dict]:
    """Parse a standalone box (no children) into categories."""
    text_norm = _normalize_dept_case(text)
    segments = _split_by_or(text_norm)

    if len(segments) > 1:
        courses = []
        for seg in segments:
            c = _first_course_in(seg)
            if c:
                courses.append(c)
        if courses:
            return [{
                "id": section_id,
                "name": section_id.replace("_", " ").title(),
                "type": "pick_one",
                "courses": _dedup(courses),
                "description": f"Choose one course.",
            }]

    courses = extract_codes(text_norm)
    if courses:
        return [{
            "id": section_id,
            "name": section_id.replace("_", " ").title(),
            "type": "all_required",
            "courses": courses[:1],
            "description": "Required.",
        }]
    return []


def _parse_ud_courses_section(section: Dict, boxes: List[Dict]) -> List[Dict]:
    """Parse the Upper Division Courses section into required + pick_one categories.

    This section has standalone rects — some with single required courses,
    others with OR alternatives.
    """
    categories = []
    required_courses = []
    pick_one_pairs = []

    # Process required course boxes (no OR)
    for idx in section.get("ud_required_indices", []):
        text_norm = _normalize_dept_case(boxes[idx]["text"])
        c = _first_course_in(text_norm)
        if c:
            required_courses.append(c)

    # Process OR-alternative boxes
    for idx in section.get("ud_or_indices", []):
        text_norm = _normalize_dept_case(boxes[idx]["text"])
        segments = _split_by_or(text_norm)
        courses = []
        for seg in segments:
            c = _first_course_in(seg)
            if c:
                courses.append(c)
        if len(courses) >= 2:
            pick_one_pairs.append(courses)

    if required_courses:
        categories.append({
            "id": "UD_REQUIRED",
            "name": "Upper Division Required",
            "type": "all_required",
            "courses": _dedup(required_courses),
            "description": "All upper-division core courses are required.",
        })

    assigned_ids: set = set()
    for i, courses in enumerate(pick_one_pairs):
        if any("STAT" in c or "CSE 107" in c for c in courses) and "UD_STATS" not in assigned_ids:
            cat_id, cat_name = "UD_STATS", "Statistics/Probability (Choose One)"
        elif any("147" in c or "148" in c for c in courses) and "UD_ANALYSIS" not in assigned_ids:
            cat_id, cat_name = "UD_ANALYSIS", "Analysis (Choose One)"
        else:
            cat_id = f"UD_CHOICE_{i+1}"
            cat_name = f"Upper Division Choice {i+1}"
        assigned_ids.add(cat_id)
        categories.append({
            "id": cat_id,
            "name": cat_name,
            "type": "pick_one",
            "courses": _dedup(courses),
            "description": "Choose one course.",
        })

    return categories


def _parse_discrete_section(section: Dict, boxes: List[Dict]) -> List[Dict]:
    """Parse discrete math section — separate boxes for CSE 16 and MATH 100."""
    courses = []
    for idx in section["box_indices"]:
        text_norm = _normalize_dept_case(boxes[idx]["text"])
        c = _first_course_in(text_norm)
        if c:
            courses.append(c)

    if len(courses) >= 2:
        return [{
            "id": "MATH_DISCRETE",
            "name": "Discrete Mathematics",
            "type": "pick_one",
            "courses": _dedup(courses),
            "description": "Choose one discrete mathematics course.",
        }]
    elif courses:
        return [{
            "id": "MATH_DISCRETE",
            "name": "Discrete Mathematics",
            "type": "all_required",
            "courses": courses,
            "description": "Discrete mathematics is required.",
        }]
    return []


def scrape_elective_page(url: str) -> Dict[str, List[str]]:
    """Fetch an elective page and extract course codes by division.

    Returns {"lower": [codes...], "upper": [codes...]}.
    """
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        print("    WARNING: beautifulsoup4 not installed, cannot scrape electives")
        return {"lower": [], "upper": []}

    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) "
                           "Chrome/120.0 Safari/537.36"),
        })
        with urllib.request.urlopen(req, timeout=30) as resp:
            html = resp.read(5 * 1024 * 1024).decode("utf-8", errors="replace")
    except Exception as exc:
        print(f"    WARNING: Failed to fetch elective page: {exc}")
        return {"lower": [], "upper": []}

    soup = BeautifulSoup(html, "html.parser")

    lower_codes = []
    upper_codes = []

    # Find section headings by their id attributes or text content
    upper_heading = soup.find(id="upper") or soup.find(
        re.compile(r"^h[1-4]$"), string=re.compile(r"(?i)upper.*division")
    )
    lower_heading = soup.find(id="lower") or soup.find(
        re.compile(r"^h[1-4]$"), string=re.compile(r"(?i)lower.*division")
    )

    def _collect_list_codes(start_heading, stop_heading):
        """Extract course codes from <li> elements between two headings."""
        codes = []
        if not start_heading:
            return codes
        for el in start_heading.find_all_next():
            if stop_heading and el == stop_heading:
                break
            if el.name == "li":
                li_text = _normalize_dept_case(el.get_text())
                li_codes = extract_codes(li_text)
                codes.extend(li_codes)
        return _dedup(codes)

    def _collect_all_codes_in_section(start_heading, stop_tag="h2"):
        """Extract all course codes from text between heading and next h2."""
        codes = []
        if not start_heading:
            return codes
        for el in start_heading.find_all_next():
            if el.name == stop_tag and el != start_heading:
                break
            text = _normalize_dept_case(el.get_text())
            codes.extend(extract_codes(text))
        return _dedup(codes)

    # Extract codes from each section (upper comes first in page order)
    upper_codes = _collect_list_codes(upper_heading, lower_heading)
    lower_codes = _collect_list_codes(lower_heading, None)

    # Fallback: if no upper/lower headings found, try id="electives" (CE-style page)
    if not upper_codes and not lower_codes:
        electives_heading = soup.find(id="electives")
        if electives_heading:
            all_codes = _collect_all_codes_in_section(electives_heading)
            # All courses on CE-style pages are upper division
            upper_codes = all_codes

    # Post-filter: remove excluded grad courses and normalize
    excluded_upper = {"AM 200", "AM 211"}
    upper_codes = [c for c in upper_codes
                   if c not in excluded_upper
                   and not (c.startswith("AM ") and c[3:].isdigit()
                            and int(c[3:]) >= 280)]

    return {"lower": _dedup(lower_codes), "upper": _dedup(upper_codes)}


def _parse_elective_from_box(box_text: str) -> List[str]:
    """Extract elective course codes from a large in-chart elective description box."""
    text_norm = _normalize_dept_case(box_text)
    codes = extract_codes(text_norm)
    return _dedup(codes)


def _classify_box(box: Dict, config: Dict) -> Optional[str]:
    """Classify a box into a category role based on its content and the major config.

    Returns a role string or None if unclassified.
    """
    text = box["text"]
    text_norm = _normalize_dept_case(text)
    codes = _extract_main_codes(text_norm)
    if not codes and not text.strip():
        return None

    # DC
    if "(D C)" in text or "(DC)" in text or re.search(r"(?i)DC\s+Requirement", text):
        return "DC"
    if re.search(r"(?i)Disciplinary\s+Communication", text):
        return "DC"

    # Capstone/Comprehensive
    if re.search(r"(?i)Capstone|Comprehensive\s+Requirement|Senior\s+Thesis", text):
        return "CAPSTONE"

    # Elective placeholder (blank line, few/no course codes)
    if re.search(r"_{3,}", text) and len(codes) <= 8:
        if re.search(r"(?i)\bELECTIVE\b", text) or re.search(r"^\d+\._", text.strip()):
            return "ELECTIVE_PLACEHOLDER"

    # Large elective description box (many courses listed)
    if re.search(r"(?i)\bElective\b", text) and len(codes) > 8:
        return "ELECTIVE_DESCRIPTION"

    # Elective with URL reference
    if re.search(r"(?i)Elective", text) and re.search(r"(?i)website|list|found", text):
        return "ELECTIVE_REF"

    if not codes:
        return None

    first_code = codes[0]

    # Check configured categories
    ld_core = set(config.get("ld_core_codes", []))
    ud_core = set(config.get("ud_core_codes", []))
    stats_codes = set(config.get("stats_codes", []))
    physics_codes = set(config.get("physics_codes", []))

    if first_code in ld_core:
        return "LD_CORE"
    if first_code in ud_core:
        return "UD_CORE"
    if first_code in stats_codes:
        return "STATS"
    if first_code in physics_codes:
        return "PHYSICS"

    # Math courses: only classify as MATH (for choose_group) if box has OR
    math_patterns = {"AM 10", "AM 20", "AM 30", "MATH 19A", "MATH 19B",
                     "MATH 20A", "MATH 20B", "MATH 21", "MATH 22",
                     "MATH 23A", "MATH 23B", "MATH 24"}
    has_or = bool(re.search(r"\bOR\b|\bor\b", text))
    if first_code in math_patterns and has_or:
        return "MATH"
    if first_code in math_patterns and not has_or:
        return "LD_CORE"

    # Chemistry
    if first_code.startswith("CHEM "):
        return "CHEMISTRY"

    # Biology
    if first_code.startswith("BIOL ") or first_code.startswith("BIOE "):
        return "BIOLOGY"

    # Generic UD course with OR (pick_one)
    num = _course_num(first_code)
    if has_or and num >= 100 and not first_code.startswith("CHEM "):
        return "UD_CHOICE"

    # Generic UD course (all_required)
    if num >= 100:
        return "UD_CORE"

    # Generic LD course
    if num < 100:
        return "LD_CORE"

    return None


def _detect_math_choose_groups(math_boxes: List[Dict], config: Dict) -> List[Dict]:
    """Detect math choose_group categories from boxes classified as MATH.

    Groups OR-connected boxes at similar y-positions into choose_group categories.
    """
    if not math_boxes:
        return []

    # Check config for explicit math groupings
    configured_groups = config.get("math_choose_groups", [])

    # Sort math boxes by y-position
    sorted_boxes = sorted(math_boxes, key=lambda b: b["top"])

    # Group boxes by y-position proximity (within 15px = same row)
    rows = []
    current_row = [sorted_boxes[0]]
    for box in sorted_boxes[1:]:
        if abs(box["top"] - current_row[0]["top"]) <= 15:
            current_row.append(box)
        else:
            rows.append(current_row)
            current_row = [box]
    rows.append(current_row)

    categories = []

    # Each row with OR in its text = one choose_group line
    choose_lines = []
    for row in rows:
        for box in row:
            text_norm = _normalize_dept_case(box["text"])
            # Try line-separated OR first
            or_segments = _split_by_or(text_norm)
            if len(or_segments) >= 2:
                option_a = _extract_main_codes(or_segments[0])
                option_b = _extract_main_codes(or_segments[1])
                if option_a and option_b:
                    choose_lines.append((option_a[0], option_b[0]))
                    continue

            # Try inline OR: "AM 10 ... OR ... MATH 21" on same/adjacent lines
            if re.search(r"\bOR\b|\bor\b", text_norm):
                codes = _extract_main_codes(text_norm)
                # Look for two distinct codes from known OR-pairs
                am_codes = [c for c in codes if c.startswith("AM ")]
                math_codes = [c for c in codes if c.startswith("MATH ")]
                if am_codes and math_codes:
                    choose_lines.append((am_codes[0], math_codes[0]))

    # Group related choose_lines into choose_group categories
    if configured_groups and choose_lines:
        # Use configured groups directly — they represent the full validated pairing
        for group_a, group_b in configured_groups:
            categories.append({
                "id": "MATH_SEQUENCE",
                "name": "Mathematics Sequence",
                "type": "choose_group",
                "groups": [
                    {"label": "Option A (Engineering Math)", "courses": list(group_a)},
                    {"label": "Option B (Pure Math)", "courses": list(group_b)},
                ],
                "description": "Choose one mathematics sequence.",
            })
        return categories

    # Fallback: if we have 2+ choose_lines, bundle them
    if len(choose_lines) >= 2:
        group_a = _dedup([line[0] for line in choose_lines])
        group_b = _dedup([line[1] for line in choose_lines])
        categories.append({
            "id": "MATH_SEQUENCE",
            "name": "Mathematics Sequence",
            "type": "choose_group",
            "groups": [
                {"label": "Option A", "courses": group_a},
                {"label": "Option B", "courses": group_b},
            ],
            "description": "Choose one mathematics sequence.",
        })
    elif len(choose_lines) == 1:
        categories.append({
            "id": "MATH_CHOICE",
            "name": "Mathematics Choice",
            "type": "pick_one",
            "courses": list(choose_lines[0]),
            "description": "Choose one course.",
        })

    # Also add any non-OR math boxes as required
    for row in rows:
        for box in row:
            text_norm = _normalize_dept_case(box["text"])
            if len(_split_by_or(text_norm)) < 2:
                codes = _extract_main_codes(text_norm)
                # These are standalone required math courses (e.g., MATH 19A standalone)
                # Only add if not already captured in a choose_group
                all_grouped = set()
                for cat in categories:
                    for g in cat.get("groups", []):
                        all_grouped.update(g.get("courses", []))
                    all_grouped.update(cat.get("courses", []))
                new_codes = [c for c in codes if c not in all_grouped and c in
                             {"MATH 19A", "MATH 19B", "MATH 20A", "MATH 20B",
                              "CSE 16", "MATH 100"}]
                # Don't add individual required math — they're usually part of sequence

    return categories


def _parse_flat_major(major_id: str, name: str, pdf_url: str,
                      boxes: List[Dict]) -> Optional[Dict]:
    """Parse a flat-structure major (no parent-child hierarchy).

    Groups boxes by their classified role and assembles categories.
    """
    config = MAJOR_CONFIG.get(major_id, {})

    # Classify each top-level box
    classified: Dict[str, List[Dict]] = {}
    for box in boxes:
        if box["parent_idx"] is not None:
            continue
        role = _classify_box(box, config)
        if role:
            classified.setdefault(role, []).append(box)

    categories: List[Dict] = []
    used_codes: set = set()

    # 1. Math sequence (choose_group)
    if "MATH" in classified:
        math_cats = _detect_math_choose_groups(classified["MATH"], config)
        categories.extend(math_cats)
        for cat in math_cats:
            for g in cat.get("groups", []):
                used_codes.update(g.get("courses", []))
            used_codes.update(cat.get("courses", []))

    # 2. Statistics choice (pick_one if OR, else all_required)
    if "STATS" in classified:
        stats_courses = []
        for box in classified["STATS"]:
            text_norm = _normalize_dept_case(box["text"])
            or_segs = _split_by_or(text_norm)
            for seg in or_segs:
                c = _first_course_in(seg)
                if c and c not in used_codes:
                    stats_courses.append(c)
        stats_courses = _dedup(stats_courses)
        if len(stats_courses) >= 2:
            categories.append({
                "id": "STATS",
                "name": "Statistics/Probability",
                "type": "pick_one",
                "courses": stats_courses,
                "description": "Choose one statistics course.",
            })
        elif stats_courses:
            categories.append({
                "id": "STATS",
                "name": "Statistics/Probability",
                "type": "all_required",
                "courses": stats_courses,
                "description": "Required statistics course.",
            })
        used_codes.update(stats_courses)

    # 3. Physics (all_required)
    if "PHYSICS" in classified:
        phys_courses = []
        for box in classified["PHYSICS"]:
            text_norm = _normalize_dept_case(box["text"])
            codes = _extract_main_codes(text_norm)
            if codes and codes[0] not in used_codes:
                phys_courses.append(codes[0])
        phys_courses = _dedup(phys_courses)
        if phys_courses:
            categories.append({
                "id": "PHYSICS",
                "name": "Physics",
                "type": "all_required",
                "courses": phys_courses,
                "description": "Required physics courses.",
            })
            used_codes.update(phys_courses)

    # 4. Chemistry (all_required)
    if "CHEMISTRY" in classified:
        chem_courses = []
        for box in classified["CHEMISTRY"]:
            text_norm = _normalize_dept_case(box["text"])
            codes = _extract_main_codes(text_norm)
            if codes and codes[0] not in used_codes:
                chem_courses.append(codes[0])
        chem_courses = _dedup(chem_courses)
        if chem_courses:
            categories.append({
                "id": "CHEMISTRY",
                "name": "Chemistry",
                "type": "all_required",
                "courses": chem_courses,
                "description": "Required chemistry courses.",
            })
            used_codes.update(chem_courses)

    # 5. Biology (all_required)
    if "BIOLOGY" in classified:
        bio_courses = []
        for box in classified["BIOLOGY"]:
            text_norm = _normalize_dept_case(box["text"])
            codes = _extract_main_codes(text_norm)
            if codes and codes[0] not in used_codes:
                bio_courses.append(codes[0])
        bio_courses = _dedup(bio_courses)
        if bio_courses:
            categories.append({
                "id": "BIOLOGY",
                "name": "Biology",
                "type": "all_required",
                "courses": bio_courses,
                "description": "Required biology courses.",
            })
            used_codes.update(bio_courses)

    # 6. Lower-division core (all_required) — split out OR boxes as pick_one
    if "LD_CORE" in classified:
        ld_courses = []
        ld_choices = []
        for box in classified["LD_CORE"]:
            text_norm = _normalize_dept_case(box["text"])
            text_raw = box["text"]
            codes = _extract_main_codes(text_norm)
            if not codes:
                continue
            # Check if this box has OR between its codes
            has_or_in_box = bool(re.search(r"\bOR\b|\bor\b", text_raw))
            if has_or_in_box and len(codes) >= 2:
                choice_codes = [c for c in codes if c not in used_codes]
                if len(choice_codes) >= 2:
                    ld_choices.append(choice_codes)
                    used_codes.update(choice_codes)
            elif codes[0] not in used_codes:
                ld_courses.append(codes[0])
        ld_courses = _dedup(ld_courses)
        if ld_courses:
            categories.append({
                "id": "LD_CORE",
                "name": "Lower Division Core",
                "type": "all_required",
                "courses": ld_courses,
                "description": "Required lower-division courses.",
            })
            used_codes.update(ld_courses)
        for i, choice in enumerate(ld_choices):
            categories.append({
                "id": f"LD_CHOICE_{i+1}",
                "name": f"Lower Division Choice {i+1}",
                "type": "pick_one",
                "courses": _dedup(choice),
                "description": "Choose one course.",
            })

    # 7. Upper-division core (all_required) and UD choices (pick_one)
    ud_required = []
    ud_choices = []
    if "UD_CORE" in classified:
        for box in classified["UD_CORE"]:
            text_norm = _normalize_dept_case(box["text"])
            codes = _extract_main_codes(text_norm)
            if codes and codes[0] not in used_codes:
                ud_required.append(codes[0])
                used_codes.add(codes[0])

    if "UD_CHOICE" in classified:
        for box in classified["UD_CHOICE"]:
            text_norm = _normalize_dept_case(box["text"])
            or_segs = _split_by_or(text_norm)
            choice_courses = []
            for seg in or_segs:
                c = _first_course_in(seg)
                if c and c not in used_codes:
                    choice_courses.append(c)
            if len(choice_courses) >= 2:
                ud_choices.append(choice_courses)
                used_codes.update(choice_courses)
            elif choice_courses:
                ud_required.extend(choice_courses)
                used_codes.update(choice_courses)

    ud_required = _dedup(ud_required)
    if ud_required:
        categories.append({
            "id": "UD_REQUIRED",
            "name": "Upper Division Required",
            "type": "all_required",
            "courses": ud_required,
            "description": "Required upper-division courses.",
        })

    for i, choice in enumerate(ud_choices):
        categories.append({
            "id": f"UD_CHOICE_{i+1}",
            "name": f"Upper Division Choice {i+1}",
            "type": "pick_one",
            "courses": _dedup(choice),
            "description": "Choose one course.",
        })

    # 8. DC requirement
    dc_courses = []
    if "DC" in classified:
        dc_courses = config.get("dc_codes", [])
        if not dc_courses:
            for box in classified["DC"]:
                text_norm = _normalize_dept_case(box["text"])
                codes = extract_codes(text_norm)
                dc_courses.extend(codes)
    elif config.get("dc_codes"):
        dc_courses = config["dc_codes"]
    dc_courses = _dedup(dc_courses)
    if dc_courses:
        cat_type = "pick_one" if len(dc_courses) > 1 else "all_required"
        categories.append({
            "id": "DC",
            "name": "Disciplinary Communication (DC)",
            "type": cat_type,
            "courses": dc_courses,
            "description": "Complete the DC requirement.",
        })
        used_codes.update(dc_courses)

    # 9. Capstone/Comprehensive
    if "CAPSTONE" in classified:
        cap_courses = []
        for box in classified["CAPSTONE"]:
            text_norm = _normalize_dept_case(box["text"])
            codes = _extract_main_codes(text_norm)
            for c in codes:
                if c not in used_codes:
                    cap_courses.append(c)
        cap_courses = _dedup(cap_courses)
        if cap_courses:
            cat_type = "pick_one" if len(cap_courses) > 1 else "all_required"
            categories.append({
                "id": "CAPSTONE",
                "name": "Capstone/Comprehensive Requirement",
                "type": cat_type,
                "courses": cap_courses,
                "description": "Complete the capstone requirement.",
            })
            used_codes.update(cap_courses)

    # 10. Electives
    elective_data = {}
    if major_id in ELECTIVE_URLS:
        print(f"    scraping elective page...")
        elective_data = scrape_elective_page(ELECTIVE_URLS[major_id])

    # Count elective placeholder boxes and extract any listed courses
    n_elec_placeholders = len(classified.get("ELECTIVE_PLACEHOLDER", []))
    n_elec_ref = len(classified.get("ELECTIVE_REF", []))

    # Collect courses from elective placeholder/ref boxes
    placeholder_elec_codes = []
    for box in classified.get("ELECTIVE_PLACEHOLDER", []) + classified.get("ELECTIVE_REF", []):
        text_norm = _normalize_dept_case(box["text"])
        codes = extract_codes(text_norm)
        for c in codes:
            if c not in used_codes:
                placeholder_elec_codes.append(c)
    placeholder_elec_codes = _dedup(placeholder_elec_codes)

    # In-chart elective description (large box with many courses)
    if "ELECTIVE_DESCRIPTION" in classified:
        elec_box = classified["ELECTIVE_DESCRIPTION"][0]
        elec_codes = _parse_elective_from_box(elec_box["text"])
        elec_codes = [c for c in elec_codes if c not in used_codes]
        if elec_codes:
            n = n_elec_placeholders if n_elec_placeholders > 0 else 3
            categories.append({
                "id": "UD_ELECTIVE",
                "name": "Upper Division Electives",
                "type": "pick_n",
                "n": n,
                "courses": elec_codes,
                "description": f"Choose {n} elective courses.",
            })

    elif n_elec_placeholders > 0 or n_elec_ref > 0:
        # Determine UD vs LD elective count by position
        ud_elec_count = 0
        ld_elec_count = 0
        for box in classified.get("ELECTIVE_PLACEHOLDER", []):
            if box["top"] > 350:
                ud_elec_count += 1
            else:
                ld_elec_count += 1

        # Use scraped data, or placeholder-extracted codes, or empty
        ud_courses = elective_data.get("upper", []) or placeholder_elec_codes or []
        n = ud_elec_count if ud_elec_count > 0 else (n_elec_placeholders or n_elec_ref)
        if n > 0:
            # For EE_BS: "4 additional upper-division courses" from text
            elec_text = " ".join(box["text"] for box in
                                 classified.get("ELECTIVE_PLACEHOLDER", []))
            n_from_text = re.search(r"(\d+)\s+additional\s+upper", elec_text)
            if n_from_text:
                n = int(n_from_text.group(1))

            categories.append({
                "id": "UD_ELECTIVE",
                "name": "Upper Division Electives",
                "type": "pick_n",
                "n": max(n, 1),
                "courses": ud_courses,
                "description": f"Choose {max(n, 1)} upper-division elective courses.",
            })

        if elective_data.get("lower"):
            n = ld_elec_count if ld_elec_count > 0 else 1
            categories.append({
                "id": "LD_ELECTIVE",
                "name": "Lower Division Electives",
                "type": "pick_n",
                "n": n,
                "courses": elective_data["lower"],
                "description": f"Choose {n} lower-division elective courses.",
            })

    # Collect all codes
    all_codes = []
    for cat in categories:
        for c in cat.get("courses", []):
            all_codes.append(c)
        for g in cat.get("groups", []):
            for c in g.get("courses", []):
                all_codes.append(c)
    all_codes = _dedup(all_codes)

    if len(categories) < 3:
        return None

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
        "uncategorizedCodes": [],
        "_raw_text": "",
        "_flags": [],
    }


def parse_major_pdf_spatial(
    major_id: str, name: str, pdf_url: str, pdf_path: Path
) -> Optional[Dict]:
    """Parse a major PDF using spatial (rectangle-based) extraction.

    Returns a result dict if spatial extraction succeeds, or None to
    signal that the caller should fall back to text-based extraction.
    """
    boxes = extract_pdf_boxes(pdf_path)
    if not boxes or len(boxes) < 5:
        return None

    config = MAJOR_CONFIG.get(major_id, {})
    structure = config.get("structure", "")

    # For AM_BS (verified), use original section-based parser
    if major_id == "AM_BS":
        sections = _boxes_to_sections(boxes)
        if len(sections) < 3:
            return None
        return _parse_am_bs_spatial(major_id, name, pdf_url, boxes, sections)

    # For flat-structure majors, use the generalized flat parser
    if structure == "flat":
        return _parse_flat_major(major_id, name, pdf_url, boxes)

    # For hierarchical majors (BMEB, CSGD), try section-based parsing with relaxed rules
    if structure == "hierarchical":
        return _parse_hierarchical_generic(major_id, name, pdf_url, boxes)

    # For sparse majors (BIOTECH), fall back to text
    if structure == "sparse":
        return None

    # Default: try flat parser
    return _parse_flat_major(major_id, name, pdf_url, boxes)


def _parse_am_bs_spatial(major_id: str, name: str, pdf_url: str,
                         boxes: List[Dict], sections: Dict) -> Optional[Dict]:
    """Original AM_BS-specific spatial parser (proven correct)."""
    categories: List[Dict] = []
    all_codes: List[str] = []

    # Parse parent-rect sections (Calculus, Multivar, LinAlg, Programming, Comprehensive)
    for sid in ("CALC", "LIN_ALG_DIFFEQ", "MULTIVAR", "PROGRAMMING", "COMPREHENSIVE"):
        if sid in sections:
            sec = sections[sid]
            cats = _parse_parent_section(
                sid, sec["text"], sec["children_texts"]
            )
            categories.extend(cats)

    # Parse DC section
    if "DC" in sections:
        sec = sections["DC"]
        text_norm = _normalize_dept_case(sec["text"])
        codes = extract_codes(text_norm)
        dc_codes = [c for c in codes if "170A" in c or "185" in c or "115A" in c]
        if not dc_codes:
            dc_codes = codes[:1]
        if dc_codes:
            categories.append({
                "id": "DC",
                "name": "Disciplinary Communication (DC)",
                "type": "all_required",
                "courses": dc_codes,
                "description": "Complete the DC course.",
            })

    # Parse Discrete Math section
    if "DISCRETE" in sections:
        categories.extend(_parse_discrete_section(sections["DISCRETE"], boxes))

    # Parse Upper Division Courses section
    if "UD_COURSES" in sections:
        categories.extend(_parse_ud_courses_section(sections["UD_COURSES"], boxes))

    # Parse elective sections (need web scraping)
    elective_data = {}
    if major_id in ELECTIVE_URLS:
        print(f"    scraping elective page...")
        elective_data = scrape_elective_page(ELECTIVE_URLS[major_id])

    if "LD_ELECTIVE" in sections:
        ld_courses = elective_data.get("lower", [])
        n = len(sections["LD_ELECTIVE"]["box_indices"])
        categories.append({
            "id": "LD_ELECTIVE",
            "name": "Lower Division Electives",
            "type": "pick_n",
            "n": n,
            "courses": ld_courses,
            "description": f"Choose {n} lower-division elective courses.",
        })

    if "UD_ELECTIVE" in sections:
        ud_courses = elective_data.get("upper", [])
        n = len(sections["UD_ELECTIVE"]["box_indices"])
        categories.append({
            "id": "UD_ELECTIVE",
            "name": "Upper Division Electives",
            "type": "pick_n",
            "n": n,
            "courses": ud_courses,
            "description": f"Choose {n} upper-division elective courses.",
        })

    # Collect all course codes across categories
    for cat in categories:
        for c in cat.get("courses", []):
            all_codes.append(c)
        for g in cat.get("groups", []):
            for c in g.get("courses", []):
                all_codes.append(c)
    all_codes = _dedup(all_codes)

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
        "uncategorizedCodes": [],
        "_raw_text": "",
        "_flags": [],
    }


def _parse_hierarchical_generic(major_id: str, name: str, pdf_url: str,
                                boxes: List[Dict]) -> Optional[Dict]:
    """Parse hierarchical-structure majors (BMEB_BI, BMEB_BM, CSGD_BS).

    Uses parent box text as section headers and parses children.
    """
    config = MAJOR_CONFIG.get(major_id, {})
    categories: List[Dict] = []
    used_codes: set = set()

    # Get top-level (parent) boxes
    top_level = [(i, boxes[i]) for i in range(len(boxes)) if boxes[i]["parent_idx"] is None]

    for idx, box in top_level:
        text = box["text"]
        text_norm = _normalize_dept_case(text)
        children_texts = [boxes[c]["text"] for c in box["children"]]

        # Identify section by header text
        if re.search(r"(?i)Capstone|Comprehensive", text):
            # Capstone section — look for "Choose one sequence" or course alternatives
            courses = []
            if re.search(r"(?i)Choose\s+one", text):
                for ct in children_texts:
                    ct_norm = _normalize_dept_case(ct)
                    codes = _extract_main_codes(ct_norm)
                    if codes:
                        courses.append(codes[0])
                if not courses:
                    courses = _extract_main_codes(text_norm)
            else:
                courses = _extract_main_codes(text_norm)
            courses = [c for c in _dedup(courses) if c not in used_codes]
            if courses:
                cat_type = "pick_one" if len(courses) > 1 else "all_required"
                categories.append({
                    "id": "CAPSTONE",
                    "name": "Capstone/Comprehensive",
                    "type": cat_type,
                    "courses": courses,
                    "description": "Complete the capstone requirement.",
                })
                used_codes.update(courses)

        elif re.search(r"(?i)Programming", text) and box["children"]:
            # Programming section
            courses = []
            for ct in children_texts:
                ct_norm = _normalize_dept_case(ct)
                codes = _extract_main_codes(ct_norm)
                if codes and codes[0] not in used_codes:
                    courses.append(codes[0])
            courses = _dedup(courses)
            if courses:
                categories.append({
                    "id": "PROGRAMMING",
                    "name": "Programming",
                    "type": "all_required",
                    "courses": courses,
                    "description": "Required programming courses.",
                })
                used_codes.update(courses)

        elif re.search(r"(?i)Math\s*(&|and)\s*Stat", text) and box["children"]:
            # Math & Statistics section
            math_courses = []
            stats_courses = []
            for ct in children_texts:
                ct_norm = _normalize_dept_case(ct)
                codes = _extract_main_codes(ct_norm)
                if not codes:
                    continue
                first = codes[0]
                if first.startswith("STAT ") or first == "CSE 107":
                    for c in codes:
                        if c not in used_codes:
                            stats_courses.append(c)
                else:
                    if first not in used_codes:
                        math_courses.append(first)

            # Check for OR alternatives in math
            or_pairs = []
            for ct in children_texts:
                ct_norm = _normalize_dept_case(ct)
                or_segs = _split_by_or(ct_norm)
                if len(or_segs) >= 2:
                    a = _first_course_in(or_segs[0])
                    b = _first_course_in(or_segs[1])
                    if a and b:
                        or_pairs.append((a, b))

            if or_pairs:
                group_a = [p[0] for p in or_pairs]
                group_b = [p[1] for p in or_pairs]
                categories.append({
                    "id": "MATH_SEQUENCE",
                    "name": "Mathematics Sequence",
                    "type": "choose_group",
                    "groups": [
                        {"label": "Option A", "courses": _dedup(group_a)},
                        {"label": "Option B", "courses": _dedup(group_b)},
                    ],
                    "description": "Choose one mathematics sequence.",
                })
                used_codes.update(group_a + group_b)
            elif math_courses:
                categories.append({
                    "id": "MATH_REQUIRED",
                    "name": "Mathematics",
                    "type": "all_required",
                    "courses": _dedup(math_courses),
                    "description": "Required mathematics courses.",
                })
                used_codes.update(math_courses)

            if stats_courses:
                stats_courses = _dedup(stats_courses)
                categories.append({
                    "id": "STATS",
                    "name": "Statistics",
                    "type": "all_required",
                    "courses": stats_courses,
                    "description": "Required statistics courses.",
                })
                used_codes.update(stats_courses)

        elif re.search(r"(?i)Biolog|Organic\s+Chem|Biochem", text) and box["children"]:
            # Biology/Chemistry combined section
            bio_courses = []
            chem_courses = []
            pick_one_courses = []
            for ct in children_texts:
                ct_norm = _normalize_dept_case(ct)
                codes = _extract_main_codes(ct_norm)
                if not codes:
                    continue
                # Check for "Select one of the following"
                if re.search(r"(?i)Select\s+one|Choose\s+one", ct):
                    for c in codes:
                        if c not in used_codes:
                            pick_one_courses.append(c)
                elif codes[0].startswith("CHEM ") or codes[0].startswith("BIOC "):
                    for c in codes:
                        if c not in used_codes:
                            chem_courses.append(c)
                else:
                    for c in codes:
                        if c not in used_codes:
                            bio_courses.append(c)

            if bio_courses:
                categories.append({
                    "id": "BIOLOGY",
                    "name": "Biology",
                    "type": "all_required",
                    "courses": _dedup(bio_courses),
                    "description": "Required biology courses.",
                })
                used_codes.update(bio_courses)
            if chem_courses:
                categories.append({
                    "id": "CHEMISTRY",
                    "name": "Chemistry",
                    "type": "all_required",
                    "courses": _dedup(chem_courses),
                    "description": "Required chemistry courses.",
                })
                used_codes.update(chem_courses)
            if pick_one_courses:
                categories.append({
                    "id": "BIO_CHOICE",
                    "name": "Biology/Chemistry Choice",
                    "type": "pick_one",
                    "courses": _dedup(pick_one_courses),
                    "description": "Choose one course.",
                })
                used_codes.update(pick_one_courses)

        elif re.search(r"(?i)Chemistry", text) and box["children"]:
            # Standalone chemistry section (BMEB_BI has this)
            chem_courses = []
            choose_groups = []
            for ct in children_texts:
                ct_norm = _normalize_dept_case(ct)
                codes = _extract_main_codes(ct_norm)
                if codes and codes[0] not in used_codes:
                    chem_courses.append(codes[0])

            # Check for "Select one" in parent text
            if re.search(r"(?i)Select\s+one", text):
                # Each child is a group option
                groups = []
                for ct in children_texts:
                    ct_norm = _normalize_dept_case(ct)
                    codes = _extract_main_codes(ct_norm)
                    if codes:
                        groups.append(codes)
                if len(groups) >= 2:
                    categories.append({
                        "id": "CHEMISTRY",
                        "name": "Chemistry Sequence",
                        "type": "choose_group",
                        "groups": [
                            {"label": f"Option {chr(65+i)}", "courses": g}
                            for i, g in enumerate(groups)
                        ],
                        "description": "Choose one chemistry sequence.",
                    })
                    for g in groups:
                        used_codes.update(g)
            elif chem_courses:
                categories.append({
                    "id": "CHEMISTRY",
                    "name": "Chemistry",
                    "type": "all_required",
                    "courses": _dedup(chem_courses),
                    "description": "Required chemistry courses.",
                })
                used_codes.update(chem_courses)

        elif re.search(r"(?i)Elective", text) and box["children"]:
            # Elective section with children
            elec_courses = []
            for ct in children_texts:
                ct_norm = _normalize_dept_case(ct)
                codes = _extract_main_codes(ct_norm)
                for c in codes:
                    if c not in used_codes:
                        elec_courses.append(c)
            elec_courses = _dedup(elec_courses)
            n_placeholders = sum(1 for ct in children_texts
                                 if re.search(r"_{3,}", ct) or
                                 re.search(r"(?i)\bElective\b", ct))
            if elec_courses:
                n = max(n_placeholders, 1)
                categories.append({
                    "id": "UD_ELECTIVE",
                    "name": "Electives",
                    "type": "pick_n",
                    "n": n,
                    "courses": elec_courses,
                    "description": f"Choose {n} elective courses.",
                })

        elif re.search(r"(?i)Disciplinary\s+Comm|BME\s+185.*Technical\s+Writing", text):
            dc_codes = config.get("dc_codes", [])
            if not dc_codes:
                codes = _extract_main_codes(text_norm)
                dc_codes = [c for c in codes if "185" in c or "115A" in c or "170A" in c]
            if dc_codes:
                categories.append({
                    "id": "DC",
                    "name": "Disciplinary Communication (DC)",
                    "type": "all_required",
                    "courses": _dedup(dc_codes),
                    "description": "Complete the DC requirement.",
                })
                used_codes.update(dc_codes)

    # Handle standalone boxes (no children, not claimed by parents)
    categorized_indices = set()
    for idx, box in top_level:
        categorized_indices.add(idx)

    # DC from config if not yet found
    if not any(c["id"] == "DC" for c in categories) and config.get("dc_codes"):
        categories.append({
            "id": "DC",
            "name": "Disciplinary Communication (DC)",
            "type": "all_required",
            "courses": config["dc_codes"],
            "description": "Complete the DC requirement.",
        })

    # Elective scraping
    if major_id in ELECTIVE_URLS:
        print(f"    scraping elective page...")
        elective_data = scrape_elective_page(ELECTIVE_URLS[major_id])
        if elective_data.get("upper") and not any(c["id"] == "UD_ELECTIVE" for c in categories):
            categories.append({
                "id": "UD_ELECTIVE",
                "name": "Upper Division Electives",
                "type": "pick_n",
                "n": 3,
                "courses": elective_data["upper"],
                "description": "Choose 3 upper-division elective courses.",
            })

    # Collect all codes
    all_codes = []
    for cat in categories:
        for c in cat.get("courses", []):
            all_codes.append(c)
        for g in cat.get("groups", []):
            for c in g.get("courses", []):
                all_codes.append(c)
    all_codes = _dedup(all_codes)

    if len(categories) < 3:
        return None

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
        "uncategorizedCodes": [],
        "_raw_text": "",
        "_flags": [],
    }


# ---------------------------------------------------------------------------
# Category extractors  (LEGACY — text-based fallback)
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
    """Parse one major's curriculum chart PDF into a structured dict.

    Tries spatial (rectangle-based) extraction first. Falls back to
    legacy text-based extraction if spatial produces too few categories.
    """
    # Try spatial extraction for all majors with config (or verified)
    spatial_result = None
    if major_id in SPATIAL_VERIFIED_MAJORS or major_id in MAJOR_CONFIG:
        spatial_result = parse_major_pdf_spatial(major_id, name, pdf_url, pdf_path)
    if spatial_result and len(spatial_result["categories"]) >= 3:
        spatial_result["_flags"].append("method: spatial")
        return spatial_result

    # Fallback: legacy text-based extraction
    return _parse_major_pdf_text(major_id, name, pdf_url, pdf_path)


def _parse_major_pdf_text(
    major_id: str, name: str, pdf_url: str, pdf_path: Path
) -> Dict:
    """Legacy text-based extraction (fallback when spatial doesn't work)."""
    flags: List[str] = ["method: text_fallback"]
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
