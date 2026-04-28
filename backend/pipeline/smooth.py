"""
smooth.py — Savitzky-Golay smoothing + intelligent keyframe decimation

Reduces raw 30fps pose sequences to ~6 keyframes suitable for glosses.js,
while preserving the most visually important motion moments.
"""
import copy
import math
from typing import List

try:
    import numpy as np
    from scipy.signal import savgol_filter
except ImportError:
    raise ImportError("Install: pip install numpy scipy")

JOINTS = ["rightShoulder", "rightElbow", "rightWrist", "leftShoulder", "leftElbow", "leftWrist"]
AXES   = ["x", "y", "z"]

# Joints that carry most of the visual weight for keyframe selection
_KEY_JOINTS = ["rightShoulder", "rightElbow", "leftShoulder", "leftElbow"]
_KEY_AXES   = ["x", "z"]


def _smooth_channel(values: List[float], window: int = 11, poly: int = 2) -> List[float]:
    """Apply Savitzky-Golay smoothing to a single angle channel."""
    n = len(values)
    if n < 5:
        return values
    w = min(window, n if n % 2 == 1 else n - 1)
    if w < 3:
        return values
    smoothed = savgol_filter(values, window_length=w, polyorder=min(poly, w - 1))
    return [round(float(v), 1) for v in smoothed]


def smooth_poses(poses: List[dict]) -> List[dict]:
    """
    Apply per-channel Savitzky-Golay smoothing to a sequence of pose dicts.
    Returns a new list (does not mutate input).
    """
    if len(poses) < 3:
        return poses

    result = copy.deepcopy(poses)

    for joint in JOINTS:
        for axis in AXES:
            channel = [p["pose"][joint][axis] for p in result]
            smoothed = _smooth_channel(channel)
            for i, p in enumerate(result):
                p["pose"][joint][axis] = smoothed[i]

    return result


def _frame_score(poses: List[dict], i: int) -> float:
    """
    Score a frame by its angular velocity (sum of absolute delta to neighbours).
    Higher score = more motion = more important to keep.
    """
    if i == 0 or i >= len(poses) - 1:
        return float("inf")  # always keep first and last

    prev = poses[i - 1]["pose"]
    curr = poses[i]["pose"]
    nxt  = poses[i + 1]["pose"]

    score = 0.0
    for joint in _KEY_JOINTS:
        for axis in _KEY_AXES:
            delta_back    = abs(curr[joint][axis] - prev[joint][axis])
            delta_forward = abs(curr[joint][axis] - nxt[joint][axis])
            score += delta_back + delta_forward
    return score


def decimate(poses: List[dict], target: int = 6) -> List[dict]:
    """
    Reduce a pose sequence to `target` keyframes.
    Always keeps first and last; fills remaining slots with highest-motion frames.
    """
    n = len(poses)
    if n <= target:
        return poses

    # Score each frame (first/last get inf, so they're always chosen)
    scored = sorted(range(n), key=lambda i: _frame_score(poses, i), reverse=True)

    kept = set(scored[:target])
    return [poses[i] for i in sorted(kept)]


def smooth_and_decimate(poses: List[dict], target: int = 6) -> List[dict]:
    """Apply smoothing then decimate to target keyframe count."""
    if not poses:
        return poses
    smoothed = smooth_poses(poses)
    return decimate(smoothed, target=target)
