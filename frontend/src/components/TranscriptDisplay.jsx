export default function TranscriptDisplay({ transcript, glosses, activeGloss }) {
  if (!transcript && !glosses?.length) return null

  const fsWords = [...new Set(
    (glosses || []).filter(g => g.startsWith('FS:')).map(g => g.slice(3).toLowerCase())
  )]

  return (
    <div className="transcript">
      <div className="transcript-row">
        <span className="label">Nhận dạng:</span>
        <span className="transcript-text">{transcript}</span>
      </div>
      <div className="transcript-row">
        <span className="label">VNSL Gloss:</span>
        <div className="gloss-list">
          {glosses.map((g, i) => (
            <span
              key={i}
              className={[
                'gloss-tag',
                g.startsWith('FS:') ? 'fingerspell' : '',
                g === activeGloss ? 'active' : '',
              ].filter(Boolean).join(' ')}
            >
              {g}
            </span>
          ))}
        </div>
      </div>
      {fsWords.length > 0 && (
        <div className="fs-notice">
          <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.75 10.5h-1.5v-5h1.5v5zm0-6.5h-1.5V3.5h1.5V5z"/>
          </svg>
          <span>Đánh vần (chưa có ký hiệu): <strong>{fsWords.join(', ')}</strong></span>
        </div>
      )}
    </div>
  )
}
