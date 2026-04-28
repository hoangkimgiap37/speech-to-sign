import { useCallback, useEffect, useRef, useState } from 'react'

const WS_PATH = '/ws/transcribe'

export function useStreamRecorder({ onPartial, onFinal, onError, onConnect, canvasRef } = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [wsStatus, setWsStatus] = useState('connecting')

  const wsRef = useRef(null)
  const recorderRef = useRef(null)
  const analyserRef = useRef(null)
  const audioCtxRef = useRef(null)
  const rafRef = useRef(null)

  const onPartialRef  = useRef(onPartial)
  const onFinalRef    = useRef(onFinal)
  const onErrorRef    = useRef(onError)
  const onConnectRef  = useRef(onConnect)
  useEffect(() => { onPartialRef.current  = onPartial  }, [onPartial])
  useEffect(() => { onFinalRef.current    = onFinal    }, [onFinal])
  useEffect(() => { onErrorRef.current    = onError    }, [onError])
  useEffect(() => { onConnectRef.current  = onConnect  }, [onConnect])

  // WebSocket lifecycle
  useEffect(() => {
    let alive = true
    let reconnectTimer = null

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${proto}://${window.location.host}${WS_PATH}`)

      ws.onopen = () => {
        if (!alive) return
        setWsStatus('open')
        onConnectRef.current?.()
      }
      ws.onclose = () => {
        if (!alive) return
        setWsStatus('closed')
        reconnectTimer = setTimeout(connect, 3000)
      }
      ws.onerror = () => { onErrorRef.current?.('Lỗi kết nối WebSocket') }
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'partial') onPartialRef.current?.(msg)
          else if (msg.type === 'final') onFinalRef.current?.(msg)
          else if (msg.type === 'error') onErrorRef.current?.(msg.message)
        } catch { /* ignore */ }
      }

      wsRef.current = ws
    }

    connect()
    return () => {
      alive = false
      clearTimeout(reconnectTimer)
      wsRef.current?.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Waveform helpers
  const startWaveform = useCallback((stream) => {
    const canvas = canvasRef?.current
    if (!canvas) return

    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.75
    source.connect(analyser)
    audioCtxRef.current = ctx
    analyserRef.current = analyser

    const data = new Uint8Array(analyser.frequencyBinCount)
    const W = canvas.width
    const H = canvas.height

    const draw = () => {
      if (!analyserRef.current) return
      analyser.getByteFrequencyData(data)
      const c = canvas.getContext('2d')
      c.clearRect(0, 0, W, H)
      const n = data.length
      const gap = 2
      const barW = Math.max(1, Math.floor(W / n) - gap)
      const totalW = n * barW + (n - 1) * gap
      const ox = Math.floor((W - totalW) / 2)
      for (let i = 0; i < n; i++) {
        const ratio = data[i] / 255
        const h = Math.max(2, Math.round(ratio * H))
        const alpha = 0.25 + ratio * 0.75
        c.fillStyle = ratio > 0.6
          ? `rgba(99, 179, 255, ${alpha})`
          : `rgba(59, 130, 246, ${alpha})`
        c.fillRect(ox + i * (barW + gap), H - h, barW, h)
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
  }, [canvasRef])

  const stopWaveform = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    analyserRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    // Don't clear canvas — idle animation in AudioRecorder will take over
  }, [])

  const startRecording = useCallback(async () => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      onErrorRef.current?.('WebSocket chưa kết nối, thử lại...')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      startWaveform(stream)

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      recorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.data)
        }
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        stopWaveform()
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'end' }))
        }
      }

      recorder.start(1000)
      setIsRecording(true)
    } catch (err) {
      onErrorRef.current?.(err.message || 'Không thể truy cập microphone')
    }
  }, [startWaveform, stopWaveform])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
    setIsRecording(false)
  }, [])

  return { isRecording, wsStatus, startRecording, stopRecording }
}
