"""
batch_extract.py — Run extract_landmarks over all MP4s in frontend/public/videos/

Idempotent: skips glosses that already have a JSON in landmark_store/.

Usage:
    cd backend/
    python pipeline/batch_extract.py [--force]

Flags:
    --force   Re-extract even if JSON already exists
"""
import argparse
import json
import sys
from pathlib import Path

# Resolve paths relative to this file's location
_HERE = Path(__file__).parent
_BACKEND = _HERE.parent
_VIDEOS_DIR = _BACKEND.parent / "frontend" / "public" / "videos"
_STORE_DIR  = _BACKEND / "landmark_store"

sys.path.insert(0, str(_HERE))
from extract_landmarks import extract


def run(force: bool = False) -> None:
    _STORE_DIR.mkdir(exist_ok=True)

    mp4_files = sorted(_VIDEOS_DIR.glob("*.mp4"))
    if not mp4_files:
        print(f"No MP4 files found in {_VIDEOS_DIR}")
        return

    print(f"Found {len(mp4_files)} video(s) in {_VIDEOS_DIR}")
    print(f"Output dir: {_STORE_DIR}\n")

    ok = skipped = errors = 0

    for mp4 in mp4_files:
        gloss = mp4.stem.upper()
        out_path = _STORE_DIR / f"{gloss}.json"

        if out_path.exists() and not force:
            print(f"  SKIP  {gloss} (already exists)")
            skipped += 1
            continue

        print(f"  EXTRACT {gloss} ...", end=" ", flush=True)
        try:
            data = extract(str(mp4), gloss, verbose=False)
            out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            pct = data["valid_pose_frames"] / max(data["frame_count"], 1) * 100
            print(f"{data['frame_count']} frames, {pct:.0f}% valid pose")
            ok += 1
        except Exception as e:
            print(f"ERROR: {e}")
            errors += 1

    print(f"\nDone: {ok} extracted, {skipped} skipped, {errors} errors")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Re-extract existing files")
    args = parser.parse_args()
    run(force=args.force)
