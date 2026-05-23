#!/usr/bin/env python3
"""
merge_into_courses_js.py
=====================

Takes the JSON produced by fetch_ucsc_courses.py and safely merges new
courses into js/courses.js's COURSES object.

It NEVER overwrites existing courses — only adds missing ones. This keeps
the hand-tuned entries for CS core/math/breadth/capstone intact while
expanding the catalog with everything new.

USAGE
-----
    python3 merge_into_courses_js.py           # merge output/courses_raw.json
    python3 merge_into_courses_js.py --dry-run # preview without writing
    python3 merge_into_courses_js.py --force   # also overwrite existing entries

Default behavior:
  1. Read  scripts/output/courses_raw.json
  2. Read  Prototype 1 Website - source code/js/courses.js
  3. Find each course code already present in courses.js
  4. For every new course in the JSON, generate a JS block with:
        section: ["FREE"]   (since we can't know the requirement bucket)
        rmpScore: 0
  5. Insert the new blocks before the `};` that closes the COURSES object
  6. Write courses.js back in-place
"""

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
DEFAULT_JSON = HERE / "output" / "courses_raw.json"
COURSES_JS = HERE.parent / "Prototype 1 Website - source code" / "js" / "courses.js"

INSERT_MARKER = "// === AUTO-GENERATED FROM UCSC CATALOG (do not hand-edit below) ==="


def escape_js_string(s):
    """Escape a string for safe inclusion in a JS double-quoted literal."""
    if s is None:
        return ""
    return (
        s.replace("\\", "\\\\")
         .replace('"', '\\"')
         .replace("\n", " ")
         .replace("\r", " ")
    )


def strip_coreq_from_prereqs(prereqs, lab_coreq):
    """Remove the labCoreq from prereq OR-groups where it's the sole member.

    When a corequisite is the only option in an OR-group (e.g. [["CSE 100L"]]),
    keeping it creates an unsatisfiable circular dependency. Strip it.

    When the corequisite is one of several alternatives (e.g. [["PHYS 5A", "PHYS 15A"]]),
    keep it — the prereq is satisfiable and the corequisite is also a valid
    prior-quarter prereq ("previous or concurrent enrollment").
    """
    if not lab_coreq or not prereqs:
        return prereqs
    cleaned = []
    for or_group in prereqs:
        if or_group == [lab_coreq]:
            continue
        cleaned.append(or_group)
    return cleaned


def format_course_entry(course):
    """Produce the JS snippet for a single course, matching courses.js style."""
    code = course["code"]
    title = escape_js_string(course["title"])
    desc = escape_js_string(course["desc"])
    lab_coreq = course.get("labCoreq")
    prereqs_clean = strip_coreq_from_prereqs(course["prereqs"], lab_coreq)
    # Strip self-references (course listing itself as its own prereq)
    prereqs_clean = [
        [p for p in grp if p != code] for grp in prereqs_clean
    ]
    prereqs_clean = [grp for grp in prereqs_clean if grp]
    prereqs = json.dumps(prereqs_clean)
    quarters = json.dumps(course["quarters"])
    ge = f'"{course["ge"]}"' if course["ge"] else "null"

    lines = [
        f'  "{code}": {{',
        f'    title: "{title}",',
        f'    units: {course["units"]}, division: "{course["division"]}",',
        f'    prereqs: {prereqs},',
        f'    ge: {ge}, quarters: {quarters},',
    ]

    # New fields — only emit when they have meaningful values
    ge_all = course.get("geAll", [])
    if ge_all and len(ge_all) > 1:
        lines.append(f'    geAll: {json.dumps(ge_all)},')

    lab_coreq = course.get("labCoreq")
    if lab_coreq:
        lines.append(f'    labCoreq: "{escape_js_string(lab_coreq)}",')

    if course.get("repeatable"):
        lines.append(f'    repeatable: true,')

    max_units = course.get("maxUnits")
    if max_units is not None:
        lines.append(f'    maxUnits: {max_units},')

    restrictions = course.get("enrollmentRestrictions")
    if restrictions:
        lines.append(f'    enrollmentRestrictions: "{escape_js_string(restrictions)}",')

    catalog_url = course.get("catalogUrl", "")
    if catalog_url:
        lines.append(f'    catalogUrl: "{escape_js_string(catalog_url)}",')

    lines.append(f'    desc: "{desc}",')
    lines.append(f'    section: ["FREE"], rmpScore: 0')
    lines.append(f'  }},')

    return "\n".join(lines)


def extract_existing_codes(courses_js_text):
    """Find every course key currently declared inside the COURSES object."""
    # Handles: "CSE 12", "MATH 19A", "CSE 101P", "CHEM 3BL", "LIT 61F"
    pattern = re.compile(r'"([A-Z]{2,5}\s\d+[A-Z]{0,2})"\s*:\s*\{')
    return set(pattern.findall(courses_js_text))


def main():
    dry_run = "--dry-run" in sys.argv
    force = "--force" in sys.argv

    if not DEFAULT_JSON.exists():
        print(f"ERROR: {DEFAULT_JSON} does not exist. Run fetch_ucsc_courses.py first.")
        sys.exit(1)
    if not COURSES_JS.exists():
        print(f"ERROR: {COURSES_JS} does not exist.")
        sys.exit(1)

    parsed = json.loads(DEFAULT_JSON.read_text())
    print(f"Loaded {len(parsed)} parsed courses from {DEFAULT_JSON.name}")

    courses_js = COURSES_JS.read_text()

    # Find the closing `};` of the COURSES object. It's the first `};` after
    # `const COURSES = {`. We assume courses.js has this exact pattern.
    open_idx = courses_js.find("const COURSES = {")
    if open_idx == -1:
        print("ERROR: could not find `const COURSES = {` in courses.js")
        sys.exit(1)

    # Find the matching closing brace by counting braces
    depth = 0
    close_idx = -1
    i = open_idx + len("const COURSES = ")
    while i < len(courses_js):
        ch = courses_js[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                close_idx = i
                break
        i += 1

    if close_idx == -1:
        print("ERROR: could not find closing brace of COURSES object")
        sys.exit(1)

    # Split the file into "hand-tuned region" (before the auto-gen marker)
    # and "auto-gen region" (from the marker through close_idx). The
    # previous implementation used extract_existing_codes over the WHOLE
    # file, which meant any course previously auto-merged looked
    # "existing" and got skipped — but then we stripped the auto-gen
    # region and didn't re-add those skipped courses, silently deleting
    # thousands of entries on every re-run.
    #
    # The fix: treat only the hand-tuned region as protected. Everything
    # in raw JSON gets (re)generated unconditionally, and any collision
    # with the hand-tuned region is skipped (unless --force).
    auto_marker_start = courses_js.find(INSERT_MARKER, open_idx)
    if auto_marker_start != -1 and auto_marker_start < close_idx:
        section_start = auto_marker_start
        while section_start > 0 and courses_js[section_start - 1] in (" ", "\n"):
            section_start -= 1
        hand_tuned_region = courses_js[:section_start]
        # Rebuild courses_js without the auto-gen region
        before_auto = courses_js[:section_start]
        after_auto = courses_js[close_idx:]
        courses_js = before_auto + after_auto
        # Re-find close_idx after deletion
        open_idx = courses_js.find("const COURSES = {")
        depth = 0
        close_idx = -1
        i = open_idx + len("const COURSES = ")
        while i < len(courses_js):
            ch = courses_js[i]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    close_idx = i
                    break
            i += 1
    else:
        # No previous auto-gen region — the whole current body is
        # hand-tuned. Take everything up to the closing brace.
        hand_tuned_region = courses_js[:close_idx]

    hand_tuned_codes = extract_existing_codes(hand_tuned_region)
    print(f"Found {len(hand_tuned_codes)} hand-tuned courses in courses.js")

    # Decide which courses to add. Hand-tuned entries are protected; every
    # other parsed course is (re)generated.
    to_add = []
    skipped = []
    for course in parsed:
        code = course["code"]
        if code in hand_tuned_codes and not force:
            skipped.append(code)
        else:
            to_add.append(course)

    print(f"Will (re)generate: {len(to_add)} auto-merged courses")
    print(f"Skipping (hand-tuned, use --force to override): {len(skipped)}")

    if not to_add:
        print("Nothing to regenerate. Exiting.")
        return

    # Ensure the last hand-tuned entry has a trailing comma — otherwise
    # appending the auto-gen block produces `{ ... } "ANTH ...": {...}`
    # which is a syntax error. The splice-in point is always right before
    # the closing `};`, so we inspect the byte just before close_idx
    # (skipping whitespace) and normalize to a comma.
    scan = close_idx - 1
    while scan > 0 and courses_js[scan] in (" ", "\n", "\t", "\r"):
        scan -= 1
    if scan > 0 and courses_js[scan] == "}":
        # Last entry's closing brace — insert a comma after it
        courses_js = courses_js[: scan + 1] + "," + courses_js[scan + 1:]
        close_idx += 1  # we added one character before close_idx

    # Generate the JS block for all new courses
    entries = [format_course_entry(c) for c in to_add]
    block = "\n".join(entries)

    generated_block = (
        f"\n\n  {INSERT_MARKER}\n"
        f"  // {len(to_add)} courses auto-merged from UCSC General Catalog\n"
        f"  // Re-run scripts/fetch_ucsc_courses.py + merge_into_courses_js.py to refresh.\n"
        f"  // Each entry has section=[\"FREE\"] by default — edit manually if it\n"
        f"  // should count as BREADTH_A/BREADTH_B/CAPSTONE/DC/ELECTIVE/GE.\n"
        f"{block}\n"
    )

    # Splice in the new entries
    new_courses_js = courses_js[:close_idx] + generated_block + courses_js[close_idx:]

    if dry_run:
        print()
        print("--- DRY RUN (no files written) ---")
        print(f"Would add/update: {len(to_add)} auto-generated courses")
        print(f"Would skip: {len(skipped)} hand-tuned courses")
        # Stats on new fields
        with_quarters = sum(1 for c in to_add if not c.get("_flags", {}).get("quarters_defaulted", True))
        with_coreq = sum(1 for c in to_add if c.get("labCoreq"))
        with_restrict = sum(1 for c in to_add if c.get("enrollmentRestrictions"))
        with_repeat = sum(1 for c in to_add if c.get("repeatable"))
        with_url = sum(1 for c in to_add if c.get("catalogUrl"))
        print(f"  Courses with real quarters: {with_quarters}")
        print(f"  Courses with labCoreq: {with_coreq}")
        print(f"  Courses with enrollmentRestrictions: {with_restrict}")
        print(f"  Courses with repeatable=true: {with_repeat}")
        print(f"  Courses with catalogUrl: {with_url}")
        if skipped:
            print(f"\nHand-tuned courses preserved: {', '.join(sorted(skipped)[:20])}")
            if len(skipped) > 20:
                print(f"  ... and {len(skipped) - 20} more")
        print()
        print("First 3 new entries preview:")
        for e in entries[:3]:
            print(e)
            print()
        return

    # Safety: back up courses.js once per run
    backup = COURSES_JS.with_suffix(".js.bak")
    backup.write_text(COURSES_JS.read_text())
    print(f"Backup saved: {backup.name}")

    COURSES_JS.write_text(new_courses_js)
    print(f"Wrote {COURSES_JS}")
    print(f"Added {len(to_add)} courses. Open courses.js to review.")


if __name__ == "__main__":
    main()
