import { useCallback, useEffect, useRef, useState } from 'react'

const VIDEO_BASE = '/videos/'

function toPlayable(glosses) {
  return (glosses || []).filter((g) => !g.startsWith('FS:'))
}

export default function VideoPlayer({ glosses, sessionKey, isFinal, onGlossChange, speed = 1, replayCount = 0 }) {
  const queueRef   = useRef([])
  const idxRef     = useRef(0)
  const statusRef  = useRef('idle')
  const speedRef   = useRef(speed)
  useEffect(() => { speedRef.current = speed }, [speed])

  const [displayQueue, setDisplayQueue] = useState([])
  const [displayIdx, setDisplayIdx] = useState(0)
  const [status, setStatus] = useState('idle')

  const videoRef = useRef(null)

  const play = useCallback((queue, i) => {
    const v = videoRef.current
    if (!v || i >= queue.length) return
    queueRef.current = queue
    idxRef.current = i
    statusRef.current = 'playing'
    setDisplayIdx(i)
    setDisplayQueue([...queue])
    setStatus('playing')
    onGlossChange?.(queue[i])
    v.src = `${VIDEO_BASE}${queue[i]}.mp4`
    v.playbackRate = speedRef.current
    v.load()
    v.play().catch(() => {})
  }, [onGlossChange])

  // Full reset on new session
  useEffect(() => {
    queueRef.current = []
    idxRef.current = 0
    statusRef.current = 'idle'
    setDisplayQueue([])
    setDisplayIdx(0)
    setStatus('idle')
    const v = videoRef.current
    if (v) v.src = ''
  }, [sessionKey])

  // Sync queue when glosses arrive or grow
  useEffect(() => {
    const playable = toPlayable(glosses)
    if (!playable.length) return

    const prevLen = queueRef.current.length

    if (prevLen === 0) {
      play(playable, 0)
    } else if (playable.length > prevLen) {
      queueRef.current = playable
      setDisplayQueue([...playable])
      if (statusRef.current === 'waiting') {
        play(playable, idxRef.current + 1)
      }
    }
  }, [glosses, play]) // eslint-disable-line react-hooks/exhaustive-deps

  // Speed
  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed
  }, [speed])

  // Replay
  useEffect(() => {
    if (replayCount === 0) return
    const playable = toPlayable(glosses)
    if (playable.length) play(playable, 0)
  }, [replayCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // When final arrives and we were waiting, mark done
  useEffect(() => {
    if (isFinal && statusRef.current === 'waiting') {
      statusRef.current = 'done'
      setStatus('done')
      onGlossChange?.(null)
    }
  }, [isFinal, onGlossChange])

  const handleEnded = useCallback(() => {
    const queue = queueRef.current
    const next = idxRef.current + 1
    if (next < queue.length) {
      play(queue, next)
    } else if (isFinal) {
      statusRef.current = 'done'
      setStatus('done')
      onGlossChange?.(null)
    } else {
      statusRef.current = 'waiting'
      setStatus('waiting')
    }
  }, [play, isFinal, onGlossChange])

  if (status === 'idle' && !displayQueue.length) return null

  const current = displayQueue[displayIdx]
  return (
    <div className="video-player">
      {displayQueue.length > 0 ? (
        <>
          <video
            ref={videoRef}
            className="sign-video"
            onEnded={handleEnded}
            playsInline
          />
          <p className="video-info">
            {status === 'playing' && (
              <><span className="playing-dot" />{current} · {displayIdx + 1}/{displayQueue.length}</>
            )}
            {status === 'waiting' && <>{current} · chờ...</>}
            {status === 'done' && <><span className="done-check">✓</span> Hoàn thành</>}
          </p>
        </>
      ) : (
        <p className="no-video">
          Chưa có video — đặt .mp4 vào <code>public/videos/</code>
        </p>
      )}
    </div>
  )
}
