#!/usr/bin/env python3
"""Apply conservative official UCSC catalog prerequisite fixes to Prototype 4.

Policy encoded here:
- Official current catalog exact course pages are the source of truth.
- Engine prerequisites include only actual courses.
- Placement/AP/writing/permission/recommended/eligibility language is preserved as notes,
  not converted into schedulable prerequisite paths.
- Missing prerequisite alternatives are added only when a current official catalog course page exists.
- Courses without exact current official pages remain out of scope for the user's #6/manual queue.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
COURSES_JS = ROOT / "js" / "courses.js"
REPORT_JSON = ROOT / "data" / "audit" / "official-prerequisite-review-report.json"
INDEX_JSON = ROOT / "data" / "audit" / "official-catalog-course-index.json"
SUMMARY_JSON = ROOT / "data" / "audit" / "prototype4-official-fix-application-summary.json"
SUMMARY_MD = ROOT / "docs" / "plans" / "prototype4-official-fix-application-summary.md"

COURSE_RE = re.compile(r"\b[A-Z]{2,5}\s+\d+[A-Z]?\b")

NOTE_FLAG_LABELS = {
    "contains-placement-exam-or-writing-requirement": "Official catalog includes non-course eligibility language (placement/AP/test-out/writing/composition). It is preserved here as a note and is not engine-enforced as a course prerequisite.",
    "contains-permission-or-consent-exception": "Official catalog includes instructor permission/consent language. It is preserved here as a note and is not treated as a normal schedulable prerequisite path.",
    "contains-recommended-language": "Official catalog includes recommended/advisory language. It is preserved here as a note and is not engine-enforced.",
    "contains-major-or-enrollment-condition": "Official catalog includes major/enrollment restriction or eligibility language. It is preserved here as a note; clear machine-readable restrictions are also encoded when confidently mapped.",
    "contains-prior-or-concurrent-language": "Official catalog includes prior/concurrent enrollment language. Clear concurrent course requirements are encoded in concurrentPrereqs; ambiguous cases remain noted.",
}

SUPPORTED_MAJOR_KEYWORDS = [
    ("computer science", ["CS_BA", "CS_BS"]),
    ("computer engineering", ["CE_BS"]),
    ("electrical engineering", ["EE_BS"]),
    ("robotics engineering", ["RE_BS"]),
    ("technology and information management", ["TIM_BS"]),
    ("applied mathematics", ["AM_BS"]),
    ("biotechnology", ["BIOTECH_BS"]),
]

CLEAR_RESTRICTIONS = {
    # Current catalog: "Enrollment is restricted to senior art and design: games and playable media majors."
    # Prototype 4 has no ARTG major; encode unsupported official major IDs so every supported profile is ineligible.
    "ARTG 171": {"restrictedMajors": ["ARTG_BA", "ARTG_BS"], "restrictedLevels": [4]},
    # Catalog says intended for non-majors and CS majors should enroll in CSE 180.
    "CSE 182": {"excludedMajors": ["CS_BA", "CS_BS"], "restrictedLevels": [3, 4]},
    # Class-level restrictions that are clear from current catalog text.
    "KRSG 100": {"restrictedLevels": [2, 3]},
    "SOCY 124": {"restrictedLevels": [3, 4]},
    "PHYS 180": {"restrictedLevels": [3, 4]},
}


def load_courses() -> dict[str, dict[str, Any]]:
    script = """
const fs=require('fs'),vm=require('vm');
const ctx={console}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/courses.js','utf8')+'\\nthis.COURSES=COURSES;', ctx, {filename:'js/courses.js'});
process.stdout.write(JSON.stringify(ctx.COURSES));
"""
    proc = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, check=True)
    return json.loads(proc.stdout)


def norm_text(text: str | None) -> str:
    text = text or ""
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"\s+([,.;:/])", r"\1", text)
    return text


def canonical_groups(groups: list[list[str]]) -> list[list[str]]:
    out: list[list[str]] = []
    for group in groups:
        clean: list[str] = []
        for code in group:
            code = re.sub(r"\s+", " ", code.strip().upper())
            if code and code not in clean:
                clean.append(code)
        if clean and clean not in out:
            out.append(clean)
    return out


def code_tokens(text: str) -> list[tuple[str, int, int]]:
    fixed = re.sub(r"\b([A-Z]{2,5})\s+(\d+)\s*/\s*L\b", r"\1 \2L", text)
    return [(m.group(), m.start(), m.end()) for m in COURSE_RE.finditer(fixed)]


def strip_non_prereq_tail(text: str) -> str:
    text = norm_text(text)
    # Some extracted prerequisite snippets accidentally include crosslisted-course requirements after credits.
    text = re.split(r"\bCredits\b|\bAlso offered as\b|\bCourse restricted\b|\bStudents who\b|\bNote:\b", text, maxsplit=1, flags=re.I)[0].strip()
    return text


def note_labels(flags: list[str], official_text: str) -> list[str]:
    notes: list[str] = []
    include_official_text = False
    for flag in flags:
        label = NOTE_FLAG_LABELS.get(flag)
        if label and label not in notes:
            notes.append(label)
            include_official_text = True
    if official_text and include_official_text:
        notes.append(f"Official prerequisite/eligibility text: {official_text}")
    return notes


def looks_n_of_or_sequence(text: str) -> bool:
    low = text.lower()
    patterns = [
        r"\b(?:one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:courses?\s+)?(?:from|of the following)",
        r"\bat least\b",
        r"\bfollowing courses\b",
        r"\ball three courses in sequence\b",
        r"\bupper[- ]division course in\b",
        r"\bprior course work in the major\b",
        r"\ba university-level course\b",
        r"\boperational knowledge\b",
    ]
    return any(re.search(p, low) for p in patterns)


def remove_permission_language(text: str) -> str:
    # Delete permission alternatives/clauses, but preserve them in prereqNotes.
    text = re.sub(r"\s*[;,]?\s*or\s+by\s+permission\s+of\s+(?:the\s+)?instructor\.?", "", text, flags=re.I)
    text = re.sub(r"\s*[;,]?\s*or\s+permission\s+of\s+(?:the\s+)?instructor\.?", "", text, flags=re.I)
    text = re.sub(r"\s*[;,]?\s*or\s+instructor\s+permission\.?", "", text, flags=re.I)
    text = re.sub(r"\s*[;,]?\s*or\s+(?:instructor\s+)?consent(?:\s+of\s+instructor)?\.?", "", text, flags=re.I)
    text = re.sub(r"\s*,?\s*and\s+instructor\s+consent\.?", "", text, flags=re.I)
    return text.strip()


def parse_course_groups(text: str) -> tuple[list[list[str]], list[list[str]], list[str]]:
    """Return (prior prereq groups, concurrent prereq groups, reasons_to_skip).

    This is intentionally conservative. If a phrase encodes N-of-M, sequence, unsupported
    major alternatives, or self-referential descriptive text, it declines to update engine
    prereqs rather than guessing wrong.
    """
    original = strip_non_prereq_tail(text)
    if not original:
        return [], [], ["no official prerequisite text"]

    if looks_n_of_or_sequence(original):
        return [], [], ["n-of/sequence/non-course prerequisite wording requires manual modeling"]
    if re.search(r"\b(?:and|or|,)\s+\d{1,3}[A-Z]?\b", original, flags=re.I):
        return [], [], ["abbreviated same-subject course references require manual expansion"]
    if re.search(r"\bor\s+(?:mathematics\s+)?placement\b|\bor\s+qualifying\s+(?:AP\s+)?exam\b", original, flags=re.I):
        return [], [], []

    cleaned = remove_permission_language(original)
    # Recommended/advisory courses are notes, not enforced prerequisites.
    cleaned = re.sub(r"(?:^|[.;])\s*[^.;]*\brecommended\b[^.;]*\.?", " ", cleaned, flags=re.I)
    concurrent: list[list[str]] = []

    # Clear same-quarter requirements.
    for pat in [
        r"must\s+be\s+taken\s+concurrently\s+with\s+([A-Z]{2,5}\s+\d+[A-Z]?)",
        r"students\s+must\s+concurrently\s+enroll\s+in\s+([A-Z]{2,5}\s+\d+[A-Z]?)",
    ]:
        for m in re.finditer(pat, cleaned, flags=re.I):
            concurrent.append([re.sub(r"\s+", " ", m.group(1).upper())])
    cleaned = re.sub(r"must\s+be\s+taken\s+concurrently\s+with\s+[A-Z]{2,5}\s+\d+[A-Z]?\s*\.?", "", cleaned, flags=re.I)
    cleaned = re.sub(r"students\s+must\s+concurrently\s+enroll\s+in\s+[A-Z]{2,5}\s+\d+[A-Z]?\s*\.?", "", cleaned, flags=re.I)

    # Generic "previous or concurrent" without an identifiable course is preserved as a note.
    cleaned = re.sub(r"\b(?:previous|prior)\s+or\s+concurrent\b", "", cleaned, flags=re.I)
    cleaned = re.sub(r"\bconcurrent\b", "", cleaned, flags=re.I)

    tokens = code_tokens(cleaned)
    if not tokens:
        if concurrent:
            return [], canonical_groups(concurrent), []
        return [], canonical_groups(concurrent), ["no course prerequisite tokens after removing non-course/concurrent language"]

    groups: list[list[str]] = [[tokens[0][0]]]
    for i in range(1, len(tokens)):
        prev = tokens[i - 1]
        cur = tokens[i]
        connector = cleaned[prev[2]:cur[1]].lower()
        code = cur[0]
        # A semicolon/comma/and starts a new required group; plain "or" stays in the current OR group.
        if re.search(r";\s*or\s*$", connector):
            for group in groups:
                if code not in group:
                    group.append(code)
        elif " and " in connector or ";" in connector or ("," in connector and " or " not in connector):
            groups.append([code])
        else:
            groups[-1].append(code)

    groups = canonical_groups(groups)
    concurrent = canonical_groups(concurrent)
    return groups, concurrent, []


def official_no_prereq(text: str | None, flags: list[str]) -> bool:
    if not text:
        return True
    return "no-official-prereq-text-found" in flags or norm_text(text).lower().startswith("(none")


def fetch_official_course(index_entry: dict[str, Any]) -> dict[str, Any]:
    url = index_entry["url"]
    req = urllib.request.Request(url, headers={"User-Agent": "Hermes Prototype4 prerequisite sync"})
    body = urllib.request.urlopen(req, timeout=25).read().decode("utf-8", "ignore")
    plain = re.sub(r"<script[\s\S]*?</script>|<style[\s\S]*?</style>", " ", body, flags=re.I)
    plain = html.unescape(re.sub(r"<[^>]+>", " ", plain))
    plain = re.sub(r"\s+", " ", plain).strip()
    h1 = re.search(r"<h1[^>]*>([\s\S]*?)</h1>", body, flags=re.I)
    h1_text = html.unescape(re.sub(r"<[^>]+>", " ", h1.group(1))).strip() if h1 else index_entry.get("code", "")
    code = index_entry["code"]
    title = h1_text.replace(code, "", 1).strip() or index_entry.get("title") or "Official UCSC catalog course"
    prereq = ""
    m = re.search(r"Requirements\s+Prerequisite\(s\):\s*(.*?)\s+Credits\b", plain, flags=re.I)
    if m:
        prereq = norm_text(m.group(1))
    credits = 5
    cm = re.search(r"\bCredits\s+(\d+)", plain)
    if cm:
        credits = int(cm.group(1))
    ge = None
    gm = re.search(r"General Education Code\s+([A-Z]{1,3}(?:-[A-Z])?)", plain)
    if gm:
        ge = gm.group(1)
    desc = "Official UCSC General Catalog course added because it appears as a prerequisite alternative for another current catalog course."
    start = plain.find(title)
    if start >= 0:
        chunk = plain[start + len(title):]
        chunk = re.split(r"\bRequirements\b|\bCredits\b|\bGeneral Education Code\b", chunk, maxsplit=1)[0].strip()
        if chunk:
            desc = chunk[:700].strip()
    prereqs, concurrent, _ = parse_course_groups(prereq)
    return {
        "concentrations": [],
        "title": title,
        "units": credits,
        "division": "upper" if "/upper-division/" in url or "/graduate/" in url else "lower",
        "prereqs": prereqs,
        **({"concurrentPrereqs": concurrent} if concurrent else {}),
        "ge": ge,
        "quarters": [],
        "catalogUrl": url,
        "officialPrereqText": prereq,
        "prereqNotes": ["Added from the official UCSC General Catalog because this course appears as an official prerequisite alternative. Catalog pages do not publish typical offering quarters, so quarters are intentionally left empty instead of guessed."],
        "desc": desc,
        "section": ["FREE"],
        "rmpScore": 0,
    }


def render_js(courses: dict[str, dict[str, Any]]) -> str:
    body = json.dumps(courses, indent=2, ensure_ascii=False)
    return """// ============================================================\n// courses.js  --  UCSC Course Selection Automation\n// Prototype 4 official catalog prerequisite sync.\n// Source of truth for prerequisite text: current UCSC General Catalog exact course pages.\n//\n// Prerequisite model:\n//   prereqs             - course-only prior prerequisites, AND of OR-groups.\n//   concurrentPrereqs   - course-only prior-or-concurrent/concurrent groups.\n//   officialPrereqText  - official catalog prerequisite/eligibility text.\n//   prereqNotes         - non-course eligibility notes preserved for students; not engine-enforced.\n//   restrictedMajors    - selected major IDs allowed to take/schedule the course.\n//   excludedMajors      - selected major IDs not allowed/recommended for the course.\n//   restrictedLevels    - numeric class levels allowed when catalog gives clear class restriction.\n// ============================================================\n\nconst COURSES = """ + body + ";\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write js/courses.js. Without this, only reports proposed changes.")
    args = parser.parse_args()

    courses = load_courses()
    report = json.loads(REPORT_JSON.read_text())["review"]
    index = {entry["code"]: entry for entry in json.loads(INDEX_JSON.read_text())["courses"]}

    applied = []
    skipped = []
    notes_added = 0
    no_prereq_cleared = 0
    concurrent_added = 0
    restrictions_added = 0
    missing_added = []

    # Add current official missing prerequisite alternatives first, so parser can include them.
    missing = sorted({code for row in report for code in row.get("officialAlternativesMissingLocally", [])})
    for code in missing:
        if code in courses:
            continue
        if code not in index:
            skipped.append({"code": code, "reason": "missing prerequisite alternative has no exact current official catalog page; left for #6/manual queue"})
            continue
        try:
            courses[code] = fetch_official_course(index[code])
            missing_added.append(code)
        except Exception as exc:  # pragma: no cover - operational guard
            skipped.append({"code": code, "reason": f"failed to fetch official missing course page: {exc}"})

    for row in report:
        code = row["code"]
        course = courses.get(code)
        if not course:
            skipped.append({"code": code, "reason": "local course missing while applying report"})
            continue
        official_text = strip_non_prereq_tail(row.get("officialPrereqText") or "")
        flags = row.get("flags", [])
        if official_text:
            course["officialPrereqText"] = official_text
        notes = note_labels(flags, official_text)
        if notes:
            raw_existing = course.get("prereqNotes")
            existing: list[str] = raw_existing if isinstance(raw_existing, list) else []
            merged = existing[:]
            for note in notes:
                if note not in merged:
                    merged.append(note)
            course["prereqNotes"] = merged
            notes_added += 1

        clear_restriction = CLEAR_RESTRICTIONS.get(code)
        if clear_restriction:
            for key, value in clear_restriction.items():
                course[key] = value
            restrictions_added += 1

        if official_no_prereq(row.get("officialPrereqText"), flags):
            if course.get("prereqs"):
                course["prereqs"] = []
                course.pop("concurrentPrereqs", None)
                no_prereq_cleared += 1
                applied.append({"code": code, "action": "cleared prereqs: official current catalog has no prerequisite text"})
            continue

        if row.get("officialAlternativesMissingLocally"):
            unresolved = [c for c in row["officialAlternativesMissingLocally"] if c not in courses]
            if unresolved:
                skipped.append({"code": code, "reason": f"official prerequisite alternatives missing and no current official page added: {', '.join(unresolved)}"})
                continue

        prereqs, concurrent, reasons = parse_course_groups(official_text)
        if code in {c for group in prereqs + concurrent for c in group}:
            reasons.append("self-referential course mention in extracted text")
        if reasons:
            skipped.append({"code": code, "reason": "; ".join(reasons), "officialPrereqText": official_text})
            continue

        # Sanity: every engine-enforced course must exist locally after official missing-course additions.
        unknown = sorted({c for group in prereqs + concurrent for c in group if c not in courses})
        if unknown:
            skipped.append({"code": code, "reason": f"parsed prereqs reference unknown local courses: {', '.join(unknown)}"})
            continue

        before = {"prereqs": course.get("prereqs", []), "concurrentPrereqs": course.get("concurrentPrereqs", [])}
        course["prereqs"] = prereqs
        if concurrent:
            course["concurrentPrereqs"] = concurrent
            concurrent_added += 1
        else:
            course.pop("concurrentPrereqs", None)
        after = {"prereqs": prereqs, "concurrentPrereqs": concurrent}
        if before != after:
            applied.append({"code": code, "action": "updated course-only prereqs from official catalog", "before": before, "after": after})

    summary = {
        "appliedChanges": len(applied),
        "notesAddedOrMerged": notes_added,
        "noPrereqCleared": no_prereq_cleared,
        "concurrentPrereqCoursesEncoded": concurrent_added,
        "clearRestrictionsEncoded": restrictions_added,
        "missingOfficialPrereqCoursesAdded": missing_added,
        "skippedForManualOrAmbiguousReviewCount": len(skipped),
        "skippedSample": skipped[:200],
        "appliedSample": applied[:200],
    }
    SUMMARY_JSON.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_JSON.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    SUMMARY_MD.parent.mkdir(parents=True, exist_ok=True)
    SUMMARY_MD.write_text(
        "# Prototype 4 Official Prerequisite Fix Application Summary\n\n"
        f"- Mode: {'APPLIED' if args.apply else 'DRY RUN'}\n"
        f"- Applied prerequisite changes: {len(applied)}\n"
        f"- Courses with official non-course notes added/merged: {notes_added}\n"
        f"- Courses cleared because current official catalog has no prerequisite text: {no_prereq_cleared}\n"
        f"- Courses with clear concurrent prerequisite groups encoded: {concurrent_added}\n"
        f"- Clear major/class restrictions encoded: {restrictions_added}\n"
        f"- Missing official prerequisite courses added: {', '.join(missing_added) if missing_added else 'none'}\n"
        f"- Ambiguous/manual skips kept out of engine updates: {len(skipped)}\n\n"
        "## Notes\n"
        "Ambiguous N-of-M, self-referential, missing-current-page, and non-course-only cases were not guessed. They remain in the manual/#6 or future modeling queue.\n",
        encoding="utf-8",
    )

    if args.apply:
        backup = COURSES_JS.with_suffix(".js.before-official-prereq-sync.bak")
        if not backup.exists():
            backup.write_text(COURSES_JS.read_text(encoding="utf-8"), encoding="utf-8")
        COURSES_JS.write_text(render_js(courses), encoding="utf-8")

    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
