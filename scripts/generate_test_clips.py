"""
Generate placeholder test video clips for VNSL glosses.
Produces browser-compatible H.264 MP4 via imageio-ffmpeg.

Requires: pip install opencv-python numpy imageio imageio-ffmpeg

Usage:
    python scripts/generate_test_clips.py
    python scripts/generate_test_clips.py --glosses HELLO GOODBYE THANK_YOU
"""

import argparse
import os
import sys

try:
    import cv2
    import numpy as np
except ImportError:
    print("ERROR: pip install opencv-python numpy")
    sys.exit(1)

try:
    import imageio
    HAS_IMAGEIO = True
except ImportError:
    HAS_IMAGEIO = False

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(ROOT, "frontend", "public", "videos")

DEFAULT_GLOSSES = [
    "HELLO", "GOODBYE", "THANK_YOU", "SORRY",
    "YES", "NO",
    "ME", "YOU", "WE", "THEY",
    "EAT", "DRINK", "GO", "WORK", "STUDY", "LOVE", "LIKE", "WANT", "NEED",
    "GOOD", "BAD", "HAPPY", "SAD", "HEALTHY", "TIRED",
    "TODAY", "TOMORROW", "YESTERDAY", "NOW",
    "WHAT", "WHERE", "WHEN", "WHY", "WHO", "HOW_MUCH",
    "HOME", "SCHOOL", "FOOD", "WATER", "PHONE", "MONEY",
]

PALETTE = [
    (31,  97, 141),
    (30, 132,  73),
    (125,  60, 152),
    (176,  58,  46),
    (175,  96,  26),
    (23,  115, 115),
    (100,  30, 102),
]

W, H, FPS, DURATION = 640, 368, 25, 2  # 368 divisible by 16 (H.264 macroblock requirement)


def build_frames(gloss: str, color_rgb: tuple) -> list:
    r, g, b = color_rgb
    bgr_light = (b, g, r)
    bgr_dark  = (b // 2, g // 2, r // 2)
    font      = cv2.FONT_HERSHEY_DUPLEX
    scale, thickness = 2.0, 2
    total, fade = FPS * DURATION, 6
    frames = []

    for n in range(total):
        frame = np.full((H, W, 3), bgr_dark, dtype=np.uint8)

        pad_x, pad_y = 60, 100
        cv2.rectangle(frame, (pad_x, pad_y), (W - pad_x, H - pad_y), bgr_light, -1)
        cv2.rectangle(frame, (pad_x, pad_y), (W - pad_x, H - pad_y), (255, 255, 255), 2)

        (tw, th), _ = cv2.getTextSize(gloss, font, scale, thickness)
        tx, ty = (W - tw) // 2, (H + th) // 2
        cv2.putText(frame, gloss, (tx + 2, ty + 2), font, scale, (0, 0, 0), thickness + 2, cv2.LINE_AA)
        cv2.putText(frame, gloss, (tx, ty), font, scale, (255, 255, 255), thickness, cv2.LINE_AA)
        cv2.putText(frame, "TEST CLIP", (8, H - 8), cv2.FONT_HERSHEY_PLAIN, 1.0, (120, 120, 120), 1, cv2.LINE_AA)

        alpha = min(1.0, n / fade, (total - 1 - n) / fade)
        if alpha < 1.0:
            frame = (frame * alpha).astype(np.uint8)

        frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

    return frames


def write_h264(frames: list, out_path: str) -> bool:
    """Write H.264 MP4 via imageio-ffmpeg (browser-compatible)."""
    try:
        writer = imageio.get_writer(
            out_path, fps=FPS, codec="libx264", pixelformat="yuv420p",
            output_params=["-crf", "28"],
        )
        for f in frames:
            writer.append_data(f)
        writer.close()
        return True
    except Exception as e:
        print(f"    imageio error: {e}")
        return False


def write_mp4v(frames: list, out_path: str) -> bool:
    """Fallback: MPEG-4 Part 2 via OpenCV (limited browser support)."""
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    w = cv2.VideoWriter(out_path, fourcc, FPS, (W, H))
    if not w.isOpened():
        return False
    for f in frames:
        w.write(cv2.cvtColor(f, cv2.COLOR_RGB2BGR))
    w.release()
    return True


def make_clip(gloss: str, out_path: str, color_rgb: tuple) -> bool:
    frames = build_frames(gloss, color_rgb)
    if HAS_IMAGEIO and write_h264(frames, out_path):
        return True
    print(f"    falling back to mp4v for {gloss}")
    return write_mp4v(frames, out_path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--glosses", nargs="+", default=DEFAULT_GLOSSES)
    parser.add_argument("--out", default=OUTPUT_DIR)
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    total, ok = len(args.glosses), 0

    codec = "H.264 (imageio-ffmpeg)" if HAS_IMAGEIO else "mp4v fallback"
    print(f"Generating {total} test clips [{codec}] -> {args.out}\n")

    for i, gloss in enumerate(args.glosses):
        color = PALETTE[i % len(PALETTE)]
        out_path = os.path.join(args.out, f"{gloss}.mp4")
        success = make_clip(gloss, out_path, color)
        print(f"  [{i+1:2d}/{total}] {gloss:<20} {'OK' if success else 'FAIL'}")
        if success:
            ok += 1

    print(f"\n{ok}/{total} clips created in {args.out}")


if __name__ == "__main__":
    main()
