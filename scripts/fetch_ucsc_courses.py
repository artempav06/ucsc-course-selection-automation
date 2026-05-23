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

    # --- GE/UC requirement departments ---
    ("FILM", "film-film-and-digital-media"),
    ("FMST", "fmst-feminist-studies"),
    ("MUSC", "musc-music"),
    ("THEA", "thea-theater-arts"),
    ("HAVC", "havc-history-of-art-and-visual-culture"),
    ("CRES", "cres-critical-race-and-ethnic-studies"),
    ("ENVS", "envs-environmental-studies"),
    ("LALS", "lals-latin-american-and-latino-studies"),
    ("ESCI", "esci-environmental-sciences"),

    # --- Group B expansion (A-H alphabetical, first half of remaining) ---
    ("CHIN", "chin-chinese"),
    ("CLNI", "clni-college-nine"),
    ("CLST", "clst-classical-studies"),
    ("CMMU", "cmmu-community-studies"),
    ("COWL", "cowl-cowell-college"),
    ("CRSN", "crsn-carson-college"),
    ("CRWN", "crwn-crown-college"),
    ("CSP",  "csp-coastal-science-and-policy"),
    ("CT",   "ct-creative-technologies"),
    ("DANM", "danm-digital-arts-and-new-media"),
    ("EART", "eart-earth-sciences"),
    ("EDUC", "educ-education"),
    ("FIL",  "fil-filipino"),
    ("FREN", "fren-french"),
    ("GAME", "game-games-and-playable-media"),
    ("GCH",  "gch-global-community-health"),
    ("GIST", "gist-geographic-info-systems-science-and-technologies"),
    ("GRAD", "grad-graduate"),
    ("GREE", "gree-greek"),
    ("HCI",  "hci-human-computer-interaction"),
    ("HEBR", "hebr-hebrew"),
    ("HISC", "hisc-history-of-consciousness"),
    ("HUMN", "humn-humanities"),

    # --- Group C (remaining I-Z departments for 100% catalog coverage) ---
    ("ITAL", "ital-italian"),
    ("JAPN", "japn-japanese"),
    ("JRLC", "jrlc-john-r-lewis-college"),
    ("JWST", "jwst-jewish-studies"),
    ("KRSG", "krsg-kresge-college"),
    ("LAAD", "laad-languages"),
    ("LATN", "latn-latin"),
    ("LGST", "lgst-legal-studies"),
    ("MERR", "merr-merrill-college"),
    ("MSE",  "mse-materials-science-and-engineering"),
    ("NLP",  "nlp-natural-language-processing"),
    ("OAKS", "oaks-oakes-college"),
    ("OCEA", "ocea-ocean-sciences"),
    ("PBS",  "pbs-physical-biological-sciences"),
    ("PHYE", "phye-physical-education"),
    ("PRTR", "prtr-porter-college"),
    ("PUNJ", "punj-punjabi"),
    ("SCIC", "scic-science-communication"),
    ("SOCD", "socd-social-documentation"),
    ("SPAN", "span-spanish"),
    ("SPHS", "sphs-spanish-for-heritage-speakers"),
    ("STEV", "stev-stevenson-college"),
    ("UCDC", "ucdc-ucdc"),
    ("VAST", "vast-visualizing-abolition-studies"),
    ("YIDD", "yidd-yiddish"),
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
    Returns the first matched code for backward compatibility.
    """
    codes = extract_ge_codes(text)
    return codes[0] if codes else None


def extract_ge_codes(text):
    # type: (str) -> List[str]
    """
    Extract ALL GE codes from text. Returns list of matched codes.
    UCSC GE codes: MF, SI, SR, TA, CC, ER, IM, PE-E/H/T, PR-E/C/S, C.
    """
    if not text:
        return []
    candidate = normalize_text(text).upper().rstrip(".")
    # Direct single match
    if candidate in GE_CODES:
        return [candidate]
    # Split on whitespace/commas and collect all matching codes
    found = []
    for token in candidate.replace(",", " ").split():
        token = token.strip(".")
        if token in GE_CODES:
            if token not in found:
                found.append(token)
            continue
        # Loose normalization: PEH -> PE-H
        compact = token.replace("-", "")
        for code in GE_CODES:
            if code.replace("-", "") == compact and code not in found:
                found.append(code)
    return found


def parse_quarters(text):
    # type: (str) -> List[str]
    """Parse quarter availability text like 'Fall, Winter, Spring' -> ['F','W','S']."""
    if not text:
        return []
    mapping = {"fall": "F", "winter": "W", "spring": "S", "summer": "SU"}
    result = []
    for word in text.lower().replace(",", " ").split():
        if word in mapping and mapping[word] not in result:
            result.append(mapping[word])
    return result


def parse_credits_full(text):
    # type: (str) -> tuple
    """
    Parse credit text, returning (units, max_units).
    For '5' -> (5, None). For '2-5' -> (2, 5).
    """
    if not text:
        return 5, None
    # Check for range like "2-5" or "1 - 5"
    range_match = re.search(r"(\d+)\s*[-–]\s*(\d+)", text)
    if range_match:
        lo = int(range_match.group(1))
        hi = int(range_match.group(2))
        return lo, hi
    m = re.search(r"(\d+)", text)
    return (int(m.group(1)) if m else 5), None


def extract_corequisite(text):
    # type: (str) -> Optional[str]
    """Extract lab corequisite from prereq text."""
    m = re.search(
        r"[Cc]oncurrent enrollment in\s+([A-Z]{2,5}\s+\d{1,3}[A-Z]?)", text
    )
    return m.group(1) if m else None


def extract_enrollment_restriction(text):
    # type: (str) -> Optional[str]
    """Extract enrollment restriction from prereq text."""
    markers = [
        "Enrollment is restricted",
        "Enrollment restricted",
        "This course is restricted",
    ]
    for marker in markers:
        idx = text.find(marker)
        if idx >= 0:
            sentence = text[idx:]
            period_idx = sentence.find(".")
            return sentence[:period_idx + 1].strip() if period_idx > 0 else sentence.strip()
    return None


def extract_cross_listed(text):
    # type: (str) -> List[str]
    """Extract cross-listed courses from description or requirement text."""
    patterns = [
        r"[Ss]ame as\s+([A-Z]{2,5}\s+\d{1,3}[A-Z]?)",
        r"[Cc]ross[- ]listed with\s+([A-Z]{2,5}\s+\d{1,3}[A-Z]?)",
        r"[Aa]lso (?:offered|listed) as\s+([A-Z]{2,5}\s+\d{1,3}[A-Z]?)",
    ]
    results = []
    for pat in patterns:
        for m in re.finditer(pat, text):
            code = m.group(1)
            if code not in results:
                results.append(code)
    return results


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


def parse_prereqs_from_text(prereq_text):
    # type: (str) -> List[List[str]]
    """
    Parse prerequisite text into our [[OR group], [OR group]] format.

    Strategy:
      0. If text contains "; or", it's an OR-of-AND expression (e.g.
         "A and B; or C and D; or E"). Convert to AND-of-OR approximation.
      1. Split on ';' (optionally followed by 'and') to get AND-groups.
      2. Within each group, if it has BOTH 'and' and 'or' connectors,
         treat all codes as a single OR-group (cross-product expression).
      3. If it has only 'and' connectors, split into separate AND-groups.
      4. If it has only 'or' or no connectors, treat as one OR-group.
    """
    # Step 0: detect "; or" pattern — OR-of-AND expression
    if re.search(r";\s*or\b", prereq_text, re.IGNORECASE):
        return _parse_or_of_and(prereq_text)

    # Split on semicolons (optionally followed by "and")
    and_groups_raw = re.split(r";\s*(?:and\s+)?", prereq_text)

    result = []  # type: List[List[str]]
    for group_text in and_groups_raw:
        or_count = len(re.findall(r"\bor\b", group_text, re.IGNORECASE))
        and_count = len(re.findall(r"\band\b", group_text, re.IGNORECASE))

        if and_count > 0 and or_count > 0:
            # Mixed and/or: cross-product expression — all codes are alternatives
            codes = extract_course_codes_from_text(group_text)
            if codes:
                result.append(codes)
        elif and_count > 0 and or_count == 0:
            # Pure "and" — split into separate AND-groups
            pieces = re.split(r"\band\b", group_text, flags=re.IGNORECASE)
            for piece in pieces:
                codes = extract_course_codes_from_text(piece)
                if codes:
                    result.append(codes)
        else:
            # All codes in one OR-group
            codes = extract_course_codes_from_text(group_text)
            if codes:
                result.append(codes)

    return result


def _parse_or_of_and(prereq_text):
    # type: (str) -> List[List[str]]
    """Handle "A and B; or C and D; or E" → AND-of-OR approximation.

    Splits on "; or" to get alternatives, parses each for AND-pairs,
    then transposes into OR-groups by position. Single-course alternatives
    (like "CSE 101" alone) satisfy all positions.
    """
    alternatives_raw = re.split(r";\s*or\s+", prereq_text, flags=re.IGNORECASE)
    alternatives = []  # type: List[List[str]]
    for alt_text in alternatives_raw:
        alt_text = alt_text.strip()
        if not alt_text:
            continue
        and_count = len(re.findall(r"\band\b", alt_text, re.IGNORECASE))
        if and_count > 0:
            pieces = re.split(r"\band\b", alt_text, flags=re.IGNORECASE)
            codes = []
            for p in pieces:
                c = extract_course_codes_from_text(p)
                if c:
                    codes.append(c[0])
            if codes:
                alternatives.append(codes)
        else:
            codes = extract_course_codes_from_text(alt_text)
            if codes:
                alternatives.append([codes[0]])

    if not alternatives:
        return []

    max_len = max(len(a) for a in alternatives)
    singles = [a[0] for a in alternatives if len(a) == 1]

    result = []
    for pos in range(max_len):
        or_group = []
        seen = set()
        for alt in alternatives:
            if pos < len(alt):
                code = alt[pos]
                if code not in seen:
                    seen.add(code)
                    or_group.append(code)
            elif len(alt) == 1:
                pass  # handled below
        for s in singles:
            if s not in seen:
                seen.add(s)
                or_group.append(s)
        if or_group:
            result.append(or_group)

    return result


def parse_prereqs(prereq_paragraph):
    # type: (object) -> List[List[str]]
    """
    Convert the prerequisite <p> element into our [[OR group], [OR group]] format.
    Also returns extracted corequisite and enrollment restriction as side data
    via the _last_parse_extras module-level dict.
    """
    global _last_parse_extras
    _last_parse_extras = {"labCoreq": None, "enrollmentRestrictions": None}

    if prereq_paragraph is None:
        return []

    raw = prereq_paragraph.get_text(" ", strip=True)
    marker_match = re.search(r"Prerequisite\(s\):", raw, re.IGNORECASE)
    if not marker_match:
        prereq_text = raw
    else:
        prereq_text = raw[marker_match.end():].strip()

    # Extract corequisite and enrollment restriction BEFORE truncation
    _last_parse_extras["labCoreq"] = extract_corequisite(prereq_text)
    _last_parse_extras["enrollmentRestrictions"] = extract_enrollment_restriction(prereq_text)

    # Truncate at non-prereq sentences (case-insensitive)
    cut_markers = [
        "enrollment is restricted",
        "enrollment restricted",
        "concurrent enrollment",
        "previous or concurrent",
        "students are expected",
        "this course is restricted",
        "students cannot",
        "students may not",
        "students who have completed",
        "credit is not given",
        "not open to",
    ]
    lower_text = prereq_text.lower()
    for marker in cut_markers:
        idx = lower_text.find(marker)
        if idx > 0:
            prereq_text = prereq_text[:idx]
            lower_text = lower_text[:idx]

    return parse_prereqs_from_text(prereq_text)


_last_parse_extras = {"labCoreq": None, "enrollmentRestrictions": None}


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
        credits_text = ""
        credits = 5
        max_units = None
        prereqs = []  # type: List[List[str]]
        ge_code = None
        ge_all = []   # type: List[str]
        quarters_raw = []  # type: List[str]
        quarters_found = False
        repeatable = False
        lab_coreq = None
        enrollment_restrictions = None

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
                    credits_text = credit_div.get_text()
                    credits, max_units = parse_credits_full(credits_text)

            # extraFields — can be Requirements or Repeatable
            elif "extraFields" in classes:
                label_el = sibling.find(["h3", "h4"])
                label = label_el.get_text(strip=True).lower() if label_el else ""
                if "repeatable" in label:
                    p = sibling.find("p")
                    if p and "yes" in p.get_text().lower():
                        repeatable = True
                else:
                    p = sibling.find("p")
                    if p:
                        prereqs = parse_prereqs(p)
                        lab_coreq = _last_parse_extras.get("labCoreq")
                        enrollment_restrictions = _last_parse_extras.get("enrollmentRestrictions")

            # GE code
            elif "genEd" in classes:
                p = sibling.find("p")
                if p:
                    ge_text = p.get_text()
                    ge_all = extract_ge_codes(ge_text)
                    ge_code = ge_all[0] if ge_all else None

            # Quarter offered
            elif "quarter" in classes:
                p = sibling.find("p")
                if not p:
                    text = sibling.get_text(" ", strip=True)
                    label_el = sibling.find(["h3", "h4"])
                    if label_el:
                        text = text[len(label_el.get_text(strip=True)):].strip()
                else:
                    text = p.get_text(strip=True)
                parsed_q = parse_quarters(text)
                if parsed_q:
                    quarters_raw = parsed_q
                    quarters_found = True

            sibling = sibling.find_next_sibling()

        # Skip graduate courses
        if division == "graduate":
            continue

        # Cross-listed: check description text
        cross_listed = extract_cross_listed(desc_text)

        # Determine final quarters
        final_quarters = quarters_raw if quarters_found else ["F", "W", "S", "SU"]

        record = {
            "code": code,
            "title": title,
            "units": credits,
            "division": division,
            "prereqs": prereqs,
            "ge": ge_code,
            "geAll": ge_all if len(ge_all) > 1 else [],
            "quarters": final_quarters,
            "desc": desc_text,
            "catalogUrl": course_url,
            "labCoreq": lab_coreq,
            "crossListed": cross_listed,
            "repeatable": repeatable,
            "maxUnits": max_units,
            "enrollmentRestrictions": enrollment_restrictions,
            "_flags": {
                "quarters_defaulted": not quarters_found,
                "source_subject": subject_code,
            },
        }
        courses.append(record)

    return courses


# ------------------------------------------------------------
# MAIN
# ------------------------------------------------------------

def main():
    argv = sys.argv[1:]

    # Parse --output and --rate-limit flags
    output_prefix = None
    rate_limit = RATE_LIMIT_SECONDS

    i = 0
    positional = []
    flag_set = set()
    while i < len(argv):
        if argv[i] == "--output" and i + 1 < len(argv):
            output_prefix = argv[i + 1]
            i += 2
        elif argv[i] == "--rate-limit" and i + 1 < len(argv):
            rate_limit = float(argv[i + 1])
            i += 2
        elif argv[i].startswith("-"):
            flag_set.add(argv[i])
            i += 1
        else:
            positional.append(argv[i])
            i += 1

    if "--list" in flag_set:
        print("Configured subjects:")
        for code, slug in SUBJECTS:
            print(f"  {code:6} -> {slug}")
        return

    if positional:
        wanted = {a.upper() for a in positional}
        subjects = [(c, s) for c, s in SUBJECTS if c in wanted]
        if not subjects:
            print(f"No matching subjects. Available: {[c for c, _ in SUBJECTS]}")
            return
    else:
        subjects = SUBJECTS

    # Deduplicate by code (keep first occurrence)
    seen_codes = set()
    deduped = []
    for c, s in subjects:
        if c not in seen_codes:
            seen_codes.add(c)
            deduped.append((c, s))
    subjects = deduped

    out_dir = Path(__file__).parent / "output"
    out_dir.mkdir(exist_ok=True)

    all_courses = []  # type: List[Dict]
    by_subject = {}   # type: Dict[str, List[Dict]]
    parse_warnings = []  # type: List[str]

    for i, (code, slug) in enumerate(subjects):
        url = f"{BASE_URL}/{slug}"
        print(f"[{i + 1}/{len(subjects)}] Fetching {code} -> {url}")
        try:
            html = fetch_html(url)
        except Exception as e:
            print(f"  FAILED: {e}")
            parse_warnings.append(f"FETCH FAILED: {code} — {e}")
            continue

        courses = parse_subject_page(code, html)
        print(f"  parsed {len(courses)} courses")

        # Check for potential parse issues
        for c in courses:
            if c["_flags"]["quarters_defaulted"]:
                pass  # Expected for most departments
            if c.get("enrollmentRestrictions"):
                pass  # Informational, not a warning
            # Flag courses with empty prereq groups
            for grp in c["prereqs"]:
                if not grp:
                    parse_warnings.append(f"EMPTY PREREQ GROUP: {c['code']}")

        all_courses.extend(courses)
        by_subject[code] = courses

        if i < len(subjects) - 1:
            time.sleep(rate_limit)

    # Determine output file names
    if output_prefix:
        raw_path = out_dir / f"{output_prefix}_raw.json"
        grouped_path = out_dir / f"{output_prefix}_by_subject.json"
        js_path = out_dir / f"{output_prefix}.data.js"
        report_path = out_dir / f"{output_prefix}_report.txt"
    else:
        raw_path = out_dir / "courses_raw.json"
        grouped_path = out_dir / "courses_by_subject.json"
        js_path = out_dir / "courses.data.js"
        report_path = out_dir / "scrape_report.txt"

    raw_path.write_text(json.dumps(all_courses, indent=2, ensure_ascii=False))
    grouped_path.write_text(json.dumps(by_subject, indent=2, ensure_ascii=False))

    # Emit a JS snippet
    js_lines = [
        "// Auto-generated by scripts/fetch_ucsc_courses.py",
        "// DO NOT EDIT BY HAND — re-run the script to refresh.",
        "",
        "const UCSC_CATALOG_COURSES = {",
    ]
    for course in all_courses:
        c_code = course["code"]
        title = course["title"].replace('"', '\\"')
        desc = course["desc"].replace('"', '\\"')
        prereqs = json.dumps(course["prereqs"])
        quarters = json.dumps(course["quarters"])
        ge = f'"{course["ge"]}"' if course["ge"] else "null"
        js_lines.append(f'  "{c_code}": {{')
        js_lines.append(f'    title: "{title}",')
        js_lines.append(f'    units: {course["units"]}, division: "{course["division"]}",')
        js_lines.append(f'    prereqs: {prereqs},')
        js_lines.append(f'    ge: {ge}, quarters: {quarters},')
        js_lines.append(f'    desc: "{desc}",')
        js_lines.append(f'    section: ["FREE"], rmpScore: 0')
        js_lines.append(f'  }},')
    js_lines.append("};")
    js_path.write_text("\n".join(js_lines))

    # Write report
    quarters_real = sum(1 for c in all_courses if not c["_flags"]["quarters_defaulted"])
    quarters_defaulted = sum(1 for c in all_courses if c["_flags"]["quarters_defaulted"])
    with_coreq = sum(1 for c in all_courses if c.get("labCoreq"))
    with_restrict = sum(1 for c in all_courses if c.get("enrollmentRestrictions"))
    with_repeat = sum(1 for c in all_courses if c.get("repeatable"))
    with_crosslist = sum(1 for c in all_courses if c.get("crossListed"))

    report_lines = [
        f"Scrape Report — {output_prefix or 'full'}",
        f"Subjects: {len(by_subject)}",
        f"Total courses: {len(all_courses)}",
        f"Quarters real: {quarters_real}",
        f"Quarters defaulted: {quarters_defaulted}",
        f"With labCoreq: {with_coreq}",
        f"With enrollmentRestrictions: {with_restrict}",
        f"With repeatable: {with_repeat}",
        f"With crossListed: {with_crosslist}",
        "",
        "Warnings:",
    ]
    report_lines.extend(parse_warnings if parse_warnings else ["  (none)"])
    report_path.write_text("\n".join(report_lines))

    # Summary
    print()
    print("=" * 60)
    print("DONE")
    print(f"Total courses parsed: {len(all_courses)}")
    print(f"Subjects covered:     {len(by_subject)}")
    print(f"Quarters real/defaulted: {quarters_real}/{quarters_defaulted}")
    print(f"Lab coreqs: {with_coreq}, Restrictions: {with_restrict}, Repeatable: {with_repeat}")
    print()
    print("Output files:")
    print(f"  {raw_path}")
    print(f"  {grouped_path}")
    print(f"  {js_path}")
    print(f"  {report_path}")
    print()
    print("Sanity check — first 5 courses:")
    for c in all_courses[:5]:
        prereq_summary = " AND ".join(
            "(" + " OR ".join(g) + ")" for g in c["prereqs"]
        ) or "none"
        q_flag = "" if not c["_flags"]["quarters_defaulted"] else " [defaulted]"
        print(f"  {c['code']:10} {c['title'][:40]:40} | {c['units']}u | GE={c['ge']} | Q={c['quarters']}{q_flag}")


if __name__ == "__main__":
    main()
