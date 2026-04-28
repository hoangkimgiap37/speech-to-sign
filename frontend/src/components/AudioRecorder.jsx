import { useCallback, useEffect, useRef } from 'react'
import { useStreamRecorder } from '../hooks/useStreamRecorder'

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/>
      <path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V20H9v2h6v-2h-2v-2.07A7 7 0 0 0 19 11h-2z"/>
    </svg>
  )
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="2"/>
    </svg>
  )
}

function drawIdle(canvas, t) {
  const W = canvas.width
  const H = canvas.height
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)
  const n = 28
  const gap = 2
  const barW = Math.max(2, Math.floor((W - (n - 1) * gap) / n))
  const totalW = n * barW + (n - 1) * gap
  const ox = Math.floor((W - totalW) / 2)
  for (let i = 0; i < n; i++) {
    const ratio = Math.sin(t * 1.1 + i * 0.44) * 0.18 + 0.22
    const h = Math.max(2, Math.round(ratio * H))
    ctx.fillStyle = `rgba(99, 179, 255, ${0.1 + ratio * 0.22})`
    ctx.fillRect(ox + i * (barW + gap), H - h, barW, h)
  }
}

function statusText(wsStatus, isRecording) {
  if (isRecording) return 'Thả tay để dừng'
  if (wsStatus === 'connecting') return 'Đang kết nối...'
  if (wsStatus === 'open') return 'Giữ nút và nói tiếng Việt'
  if (wsStatus === 'closed') return 'Mất kết nối, đang thử lại...'
  return ''
}

function statusDotClass(wsStatus, isRecording) {
  if (isRecording) return 'is-recording'
  if (wsStatus === 'open') return 'is-connected'
  if (wsStatus === 'connecting') return 'is-connecting'
  if (wsStatus === 'closed') return 'is-closed'
  return ''
}

export default function AudioRecorder({ onPartial, onFinal, onError, onConnect, onStartRecording }) {
  const canvasRef  = useRef(null)
  const idleRafRef = useRef(null)
  const idleTRef   = useRef(0)

  const { isRecording, wsStatus, startRecording, stopRecording } = useStreamRecorder({
    onPartial,
    onFinal,
    onError,
    onConnect,
    canvasRef,
  })

  // Idle waveform — runs whenever not recording
  useEffect(() => {
    if (isRecording) return
    const canvas = canvasRef.current
    if (!canvas) return
    const tick = () => {
      idleTRef.current += 0.022
      drawIdle(canvas, idleTRef.current)
      idleRafRef.current = requestAnimationFrame(tick)
    }
    idleRafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(idleRafRef.current)
  }, [isRecording])

  const handleStart = useCallback(async () => {
    onStartRecording?.()
    await startRecording()
  }, [startRecording, onStartRecording])

  return (
    <div className="recorder">
      <div className={`record-ring ${isRecording ? 'is-recording' : ''}`}>
        <button
          className={`record-btn ${isRecording ? 'is-recording' : ''}`}
          onMouseDown={handleStart}
          onMouseUp={stopRecording}
          onTouchStart={(e) => { e.preventDefault(); handleStart() }}
          onTouchEnd={stopRecording}
          disabled={wsStatus !== 'open'}
          aria-label={isRecording ? 'Dừng ghi' : 'Bắt đầu ghi'}
          aria-pressed={isRecording}
        >
          {isRecording ? <StopIcon /> : <MicIcon />}
        </button>
      </div>

      <div className="waveform-wrap">
        <canvas ref={canvasRef} className="waveform" width={320} height={40} />
      </div>

      <div className="recorder-status">
        <span className={`status-dot ${statusDotClass(wsStatus, isRecording)}`} />
        <span>{statusText(wsStatus, isRecording)}</span>
      </div>
    </div>
  )
}
