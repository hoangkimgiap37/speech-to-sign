"""
batch_extract.py — Run extract_landmarks over all MP4s in a videos directory

Idempotent: skips glosses that already have a JSON in landmark_store/.

Usage:
    cd backend/
    python pipeline/batch_extract.py [--force] [--input DIR] [--output DIR]

Flags:
    --force   Re-extract even if JSON already exists
    --input   Video directory (default: ../frontend/public/videos)
    --output  Landmark output directory (default: landmark_store/)
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


def run(force: bool = False, videos_dir: Path = None, store_dir: Path = None) -> None:
    if videos_dir is None:
        videos_dir = _VIDEOS_DIR
    if store_dir is None:
        store_dir = _STORE_DIR
    store_dir.mkdir(exist_ok=True)

    mp4_files = sorted(videos_dir.glob("*.mp4"))
    if not mp4_files:
        print(f"No MP4 files found in {videos_dir}")
        return

    print(f"Found {len(mp4_files)} video(s) in {videos_dir}")
    print(f"Output dir: {store_dir}\n")

    ok = skipped = errors = 0

    for mp4 in mp4_files:
        gloss = mp4.stem.upper()
        out_path = store_dir / f"{gloss}.json"

        if out_path.exists() and not force:
            print(f"  SKIP  {gloss} (already exists)")
            skipped += 1
            continue

        print(f"  EXTRACT {gloss} ...", end=" ", flush=True)
        try:
            data = extract(str(mp4), gloss, verbose=False)
            out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            pct = data["valid_pose_frames"] / max(data["frame_count"], 1) * 100
            print(f"{data['frame_count']} frames, {pct:.0f}% valid pose")
            ok += 1
        except Exception as e:
            print(f"ERROR: {e}")
            errors += 1

    print(f"\nDone: {ok} extracted, {skipped} skipped, {errors} errors")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force",  action="store_true", help="Re-extract existing files")
    parser.add_argument("--input",  type=Path, default=None, dest="input_dir",
                        help="Video directory (default: ../frontend/public/videos)")
    parser.add_argument("--output", type=Path, default=None, dest="output_dir",
                        help="Landmark output directory (default: landmark_store/)")
    args = parser.parse_args()
    run(force=args.force, videos_dir=args.input_dir, store_dir=args.output_dir)
