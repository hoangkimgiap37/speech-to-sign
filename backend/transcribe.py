import os
import tempfile
from faster_whisper import WhisperModel

_model = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel("small", device="cpu", compute_type="int8")
    return _model


def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    model = get_model()
    suffix = os.path.splitext(filename)[1] or ".webm"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        tmp_path = f.name

    try:
        segments, _ = model.transcribe(tmp_path, language="vi")
        return " ".join(seg.text.strip() for seg in segments)
    finally:
        os.unlink(tmp_path)
