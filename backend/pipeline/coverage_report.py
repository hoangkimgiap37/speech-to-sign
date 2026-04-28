"""
coverage_report.py — Show animation/landmark/video coverage for all 251 dictionary glosses

Usage:
    cd backend/
    python pipeline/coverage_report.py [--missing] [--json]

Flags:
    --missing  Only show glosses with no animation AND no landmark
    --json     Output as JSON (for use by RecordPage.jsx suggestion API)
"""
import argparse
import json
import sys
from pathlib import Path

_HERE    = Path(__file__).parent
_BACKEND = _HERE.parent

_DICT_PATH    = _BACKEND / "dictionary" / "vnsl_dict.json"
_STORE_DIR    = _BACKEND / "landmark_store"
_VIDEOS_DIR   = _BACKEND.parent / "frontend" / "public" / "videos"

# Hand-crafted animations in glosses.js (maintained manually when changed)
_HANDCRAFTED = {
    "HELLO", "GOODBYE", "THANK_YOU", "SORRY", "YES", "NO",
    "ME", "YOU", "YOU_MALE", "YOU_FEMALE", "WE",
    "WANT", "NEED", "LOVE", "LIKE",
    "EAT", "DRINK", "STUDY", "WORK", "GO", "HELP",
    "UNDERSTAND", "KNOW",
    "GOOD", "BAD", "HAPPY", "SAD",
    "TODAY", "TOMORROW", "YESTERDAY",
}


def load_all_glosses() -> set[str]:
    data = json.loads(_DICT_PATH.read_text(encoding="utf-8"))
    return set(data.values())


def build_report(all_glosses: set[str]) -> list[dict]:
    rows = []
    for gloss in sorted(all_glosses):
        has_handcraft = gloss in _HANDCRAFTED
        has_landmark  = (_STORE_DIR  / f"{gloss}.json").exists()
        has_video     = (_VIDEOS_DIR / f"{gloss}.mp4").exists()
        has_anim      = has_handcraft or has_landmark

        priority = (
            "HIGH"   if not has_anim and not has_video else
            "MEDIUM" if not has_anim else
            "LOW"
        )

        rows.append({
            "gloss":        gloss,
            "has_handcraft": has_handcraft,
            "has_landmark":  has_landmark,
            "has_video":     has_video,
            "has_anim":      has_anim,
            "priority":      priority,
        })

    # Sort: HIGH first, then by gloss name
    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    rows.sort(key=lambda r: (priority_order[r["priority"]], r["gloss"]))
    return rows


def print_table(rows: list[dict], missing_only: bool = False) -> None:
    if missing_only:
        rows = [r for r in rows if r["priority"] == "HIGH"]

    total = len(rows)
    with_anim  = sum(1 for r in rows if r["has_anim"])
    with_video = sum(1 for r in rows if r["has_video"])
    with_lm    = sum(1 for r in rows if r["has_landmark"])

    print(f"\n{'GLOSS':<28} {'HAND':>5} {'LM':>4} {'VID':>4} {'ANIM':>5}  PRIORITY")
    print("-" * 62)

    for r in rows:
        hc  = "Y" if r["has_handcraft"] else "."
        lm  = "Y" if r["has_landmark"]  else "."
        vid = "Y" if r["has_video"]     else "."
        an  = "Y" if r["has_anim"]      else "."
        pri = r["priority"]
        marker = "" if pri != "HIGH" else "  ** MISSING"
        print(f"  {r['gloss']:<26} {hc:>5} {lm:>4} {vid:>4} {an:>5}  {pri}{marker}")

    if not missing_only:
        print("-" * 62)
        total_all = len(rows)
        print(f"\nTotal glosses:   {total_all}")
        print(f"Has any anim:    {with_anim}  ({with_anim/total_all*100:.0f}%)")
        print(f"Has hand-craft:  {sum(1 for r in rows if r['has_handcraft'])}")
        print(f"Has landmark:    {with_lm}")
        print(f"Has video:       {with_video}")
        missing = sum(1 for r in rows if not r["has_anim"])
        print(f"\nMissing anim:    {missing}  (target for data collection)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--missing", action="store_true", help="Only show HIGH priority glosses")
    parser.add_argument("--json",    action="store_true", help="Output JSON")
    args = parser.parse_args()

    all_glosses = load_all_glosses()
    rows = build_report(all_glosses)

    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        print_table(rows, missing_only=args.missing)


if __name__ == "__main__":
    main()
