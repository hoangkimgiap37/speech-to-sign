import { useCallback, useEffect, useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// MediaPipe CDN URLs (loaded lazily when page opens)
const MP_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629'

// Landmark indices for 6 arm pose joints
const POSE_IDX = {
  right_shoulder: 12, right_elbow: 14, right_wrist: 16,
  left_shoulder:  11, left_elbow:  13, left_wrist:  15,
  right_hip: 24, left_hip: 23,
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return }
    const s = document.createElement('script')
    s.src = src; s.crossOrigin = 'anonymous'
    s.onload = res; s.onerror = rej
    document.head.appendChild(s)
  })
}

async function loadMediaPipe() {
  await loadScript(`${MP_CDN}/holistic.js`)
  return window.Holistic
}

// Draw pose + hand skeleton overlay on canvas
function drawOverlay(canvas, results, W, H) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  const drawDots = (lms, color, r = 3) => {
    if (!lms) return
    ctx.fillStyle = color
    for (const lm of lms.landmark ?? lms) {
      ctx.beginPath()
      ctx.arc(lm.x * W, lm.y * H, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const drawLine = (lms, a, b, color) => {
    if (!lms?.landmark) return
    const p1 = lms.landmark[a], p2 = lms.landmark[b]
    if (!p1 || !p2) return
    ctx.strokeStyle = color; ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(p1.x * W, p1.y * H)
    ctx.lineTo(p2.x * W, p2.y * H)
    ctx.stroke()
  }

  // Arm skeleton
  ;[[12, 14], [14, 16], [11, 13], [13, 15]].forEach(([a, b]) =>
    drawLine(results.poseLandmarks, a, b, '#3b82f6'))

  // Shoulder-to-shoulder
  drawLine(results.poseLandmarks, 11, 12, '#3b82f6')

  // Hand dots
  drawDots(results.rightHandLandmarks?.landmark ? results.rightHandLandmarks : null, '#60a5fa', 3)
  drawDots(results.leftHandLandmarks?.landmark  ? results.leftHandLandmarks  : null, '#a78bfa', 3)

  // Pose joint dots (shoulders, elbows, wrists)
  if (results.poseLandmarks) {
    ctx.fillStyle = '#f59e0b'
    for (const i of Object.values(POSE_IDX).slice(0, 6)) {
      const lm = results.poseLandmarks.landmark[i]
      if (!lm) continue
      ctx.beginPath()
      ctx.arc(lm.x * W, lm.y * H, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function extractPoseJoints(poseLandmarks) {
  if (!poseLandmarks) return null
  const lm = poseLandmarks.landmark
  const out = {}
  for (const [name, idx] of Object.entries(POSE_IDX)) {
    const p = lm[idx]
    if (p) out[name] = { x: p.x, y: p.y, z: p.z, visibility: p.visibility ?? 1 }
  }
  return out
}

export default function RecordPage() {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const holisticRef = useRef(null)
  const cameraRef  = useRef(null)
  const framesRef  = useRef([])
  const startMsRef = useRef(0)
  const fpsRef     = useRef(30)

  const [mpLoaded,    setMpLoaded]    = useState(false)
  const [mpError,     setMpError]     = useState(null)
  const [glossInput,  setGlossInput]  = useState('')
  const [recording,   setRecording]   = useState(false)
  const [frameCount,  setFrameCount]  = useState(0)
  const [submitting,  setSubmitting]  = useState(false)
  const [lastResult,  setLastResult]  = useState(null) // {gloss, frames, status}
  const [error,       setError]       = useState(null)
  const [suggestions, setSuggestions] = useState([])

  // Load coverage suggestions from backend
  useEffect(() => {
    fetch(`${API_BASE}/coverage`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          const high = data.filter(r => r.priority === 'HIGH').map(r => r.gloss)
          setSuggestions(high.slice(0, 20))
        }
      })
      .catch(() => {})
  }, [])

  // Load MediaPipe on mount
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const HolisticClass = await loadMediaPipe()
        if (cancelled) return

        const holistic = new HolisticClass({
          locateFile: (f) => `${MP_CDN}/${f}`,
        })
        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        holistic.onResults((results) => {
          const canvas = canvasRef.current
          const video  = videoRef.current
          if (!canvas || !video) return
          const W = canvas.width, H = canvas.height
          drawOverlay(canvas, results, W, H)

          if (!recording) return
          const now = performance.now()
          if (framesRef.current.length === 0) startMsRef.current = now

          const elapsed = now - startMsRef.current
          const pose = extractPoseJoints(results.poseLandmarks)
          const rh = results.rightHandLandmarks
            ? results.rightHandLandmarks.landmark.map(p => [p.x, p.y, p.z])
            : null
          const lh = results.leftHandLandmarks
            ? results.leftHandLandmarks.landmark.map(p => [p.x, p.y, p.z])
            : null

          framesRef.current.push({
            frame_idx: framesRef.current.length,
            timestamp_ms: Math.round(elapsed),
            pose,
            right_hand: rh,
            left_hand:  lh,
          })
          setFrameCount(framesRef.current.length)
        })

        holisticRef.current = holistic

        // Start webcam
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

        const video = videoRef.current
        video.srcObject = stream
        await video.play()

        fpsRef.current = 30 // default; will be refined from stream track settings
        try {
          const settings = stream.getVideoTracks()[0].getSettings()
          if (settings.frameRate) fpsRef.current = settings.frameRate
        } catch { /* ignore */ }

        // Process frames
        const processFrame = async () => {
          if (cancelled) return
          if (video.readyState >= 2 && holisticRef.current) {
            await holisticRef.current.send({ image: video })
          }
          cameraRef.current = requestAnimationFrame(processFrame)
        }
        cameraRef.current = requestAnimationFrame(processFrame)

        if (!cancelled) setMpLoaded(true)
      } catch (e) {
        if (!cancelled) setMpError(e.message || 'Không tải được MediaPipe')
      }
    }

    init()
    return () => {
      cancelled = true
      if (cameraRef.current) cancelAnimationFrame(cameraRef.current)
      const video = videoRef.current
      if (video?.srcObject) video.srcObject.getTracks().forEach(t => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep recording ref in sync (holistic onResults closure needs it)
  const recordingRef = useRef(recording)
  useEffect(() => { recordingRef.current = recording }, [recording])
  // Patch holistic callback to use ref
  useEffect(() => {
    const h = holisticRef.current
    if (!h) return
    h.onResults((results) => {
      const canvas = canvasRef.current
      const video  = videoRef.current
      if (!canvas || !video) return
      const W = canvas.width, H = canvas.height
      drawOverlay(canvas, results, W, H)

      if (!recordingRef.current) return
      const now = performance.now()
      if (framesRef.current.length === 0) startMsRef.current = now

      const pose = extractPoseJoints(results.poseLandmarks)
      const rh = results.rightHandLandmarks
        ? results.rightHandLandmarks.landmark.map(p => [p.x, p.y, p.z]) : null
      const lh = results.leftHandLandmarks
        ? results.leftHandLandmarks.landmark.map(p => [p.x, p.y, p.z]) : null

      framesRef.current.push({
        frame_idx: framesRef.current.length,
        timestamp_ms: Math.round(performance.now() - startMsRef.current),
        pose, right_hand: rh, left_hand: lh,
      })
      setFrameCount(framesRef.current.length)
    })
  }, [mpLoaded])

  const startRecording = useCallback(() => {
    framesRef.current = []
    setFrameCount(0)
    setError(null)
    setLastResult(null)
    setRecording(true)
  }, [])

  const stopRecording = useCallback(() => {
    setRecording(false)
  }, [])

  const submitRecording = useCallback(async () => {
    const gloss = glossInput.trim().toUpperCase()
    if (!gloss) { setError('Nhập tên ký hiệu trước'); return }

    const frames = framesRef.current
    if (frames.length < 15) {
      setError(`Chỉ có ${frames.length} frame — cần ít nhất 15 (ghi ≥0.5 giây)`)
      return
    }

    // Check visibility quality
    const validPose = frames.filter(f => f.pose !== null).length
    const pct = validPose / frames.length * 100
    if (pct < 30) {
      setError(`Chỉ ${pct.toFixed(0)}% frame nhận diện được pose — cải thiện ánh sáng và góc camera`)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/landmarks/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gloss, fps: fpsRef.current, frames }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      setLastResult({ gloss, frames: data.frames, status: 'ok' })
      setSuggestions(prev => prev.filter(s => s !== gloss))
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }, [glossInput])

  const validPct = frameCount > 0
    ? Math.round(framesRef.current.filter(f => f.pose !== null).length / frameCount * 100)
    : 0

  return (
    <div className="record-page">
      <header className="record-header">
        <a href="/" className="record-back">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Quay lại
        </a>
        <div>
          <div className="record-title">Thu thập dữ liệu VNSL</div>
          <div className="record-subtitle">Ghi ký hiệu để mở rộng thư viện animation</div>
        </div>
      </header>

      <div className="record-body">
        {/* ── Camera panel ── */}
        <div className="record-camera-wrap">
          {mpError ? (
            <div className="record-mp-error">
              <p>Không tải được MediaPipe</p>
              <small>{mpError}</small>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="record-video"
                muted
                playsInline
                style={{ transform: 'scaleX(-1)' }}
              />
              <canvas
                ref={canvasRef}
                className="record-canvas"
                width={640}
                height={480}
                style={{ transform: 'scaleX(-1)' }}
              />
              {!mpLoaded && (
                <div className="record-loading">
                  <span className="spinner" /> Đang tải MediaPipe...
                </div>
              )}
            </>
          )}

          {/* Recording indicator */}
          {recording && (
            <div className="record-indicator">
              <span className="rec-dot" /> REC · {frameCount} frames
              {frameCount > 0 && (
                <span className="rec-quality" style={{ color: validPct > 70 ? '#22c55e' : validPct > 40 ? '#f59e0b' : '#ef4444' }}>
                  · pose {validPct}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Controls panel ── */}
        <div className="record-controls">
          {/* Gloss input */}
          <div className="record-field">
            <label className="label">Tên ký hiệu (GLOSS)</label>
            <input
              className="record-input"
              type="text"
              value={glossInput}
              onChange={e => setGlossInput(e.target.value.toUpperCase())}
              placeholder="VD: HOSPITAL, POLICE, SCHOOL..."
              disabled={recording}
            />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="record-suggestions">
              <span className="label">Ưu tiên (chưa có animation):</span>
              <div className="suggestion-chips">
                {suggestions.slice(0, 10).map(s => (
                  <button
                    key={s}
                    className="suggestion-chip"
                    onClick={() => setGlossInput(s)}
                    disabled={recording}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Record button */}
          <div className="record-actions">
            {!recording ? (
              <button
                className="record-btn-start"
                onClick={startRecording}
                disabled={!mpLoaded || !!mpError}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                  <circle cx="12" cy="12" r="8"/>
                </svg>
                Bắt đầu ghi
              </button>
            ) : (
              <button className="record-btn-stop" onClick={stopRecording}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                  <rect x="6" y="6" width="12" height="12" rx="1"/>
                </svg>
                Dừng ghi
              </button>
            )}

            {!recording && frameCount >= 15 && (
              <button
                className="record-btn-submit"
                onClick={submitRecording}
                disabled={submitting || !glossInput.trim()}
              >
                {submitting ? <><span className="spinner" /> Đang gửi...</> : '✓ Lưu ký hiệu'}
              </button>
            )}
          </div>

          {/* Frame counter */}
          {frameCount > 0 && !recording && (
            <p className="record-frame-info">
              Đã ghi {frameCount} frames · {(frameCount / fpsRef.current).toFixed(1)}s · pose {validPct}%
              {validPct < 30 && ' ⚠ Cần cải thiện ánh sáng'}
            </p>
          )}

          {/* Error */}
          {error && <p className="status-msg error">{error}</p>}

          {/* Success */}
          {lastResult?.status === 'ok' && (
            <div className="record-success">
              <span className="done-check">✓</span>
              <strong>{lastResult.gloss}</strong> đã lưu ({lastResult.frames} frames).
              Animation 3D sẽ được tự động cập nhật.
            </div>
          )}

          {/* Instructions */}
          <div className="record-instructions">
            <p className="label">Hướng dẫn:</p>
            <ol>
              <li>Nhập tên ký hiệu VNSL (chữ hoa)</li>
              <li>Đứng thẳng, để camera thấy cả 2 vai và 2 tay</li>
              <li>Bấm <strong>Bắt đầu ghi</strong>, thực hiện ký hiệu 1–3 lần</li>
              <li>Bấm <strong>Dừng ghi</strong>, sau đó <strong>Lưu ký hiệu</strong></li>
              <li>Điểm vàng = khớp vai/khuỷu/cổ tay · xanh = ngón tay</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
