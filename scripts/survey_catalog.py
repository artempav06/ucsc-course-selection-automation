#!/usr/bin/env python3
"""
survey_catalog.py
=================
Fetches the UCSC catalog course index and enumerates all departments.
Outputs: scripts/all_departments.json, scripts/scrape_plan.md

Usage:
    python3 scripts/survey_catalog.py
"""

import json
import re
import sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: BeautifulSoup not installed. pip install beautifulsoup4")
    sys.exit(1)

HERE = Path(__file__).parent
CATALOG_URL = "https://catalog.ucsc.edu/en/current/general-catalog/courses"
USER_AGENT = "UCSC-Schedule-Planner-Research-Bot/1.0 (local use only)"

# Known code-to-slug mappings from the existing scraper
KNOWN_SLUGS = {
    "AM": "am-applied-mathematics",
    "ANCS": "ancs-ancient-studies",
    "ANTH": "anth-anthropology",
    "APLX": "aplx-applied-linguistics",
    "ARBC": "arbc-arabic",
    "ART": "art-art",
    "ARTG": "artg-art-and-design-games-and-playable-media",
    "ASTR": "astr-astronomy-and-astrophysics",
    "BIOC": "bioc-biochemistry-and-molecular-biology",
    "BIOE": "bioe-biology-ecology-and-evolutionary",
    "BIOL": "biol-biology-molecular-cell-and-developmental",
    "BME": "bme-biomolecular-engineering",
    "CHEM": "chem-chemistry-and-biochemistry",
    "CMPM": "cmpm-computational-media",
    "CSE": "cse-computer-science-and-engineering",
    "ECON": "econ-economics",
    "ECE": "ece-electrical-and-computer-engineering",
    "HIS": "his-history",
    "LING": "ling-linguistics",
    "LIT": "lit-literature",
    "MATH": "math-mathematics",
    "METX": "metx-microbiology-and-environmental-toxicology",
    "PHIL": "phil-philosophy",
    "PHYS": "phys-physics",
    "POLI": "poli-politics",
    "PSYC": "psyc-psychology",
    "SOCY": "socy-sociology",
    "STAT": "stat-statistics",
    "TIM": "tim-technology-information-management",
    "WRIT": "writ-writing",
    "FILM": "film-film-and-digital-media",
    "FMST": "fmst-feminist-studies",
}


def derive_code_from_slug(slug):
    """Derive department code from catalog URL slug."""
    # Check known mappings first
    for code, known_slug in KNOWN_SLUGS.items():
        if slug == known_slug:
            return code
    # Heuristic: take the first segment before the first hyphen, uppercase
    first_part = slug.split("-")[0].upper()
    return first_part


def fetch_departments():
    """Fetch and parse the catalog index page for all department links."""
    req = Request(CATALOG_URL, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(req, timeout=30) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError) as e:
        print(f"ERROR fetching catalog index: {e}")
        sys.exit(1)

    soup = BeautifulSoup(html, "html.parser")
    departments = []
    seen_slugs = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        m = re.match(
            r"/en/current/general-catalog/courses/([a-z0-9]+-[a-z0-9-]+)$", href
        )
        if not m:
            continue
        slug = m.group(1)
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)
        name = a.get_text(strip=True)
        code = derive_code_from_slug(slug)
        url = f"https://catalog.ucsc.edu{href}"
        departments.append({
            "code": code,
            "name": name,
            "slug": slug,
            "url": url,
        })

    return departments


def main():
    print("Fetching catalog index...")
    departments = fetch_departments()
    print(f"Found {len(departments)} departments")

    # Load priority departments
    priority_path = HERE / "priority_departments.json"
    if priority_path.exists():
        priority_depts = set(json.loads(priority_path.read_text()))
    else:
        print("WARNING: priority_departments.json not found, using empty set")
        priority_depts = set()

    # Classify into groups
    dept_codes = [d["code"] for d in departments]
    group_a = [d for d in departments if d["code"] in priority_depts]
    remaining = [d for d in departments if d["code"] not in priority_depts]
    remaining.sort(key=lambda d: d["code"])

    # Split remaining alphabetically: A-L = Group B, M-Z = Group C
    midpoint = len(remaining) // 2
    group_b = remaining[:midpoint]
    group_c = remaining[midpoint:]

    # Write all_departments.json
    out_path = HERE / "all_departments.json"
    out_path.write_text(json.dumps(departments, indent=2, ensure_ascii=False))
    print(f"Written: {out_path}")

    # Write scrape_plan.md
    plan_path = HERE / "scrape_plan.md"
    lines = [
        "# Scrape Plan — Department Split",
        "",
        f"Generated: 2026-05-08",
        f"Total departments on catalog: {len(departments)}",
        "",
        f"## Group A — Priority ({len(group_a)} departments)",
        "Departments directly referenced by our 12 supported majors.",
        "",
    ]
    for d in sorted(group_a, key=lambda x: x["code"]):
        lines.append(f"- **{d['code']}** — {d['name']} (`{d['slug']}`)")
    lines.extend([
        "",
        f"## Group B — This Pass ({len(group_b)} departments)",
        "First alphabetical half of remaining departments.",
        "",
    ])
    for d in group_b:
        lines.append(f"- **{d['code']}** — {d['name']} (`{d['slug']}`)")
    lines.extend([
        "",
        f"## Group C — Deferred ({len(group_c)} departments)",
        "Second pass. These departments are documented but not scraped yet.",
        "",
    ])
    for d in group_c:
        lines.append(f"- **{d['code']}** — {d['name']} (`{d['slug']}`)")
    lines.append("")

    plan_path.write_text("\n".join(lines))
    print(f"Written: {plan_path}")

    # Summary
    print(f"\nGroup A (priority): {len(group_a)} departments")
    print(f"  {', '.join(d['code'] for d in sorted(group_a, key=lambda x: x['code']))}")
    print(f"Group B (this pass): {len(group_b)} departments")
    print(f"  {', '.join(d['code'] for d in group_b)}")
    print(f"Group C (deferred): {len(group_c)} departments")
    print(f"  {', '.join(d['code'] for d in group_c)}")


if __name__ == "__main__":
    main()
