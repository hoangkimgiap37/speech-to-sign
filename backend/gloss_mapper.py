import json
import os
import unicodedata
from typing import List

try:
    from underthesea import word_tokenize as _vn_tokenize
    _HAS_UNDERTHESEA = True
except ImportError:
    _HAS_UNDERTHESEA = False

_dict_path = os.path.join(os.path.dirname(__file__), "dictionary", "vnsl_dict.json")
with open(_dict_path, encoding="utf-8") as f:
    DICTIONARY: dict[str, str] = json.load(f)

# ── VNSL syntax categories ─────────────────────────────────────────────────────

_TIME = frozenset({
    'TODAY', 'TOMORROW', 'YESTERDAY', 'NOW',
    'MORNING', 'AFTERNOON', 'EVENING', 'WEEK', 'MONTH',
})

_SUBJ = frozenset({
    'ME', 'YOU', 'YOU_MALE', 'YOU_FEMALE', 'YOU_YOUNGER', 'THEY', 'WE',
    'FATHER', 'MOTHER', 'OLDER_BROTHER', 'OLDER_SISTER',
    'YOUNGER_BROTHER', 'YOUNGER_SISTER', 'GRANDFATHER', 'GRANDMOTHER', 'CHILD',
    'SON', 'DAUGHTER', 'WIFE', 'HUSBAND', 'FRIEND',
    'DOCTOR', 'NURSE', 'PATIENT',
})

# Modal/stative verbs — kept in predicate position, not moved as content verbs
_MODAL = frozenset({
    'WANT', 'NEED', 'LIKE', 'LOVE', 'CAN', 'CANNOT', 'HAVE', 'IS',
})

# Action/content verbs — trigger SOV reorder (object moves before verb)
_VERB = frozenset({
    'EAT', 'DRINK', 'GO', 'ARRIVE', 'RETURN_HOME', 'WORK', 'STUDY',
    'KNOW', 'UNDERSTAND', 'SPEAK', 'HEAR', 'LOOK', 'READ', 'WRITE',
    'HELP', 'BUY', 'SELL', 'MEET',
    'RUN', 'WALK', 'SLEEP', 'WAKE_UP', 'COOK', 'WASH', 'DRIVE',
    'WAIT', 'FIND', 'CALL', 'OPEN', 'CLOSE',
})

_WH = frozenset({
    'WHAT', 'WHERE', 'WHEN', 'WHY', 'HOW', 'HOW_MUCH', 'WHO',
})

_ALL_PRED = _MODAL | _VERB  # anything that acts as part of a predicate


# ── Reorder helpers ────────────────────────────────────────────────────────────

def _apply_sov(glosses: List[str]) -> List[str]:
    """
    Within each subject-predicate span, move the direct object before its
    content verb:  SUBJ [MODAL*] VERB OBJ+  →  SUBJ [MODAL*] OBJ+ VERB

    Boundaries: another subject pronoun, a time marker, or a wh-word stops
    the current span.
    """
    result: List[str] = []
    i = 0
    n = len(glosses)

    while i < n:
        g = glosses[i]

        if g in _SUBJ:
            result.append(g)
            i += 1

            # Collect zero or more modals before the content verb
            modals: List[str] = []
            while i < n and glosses[i] in _MODAL:
                modals.append(glosses[i])
                i += 1

            # Expect a content verb
            if i < n and glosses[i] in _VERB:
                verb = glosses[i]
                i += 1

                # Collect noun/adjective objects that follow the verb
                objs: List[str] = []
                while (i < n
                       and glosses[i] not in _SUBJ
                       and glosses[i] not in _ALL_PRED
                       and glosses[i] not in _TIME
                       and glosses[i] not in _WH):
                    objs.append(glosses[i])
                    i += 1

                # SOV: [SUBJ already appended] + MODAL* + OBJ* + VERB
                result.extend(modals + objs + [verb])
            else:
                result.extend(modals)
        else:
            result.append(g)
            i += 1

    return result


def reorder_to_vnsl(glosses: List[str]) -> List[str]:
    """
    Approximate VNSL syntax rules on a gloss list.

    Rules applied:
      1. Time expressions → sentence front   (TODAY/NOW/... always lead)
      2. SOV reorder — object precedes its governing content verb
      3. Wh-question words → sentence end    (WHAT/WHERE/... always trail)

    Limitations (out of scope for Phase 3):
      - Negation placement (KHÔNG stays in input order)
      - Classifier agreement
      - Non-manual markers (facial expression, mouth morphemes)
    """
    if len(glosses) < 2:
        return glosses

    time_front = [g for g in glosses if g in _TIME]
    rest       = [g for g in glosses if g not in _TIME]

    wh_end = [g for g in rest if g in _WH]
    middle = [g for g in rest if g not in _WH]

    middle = _apply_sov(middle)

    return time_front + middle + wh_end


# ── Public API ─────────────────────────────────────────────────────────────────

def _normalize(text: str) -> str:
    return unicodedata.normalize("NFC", text.lower().strip())


def _tokenize(text: str) -> List[str]:
    if _HAS_UNDERTHESEA:
        return _vn_tokenize(_normalize(text))
    return _normalize(text).split()


def _lookup_token(token: str) -> List[str]:
    if token in DICTIONARY:
        return [DICTIONARY[token]]

    sub_words = token.split()
    if len(sub_words) > 1:
        glosses: List[str] = []
        i = 0
        while i < len(sub_words):
            matched = False
            for length in range(min(3, len(sub_words) - i), 0, -1):
                phrase = " ".join(sub_words[i : i + length])
                if phrase in DICTIONARY:
                    glosses.append(DICTIONARY[phrase])
                    i += length
                    matched = True
                    break
            if not matched:
                glosses.append(f"FS:{sub_words[i].upper()}")
                i += 1
        return glosses

    return [f"FS:{token.upper()}"]


def text_to_glosses(text: str) -> List[str]:
    """
    Vietnamese transcript  →  VNSL gloss list (with syntax reorder).

    Pipeline:
      1. underthesea word_tokenize — segments multi-syllable words correctly.
      2. Dictionary lookup + greedy sub-token fallback + fingerspelling.
      3. reorder_to_vnsl — time front, SOV reorder, wh-word to end.
    """
    tokens = _tokenize(text)
    raw: List[str] = []
    for token in tokens:
        raw.extend(_lookup_token(token))
    return reorder_to_vnsl(raw)


# ── Reverse translation (Direction 2: Sign → Text) ────────────────────────────

# Build reverse dict: gloss → primary Vietnamese word (first match in dict)
_REVERSE_DICT: dict[str, str] = {}
for _vn, _gl in DICTIONARY.items():
    if _gl not in _REVERSE_DICT:          # keep first / shortest Vietnamese form
        _REVERSE_DICT[_gl] = _vn


def glosses_to_vietnamese(glosses: List[str]) -> str:
    """
    VNSL gloss list → Vietnamese text (approximate inverse of text_to_glosses).

    Limitations:
    - Produces SVO order (not VNSL SOV) — suitable for hearing users to read.
    - Does not reconstruct particles, tones, or natural phrasing.
    - Fingerspelled tokens (FS:WORD) are passed through as lowercase.
    """
    words: List[str] = []
    for g in glosses:
        if g.startswith("FS:"):
            words.append(g[3:].lower())
        elif g in _REVERSE_DICT:
            words.append(_REVERSE_DICT[g])
        else:
            words.append(g.lower())
    return " ".join(words)
