"""
train_rf.py — Train a Random Forest classifier on landmark_store/ data

Usage:
    cd backend/
    python recognition/train_rf.py [--min-samples N] [--output PATH]

Flags:
    --min-samples  Minimum frames per gloss to include (default: 15)
    --output       Where to save the model (default: recognition/model_rf.pkl)

Requirements:
    pip install scikit-learn numpy scipy

The trained model is saved as a pickle file containing:
    {"model": RandomForestClassifier, "classes": [gloss_names], "trained_at": ISO timestamp}
"""
import argparse
import json
import pickle
import sys
from datetime import datetime
from pathlib import Path

_HERE    = Path(__file__).parent
_BACKEND = _HERE.parent
_STORE   = _BACKEND / "landmark_store"

sys.path.insert(0, str(_HERE))
from features import sequence_to_flat

try:
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import StratifiedKFold, cross_val_score
    from sklearn.preprocessing import LabelEncoder
except ImportError:
    print("Install: pip install scikit-learn numpy")
    sys.exit(1)


def load_dataset(min_samples: int = 15) -> tuple[np.ndarray, list[str]]:
    """
    Load all landmark JSONs from landmark_store/.
    Returns (X, y) where X.shape = (n_samples, 117), y = list of gloss names.
    """
    X, y = [], []
    skipped = []

    for jf in sorted(_STORE.glob("*.json")):
        gloss = jf.stem.upper()
        try:
            data = json.loads(jf.read_text(encoding="utf-8"))
            frames = data.get("frames", [])
            valid = [f for f in frames if f.get("pose")]
            if len(valid) < min_samples:
                skipped.append(f"{gloss} ({len(valid)} valid frames)")
                continue
            feat = sequence_to_flat(frames)
            X.append(feat)
            y.append(gloss)
        except Exception as e:
            print(f"  WARNING: could not load {jf.name}: {e}", file=sys.stderr)

    if skipped:
        print(f"Skipped (too few frames): {', '.join(skipped)}", file=sys.stderr)

    return np.stack(X), y


def train(min_samples: int = 15, output: Path | None = None) -> None:
    output = output or _HERE / "model_rf.pkl"

    print(f"Loading dataset from {_STORE} ...")
    X, y = load_dataset(min_samples=min_samples)

    if len(set(y)) < 2:
        print(f"ERROR: Need at least 2 classes, got {len(set(y))} ({y})")
        sys.exit(1)

    print(f"Dataset: {len(y)} samples × {X.shape[1]} features, {len(set(y))} classes")
    print(f"Classes: {sorted(set(y))}")

    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    clf = RandomForestClassifier(
        n_estimators=300,
        max_depth=20,
        min_samples_leaf=1,
        n_jobs=-1,
        random_state=42,
    )

    # Cross-validation (only if enough samples)
    n_splits = min(5, min(len(y) // len(set(y)), 5))
    if n_splits >= 2:
        cv = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        scores = cross_val_score(clf, X, y_enc, cv=cv, scoring="accuracy")
        print(f"CV accuracy: {scores.mean():.2%} ± {scores.std():.2%}")
    else:
        print("Skipping CV (too few samples per class)")

    # Final fit on all data
    clf.fit(X, y_enc)

    model_data = {
        "model":      clf,
        "classes":    list(le.classes_),
        "trained_at": datetime.now().isoformat(),
        "n_samples":  len(y),
        "n_classes":  len(set(y)),
        "feature_dim": X.shape[1],
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "wb") as f:
        pickle.dump(model_data, f)

    print(f"Model saved → {output}")
    print(f"To use: python recognition/predict.py")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-samples", type=int, default=15)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    train(min_samples=args.min_samples, output=args.output)
