"""
predict.py — Inference wrapper for the trained Random Forest classifier

Loaded lazily on first call; reloaded automatically when model file changes.

Usage (standalone test):
    cd backend/
    python recognition/predict.py <landmark_json_path>
"""
import json
import pickle
import sys
import time
from pathlib import Path
from typing import List

_HERE       = Path(__file__).parent
_MODEL_PATH = _HERE / "model_rf.pkl"

sys.path.insert(0, str(_HERE))
from features import sequence_to_flat

try:
    import numpy as np
except ImportError:
    raise ImportError("pip install numpy")

# ── Lazy model cache ───────────────────────────────────────────────────────────

_model_cache = None
_model_mtime = 0.0


def _load_model():
    global _model_cache, _model_mtime

    if not _MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found at {_MODEL_PATH}. "
            "Train it first: python recognition/train_rf.py"
        )

    mtime = _MODEL_PATH.stat().st_mtime
    if _model_cache is None or mtime != _model_mtime:
        with open(_MODEL_PATH, "rb") as f:
            _model_cache = pickle.load(f)
        _model_mtime = mtime

    return _model_cache


# ── Public API ─────────────────────────────────────────────────────────────────

def predict_top_k(frames: List[dict], k: int = 3) -> List[dict]:
    """
    Given a list of landmark frame dicts, return top-k gloss predictions.

    Returns a list of dicts: [{"gloss": "HELLO", "confidence": 0.92}, ...]
    Raises FileNotFoundError if model is not trained yet.
    """
    model_data = _load_model()
    clf     = model_data["model"]
    classes = model_data["classes"]

    feat = sequence_to_flat(frames).reshape(1, -1)
    proba = clf.predict_proba(feat)[0]

    top_k = min(k, len(classes))
    top_idx = np.argsort(proba)[::-1][:top_k]

    return [
        {"gloss": classes[i], "confidence": round(float(proba[i]), 3)}
        for i in top_idx
    ]


def predict_gloss(frames: List[dict]) -> str:
    """Return just the top-1 gloss."""
    results = predict_top_k(frames, k=1)
    return results[0]["gloss"] if results else ""


# ── CLI test ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python predict.py <landmark_json>")
        sys.exit(1)

    path = Path(sys.argv[1])
    data = json.loads(path.read_text())
    frames = data.get("frames", [])

    results = predict_top_k(frames, k=5)
    print(f"\nPrediction for {path.stem}:")
    for r in results:
        bar = "█" * int(r["confidence"] * 20)
        print(f"  {r['gloss']:<20} {r['confidence']:.1%}  {bar}")
