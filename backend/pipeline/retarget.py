"""
retarget.py — Convert MediaPipe landmark sequences → Three.js Euler angle keyframes

MediaPipe coordinate space:
  - x, y normalised to [0,1] in image space (y increases downward)
  - z is depth relative to hip midpoint (negative = closer to camera)

Three.js skeleton convention (from glosses.js header):
  - shoulder.x negative → arm raises FORWARD
  - shoulder.z negative → RIGHT arm raises OUTWARD; positive → inward
  - shoulder.z positive → LEFT  arm raises OUTWARD; negative → inward
  - elbow.z    negative → right forearm swings INWARD (arm curls toward chest)
  - elbow.x    negative → forearm raises forward relative to upper arm

All output angles are in degrees.
"""
import math
from typing import Optional

try:
    import numpy as np
except ImportError:
    raise ImportError("Install numpy: pip install numpy")


# ── Vector helpers ─────────────────────────────────────────────────────────────

def _v(p: dict) -> np.ndarray:
    """Landmark dict → [x, -y, z]  (flip Y: image-space → right-hand Y-up)."""
    return np.array([p["x"], -p["y"], p["z"]], dtype=float)


def _norm(v: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(v)
    return v / (n + 1e-8)


def _deg(rad: float) -> float:
    return round(math.degrees(rad), 1)


# ── Angle decomposition ────────────────────────────────────────────────────────

def _shoulder_angles(shoulder: np.ndarray, elbow: np.ndarray, side: str) -> dict:
    """
    Compute shoulder Euler (x, z) from upper arm direction.

    Upper arm vector = elbow - shoulder, expressed in body frame where:
      Y-axis = up (spine direction)
      X-axis = left→right
      Z-axis = back→front
    """
    upper = _norm(elbow - shoulder)

    # shoulder.x: forward raise
    #   When arm is at rest (hanging down): upper.y ≈ -1, upper.z ≈ 0
    #   When arm raises forward: upper.z becomes positive, upper.y less negative
    angle_x = _deg(math.atan2(-upper[2], -upper[1]))

    # shoulder.z: lateral raise (outward)
    #   For RIGHT arm: outward means x decreasing (more negative in image space)
    #   For LEFT arm:  outward means x increasing
    sz = 1.0 if side == "right" else -1.0
    angle_z = _deg(math.atan2(sz * upper[0], -upper[1]))

    # Clamp to reasonable range
    angle_x = max(-80.0, min(20.0, angle_x))
    angle_z = max(-60.0, min(60.0, sz * abs(angle_z)) * sz)

    return {"x": angle_x, "y": 0.0, "z": angle_z}


def _elbow_angles(
    shoulder: np.ndarray, elbow: np.ndarray, wrist: np.ndarray, side: str
) -> dict:
    """
    Compute elbow Euler (x, z) — forearm angle relative to upper arm.

    elbow.z (negative for right) = forearm swings inward (toward chest).
    elbow.x (negative) = forearm raises forward.
    """
    upper = _norm(elbow - shoulder)
    forearm = _norm(wrist - elbow)

    # Project forearm onto plane perpendicular to upper arm
    proj = forearm - np.dot(forearm, upper) * upper
    proj_norm = _norm(proj)

    # Build a local frame for the elbow:
    # forward = upper arm × world_X (gets the "forward" direction for this arm)
    world_up = np.array([0.0, 1.0, 0.0])
    world_x  = np.array([1.0 if side == "right" else -1.0, 0.0, 0.0])

    # elbow.z: inward/outward swing
    inward_axis = _norm(np.cross(upper, world_up))
    angle_z = _deg(math.atan2(np.dot(proj_norm, inward_axis), np.dot(proj_norm, upper)))

    # elbow.x: forward bend
    forward_axis = _norm(np.cross(inward_axis, upper))
    angle_x = _deg(math.atan2(np.dot(proj_norm, forward_axis), np.dot(proj_norm, upper)))

    sz = 1.0 if side == "right" else -1.0
    angle_z = max(-80.0, min(80.0, angle_z * sz)) * sz

    return {"x": round(angle_x, 1), "y": 0.0, "z": round(angle_z, 1)}


def _wrist_angles(
    elbow: np.ndarray,
    wrist: np.ndarray,
    hand_landmarks: Optional[list],
    side: str,
) -> dict:
    """
    Estimate wrist rotation from hand landmarks if available.
    Uses landmarks 0 (wrist), 5 (index MCP), 17 (pinky MCP).
    Falls back to zero rotation if hand landmarks are missing.
    """
    if not hand_landmarks or len(hand_landmarks) < 21:
        return {"x": 0.0, "y": 0.0, "z": 0.0}

    lm = hand_landmarks
    h_wrist = np.array(lm[0])
    h_index = np.array(lm[5])
    h_pinky = np.array(lm[17])

    # Hand plane normal
    v1 = h_index - h_wrist
    v2 = h_pinky - h_wrist
    normal = _norm(np.cross(v1, v2))

    # Forearm direction (wrist → elbow direction, for orientation reference)
    forearm_dir = _norm(elbow - wrist)

    # Wrist roll: rotation of hand around forearm axis
    roll = _deg(math.atan2(np.dot(normal, forearm_dir), 1.0))
    roll = max(-45.0, min(45.0, roll))

    return {"x": round(roll * 0.5, 1), "y": 0.0, "z": 0.0}


# ── Public API ─────────────────────────────────────────────────────────────────

def retarget_frame(frame: dict) -> Optional[dict]:
    """
    Convert a single landmark frame into a Three.js pose dict.

    Returns None if pose data is missing or low-quality.
    """
    pose = frame.get("pose")
    if not pose:
        return None

    # Check minimum visibility
    avg_vis = sum(
        pose[k].get("visibility", 1.0)
        for k in ["right_shoulder", "right_elbow", "left_shoulder", "left_elbow"]
    ) / 4.0
    if avg_vis < 0.4:
        return None

    rs = _v(pose["right_shoulder"])
    re = _v(pose["right_elbow"])
    rw = _v(pose["right_wrist"])
    ls = _v(pose["left_shoulder"])
    le = _v(pose["left_elbow"])
    lw = _v(pose["left_wrist"])

    return {
        "rightShoulder": _shoulder_angles(rs, re, "right"),
        "rightElbow":    _elbow_angles(rs, re, rw, "right"),
        "rightWrist":    _wrist_angles(re, rw, frame.get("right_hand"), "right"),
        "leftShoulder":  _shoulder_angles(ls, le, "left"),
        "leftElbow":     _elbow_angles(ls, le, lw, "left"),
        "leftWrist":     _wrist_angles(le, lw, frame.get("left_hand"), "left"),
    }


def landmark_sequence_to_poses(landmark_data: dict) -> tuple[float, list[dict]]:
    """
    Convert a full landmark JSON (from extract_landmarks.py) into a list of
    timed pose dicts compatible with glosses.js keyframe format.

    Returns: (duration_seconds, [{"t": float, "pose": {rightShoulder:...}}, ...])
    """
    frames = landmark_data.get("frames", [])
    fps    = landmark_data.get("fps", 30.0)

    poses = []
    for f in frames:
        pose = retarget_frame(f)
        if pose is None:
            continue
        t = f["timestamp_ms"] / 1000.0
        poses.append({"t": t, "pose": pose})

    if not poses:
        return 0.5, []

    # Normalise: start at t=0
    t0 = poses[0]["t"]
    for p in poses:
        p["t"] = round(p["t"] - t0, 3)

    duration = round(poses[-1]["t"], 2) or 0.5
    return duration, poses
