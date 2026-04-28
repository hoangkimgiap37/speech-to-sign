import asyncio
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import uvicorn

from gloss_mapper import text_to_glosses, glosses_to_vietnamese
from transcribe import transcribe_audio

_HERE           = Path(__file__).parent
_LANDMARK_STORE = _HERE / "landmark_store"
_LANDMARK_STORE.mkdir(exist_ok=True)

app = FastAPI(title="Speech to VNSL API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Single-worker executor so WhisperModel is never called concurrently
_executor = ThreadPoolExecutor(max_workers=1)


async def _transcribe(audio: bytes, filename: str) -> str:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, transcribe_audio, audio, filename)


def _run_generator():
    """Regenerate generated_glosses.js from all landmark files."""
    script = _HERE / "pipeline" / "generate_glosses_js.py"
    try:
        subprocess.run(
            [sys.executable, str(script)],
            cwd=str(_HERE),
            capture_output=True,
            timeout=120,
        )
    except Exception:
        pass  # non-blocking; failure means old JS stays


# ── Pydantic models ────────────────────────────────────────────────────────────

class TranscribeResponse(BaseModel):
    transcript: str
    glosses: List[str]


class TextRequest(BaseModel):
    text: str


class LandmarkFrame(BaseModel):
    frame_idx:    int
    timestamp_ms: int
    pose:         Optional[Dict[str, Any]] = None
    right_hand:   Optional[List[List[float]]] = None
    left_hand:    Optional[List[List[float]]] = None


class LandmarkSubmission(BaseModel):
    gloss:  str
    fps:    float = 30.0
    frames: List[LandmarkFrame]


class RecognizeRequest(BaseModel):
    fps:    float = 30.0
    frames: List[LandmarkFrame]


# ── Existing endpoints ─────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/text-to-sign", response_model=TranscribeResponse)
def text_to_sign(body: TextRequest):
    text = body.text.strip()
    if not text:
        return TranscribeResponse(transcript="", glosses=[])
    glosses = text_to_glosses(text)
    return TranscribeResponse(transcript=text, glosses=glosses)


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(file: UploadFile = File(...)):
    if not (file.content_type or "").startswith("audio/"):
        raise HTTPException(status_code=400, detail="File phải là audio (webm, wav, mp3...)")
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="File rỗng")
    transcript = await _transcribe(audio_bytes, file.filename or "audio.webm")
    glosses = text_to_glosses(transcript)
    return TranscribeResponse(transcript=transcript, glosses=glosses)


# ── New: Coverage report (for RecordPage suggestions) ────────────────────────

@app.get("/coverage")
def coverage():
    """Return coverage status for all dictionary glosses (used by /record page)."""
    try:
        sys.path.insert(0, str(_HERE / "pipeline"))
        from coverage_report import load_all_glosses, build_report
        all_glosses = load_all_glosses()
        return build_report(all_glosses)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── New: Landmark submission (from /record page) ──────────────────────────────

@app.post("/landmarks/submit")
async def submit_landmarks(body: LandmarkSubmission):
    """
    Receive a landmark sequence from the browser recording tool.
    Saves to landmark_store/<GLOSS>.json and triggers regeneration of
    generated_glosses.js in the background.
    """
    gloss = body.gloss.strip().upper()
    if not gloss:
        raise HTTPException(status_code=400, detail="gloss is required")

    frames = [f.model_dump() for f in body.frames]
    valid  = sum(1 for f in frames if f.get("pose"))
    pct    = valid / max(len(frames), 1) * 100

    if len(frames) < 15:
        raise HTTPException(
            status_code=422,
            detail=f"Too few frames ({len(frames)}). Need at least 15."
        )
    if pct < 20:
        raise HTTPException(
            status_code=422,
            detail=f"Only {pct:.0f}% frames have valid pose. Improve lighting/angle."
        )

    data = {
        "gloss":             gloss,
        "fps":               body.fps,
        "frame_count":       len(frames),
        "valid_pose_frames": valid,
        "frames":            frames,
    }

    out_path = _LANDMARK_STORE / f"{gloss}.json"
    out_path.write_text(json.dumps(data, indent=2, ensure_ascii=False))

    # Regenerate generated_glosses.js asynchronously (don't block response)
    asyncio.get_event_loop().run_in_executor(_executor, _run_generator)

    return {
        "status": "ok",
        "gloss":  gloss,
        "frames": len(frames),
        "valid_pct": round(pct, 1),
        "message": f"Saved {gloss} ({len(frames)} frames). Animation will update shortly.",
    }


# ── New: Sign recognition (Direction 2: Sign → Text) ─────────────────────────

@app.post("/recognize")
async def recognize_sign(body: RecognizeRequest):
    """
    Receive a landmark sequence from the browser webcam.
    Returns top-3 gloss candidates using the trained classifier.
    Falls back to a 'model not ready' response if no model is trained yet.
    """
    try:
        sys.path.insert(0, str(_HERE / "recognition"))
        from predict import predict_top_k
        frames = [f.model_dump() for f in body.frames]
        candidates = predict_top_k(frames, k=3)
        return {"status": "ok", "candidates": candidates}
    except ImportError:
        return {
            "status": "not_ready",
            "message": "Model chưa được train. Cần thu thập dữ liệu cho ≥30 ký hiệu trước.",
            "candidates": [],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── New: Reverse translation (gloss list → Vietnamese text) ───────────────────

@app.post("/glosses-to-text")
def glosses_to_text(body: dict):
    """Convert a VNSL gloss list back to Vietnamese text (Direction 2 output)."""
    glosses = body.get("glosses", [])
    if not glosses:
        return {"text": ""}
    text = glosses_to_vietnamese(glosses)
    return {"text": text}


# ── WebSocket streaming ────────────────────────────────────────────────────────

@app.websocket("/ws/transcribe")
async def ws_transcribe(ws: WebSocket):
    await ws.accept()

    while True:
        chunks: list[bytes] = []
        sent_count = 0

        try:
            while True:
                msg = await ws.receive()

                if msg.get("type") == "websocket.disconnect":
                    return

                if msg.get("bytes"):
                    chunks.append(msg["bytes"])

                    if len(chunks) == 3:
                        audio = b"".join(chunks)
                        try:
                            transcript = await _transcribe(audio, "stream.webm")
                            glosses = text_to_glosses(transcript)
                            if glosses:
                                await ws.send_json({
                                    "type": "partial",
                                    "transcript": transcript,
                                    "glosses": glosses,
                                })
                                sent_count = len(glosses)
                        except Exception:
                            pass

                elif msg.get("text"):
                    data = json.loads(msg["text"])
                    if data.get("type") == "end":
                        if not chunks:
                            await ws.send_json({
                                "type": "final",
                                "transcript": "",
                                "glosses": [],
                                "all_glosses": [],
                            })
                        else:
                            audio = b"".join(chunks)
                            try:
                                transcript = await _transcribe(audio, "stream.webm")
                                glosses = text_to_glosses(transcript)
                                await ws.send_json({
                                    "type": "final",
                                    "transcript": transcript,
                                    "glosses": glosses[sent_count:],
                                    "all_glosses": glosses,
                                })
                            except Exception as e:
                                await ws.send_json({
                                    "type": "error",
                                    "message": f"Không nhận dạng được audio ({type(e).__name__}). Thử nói lâu hơn 1 giây.",
                                })
                        break

        except WebSocketDisconnect:
            return


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
