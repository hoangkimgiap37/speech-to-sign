"""
download_msasl.py - Download ASL sign videos from MS-ASL dataset (Microsoft)

MS-ASL contains ~25,000 clips for 1000 ASL signs with precise timestamps.
Each entry has a YouTube URL + start_time/end_time -> trimmed to exact sign.

Usage:
    cd backend/
    python pipeline/download_msasl.py [--output DIR] [--limit N] [--glosses G1 G2]
    python pipeline/download_msasl.py --limit 100          # first 100 words
    python pipeline/download_msasl.py --glosses HELLO EAT  # specific words only
    python pipeline/download_msasl.py --all                # all 1000 words

Flags:
    --output    Where to save videos (default: ../frontend/public/videos)
    --glosses   Specific VNSL glosses to download
    --limit     Max number of words to process (default: 41 target glosses)
    --all       Download all 1000 MS-ASL words
    --force     Re-download even if file exists
    --clips-per-word  Max clips to try per word before giving up (default: 5)
"""
import argparse
import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from collections import defaultdict

_HERE    = Path(__file__).parent
_BACKEND = _HERE.parent
_DEFAULT_OUTPUT = _BACKEND.parent / "frontend" / "public" / "videos"
_MODELS_DIR = _HERE / "models"

# MS-ASL official ZIP from Microsoft Download Center (contains all JSON files)
_MSASL_ZIP_URL   = (
    "https://download.microsoft.com/download/3/c/a/"
    "3ca92c78-1c4a-4a91-a7ee-6980c1d242ec/MS-ASL.zip"
)
_MSASL_ZIP_CACHE = _MODELS_DIR / "MS-ASL.zip"

# Mirror for classes only (fast, no need to download full ZIP just for class list)
_MSASL_CLASSES_MIRROR = (
    "https://raw.githubusercontent.com/iamgarcia/msasl-video-downloader"
    "/master/MSASL_classes.json"
)

_MSASL_TRAIN_CACHE   = _MODELS_DIR / "msasl_train.json"
_MSASL_VAL_CACHE     = _MODELS_DIR / "msasl_val.json"
_MSASL_CLASSES_CACHE = _MODELS_DIR / "msasl_classes.json"

# Mapping: our VNSL gloss names -> MS-ASL English labels (lowercase)
# MS-ASL uses plain English words
VNSL_TO_MSASL = {
    "BAD":       "bad",
    "DRINK":     "drink",
    "EAT":       "eat",
    "FOOD":      "food",
    "GO":        "go",
    "GOOD":      "good",
    "GOODBYE":   "goodbye",
    "HAPPY":     "happy",
    "HEALTHY":   "healthy",
    "HELLO":     "hello",
    "HOME":      "home",
    "HOW_MUCH":  "how much",
    "LIKE":      "like",
    "LOVE":      "love",
    "ME":        "me",
    "MONEY":     "money",
    "NEED":      "need",
    "NO":        "no",
    "NOW":       "now",
    "PHONE":     "phone",
    "SAD":       "sad",
    "SCHOOL":    "school",
    "SORRY":     "sorry",
    "STUDY":     "study",
    "THANK_YOU": "thank you",
    "THEY":      "they",
    "TIRED":     "tired",
    "TODAY":     "today",
    "TOMORROW":  "tomorrow",
    "WANT":      "want",
    "WATER":     "water",
    "WE":        "we",
    "WHAT":      "what",
    "WHEN":      "when",
    "WHERE":     "where",
    "WHO":       "who",
    "WHY":       "why",
    "WORK":      "work",
    "YES":       "yes",
    "YESTERDAY": "yesterday",
    "YOU":       "you",
}


def _fetch_json(url: str, cache_path: Path) -> list | dict:
    _MODELS_DIR.mkdir(exist_ok=True)
    if not cache_path.exists() and url:
        print(f"  Downloading {cache_path.name} ...", flush=True)
        try:
            urllib.request.urlretrieve(url, cache_path)
            print(f"  Saved -> {cache_path}")
        except Exception as e:
            print(f"  ERROR: {e}")
            raise
    return json.loads(cache_path.read_text(encoding="utf-8"))


def _extract_zip_if_needed():
    """Download and extract MS-ASL.zip if train/val JSONs not yet extracted."""
    if _MSASL_TRAIN_CACHE.exists() and _MSASL_VAL_CACHE.exists():
        return

    _MODELS_DIR.mkdir(exist_ok=True)
    if not _MSASL_ZIP_CACHE.exists():
        print("Downloading MS-ASL.zip from Microsoft (~80MB) ...", flush=True)
        urllib.request.urlretrieve(_MSASL_ZIP_URL, _MSASL_ZIP_CACHE)
        print(f"  Saved -> {_MSASL_ZIP_CACHE}")

    print("Extracting MS-ASL.zip ...", flush=True)
    import zipfile
    with zipfile.ZipFile(_MSASL_ZIP_CACHE, "r") as zf:
        for name in zf.namelist():
            fname = Path(name).name
            if fname in ("MSASL_train.json", "MSASL_val.json",
                         "MSASL_test.json", "MSASL_classes.json"):
                dest = _MODELS_DIR / fname
                dest.write_bytes(zf.read(name))
                print(f"  Extracted -> {dest}")


def _load_msasl() -> tuple[list, list]:
    """Load train + val splits. Returns (all_clips, class_list)."""
    print("Loading MS-ASL dataset ...")
    _extract_zip_if_needed()

    train   = _fetch_json("", _MSASL_TRAIN_CACHE)
    val     = _fetch_json("", _MSASL_VAL_CACHE)

    # Classes: try cache first, then mirror
    if not _MSASL_CLASSES_CACHE.exists():
        _fetch_json(_MSASL_CLASSES_MIRROR, _MSASL_CLASSES_CACHE)
    classes = json.loads(_MSASL_CLASSES_CACHE.read_text(encoding="utf-8"))

    all_clips = train + val
    print(f"  {len(all_clips)} total clips, {len(classes)} classes")
    return all_clips, classes


def _group_by_word(clips: list, classes: list) -> dict[str, list]:
    """Group clips by word label. Returns {word: [clip, ...]}."""
    # classes is a list of word strings, index = label int
    groups = defaultdict(list)
    for clip in clips:
        label = clip.get("label")
        if label is not None and label < len(classes):
            word = classes[label].lower().strip()
        else:
            word = clip.get("clean_text", clip.get("org_text", "")).lower().strip()
        if word:
            groups[word].append(clip)
    return groups


def _check_ffmpeg() -> bool:
    try:
        r = subprocess.run(
            ["ffmpeg", "-version"], capture_output=True, timeout=5
        )
        return r.returncode == 0
    except Exception:
        return False


def _download_clip(
    clip: dict,
    gloss: str,
    output_dir: Path,
) -> bool:
    """
    Download one MS-ASL clip using yt-dlp + ffmpeg trim.
    Returns True on success.
    """
    try:
        import yt_dlp
    except ImportError:
        print("  ERROR: pip install yt-dlp")
        return False

    url        = clip.get("url", "")
    start_time = float(clip.get("start_time", 0))
    end_time   = float(clip.get("end_time", start_time + 3))
    duration   = end_time - start_time

    if duration <= 0 or duration > 10:
        return False  # skip bad timestamps

    out_path = output_dir / f"{gloss}.mp4"
    raw_path = output_dir / f"{gloss}_raw.mp4"

    # Download raw video (format 18 = 360p muxed mp4, no ffmpeg merge needed for download)
    dl_opts = {
        "format":   "18/best[ext=mp4]/best",
        "outtmpl":  str(output_dir / f"{gloss}_raw.%(ext)s"),
        "quiet":    True,
        "no_warnings": True,
        "socket_timeout": 30,
        "retries":  2,
        "overwrites": True,
    }
    try:
        with yt_dlp.YoutubeDL(dl_opts) as ydl:
            ydl.download([url])
    except Exception as e:
        err = str(e)[:60].encode("ascii", "replace").decode()
        print(f" yt-dlp: {err}", end="", flush=True)
        return False

    # Find the raw downloaded file
    raw_files = list(output_dir.glob(f"{gloss}_raw.*"))
    if not raw_files:
        return False
    raw = raw_files[0]

    # Add small buffer around the sign
    t_start = max(0.0, start_time - 0.3)
    t_dur   = min(duration + 0.6, 8.0)

    # Trim with ffmpeg
    result = subprocess.run(
        [
            "ffmpeg", "-y",
            "-ss", f"{t_start:.3f}",
            "-i", str(raw),
            "-t", f"{t_dur:.3f}",
            "-vf", "scale=640:480:force_original_aspect_ratio=decrease,"
                   "pad=640:480:(ow-iw)/2:(oh-ih)/2",
            "-c:v", "libx264", "-crf", "22", "-preset", "fast",
            "-an",  # no audio needed
            str(out_path),
        ],
        capture_output=True, timeout=30,
    )
    raw.unlink(missing_ok=True)

    if result.returncode != 0 or not out_path.exists():
        return False
    if out_path.stat().st_size < 20_000:
        out_path.unlink(missing_ok=True)
        return False
    return True


def _is_real_video(path: Path) -> bool:
    if not path.exists() or path.stat().st_size < 50_000:
        return False
    try:
        import cv2
        cap = cv2.VideoCapture(str(path))
        ok, frame = cap.read()
        cap.release()
        return ok and frame is not None and frame.mean() > 5
    except Exception:
        return path.stat().st_size > 100_000


def download_all(
    target: dict[str, str],   # {GLOSS: msasl_word}
    output_dir: Path,
    force: bool,
    clips_per_word: int,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    if not _check_ffmpeg():
        print("ERROR: ffmpeg not found in PATH.")
        print("Install: winget install Gyan.FFmpeg  (then restart terminal)")
        sys.exit(1)

    clips_all, classes = _load_msasl()
    groups = _group_by_word(clips_all, classes)

    ok = skipped = failed = not_found = 0

    for gloss, msasl_word in sorted(target.items()):
        out_path = output_dir / f"{gloss}.mp4"

        if not force and _is_real_video(out_path):
            print(f"  SKIP  {gloss} (real video exists)")
            skipped += 1
            continue

        clips = groups.get(msasl_word, [])
        if not clips:
            print(f"  NOT FOUND  {gloss} ('{msasl_word}' not in MS-ASL)")
            not_found += 1
            continue

        # Sort by duration quality: prefer clips ~2-5s
        def score(c):
            d = float(c.get("end_time", 0)) - float(c.get("start_time", 0))
            return abs(d - 3.0)  # closest to 3s wins

        clips_sorted = sorted(clips, key=score)
        print(f"  DOWNLOAD  {gloss} ({len(clips)} clips) ", end="", flush=True)

        success = False
        for clip in clips_sorted[:clips_per_word]:
            print(".", end="", flush=True)
            try:
                success = _download_clip(clip, gloss, output_dir)
            except Exception as e:
                success = False
            if success:
                break
            time.sleep(0.5)

        if success:
            print(f" OK")
            ok += 1
        else:
            print(f" FAILED")
            failed += 1

        time.sleep(1.0)

    print(f"\nDone: {ok} downloaded, {skipped} skipped, "
          f"{not_found} not in MS-ASL, {failed} failed")
    if ok > 0:
        print("\nNext step: python pipeline/batch_extract.py --force")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output",         type=Path, default=_DEFAULT_OUTPUT)
    parser.add_argument("--glosses",        nargs="+")
    parser.add_argument("--limit",          type=int, default=None)
    parser.add_argument("--all",            action="store_true",
                        help="Download all 1000 MS-ASL words (not just 41 targets)")
    parser.add_argument("--force",          action="store_true")
    parser.add_argument("--clips-per-word", type=int, default=5, dest="clips_per_word")
    args = parser.parse_args()

    if args.all:
        # Load classes and build full mapping: UPPERCASE_WORD -> msasl_word
        _MODELS_DIR.mkdir(exist_ok=True)
        classes = _fetch_json(_MSASL_CLASSES_URL, _MSASL_CLASSES_CACHE)
        # Gloss name: uppercase, spaces -> underscore
        target = {
            w.upper().replace(" ", "_"): w.lower()
            for w in classes
        }
        print(f"Mode: ALL {len(target)} MS-ASL words")
    else:
        target = dict(VNSL_TO_MSASL)
        if args.glosses:
            target = {k: v for k, v in target.items() if k in args.glosses}
            unknown = set(args.glosses) - set(VNSL_TO_MSASL)
            if unknown:
                print(f"WARNING: Unknown glosses: {unknown}")
        if args.limit:
            target = dict(list(target.items())[:args.limit])

    if not target:
        print("No glosses to download.")
        sys.exit(1)

    print(f"Downloading {len(target)} MS-ASL sign videos -> {args.output}")
    print("Source: MS-ASL dataset (Microsoft, 1000 ASL signs)")
    print("Note: ASL videos, not VNSL - for pipeline testing\n")

    download_all(target, args.output, force=args.force,
                 clips_per_word=args.clips_per_word)


if __name__ == "__main__":
    main()
