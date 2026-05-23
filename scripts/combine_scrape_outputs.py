#!/usr/bin/env python3
"""
combine_scrape_outputs.py
=========================
Combines multiple scrape_*_raw.json files from parallel agents into a single
courses_raw.json. Deduplicates by course code (first occurrence wins).

Usage:
    python3 scripts/combine_scrape_outputs.py
"""

import json
from pathlib import Path

HERE = Path(__file__).parent
OUT_DIR = HERE / "output"


def main():
    files = sorted(OUT_DIR.glob("scrape_*_raw.json"))
    if not files:
        print("No scrape_*_raw.json files found in scripts/output/")
        return

    print(f"Found {len(files)} scrape files:")
    all_courses = []
    seen_codes = set()
    duplicates = 0

    for f in files:
        data = json.loads(f.read_text())
        added = 0
        for course in data:
            code = course["code"]
            if code not in seen_codes:
                seen_codes.add(code)
                all_courses.append(course)
                added += 1
            else:
                duplicates += 1
        print(f"  {f.name}: {len(data)} courses, {added} new")

    out_path = OUT_DIR / "courses_raw.json"
    out_path.write_text(json.dumps(all_courses, indent=2, ensure_ascii=False))

    # Stats
    quarters_real = sum(1 for c in all_courses if not c.get("_flags", {}).get("quarters_defaulted", True))
    with_coreq = sum(1 for c in all_courses if c.get("labCoreq"))
    with_restrict = sum(1 for c in all_courses if c.get("enrollmentRestrictions"))
    with_repeat = sum(1 for c in all_courses if c.get("repeatable"))
    with_crosslist = sum(1 for c in all_courses if c.get("crossListed"))

    print(f"\nCombined: {len(all_courses)} unique courses ({duplicates} duplicates removed)")
    print(f"Quarters real: {quarters_real} / {len(all_courses)}")
    print(f"Lab coreqs: {with_coreq}")
    print(f"Enrollment restrictions: {with_restrict}")
    print(f"Repeatable: {with_repeat}")
    print(f"Cross-listed: {with_crosslist}")
    print(f"\nWritten: {out_path}")


if __name__ == "__main__":
    main()
