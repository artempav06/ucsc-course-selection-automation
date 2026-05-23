#!/usr/bin/env python3
"""Test that AM_BS spatial extraction matches the manually-verified ground truth."""

import json
import os
import sys

GROUND_TRUTH = [
    {
        "id": "MATH_CALC", "type": "choose_group",
        "groups": [["MATH 19A", "MATH 19B"], ["MATH 20A", "MATH 20B"]],
    },
    {
        "id": "LIN_ALG_DIFFEQ", "type": "choose_group",
        "groups": [["AM 10", "AM 20"], ["MATH 21", "MATH 24"]],
    },
    {
        "id": "MATH_MULTIVAR", "type": "choose_group",
        "groups": [["MATH 23A", "MATH 23B"], ["AM 30"]],
    },
    {
        "id": "MATH_DISCRETE", "type": "pick_one",
        "courses": {"CSE 16", "MATH 100"},
    },
    {
        "id": "PROGRAMMING", "type": "pick_one",
        "courses": {"CSE 20", "CSE 13S", "ECE 13", "ASTR 19", "ECON 22P"},
    },
    {
        "id": "LD_ELECTIVE", "type": "pick_n", "n": 2,
        "courses_must_include": {"PHYS 5A", "PHYS 5B", "PHYS 5C", "ASTR 21",
                                  "CSE 30", "ECE 9", "ECON 1", "ECON 2",
                                  "BIOL 20A", "BIOE 20C"},
    },
    {
        "id": "UD_REQUIRED", "type": "all_required",
        "courses": {"AM 100", "AM 112", "AM 114", "AM 129"},
    },
    {
        "id": "UD_ANALYSIS", "type": "pick_one",
        "courses": {"AM 147", "MATH 148"},
    },
    {
        "id": "UD_STATS", "type": "pick_one",
        "courses": {"STAT 131", "CSE 107"},
    },
    {
        "id": "UD_ELECTIVE", "type": "pick_n", "n": 3,
        "courses_must_include": {"ASTR 112", "CSE 101", "MATH 105A", "STAT 108"},
        "courses_must_exclude": {"AM 200", "AM 211"},
    },
    {
        "id": "DC", "type": "all_required",
        "courses": {"AM 170A"},
    },
    {
        "id": "COMPREHENSIVE", "type": "pick_one",
        "courses": {"AM 170B", "AM 195"},
    },
]


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(here, "output", "majors_by_id.json")
    try:
        data = json.load(open(json_path))
    except FileNotFoundError:
        print("ERROR: Run 'python3 scripts/fetch_ucsc_majors.py --offline am_bs' first")
        sys.exit(1)

    if "AM_BS" not in data:
        print("ERROR: AM_BS not found in output")
        sys.exit(1)

    am = data["AM_BS"]
    cats = {c["id"]: c for c in am["categories"]}
    failures = 0
    passes = 0

    for gt in GROUND_TRUTH:
        gid = gt["id"]
        if gid not in cats:
            print(f"FAIL  {gid}: MISSING from extraction")
            failures += 1
            continue

        cat = cats[gid]

        # Check type
        if cat["type"] != gt["type"]:
            print(f"FAIL  {gid}: type={cat['type']}, expected {gt['type']}")
            failures += 1
            continue

        # Check choose_group
        if gt["type"] == "choose_group":
            extracted_groups = [set(g["courses"]) for g in cat.get("groups", [])]
            expected_groups = [set(g) for g in gt["groups"]]
            if len(extracted_groups) != len(expected_groups):
                print(f"FAIL  {gid}: {len(extracted_groups)} groups, expected {len(expected_groups)}")
                failures += 1
                continue
            matched = True
            for eg in expected_groups:
                if eg not in extracted_groups:
                    print(f"FAIL  {gid}: missing group {eg}, got {extracted_groups}")
                    failures += 1
                    matched = False
                    break
            if matched:
                print(f"PASS  {gid}: choose_group OK")
                passes += 1
            continue

        # Check pick_n
        if gt["type"] == "pick_n":
            if cat.get("n") != gt.get("n"):
                print(f"FAIL  {gid}: n={cat.get('n')}, expected {gt.get('n')}")
                failures += 1
                continue
            extracted = set(cat.get("courses", []))
            must_include = gt.get("courses_must_include", set())
            must_exclude = gt.get("courses_must_exclude", set())
            missing = must_include - extracted
            unwanted = must_exclude & extracted
            if missing:
                print(f"FAIL  {gid}: missing courses {missing}")
                failures += 1
                continue
            if unwanted:
                print(f"FAIL  {gid}: should not contain {unwanted}")
                failures += 1
                continue
            print(f"PASS  {gid}: pick_n OK ({len(extracted)} courses)")
            passes += 1
            continue

        # Check courses (all_required, pick_one)
        expected_courses = gt.get("courses", set())
        extracted_courses = set(cat.get("courses", []))
        if extracted_courses != expected_courses:
            print(f"FAIL  {gid}: courses={extracted_courses}, expected {expected_courses}")
            failures += 1
        else:
            print(f"PASS  {gid}: {gt['type']} OK")
            passes += 1

    # Check for unexpected categories
    expected_ids = {gt["id"] for gt in GROUND_TRUTH}
    extra = set(cats.keys()) - expected_ids
    if extra:
        print(f"\nWARNING: unexpected categories: {extra}")

    print(f"\n{'='*40}")
    print(f"Results: {passes} passed, {failures} failed out of {len(GROUND_TRUTH)}")
    if failures == 0:
        print("ALL TESTS PASSED!")
    sys.exit(failures)


if __name__ == "__main__":
    main()
