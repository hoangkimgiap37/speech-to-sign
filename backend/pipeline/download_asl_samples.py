"""
download_asl_samples.py — Download ASL sign videos via YouTube search (Option C)

Searches YouTube for "<word> ASL sign language" and downloads the first result
per gloss, saved as <GLOSS>.mp4 in the output directory.

ASL and VNSL share many of the same root glosses for basic vocabulary, so these
videos are suitable for testing the landmark extraction pipeline.

Usage:
    cd backend/
    python pipeline/download_asl_samples.py [--output DIR] [--glosses G1 G2 ...]

Flags:
    --output   Where to save videos (default: ../frontend/public/videos)
    --glosses  Only download specific glosses (default: all 41 target glosses)
    --limit    Max videos to download (default: all)
    --force    Re-download even if file exists
    --max-dur  Max video duration in seconds to accept (default: 120)
"""
import argparse
import sys
import time
from pathlib import Path

_HERE    = Path(__file__).parent
_BACKEND = _HERE.parent

# Default output: replace the placeholder test clips
_DEFAULT_OUTPUT = _BACKEND.parent / "frontend" / "public" / "videos"

# Our 41 target glosses → search terms
TARGET_GLOSSES = {
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

# Search query template — short dictionary-style videos are best for landmark extraction
_SEARCH_TMPL = "{word} ASL sign language"

# Prefer short clips (dictionary videos are usually 5–30s)
# Reject anything over this duration to avoid downloading full lessons
_MAX_DURATION = 120  # seconds


def _is_real_video(path: Path) -> bool:
    """Return True if path exists and is a non-trivial video file."""
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


def _download_via_search(
    word: str,
    gloss: str,
    output_dir: Path,
    max_dur: int,
) -> bool:
    """
    Search YouTube for `word ASL sign language` and download the best short result.
    Returns True on success.
    """
    try:
        import yt_dlp
    except ImportError:
        print("  ERROR: yt-dlp not installed. Run: pip install yt-dlp")
        return False

    out_path = output_dir / f"{gloss}.mp4"
    query    = _SEARCH_TMPL.format(word=word)

    # yt-dlp options — search YouTube, pick first result ≤ max_dur seconds
    ydl_opts = {
        "format": (
            "bestvideo[ext=mp4][height<=480]+bestaudio[ext=m4a]"
            "/best[ext=mp4][height<=480]"
            "/best[ext=mp4]"
            "/best"
        ),
        "outtmpl":     str(output_dir / f"{gloss}.%(ext)s"),
        "quiet":       True,
        "no_warnings": True,
        "merge_output_format": "mp4",
        "socket_timeout": 30,
        "retries": 2,
        # Match filter: reject overly long videos (full ASL courses, etc.)
        "match_filter": yt_dlp.utils.match_filter_func(f"duration < {max_dur}"),
        # Search: first 5 results, pick best match
        "default_search": f"ytsearch5",
        # Postprocessors: convert to mp4 if needed
        "postprocessors": [{
            "key": "FFmpegVideoConvertor",
            "preferedformat": "mp4",
        }],
    }

    # Search up to 10 results and try each until one downloads successfully
    search_url = f"ytsearch10:{query}"

    try:
        with yt_dlp.YoutubeDL({**ydl_opts, "quiet": True, "ignoreerrors": True}) as ydl:
            info = ydl.extract_info(search_url, download=False)
    except Exception as e:
        print(f"  search error: {e}")
        return False

    if not info or "entries" not in info:
        print(f"  no search results")
        return False

    candidates = [
        e for e in info["entries"]
        if e and (e.get("duration") or 999) <= max_dur
    ]
    if not candidates:
        print(f"  no results under {max_dur}s")
        return False

    for entry in candidates[:5]:
        url        = entry.get("webpage_url") or entry.get("url")
        title_safe = entry.get('title', '?')[:55].encode('ascii', 'replace').decode()
        dur        = entry.get("duration", "?")
        print(f"\n     trying: {title_safe} ({dur}s) ... ", end="", flush=True)

        dl_opts = {
            # Prefer pre-muxed mp4 (format 18 = 360p mp4 with audio, no ffmpeg needed).
            # Fallback to any single-file format. Avoid dash-only streams that require merging.
            "format": (
                "18"                              # YouTube 360p muxed mp4 (most reliable)
                "/best[ext=mp4][height<=480]"     # any muxed mp4 ≤480p
                "/best[ext=mp4]"                  # any muxed mp4
                "/best[height<=480]"              # any muxed ≤480p
                "/best"                           # absolute fallback
            ),
            "outtmpl":        str(output_dir / f"{gloss}.%(ext)s"),
            "quiet":          True,
            "no_warnings":    True,
            "socket_timeout": 30,
            "retries":        2,
            "overwrites":     True,   # overwrite existing placeholder files
        }
        try:
            with yt_dlp.YoutubeDL(dl_opts) as ydl2:
                ydl2.download([url])
            # Check output exists
            mp4 = output_dir / f"{gloss}.mp4"
            if mp4.exists() and mp4.stat().st_size > 50_000:
                print("ok")
                return True
            # Check for other extensions
            for c in output_dir.glob(f"{gloss}.*"):
                if c.suffix != ".mp4" and c.stat().st_size > 50_000:
                    c.rename(mp4)
                    print("ok (renamed)")
                    return True
            print("file too small, trying next")
        except Exception as e:
            err = str(e)[:80].encode('ascii', 'replace').decode()
            print(f"failed ({err}), trying next")

    return False

    # Check result — yt-dlp may have written .mp4 or .webm etc.
    candidates = list(output_dir.glob(f"{gloss}.*"))
    mp4 = output_dir / f"{gloss}.mp4"
    if mp4.exists() and mp4.stat().st_size > 50_000:
        return True
    # Rename if different extension
    for c in candidates:
        if c.suffix != ".mp4" and c.stat().st_size > 50_000:
            c.rename(mp4)
            return True
    return False


def download_all(
    target_glosses: dict,
    output_dir: Path,
    limit: int | None,
    force: bool,
    max_dur: int,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    glosses = list(target_glosses.items())
    if limit:
        glosses = glosses[:limit]

    ok = skipped = failed = 0

    for gloss, word in glosses:
        out_path = output_dir / f"{gloss}.mp4"

        if not force and _is_real_video(out_path):
            print(f"  SKIP     {gloss} (already has real video)")
            skipped += 1
            continue

        print(f"  SEARCH   {gloss} <- \"{word} ASL sign language\" ... ", end="", flush=True)
        try:
            success = _download_via_search(word, gloss, output_dir, max_dur)
        except Exception as e:
            print(f"ERROR: {e}")
            success = False

        if success:
            print(f"  OK -> {out_path.name}")
            ok += 1
        else:
            print(f"  FAILED   {gloss}")
            failed += 1

        time.sleep(1.5)   # polite gap between requests

    print(f"\nDone: {ok} downloaded, {skipped} skipped, {failed} failed")
    if ok > 0:
        print(f"\nNext step: cd backend && python pipeline/batch_extract.py")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output",   type=Path, default=_DEFAULT_OUTPUT)
    parser.add_argument("--glosses",  nargs="+", help="Subset of glosses to download")
    parser.add_argument("--limit",    type=int,  default=None)
    parser.add_argument("--force",    action="store_true")
    parser.add_argument("--max-dur",  type=int,  default=_MAX_DURATION,
                        dest="max_dur", help="Max video duration in seconds")
    args = parser.parse_args()

    target = TARGET_GLOSSES
    if args.glosses:
        target = {k: v for k, v in TARGET_GLOSSES.items() if k in args.glosses}
        unknown = set(args.glosses) - set(TARGET_GLOSSES)
        if unknown:
            print(f"WARNING: Unknown glosses: {unknown}")

    if not target:
        print("No glosses to download.")
        sys.exit(1)

    print(f"Downloading {len(target)} ASL sign videos -> {args.output}")
    print(f"Method: YouTube search (yt-dlp), max duration {args.max_dur}s")
    print("Note: Videos are ASL, not VNSL - for pipeline testing only\n")

    download_all(target, args.output, limit=args.limit, force=args.force, max_dur=args.max_dur)


if __name__ == "__main__":
    main()
