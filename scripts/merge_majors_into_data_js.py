#!/usr/bin/env python3
"""
merge_majors_into_data_js.py
============================

Takes the JSON produced by fetch_ucsc_majors.py and adds new major
REQUIREMENTS objects into js/majors.js so the schedule planner can
support more majors beyond the hand-built CS_BA.

USAGE
-----
    python3 merge_majors_into_data_js.py           # merge all parsed majors
    python3 merge_majors_into_data_js.py --dry-run  # preview only
    python3 merge_majors_into_data_js.py --force    # overwrite existing majors

By default, it NEVER overwrites an existing REQUIREMENTS object. The
hand-tuned CS_BA_REQUIREMENTS stays intact. After writing the new
REQUIREMENTS consts, the script also re-emits the MAJOR_REQUIREMENTS
registry so the app picks up every declared major automatically.
"""

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).parent
DEFAULT_JSON = HERE / "output" / "majors_raw.json"
MAJORS_JS = HERE.parent / "Prototype 1 Website - source code" / "js" / "majors.js"

MAJOR_MARKER = "// === AUTO-GENERATED MAJOR REQUIREMENTS (do not hand-edit below) ==="


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


def format_major_entry(major):
    """Produce the JS snippet for a single major's REQUIREMENTS object."""
    mid = major["id"]
    var_name = f"{mid}_REQUIREMENTS"
    lines = [f"const {var_name} = {{"]
    lines.append(f'  id: "{mid}",')
    lines.append(f'  name: "{escape_js_string(major["name"])}",')
    if major.get("catalogUrl"):
        lines.append(f'  catalogUrl: "{major["catalogUrl"]}",')
    else:
        lines.append(f'  catalogUrl: null,')
    lines.append(f'  pdfUrl: "{major["pdfUrl"]}",')
    lines.append(f'  totalUnitsRequired: {major["totalUnitsRequired"]},')
    lines.append(f'  minUpperDivUnits: {major["minUpperDivUnits"]},')
    lines.append(f'  minGPA: {major["minGPA"]},')
    lines.append(f'  majorGPA: {major["majorGPA"]},')
    lines.append("")
    lines.append("  categories: [")

    for cat in major["categories"]:
        lines.append("    {")
        lines.append(f'      id: "{cat["id"]}",')
        lines.append(f'      name: "{escape_js_string(cat["name"])}",')
        lines.append(f'      type: "{cat["type"]}",')

        if cat["type"] == "choose_group" and "groups" in cat:
            lines.append("      groups: [")
            for g in cat["groups"]:
                courses_js = json.dumps(g["courses"])
                lines.append(f'        {{ label: "{g["label"]}", courses: {courses_js} }},')
            lines.append("      ],")
        else:
            courses_js = json.dumps(cat.get("courses", []))
            lines.append(f"      courses: {courses_js},")

        if "n" in cat:
            lines.append(f"      n: {cat['n']},")

        # Always emit description with a trailing comma — JS tolerates
        # trailing commas in object literals and this avoids having to
        # know whether more fields follow.
        desc = escape_js_string(cat.get("description", ""))
        lines.append(f'      description: "{desc}",')

        if cat.get("note"):
            lines.append(f'      note: "{escape_js_string(cat["note"])}",')

        lines.append("    },")

    lines.append("  ]")
    lines.append("};")
    return "\n".join(lines)


def find_existing_requirement_ids(text):
    """Find every <ID>_REQUIREMENTS variable already declared in the given JS text.

    The `MAJOR_REQUIREMENTS` registry constant also syntactically matches the
    pattern, so we exclude it explicitly — it's a registry, not a major.
    """
    pattern = re.compile(r"const\s+([A-Z0-9_]+_REQUIREMENTS)\s*=\s*\{")
    return {
        m.group(1) for m in pattern.finditer(text)
        if m.group(1) != "MAJOR_REQUIREMENTS"
    }


def rewrite_major_registry(text, all_major_ids):
    """Move the MAJOR_REQUIREMENTS registry to the end of the file and
    rewrite it to reference every major const.

    The registry MUST live after every `const <ID>_REQUIREMENTS = {...}`
    declaration it points at — `const` is not hoisted, so any earlier
    reference throws ReferenceError at load time. We drop the old
    in-place declaration and re-append a fresh one at the bottom.
    """
    sorted_ids = sorted(all_major_ids)
    lines = [
        "",
        "// ------------------------------------------------------------",
        "// MAJOR REGISTRY",
        "// Auto-regenerated on every merge run. Lists every",
        "// _REQUIREMENTS const declared above. The wizard dropdown",
        "// iterates this object to populate major choices.",
        "// ------------------------------------------------------------",
        "",
        "const MAJOR_REQUIREMENTS = {",
    ]
    for mid in sorted_ids:
        lines.append(f'  "{mid}": {mid}_REQUIREMENTS,')
    lines.append("};")
    new_block = "\n".join(lines)

    # Drop any existing MAJOR_REQUIREMENTS declaration (regardless of where
    # it sits). The registry body only contains "KEY": SOMETHING_REQUIREMENTS
    # entries + line comments — no nested braces — so [^}]* is safe.
    pattern = re.compile(
        r"const\s+MAJOR_REQUIREMENTS\s*=\s*\{[^}]*\};",
        re.DOTALL,
    )
    text_without_registry = pattern.sub("", text).rstrip()
    return text_without_registry + "\n" + new_block + "\n"


def main():
    dry_run = "--dry-run" in sys.argv
    force = "--force" in sys.argv

    if not DEFAULT_JSON.exists():
        print(f"ERROR: {DEFAULT_JSON} does not exist. "
              f"Run fetch_ucsc_majors.py first.")
        sys.exit(1)
    if not MAJORS_JS.exists():
        print(f"ERROR: {MAJORS_JS} does not exist.")
        sys.exit(1)

    parsed = json.loads(DEFAULT_JSON.read_text())
    print(f"Loaded {len(parsed)} parsed majors from {DEFAULT_JSON.name}")

    majors_js = MAJORS_JS.read_text()

    # Split the file into "before auto-gen marker" (hand-tuned region) and
    # whatever comes after (the old auto-generated block — discard it).
    # This split-first approach is what makes re-runs idempotent: we
    # classify existing consts into hand-tuned vs auto-gen by location,
    # not just by name.
    marker_idx = majors_js.find(MAJOR_MARKER)
    if marker_idx != -1:
        section_start = marker_idx
        while section_start > 0 and majors_js[section_start - 1] in (" ", "\n"):
            section_start -= 1
        hand_tuned_region = majors_js[:section_start]
    else:
        hand_tuned_region = majors_js

    hand_tuned_vars = find_existing_requirement_ids(hand_tuned_region)
    hand_tuned_ids = {
        var[: -len("_REQUIREMENTS")] for var in hand_tuned_vars
    }
    print(f"Found {len(hand_tuned_ids)} hand-tuned REQUIREMENTS objects: "
          f"{', '.join(sorted(hand_tuned_ids))}")

    # Every major in the JSON is a candidate for (re)generation. We only
    # skip one if it collides with a hand-tuned const and --force isn't
    # set — that protects manual edits to e.g. CS_BA_REQUIREMENTS.
    to_add = []
    skipped = []
    for major in parsed:
        if major["id"] in hand_tuned_ids and not force:
            skipped.append(major["id"])
        else:
            to_add.append(major)

    print(f"Will (re)generate: {len(to_add)} auto-merged majors")
    print(f"Skipping (hand-tuned, use --force to override): "
          f"{len(skipped)} — {', '.join(skipped) if skipped else '(none)'}")

    if not to_add:
        print("Nothing to regenerate. Exiting.")
        return

    # Generate JS blocks
    entries = [format_major_entry(m) for m in to_add]
    block = "\n\n".join(entries)

    generated_block = (
        f"\n\n{MAJOR_MARKER}\n"
        f"// {len(to_add)} majors auto-merged from curriculum chart PDFs.\n"
        f"// Re-run scripts/fetch_ucsc_majors.py + merge_majors_into_data_js.py "
        f"to refresh.\n"
        f"// These are best-effort parses — review _flags in majors_raw.json\n"
        f"// and hand-edit any incorrect categories.\n\n"
        f"{block}\n"
    )

    if dry_run:
        print()
        print("--- DRY RUN (no files written) ---")
        print(f"Would write {len(to_add)} auto-merged majors")
        print(f"Registry would list: "
              f"{', '.join(sorted(hand_tuned_ids | {m['id'] for m in to_add}))}")
        print()
        for e in entries[:2]:
            print(e[:800])
            print("  ...")
            print()
        return

    # Drop the old auto-generated region entirely — we only keep the
    # hand-tuned region and rebuild everything after it.
    majors_js = hand_tuned_region

    # Safety: back up majors.js
    backup = MAJORS_JS.with_suffix(".js.majors.bak")
    backup.write_text(MAJORS_JS.read_text())
    print(f"Backup saved: {backup.name}")

    # Append the new auto-merged major const blocks after the hand-tuned region
    new_majors_js = majors_js.rstrip() + generated_block

    # Regenerate the MAJOR_REQUIREMENTS registry so it lists every major
    # that will exist after this run: hand-tuned + every auto-merged.
    auto_generated_ids = {m["id"] for m in to_add}
    all_major_ids = hand_tuned_ids | auto_generated_ids
    new_majors_js = rewrite_major_registry(new_majors_js, all_major_ids)

    MAJORS_JS.write_text(new_majors_js)
    print(f"Wrote {MAJORS_JS}")
    print(f"Wrote {len(to_add)} auto-merged major requirements. "
          f"Registry now lists {len(all_major_ids)} majors: "
          f"{', '.join(sorted(all_major_ids))}")


if __name__ == "__main__":
    main()
