import { useCallback, useEffect, useRef, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const MP_CDN   = 'https://cdn.jsdelivr.net/npm/@mediapipe/holistic@0.5.1675471629'

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

function drawSkeleton(canvas, results, W, H) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)

  const drawLine = (lms, a, b) => {
    if (!lms?.landmark) return
    const p1 = lms.landmark[a], p2 = lms.landmark[b]
    if (!p1 || !p2) return
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(p1.x * W, p1.y * H)
    ctx.lineTo(p2.x * W, p2.y * H)
    ctx.stroke()
  }

  ;[[12, 14], [14, 16], [11, 13], [13, 15], [11, 12]].forEach(
    ([a, b]) => drawLine(results.poseLandmarks, a, b)
  )

  const drawDots = (lms, color) => {
    if (!lms?.landmark) return
    ctx.fillStyle = color
    for (const lm of lms.landmark) {
      ctx.beginPath()
      ctx.arc(lm.x * W, lm.y * H, 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  drawDots(results.rightHandLandmarks, '#60a5fa')
  drawDots(results.leftHandLandmarks,  '#a78bfa')

  if (results.poseLandmarks) {
    ctx.fillStyle = '#f59e0b'
    for (const i of [11, 12, 13, 14, 15, 16]) {
      const lm = results.poseLandmarks.landmark[i]
      if (!lm) continue
      ctx.beginPath(); ctx.arc(lm.x * W, lm.y * H, 5, 0, Math.PI * 2); ctx.fill()
    }
  }
}

function extractFrame(results, timestampMs, idx) {
  const lm = results.poseLandmarks?.landmark
  const pose = lm ? Object.fromEntries(
    Object.entries(POSE_IDX).map(([name, i]) => [
      name, { x: lm[i].x, y: lm[i].y, z: lm[i].z, visibility: lm[i].visibility ?? 1 }
    ])
  ) : null
  return {
    frame_idx: idx,
    timestamp_ms: timestampMs,
    pose,
    right_hand: results.rightHandLandmarks?.landmark.map(p => [p.x, p.y, p.z]) ?? null,
    left_hand:  results.leftHandLandmarks?.landmark.map(p => [p.x, p.y, p.z])  ?? null,
  }
}

export default function SignInput({ onStart, onSubmit, onError }) {
  const videoRef   = useRef(null)
  const canvasRef  = useRef(null)
  const rafRef     = useRef(null)
  const holisticRef = useRef(null)
  const framesRef  = useRef([])
  const startMsRef = useRef(0)
  const recordingRef = useRef(false)

  const [mpStatus,   setMpStatus]   = useState('idle')   // idle | loading | ready | error
  const [recording,  setRecording]  = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [confirmed,  setConfirmed]  = useState(null)

  // Sync recording ref for use inside MediaPipe callback
  useEffect(() => { recordingRef.current = recording }, [recording])

  // Load MediaPipe + start webcam
  useEffect(() => {
    let cancelled = false
    setMpStatus('loading')

    async function init() {
      try {
        await loadScript(`${MP_CDN}/holistic.js`)
        if (cancelled) return

        const holistic = new window.Holistic({
          locateFile: f => `${MP_CDN}/${f}`,
        })
        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence:  0.5,
        })
        holistic.onResults(results => {
          const canvas = canvasRef.current
          const video  = videoRef.current
          if (!canvas || !video) return
          drawSkeleton(canvas, results, canvas.width, canvas.height)

          if (!recordingRef.current) return
          const now = performance.now()
          if (framesRef.current.length === 0) startMsRef.current = now
          framesRef.current.push(
            extractFrame(results, Math.round(now - startMsRef.current), framesRef.current.length)
          )
          setFrameCount(c => c + 1)
        })
        holisticRef.current = holistic

        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

        const video = videoRef.current
        video.srcObject = stream
        await video.play()

        const send = async () => {
          if (cancelled) return
          if (video.readyState >= 2 && holisticRef.current) {
            await holisticRef.current.send({ image: video })
          }
          rafRef.current = requestAnimationFrame(send)
        }
        rafRef.current = requestAnimationFrame(send)

        if (!cancelled) setMpStatus('ready')
      } catch (e) {
        if (!cancelled) { setMpStatus('error'); onError?.(e.message) }
      }
    }

    init()
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      const video = videoRef.current
      if (video?.srcObject) video.srcObject.getTracks().forEach(t => t.stop())
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = useCallback(() => {
    framesRef.current = []
    setFrameCount(0)
    setCandidates([])
    setConfirmed(null)
    onStart?.()
    setRecording(true)
  }, [onStart])

  const stopAndRecognize = useCallback(async () => {
    setRecording(false)
    const frames = framesRef.current
    if (frames.length < 10) {
      onError?.('Ghi quá ngắn — giữ nút ít nhất 0.5 giây')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/recognize`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fps: 30, frames }),
      })
      const data = await res.json()
      if (data.status === 'not_ready') {
        onError?.('Chưa có model nhận dạng. Thu thập dữ liệu tại /record trước.')
      } else {
        setCandidates(data.candidates ?? [])
      }
    } catch (e) {
      onError?.(e.message)
    } finally {
      setSubmitting(false)
    }
  }, [onError])

  const confirmGloss = useCallback(async (gloss) => {
    setConfirmed(gloss)
    setCandidates([])
    // Fetch Vietnamese text from backend
    try {
      const res = await fetch(`${API_BASE}/glosses-to-text`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glosses: [gloss] }),
      })
      const data = await res.json()
      onSubmit?.({ transcript: data.text || gloss, all_glosses: [gloss] })
      // Speak the result using Web Speech API
      if ('speechSynthesis' in window && data.text) {
        const utt = new SpeechSynthesisUtterance(data.text)
        utt.lang = 'vi-VN'
        window.speechSynthesis.speak(utt)
      }
    } catch {
      onSubmit?.({ transcript: gloss, all_glosses: [gloss] })
    }
  }, [onSubmit])

  return (
    <div className="sign-input">
      {/* Camera view */}
      <div className="sign-camera-wrap">
        <video
          ref={videoRef}
          className="sign-video-feed"
          muted
          playsInline
          style={{ transform: 'scaleX(-1)' }}
        />
        <canvas
          ref={canvasRef}
          className="sign-canvas-overlay"
          width={320}
          height={240}
          style={{ transform: 'scaleX(-1)' }}
        />
        {mpStatus === 'loading' && (
          <div className="sign-camera-loading">
            <span className="spinner" /> Đang tải camera...
          </div>
        )}
        {recording && (
          <div className="sign-rec-badge">
            <span className="rec-dot" /> {frameCount}f
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="sign-controls">
        {!recording && !submitting && candidates.length === 0 && (
          <button
            className="sign-btn-record"
            onPointerDown={startRecording}
            onPointerUp={stopAndRecognize}
            onPointerLeave={recording ? stopAndRecognize : undefined}
            disabled={mpStatus !== 'ready'}
          >
            {mpStatus === 'loading'
              ? <><span className="spinner" /> Đang tải...</>
              : <><svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="12" r="8"/></svg> Giữ để ký hiệu</>
            }
          </button>
        )}

        {recording && (
          <button className="sign-btn-stop" onPointerUp={stopAndRecognize}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <rect x="6" y="6" width="12" height="12" rx="1"/>
            </svg>
            Thả để nhận dạng
          </button>
        )}

        {submitting && (
          <p className="status-msg"><span className="spinner" /> Đang nhận dạng...</p>
        )}

        {/* Candidates */}
        {candidates.length > 0 && (
          <div className="sign-candidates">
            <p className="label">Chọn ký hiệu:</p>
            {candidates.map(c => (
              <button
                key={c.gloss}
                className="sign-candidate-btn"
                onClick={() => confirmGloss(c.gloss)}
              >
                <span className="sign-candidate-gloss">{c.gloss}</span>
                <span className="sign-candidate-conf">
                  <span
                    className="sign-conf-bar"
                    style={{ width: `${Math.round(c.confidence * 100)}%` }}
                  />
                  {Math.round(c.confidence * 100)}%
                </span>
              </button>
            ))}
            <button className="sign-retry-btn" onClick={() => setCandidates([])}>
              Thử lại
            </button>
          </div>
        )}

        {confirmed && candidates.length === 0 && (
          <p className="sign-confirmed">
            <span className="done-check">✓</span> {confirmed}
          </p>
        )}
      </div>

      <p className="sign-hint">
        Giữ nút và thực hiện ký hiệu — thả tay để nhận dạng
      </p>
    </div>
  )
}
