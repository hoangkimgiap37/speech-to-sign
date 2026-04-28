import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import AudioRecorder from './components/AudioRecorder'
import TextInput from './components/TextInput'
import SignInput from './components/SignInput'
import TranscriptDisplay from './components/TranscriptDisplay'
import VideoPlayer from './components/VideoPlayer'
import ErrorBoundary from './components/ErrorBoundary'
import HistoryPanel from './components/HistoryPanel'
import './App.css'

const AvatarPlayer = lazy(() => import('./components/AvatarPlayer'))

function EmptyState() {
  return (
    <div className="output-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 18.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13z"/>
        <path d="M9.5 9.5c.5-1 1.5-1.5 2.5-1.5s2 .5 2.5 1.5"/>
        <path d="M9 15c.8.8 1.8 1.2 3 1.2s2.2-.4 3-1.2"/>
        <path d="M12 3v1M12 20v1M3 12h1M20 12h1"/>
      </svg>
      <p>
        Sẵn sàng nhận dạng
        <span>Nhấn giữ nút mic và nói tiếng Việt</span>
      </p>
    </div>
  )
}

export default function App() {
  const [transcript, setTranscript]   = useState('')
  const [glosses, setGlosses]         = useState([])
  const [isFinal, setIsFinal]         = useState(false)
  const [sessionKey, setSessionKey]   = useState(0)
  const [activeGloss, setActiveGloss] = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [mode, setMode]               = useState('avatar')
  const [speed, setSpeed]             = useState(1)
  const [replayCount, setReplayCount] = useState(0)
  const [inputMode, setInputMode]     = useState('voice') // 'voice' | 'text'
  const [mobilePanel, setMobilePanel] = useState('input') // 'input' | 'output'
  const [history, setHistory]         = useState([])

  const handleStartRecording = useCallback(() => {
    setTranscript('')
    setGlosses([])
    setIsFinal(false)
    setActiveGloss(null)
    setError(null)
    setLoading(true)
    setSessionKey(k => k + 1)
  }, [])

  const handlePartial = useCallback(({ transcript, glosses }) => {
    setTranscript(transcript)
    setGlosses(glosses)
    setError(null)
  }, [])

  const handleFinal = useCallback(({ transcript, all_glosses }) => {
    setTranscript(transcript)
    setGlosses(all_glosses)
    setIsFinal(true)
    setLoading(false)
    setError(null)
    if (transcript) {
      setHistory(prev => [
        { id: Date.now(), transcript, glosses: all_glosses, time: new Date() },
        ...prev,
      ].slice(0, 8))
    }
  }, [])

  const handleError = useCallback((msg) => {
    setError(msg)
    setLoading(false)
  }, [])

  const handleConnect = useCallback(() => {
    setError(null)
  }, [])

  const handleReplay = useCallback(() => {
    setReplayCount(c => c + 1)
  }, [])

  const handleHistorySelect = useCallback((entry) => {
    setTranscript(entry.transcript)
    setGlosses(entry.glosses)
    setIsFinal(true)
    setLoading(false)
    setError(null)
    setActiveGloss(null)
    setSessionKey(k => k + 1)
  }, [])

  // Auto-switch to output panel on mobile when glosses arrive
  useEffect(() => {
    if (glosses.length > 0) setMobilePanel('output')
  }, [glosses.length])

  const hasOutput = glosses.length > 0

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <div className="brand-icon">🤟</div>
          <div>
            <div className="brand-name">SpeakSign</div>
            <div className="brand-sub">Nhận dạng tiếng Việt · VNSL</div>
          </div>
        </div>
      </header>

      <div className="app-body">
        {/* ── LEFT: input ── */}
        <aside className="panel-left" data-mobile-active={mobilePanel === 'input'}>
          <div className="input-mode-toggle">
            <button
              className={inputMode === 'voice' ? 'active' : ''}
              onClick={() => setInputMode('voice')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/>
                <path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V20H9v2h6v-2h-2v-2.07A7 7 0 0 0 19 11h-2z"/>
              </svg>
              Giọng nói
            </button>
            <button
              className={inputMode === 'text' ? 'active' : ''}
              onClick={() => setInputMode('text')}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-1 14H5V6h14v12zM7 9h10v2H7zm0 4h7v2H7z"/>
              </svg>
              Văn bản
            </button>
            <button
              className={inputMode === 'sign' ? 'active' : ''}
              onClick={() => setInputMode('sign')}
              title="Nhận dạng ký hiệu → văn bản"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13">
                <path d="M7 6c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0 2C5.34 8 2 8.9 2 10.5V12h10v-1.5C12 8.9 8.66 8 7 8zm10-2c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0 2c-1.66 0-5 .9-5 2.5V12h10v-1.5C22 8.9 18.66 8 17 8zm-5 6c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1zm0 2c-1.66 0-5 .9-5 2.5V20h10v-1.5C17 16.9 13.66 16 12 16z"/>
              </svg>
              Ký hiệu
            </button>
          </div>

          {inputMode === 'voice' ? (
            <AudioRecorder
              onStartRecording={handleStartRecording}
              onPartial={handlePartial}
              onFinal={handleFinal}
              onError={handleError}
              onConnect={handleConnect}
            />
          ) : inputMode === 'text' ? (
            <TextInput
              onStart={handleStartRecording}
              onSubmit={handleFinal}
              onError={handleError}
            />
          ) : (
            <SignInput
              onStart={handleStartRecording}
              onSubmit={handleFinal}
              onError={handleError}
            />
          )}

          {loading && (
            <p className="status-msg">
              <span className="spinner" />
              Đang nhận dạng...
            </p>
          )}
          {error && (
            <p className="status-msg error">{error}</p>
          )}

          {(transcript || glosses.length > 0) && (
            <TranscriptDisplay
              transcript={transcript}
              glosses={glosses}
              activeGloss={activeGloss}
            />
          )}

          <HistoryPanel history={history} onSelect={handleHistorySelect} />
        </aside>

        {/* ── RIGHT: output ── */}
        <section className="panel-right" data-mobile-active={mobilePanel === 'output'}>
          <div className="output-card">
            <div className="output-card-header">
              <span className="output-card-title">Ngôn ngữ ký hiệu</span>
              <div className="output-header-controls">
                {hasOutput && (
                  <button className="replay-btn" onClick={handleReplay} title="Xem lại">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                    </svg>
                  </button>
                )}
                <div className="speed-toggle">
                  {[0.5, 1, 1.5].map(s => (
                    <button key={s} className={speed === s ? 'active' : ''} onClick={() => setSpeed(s)}>
                      {s}×
                    </button>
                  ))}
                </div>
                <div className="mode-toggle">
                  <button
                    className={mode === 'avatar' ? 'active' : ''}
                    onClick={() => setMode('avatar')}
                  >
                    Avatar 3D
                  </button>
                  <button
                    className={mode === 'video' ? 'active' : ''}
                    onClick={() => setMode('video')}
                  >
                    Video clip
                  </button>
                </div>
              </div>
            </div>

            <div className="output-card-body">
              {!hasOutput ? (
                <EmptyState />
              ) : mode === 'avatar' ? (
                <ErrorBoundary label="Không thể tải avatar 3D">
                  <Suspense fallback={<div className="avatar-loading"><span className="spinner" />Đang tải...</div>}>
                    <AvatarPlayer
                      glosses={glosses}
                      sessionKey={sessionKey}
                      isFinal={isFinal}
                      onGlossChange={setActiveGloss}
                      speed={speed}
                      replayCount={replayCount}
                    />
                  </Suspense>
                </ErrorBoundary>
              ) : (
                <ErrorBoundary label="Không thể phát video">
                  <VideoPlayer
                    glosses={glosses}
                    sessionKey={sessionKey}
                    isFinal={isFinal}
                    onGlossChange={setActiveGloss}
                    speed={speed}
                    replayCount={replayCount}
                  />
                </ErrorBoundary>
              )}
            </div>
          </div>
        </section>
      </div>

      <nav className="mobile-nav" aria-label="Điều hướng">
        <button
          className={mobilePanel === 'input' ? 'active' : ''}
          onClick={() => setMobilePanel('input')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z"/>
            <path d="M17 11a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V20H9v2h6v-2h-2v-2.07A7 7 0 0 0 19 11h-2z"/>
          </svg>
          <span>Đầu vào</span>
        </button>
        <button
          className={mobilePanel === 'output' ? 'active' : ''}
          onClick={() => setMobilePanel('output')}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
            <path d="M21 3H3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-9 14-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/>
          </svg>
          <span>Kết quả</span>
          {glosses.length > 0 && mobilePanel !== 'output' && (
            <span className="mobile-nav-badge" />
          )}
        </button>
      </nav>
    </div>
  )
}
