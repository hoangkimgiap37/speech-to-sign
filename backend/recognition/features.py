"""
features.py — Convert landmark frame sequences into fixed-size feature vectors

Feature design (39 floats/frame, scale-invariant):
  - 6 pose joints × 3 coords = 18  (shoulders, elbows, wrists)
  - Dominant hand 7 landmarks × 3  = 21  (wrist + 4 fingertips + index MCP)

All coordinates normalised by torso width so the classifier is
independent of camera distance and person size.

For sequence-level classification, `sequence_to_features` pads/truncates
to T=60 frames and also appends global statistics (mean, std, max range)
giving a rich descriptor even for simple classifiers like Random Forest.
"""
from typing import List, Optional

try:
    import numpy as np
except ImportError:
    raise ImportError("pip install numpy")

# Pose joint key names (must match landmark JSON schema)
POSE_JOINTS = [
    "right_shoulder", "right_elbow", "right_wrist",
    "left_shoulder",  "left_elbow",  "left_wrist",
]

# Hand landmark indices: wrist(0) + fingertips(4,8,12,16,20) + index MCP(5)
HAND_INDICES = [0, 4, 5, 8, 12, 16, 20]

FRAME_DIM  = len(POSE_JOINTS) * 3 + len(HAND_INDICES) * 3   # = 39
SEQ_LEN    = 60   # fixed temporal window


def _torso_width(pose: dict) -> float:
    rs = pose.get("right_shoulder", {})
    ls = pose.get("left_shoulder",  {})
    if not rs or not ls:
        return 1.0
    return abs(rs.get("x", 0.5) - ls.get("x", 0.5)) + 1e-6


def frame_to_vector(frame: dict) -> Optional[np.ndarray]:
    """
    Convert a single landmark frame dict → 39-float numpy vector.
    Returns None if pose is missing.
    """
    pose = frame.get("pose")
    if not pose:
        return None

    tw = _torso_width(pose)
    feats = []

    # 6 pose joints
    for joint in POSE_JOINTS:
        p = pose.get(joint)
        if p:
            feats.extend([
                (p.get("x", 0.5) - 0.5) / tw,
                (p.get("y", 0.5) - 0.5) / tw,
                p.get("z", 0.0) / tw,
            ])
        else:
            feats.extend([0.0, 0.0, 0.0])

    # Dominant hand (prefer right; fall back to left)
    hand = frame.get("right_hand") or frame.get("left_hand") or []
    for idx in HAND_INDICES:
        if idx < len(hand):
            p = hand[idx]
            feats.extend([
                (p[0] - 0.5) / tw,
                (p[1] - 0.5) / tw,
                p[2] / tw,
            ])
        else:
            feats.extend([0.0, 0.0, 0.0])

    return np.array(feats, dtype=np.float32)


def sequence_to_tensor(frames: List[dict], T: int = SEQ_LEN) -> np.ndarray:
    """
    Pad/truncate a frame sequence to exactly T frames.
    Shape: (T, FRAME_DIM)
    """
    vecs = [frame_to_vector(f) for f in frames]
    vecs = [v for v in vecs if v is not None]

    if not vecs:
        return np.zeros((T, FRAME_DIM), dtype=np.float32)

    arr = np.stack(vecs)            # (n, 39)

    if len(arr) >= T:
        # Uniform sub-sampling to T frames
        indices = np.round(np.linspace(0, len(arr) - 1, T)).astype(int)
        return arr[indices]
    else:
        # Pad with last frame
        pad = np.tile(arr[-1:], (T - len(arr), 1))
        return np.vstack([arr, pad]).astype(np.float32)


def sequence_to_flat(frames: List[dict]) -> np.ndarray:
    """
    Global statistics descriptor — suitable for Random Forest (no sequence modelling).
    Shape: (FRAME_DIM * 3,) = mean + std + range  →  117 floats
    """
    tensor = sequence_to_tensor(frames)  # (T, 39)
    mean   = tensor.mean(axis=0)
    std    = tensor.std(axis=0)
    rng    = tensor.max(axis=0) - tensor.min(axis=0)
    return np.concatenate([mean, std, rng]).astype(np.float32)
