"""
extract_landmarks.py — MediaPipe Tasks API extractor (mediapipe >= 0.10)

Reads an MP4 video and emits a structured JSON of per-frame landmark data
covering 6 arm/shoulder pose joints + 21 hand landmarks per hand.

Model files (.task) are auto-downloaded on first run to pipeline/models/.

Usage:
    python extract_landmarks.py <video_path> <gloss_name> [output_path]
"""
import json
import sys
import urllib.request
from pathlib import Path

try:
    import cv2
except ImportError:
    print("ERROR: pip install opencv-python-headless", file=sys.stderr)
    sys.exit(1)

try:
    import mediapipe as mp
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision
    from mediapipe.tasks.python.core.base_options import BaseOptions
except ImportError:
    print("ERROR: pip install mediapipe", file=sys.stderr)
    sys.exit(1)

# ── Model files ────────────────────────────────────────────────────────────────

_MODELS_DIR = Path(__file__).parent / "models"

_POSE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task"
)
_HAND_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
)

_POSE_MODEL_PATH = _MODELS_DIR / "pose_landmarker_lite.task"
_HAND_MODEL_PATH = _MODELS_DIR / "hand_landmarker.task"


def _ensure_models():
    _MODELS_DIR.mkdir(exist_ok=True)
    for url, path in [(_POSE_MODEL_URL, _POSE_MODEL_PATH), (_HAND_MODEL_URL, _HAND_MODEL_PATH)]:
        if not path.exists():
            print(f"  Downloading model: {path.name} ...", file=sys.stderr)
            try:
                urllib.request.urlretrieve(url, path)
                print(f"  Saved → {path}", file=sys.stderr)
            except Exception as e:
                print(f"  ERROR downloading {url}: {e}", file=sys.stderr)
                raise


# ── Pose joint indices (MediaPipe 33-point body model) ─────────────────────────

POSE_INDICES = {
    "right_shoulder": 12,
    "right_elbow":    14,
    "right_wrist":    16,
    "left_shoulder":  11,
    "left_elbow":     13,
    "left_wrist":     15,
    "right_hip":      24,
    "left_hip":       23,
}


# ── Core extractor ─────────────────────────────────────────────────────────────

def extract(video_path: str, gloss: str, verbose: bool = False) -> dict:
    """
    Extract pose + hand landmarks from a video file using MediaPipe Tasks API.
    Returns a dict ready to be serialised as JSON.
    """
    _ensure_models()

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {video_path}")

    fps         = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()

    # ── Build landmarkers ──────────────────────────────────────────────────────
    pose_options = mp_vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(_POSE_MODEL_PATH)),
        running_mode=mp_vision.RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )
    hand_options = mp_vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(_HAND_MODEL_PATH)),
        running_mode=mp_vision.RunningMode.VIDEO,
        num_hands=2,
        min_hand_detection_confidence=0.5,
        min_hand_presence_confidence=0.5,
        min_tracking_confidence=0.5,
    )

    frames = []
    idx    = 0
    valid  = 0

    cap = cv2.VideoCapture(video_path)

    with (
        mp_vision.PoseLandmarker.create_from_options(pose_options) as pose_lm,
        mp_vision.HandLandmarker.create_from_options(hand_options) as hand_lm,
    ):
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            rgb       = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image  = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            ts_ms     = int(idx / fps * 1000)

            pose_result = pose_lm.detect_for_video(mp_image, ts_ms)
            hand_result = hand_lm.detect_for_video(mp_image, ts_ms)

            # ── Pose joints ────────────────────────────────────────────────────
            pose_data = None
            if pose_result.pose_landmarks:
                lm = pose_result.pose_landmarks[0]   # first (only) person
                pose_data = {
                    name: {
                        "x":          float(lm[i].x),
                        "y":          float(lm[i].y),
                        "z":          float(lm[i].z),
                        "visibility": float(lm[i].visibility),
                    }
                    for name, i in POSE_INDICES.items()
                }
                valid += 1

            # ── Hand landmarks ─────────────────────────────────────────────────
            right_hand = None
            left_hand  = None

            if hand_result.hand_landmarks and hand_result.handedness:
                for hand_lms, handedness in zip(
                    hand_result.hand_landmarks, hand_result.handedness
                ):
                    coords = [[float(p.x), float(p.y), float(p.z)] for p in hand_lms]
                    # MediaPipe handedness label is from the model's perspective
                    # (mirrored) — we store as-labelled; retarget.py handles side logic
                    label = handedness[0].category_name  # "Left" or "Right"
                    if label == "Right":
                        right_hand = coords
                    else:
                        left_hand  = coords

            frames.append({
                "frame_idx":    idx,
                "timestamp_ms": ts_ms,
                "pose":         pose_data,
                "right_hand":   right_hand,
                "left_hand":    left_hand,
            })
            idx += 1

    cap.release()

    valid_pct = valid / max(idx, 1) * 100
    if verbose:
        print(f"  {gloss}: {idx} frames, {valid} valid pose ({valid_pct:.0f}%)")

    if valid_pct < 30:
        print(
            f"  WARNING: {gloss} only {valid_pct:.0f}% valid pose frames — "
            "check lighting/camera angle",
            file=sys.stderr,
        )

    return {
        "gloss":             gloss,
        "source_video":      str(video_path),
        "fps":               float(fps),
        "frame_count":       idx,
        "valid_pose_frames": valid,
        "frames":            frames,
    }


def main():
    if len(sys.argv) < 3:
        print("Usage: python extract_landmarks.py <video_path> <gloss> [output_path]")
        sys.exit(1)

    video_path = sys.argv[1]
    gloss      = sys.argv[2].upper()
    out_path   = sys.argv[3] if len(sys.argv) > 3 else None

    data = extract(video_path, gloss, verbose=True)

    if out_path:
        Path(out_path).write_text(json.dumps(data, indent=2), encoding="utf-8")
        print(f"  Saved → {out_path}")
    else:
        # Print summary only to avoid flooding terminal
        print(json.dumps({k: v for k, v in data.items() if k != "frames"}, indent=2))
        print(f"  (frames omitted — use output_path to save full JSON)")


if __name__ == "__main__":
    main()
