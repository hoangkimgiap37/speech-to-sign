"""
expand_dictionary.py - Add MS-ASL words to VNSL dictionary as English glosses

After downloading MS-ASL videos + extracting landmarks, run this script to
add the new English words to vnsl_dict.json so the gloss_mapper can find them.

Usage:
    cd backend/
    python pipeline/expand_dictionary.py [--preview] [--force]

Flags:
    --preview   Show what would be added without writing
    --force     Overwrite existing entries
"""
import argparse
import json
from pathlib import Path

_BACKEND     = Path(__file__).parent.parent
_DICT_PATH   = _BACKEND / "dictionary" / "vnsl_dict.json"
_LM_DIR      = _BACKEND / "landmark_store"
_MODELS_DIR  = Path(__file__).parent / "models"
_CLASSES_URL = (
    "https://raw.githubusercontent.com/microsoft/MS-ASL/master/MSASL_classes.json"
)
_CLASSES_CACHE = _MODELS_DIR / "msasl_classes.json"

# Words already mapped to VNSL glosses (skip — handled by VNSL_TO_MSASL)
_ALREADY_MAPPED = {
    "bad", "drink", "eat", "food", "go", "good", "goodbye", "happy",
    "healthy", "hello", "home", "how much", "like", "love", "me",
    "money", "need", "no", "now", "phone", "sad", "school", "sorry",
    "study", "thank you", "they", "tired", "today", "tomorrow", "want",
    "water", "we", "what", "when", "where", "who", "why", "work",
    "yes", "yesterday", "you",
}


def _gloss_name(word: str) -> str:
    """'how much' -> 'HOW_MUCH'"""
    return word.upper().replace(" ", "_").replace("-", "_")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--force",   action="store_true")
    args = parser.parse_args()

    # Load existing dictionary
    current = json.loads(_DICT_PATH.read_text(encoding="utf-8"))
    existing_glosses = set(current.values())

    # Find what landmark files exist (these are the words we can animate)
    lm_glosses = {p.stem for p in _LM_DIR.glob("*.json")}

    # Load MS-ASL classes if available
    new_entries = {}
    if _CLASSES_CACHE.exists():
        classes = json.loads(_CLASSES_CACHE.read_text(encoding="utf-8"))
        for word in classes:
            word = word.lower().strip()
            gloss = _gloss_name(word)
            # Only add if we have a landmark file for it
            if gloss not in lm_glosses:
                continue
            # Skip already mapped VNSL words
            if word in _ALREADY_MAPPED:
                continue
            # Skip if gloss already in dictionary values
            if gloss in existing_glosses and not args.force:
                continue
            # Add as English word -> English gloss (identity mapping)
            # The word itself is the "Vietnamese" entry for English users
            if word not in current or args.force:
                new_entries[word] = gloss

    if not new_entries:
        print("Nothing new to add (run download_msasl.py --all first).")
        return

    print(f"New entries to add: {len(new_entries)}")
    for vn, gl in sorted(new_entries.items())[:20]:
        print(f"  '{vn}' -> {gl}")
    if len(new_entries) > 20:
        print(f"  ... and {len(new_entries) - 20} more")

    if args.preview:
        print("\n(preview mode - not written)")
        return

    updated = {**current, **new_entries}
    _DICT_PATH.write_text(
        json.dumps(updated, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"\nDictionary updated: {len(current)} -> {len(updated)} entries")
    print(f"Saved -> {_DICT_PATH}")


if __name__ == "__main__":
    main()
