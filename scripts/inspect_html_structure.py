#!/usr/bin/env python3
"""
inspect_html_structure.py
=========================
Fetches raw HTML from sample catalog pages and identifies the CSS classes
used for new fields (quarters, repeatable, cross-listed, etc.).
"""

import sys
from urllib.request import Request, urlopen
from bs4 import BeautifulSoup

USER_AGENT = "UCSC-Schedule-Planner-Research-Bot/1.0 (local use only)"
BASE = "https://catalog.ucsc.edu/en/current/general-catalog/courses"

PAGES = [
    ("LIT", f"{BASE}/lit-literature"),
    ("CSE", f"{BASE}/cse-computer-science-and-engineering"),
    ("PHYS", f"{BASE}/phys-physics"),
]


def fetch(url):
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def inspect_page(dept, url, max_courses=3):
    print(f"\n{'='*70}")
    print(f"DEPARTMENT: {dept} — {url}")
    print(f"{'='*70}")
    html = fetch(url)
    soup = BeautifulSoup(html, "html.parser")

    count = 0
    for h2 in soup.find_all("h2", class_="course-name"):
        if count >= max_courses:
            break
        anchor = h2.find("a")
        if not anchor:
            continue
        code = anchor.find("span")
        code_text = code.get_text(strip=True) if code else "???"
        print(f"\n--- {code_text} ---")

        sibling = h2.find_next_sibling()
        sib_idx = 0
        while sibling and sib_idx < 20:
            if sibling.name == "h2" and "course-name" in (sibling.get("class") or []):
                break
            tag = sibling.name
            classes = sibling.get("class") or []
            text = sibling.get_text(" ", strip=True)[:200]

            # Check for h3/h4 labels inside
            label_el = sibling.find(["h3", "h4"])
            label = label_el.get_text(strip=True) if label_el else ""

            print(f"  [{sib_idx}] <{tag} class={classes}>")
            if label:
                print(f"       label: {label}")
            print(f"       text: {text[:150]}")
            print()

            sibling = sibling.find_next_sibling()
            sib_idx += 1
        count += 1


if __name__ == "__main__":
    import time
    for i, (dept, url) in enumerate(PAGES):
        inspect_page(dept, url, max_courses=3)
        if i < len(PAGES) - 1:
            time.sleep(1)
