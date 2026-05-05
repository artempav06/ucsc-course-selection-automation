#!/usr/bin/env python3
"""
fetch_ucsc_courses.py
=====================

Scrapes the official UCSC General Catalog and converts course listings into
structured JSON for use by the UCSC Course Selection Automation website.

HOW THE CATALOG IS STRUCTURED
-----------------------------
Each subject page (e.g. catalog.ucsc.edu/.../courses/am-applied-mathematics)
lists every course under that prefix. Every course is wrapped in a block of
predictable HTML like:

    <h2 class="course-name">
        <a href=".../lower-division/am-10"><span>AM 10</span> Linear Algebra ...</a>
    </h2>
    <div class="desc">...description...</div>
    <div class="sc-credithours"><h3>Credits</h3><div class="credits">5</div></div>
    <div class="extraFields"><h4>Requirements</h4><p>Prerequisite(s): ...</p></div>
    <div class="genEd"><h4>General Education Code</h4><p>MF</p></div>

We parse those fields and output one record per course.

USAGE
-----
Make sure you have BeautifulSoup installed:
    python3 -m pip install beautifulsoup4 requests

Then run:
    python3 fetch_ucsc_courses.py                # fetches every configured subject
    python3 fetch_ucsc_courses.py am anth        # fetches specific subjects by code
    python3 fetch_ucsc_courses.py --all          # fetches every subject in SUBJECTS
    python3 fetch_ucsc_courses.py --list         # lists configured subjects

The script writes:
    scripts/output/courses_raw.json          -- one flat JSON array of all courses
    scripts/output/courses_by_subject.json   -- grouped by subject for inspection
    scripts/output/courses.data.js           -- a JS file you can paste into data.js

Rate limiting: 1 second between subject fetches, so the UCSC servers stay happy.
"""

import json
import re
import sys
import time
from pathlib import Path
from typing import List, Dict, Optional
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: BeautifulSoup is not installed.")
    print("Install it with: python3 -m pip install beautifulsoup4")
    sys.exit(1)


# ------------------------------------------------------------
# CONFIG: the list of subjects to fetch.
# Add more as you expand coverage. Each entry is (code, slug).
# ------------------------------------------------------------

SUBJECTS = [
    # --- Original 12 (AM through BME) ---
    ("AM",   "am-applied-mathematics"),
    ("ANCS", "ancs-ancient-studies"),
    ("ANTH", "anth-anthropology"),
    ("APLX", "aplx-applied-linguistics"),
    ("ARBC", "arbc-arabic"),
    ("ART",  "art-art"),
    ("ARTG", "artg-art-and-design-games-and-playable-media"),
    ("ASTR", "astr-astronomy-and-astrophysics"),
    ("BIOC", "bioc-biochemistry-and-molecular-biology"),
    ("BIOE", "bioe-biology-ecology-and-evolutionary"),
    ("BIOL", "biol-biology-molecular-cell-and-developmental"),
    ("BME",  "bme-biomolecular-engineering"),

    # --- Already-used by our CS BA schedule (good to refresh) ---
    ("CSE",  "cse-computer-science-and-engineering"),
    ("MATH", "math-mathematics"),
    ("WRIT", "writ-writing"),                      # catalog slug is "writ-writing"

    # --- Expansion batch: 10 additional subjects covering majors beyond CS ---
    # Needed by BMEB / BIOTECH / EE / CE / TIM majors and by our GE/UC catalog.
    ("CHEM", "chem-chemistry-and-biochemistry"),   # CHEM 1A etc. — GE SI, Biotech core
    ("PHYS", "phys-physics"),                      # PHYS 5A/B/C — EE/CE/BMEB core
    ("ECON", "econ-economics"),                    # TIM-adjacent
    ("LING", "ling-linguistics"),                  # LING 112 — CS elective
    ("PHIL", "phil-philosophy"),                   # PHIL 9 — GE TA
    ("POLI", "poli-politics"),                     # POLI 20 — UC AI
    ("PSYC", "psyc-psychology"),                   # PSYC 1 — GE PE-H
    ("SOCY", "socy-sociology"),                    # SOCY 1, SOCY 15 — GE CC / PE
    ("HIS",  "his-history"),                       # HIS 10B, HIS 80A — UC AH/AI
    ("LIT",  "lit-literature"),                    # LIT 1 — GE TA

    # --- Engineering & applied-science subjects required by our 10 majors ---
    # Without these, auto-parsed majors like EE_BS / CE_BS / BMEB / CSGD
    # reference course codes (ECE 13, STAT 131, CMPM 80K, etc.) that are
    # absent from COURSES{}, so the planner silently skips them.
    ("ECE",  "ece-electrical-and-computer-engineering"),  # EE/CE/BMEB core (ECE 13, ECE 101, ...)
    ("STAT", "stat-statistics"),                          # STAT 131 — referenced by many majors
    ("TIM",  "tim-technology-information-management"),    # TIM-adjacent upper-div
    ("CMPM", "cmpm-computational-media"),                 # CSGD (Games) core
    ("METX", "metx-microbiology-and-environmental-toxicology"),  # BIOTECH elective pool

    # --- Graduate-only subjects (confirmed 200+ level, skip for undergrad planner) ---
    # ("GAME", "game-games-and-playable-media"),
    # ("MSE",  "mse-materials-science-and-engineering"),
    # ("NLP",  "nlp-natural-language-processing"),
    # ("HCI",  "hci-human-computer-interaction"),

    # --- Still commented — add to grow coverage further ---
    # ("MUSC", "musc-music"),
    # ("THEA", "thea-theater-arts"),
    # ("FILM", "film-film-and-digital-media"),
    # ("HAVC", "havc-history-of-art-and-visual-culture"),
    # ("EART", "eart-earth-sciences"),
]

BASE_URL = "https://catalog.ucsc.edu/en/current/general-catalog/courses"
REQUEST_TIMEOUT = 30
RATE_LIMIT_SECONDS = 1.0
USER_AGENT = "UCSC-Schedule-Planner-Research-Bot/1.0 (local use only)"

# Valid UCSC GE codes — used to normalize the text we find
GE_CODES = {
    "MF", "SI", "SR", "TA", "CC", "ER", "IM",
    "PE-E", "PE-H", "PE-T", "PR-E", "PR-C", "PR-S", "C"
}


# ------------------------------------------------------------
# HELPERS
# ------------------------------------------------------------

def fetch_html(url):
    # type: (str) -> str
    """Fetch a URL with a polite User-Agent. Returns the body as a string."""
    req = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} fetching {url}") from e
    except URLError as e:
        raise RuntimeError(f"Network error fetching {url}: {e.reason}") from e


def normalize_text(text):
    # type: (str) -> str
    """Collapse whitespace and strip surrounding space."""
    return re.sub(r"\s+", " ", text or "").strip()


def classify_division(url_slug, course_num):
    # type: (str, str) -> str
    """
    Determine if a course is lower or upper division.
    Prefer the URL segment (lower-division / upper-division / graduate),
    fall back to the numeric course number (0-99 = lower, 100+ = upper).
    """
    if "lower-division" in url_slug:
        return "lower"
    if "upper-division" in url_slug:
        return "upper"
    if "graduate" in url_slug:
        return "graduate"

    # Fallback: extract digits from course number
    m = re.search(r"(\d+)", course_num)
    if m:
        n = int(m.group(1))
        if n < 100:
            return "lower"
        if n < 200:
            return "upper"
        return "graduate"
    return "lower"


def extract_course_code(anchor):
    # type: (object) -> str
    """Pull the code (e.g. 'AM 10') from the <span> inside the course-name anchor."""
    span = anchor.find("span")
    if span:
        return normalize_text(span.get_text())
    # Fallback: first 1-3 words of the link text
    parts = normalize_text(anchor.get_text()).split()
    return " ".join(parts[:2]) if parts else ""


def extract_course_title(anchor):
    # type: (object) -> str
    """Everything after the <span> is the course title."""
    full = normalize_text(anchor.get_text())
    span = anchor.find("span")
    if span:
        code = normalize_text(span.get_text())
        if full.startswith(code):
            return full[len(code):].strip()
    return full


def parse_credits(text):
    # type: (str) -> int
    """
    Extract a numeric credit value from a string like '5' or '5 credits' or '2-5'.
    Returns the first integer encountered; defaults to 5 (most common at UCSC).
    """
    if not text:
        return 5
    m = re.search(r"(\d+)", text)
    return int(m.group(1)) if m else 5


def extract_ge_code(text):
    # type: (str) -> Optional[str]
    """
    Normalize the raw GE field text to one of the known GE codes.
    UCSC GE codes: MF, SI, SR, TA, CC, ER, IM, PE-E/H/T, PR-E/C/S, C.
    """
    if not text:
        return None
    candidate = normalize_text(text).upper().rstrip(".")
    # Direct match
    if candidate in GE_CODES:
        return candidate
    # Try splitting on whitespace and finding a known code
    for token in candidate.replace(",", " ").split():
        token = token.strip(".")
        if token in GE_CODES:
            return token
    # Some pages write "PE-H" as "PEH" or similar. Try a loose normalization.
    compact = candidate.replace("-", "")
    for code in GE_CODES:
        if code.replace("-", "") == compact:
            return code
    return None


# ---------- PREREQ PARSING (the tricky part) ----------

COURSE_CODE_RE = re.compile(
    r"""
    \b                          # word boundary
    ([A-Z]{2,5})                # department prefix (2-5 capital letters)
    \s*                         # optional space
    (\d{1,3}[A-Z]?(?:/[A-Z])?)  # number with optional letter suffix
    \b
    """,
    re.VERBOSE,
)


def extract_course_codes_from_text(text):
    # type: (str) -> List[str]
    """
    Find all course codes in a chunk of text. Returns them in order, de-duplicated
    while preserving first-seen order.
    """
    seen = set()
    out = []
    for match in COURSE_CODE_RE.finditer(text):
        prefix, num = match.groups()
        # Skip false positives like "MPE" (placement exam) by requiring a number.
        if not num:
            continue
        # Skip "MPE" scores which look like "MPE 200" in some prereq text
        if prefix == "MPE":
            continue
        code = f"{prefix} {num}"
        if code not in seen:
            seen.add(code)
            out.append(code)
    return out


def parse_prereqs(prereq_paragraph):
    # type: (object) -> List[List[str]]
    """
    Convert the prerequisite <p> element into our [[OR group], [OR group]] format.

    Strategy:
      1. Extract the raw text starting at 'Prerequisite(s):'.
      2. Collect ALL course codes present (for safety fallback).
      3. Try to split the text into AND-groups using ';' and ' and ' separators.
      4. Within each AND-group, extract course codes and treat them as an OR-group.
      5. If an AND-group has no codes (e.g. 'permission of instructor'), skip it.
      6. Return the list of non-empty OR-groups.
    """
    if prereq_paragraph is None:
        return []

    # Prefer using anchor tags directly — they give us guaranteed-clean course codes.
    # But we still need the text structure to figure out AND/OR grouping.
    raw = prereq_paragraph.get_text(" ", strip=True)
    # Find the prereq section
    marker_match = re.search(r"Prerequisite\(s\):", raw, re.IGNORECASE)
    if not marker_match:
        # Sometimes there's no explicit marker; try the whole text.
        prereq_text = raw
    else:
        prereq_text = raw[marker_match.end():].strip()

    # Truncate at common trailing sentences that aren't prereqs
    # (e.g. "Enrollment is restricted to..." which isn't a course requirement)
    cut_markers = [
        "Enrollment is restricted",
        "Enrollment restricted",
        "Concurrent enrollment",
        "Students are expected",
        "This course is restricted",
    ]
    for marker in cut_markers:
        idx = prereq_text.find(marker)
        if idx > 0:
            prereq_text = prereq_text[:idx]

    # Split into AND-groups. UCSC uses ';' most reliably, and ' and ' sometimes.
    # Order matters: split on ';' first, then split each piece on ' and '.
    and_groups_raw = re.split(r";", prereq_text)
    and_groups = []  # type: List[str]
    for g in and_groups_raw:
        # Further split on ' and ' (but not inside parentheses, best-effort)
        pieces = re.split(r"\band\b", g)
        and_groups.extend(pieces)

    result = []  # type: List[List[str]]
    for group_text in and_groups:
        codes = extract_course_codes_from_text(group_text)
        if codes:
            result.append(codes)

    return result


# ---------- MAIN PARSER ----------

def parse_subject_page(subject_code, html):
    # type: (str, str) -> List[Dict]
    """
    Given the HTML of a subject page, extract a list of course records.
    Each record has:
        code, title, units, division, prereqs, ge, quarters, desc, catalogUrl
    """
    soup = BeautifulSoup(html, "html.parser")
    courses = []  # type: List[Dict]

    # Each course starts at an <h2 class="course-name">
    for h2 in soup.find_all("h2", class_="course-name"):
        anchor = h2.find("a")
        if not anchor:
            continue

        code = extract_course_code(anchor)
        title = extract_course_title(anchor)
        course_url = anchor.get("href", "")
        if course_url.startswith("/"):
            course_url = "https://catalog.ucsc.edu" + course_url

        # Extract course number for division fallback
        num_match = re.search(r"\d+[A-Z]?", code)
        course_num = num_match.group(0) if num_match else ""
        division = classify_division(course_url, course_num)

        # Walk forward through siblings until the next h2.course-name
        desc_text = ""
        credits = 5
        prereqs = []  # type: List[List[str]]
        ge_code = None

        sibling = h2.find_next_sibling()
        while sibling and not (
            sibling.name == "h2" and "course-name" in (sibling.get("class") or [])
        ):
            classes = sibling.get("class") or []

            # Description (first non-empty .desc)
            if "desc" in classes and not desc_text:
                text = normalize_text(sibling.get_text(" ", strip=True))
                if text:
                    desc_text = text

            # Credits
            elif "sc-credithours" in classes:
                credit_div = sibling.find(class_="credits")
                if credit_div:
                    credits = parse_credits(credit_div.get_text())

            # Prereqs (inside div.extraFields > p)
            elif "extraFields" in classes:
                p = sibling.find("p")
                if p:
                    prereqs = parse_prereqs(p)

            # GE code
            elif "genEd" in classes:
                p = sibling.find("p")
                if p:
                    ge_code = extract_ge_code(p.get_text())

            sibling = sibling.find_next_sibling()

        # Skip graduate courses unless explicitly wanted
        if division == "graduate":
            continue

        # Quarter data isn't in the catalog subject page.
        # Default to ["F","W","S"] with a flag so the user knows to verify.
        record = {
            "code": code,
            "title": title,
            "units": credits,
            "division": division,
            "prereqs": prereqs,
            "ge": ge_code,
            "quarters": ["F", "W", "S"],
            "desc": desc_text,
            "catalogUrl": course_url,
            "_flags": {
                "quarters_defaulted": True,
                "source_subject": subject_code,
            },
        }
        courses.append(record)

    return courses


# ------------------------------------------------------------
# MAIN
# ------------------------------------------------------------

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    flags = [a for a in sys.argv[1:] if a.startswith("-")]

    if "--list" in flags:
        print("Configured subjects:")
        for code, slug in SUBJECTS:
            print(f"  {code:6} -> {slug}")
        return

    if args:
        wanted = {a.upper() for a in args}
        subjects = [(c, s) for c, s in SUBJECTS if c in wanted]
        if not subjects:
            print(f"No matching subjects. Available: {[c for c, _ in SUBJECTS]}")
            return
    else:
        subjects = SUBJECTS

    out_dir = Path(__file__).parent / "output"
    out_dir.mkdir(exist_ok=True)

    all_courses = []  # type: List[Dict]
    by_subject = {}   # type: Dict[str, List[Dict]]

    for i, (code, slug) in enumerate(subjects):
        url = f"{BASE_URL}/{slug}"
        print(f"[{i + 1}/{len(subjects)}] Fetching {code} -> {url}")
        try:
            html = fetch_html(url)
        except Exception as e:
            print(f"  FAILED: {e}")
            continue

        courses = parse_subject_page(code, html)
        print(f"  parsed {len(courses)} courses")
        all_courses.extend(courses)
        by_subject[code] = courses

        # Be nice to UCSC's servers
        if i < len(subjects) - 1:
            time.sleep(RATE_LIMIT_SECONDS)

    # Write outputs
    raw_path = out_dir / "courses_raw.json"
    grouped_path = out_dir / "courses_by_subject.json"
    js_path = out_dir / "courses.data.js"

    raw_path.write_text(json.dumps(all_courses, indent=2, ensure_ascii=False))
    grouped_path.write_text(json.dumps(by_subject, indent=2, ensure_ascii=False))

    # Emit a JS snippet you can paste into data.js
    js_lines = [
        "// Auto-generated by scripts/fetch_ucsc_courses.py",
        "// DO NOT EDIT BY HAND — re-run the script to refresh.",
        "// Each entry matches the COURSES object format in js/data.js.",
        "",
        "const UCSC_CATALOG_COURSES = {",
    ]
    for course in all_courses:
        code = course["code"]
        title = course["title"].replace('"', '\\"')
        desc = course["desc"].replace('"', '\\"')
        prereqs = json.dumps(course["prereqs"])
        quarters = json.dumps(course["quarters"])
        ge = f'"{course["ge"]}"' if course["ge"] else "null"
        js_lines.append(f'  "{code}": {{')
        js_lines.append(f'    title: "{title}",')
        js_lines.append(f'    units: {course["units"]}, division: "{course["division"]}",')
        js_lines.append(f'    prereqs: {prereqs},')
        js_lines.append(f'    ge: {ge}, quarters: {quarters},')
        js_lines.append(f'    desc: "{desc}",')
        js_lines.append(f'    section: ["FREE"], rmpScore: 0')
        js_lines.append(f'  }},')
    js_lines.append("};")
    js_path.write_text("\n".join(js_lines))

    # Summary
    print()
    print("=" * 60)
    print("DONE")
    print(f"Total courses parsed: {len(all_courses)}")
    print(f"Subjects covered:     {len(by_subject)}")
    print()
    print("Output files:")
    print(f"  {raw_path}")
    print(f"  {grouped_path}")
    print(f"  {js_path}")
    print()
    print("Sanity check — top 5 courses:")
    for c in all_courses[:5]:
        prereq_summary = " AND ".join(
            "(" + " OR ".join(g) + ")" for g in c["prereqs"]
        ) or "none"
        print(f"  {c['code']:10} {c['title'][:50]:50} | {c['units']}u | GE={c['ge']} | prereqs: {prereq_summary}")


if __name__ == "__main__":
    main()
