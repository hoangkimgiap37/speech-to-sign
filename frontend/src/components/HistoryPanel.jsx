function formatTime(date) {
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export default function HistoryPanel({ history, onSelect }) {
  if (!history.length) return null

  return (
    <div className="history-panel">
      <div className="history-header">
        <span className="label">Lịch sử</span>
        <span className="history-badge">{history.length}</span>
      </div>
      <div className="history-list">
        {history.map(entry => {
          const signCount = entry.glosses.filter(g => !g.startsWith('FS:')).length
          return (
            <button key={entry.id} className="history-item" onClick={() => onSelect(entry)}>
              <span className="history-transcript">{entry.transcript}</span>
              <span className="history-meta">
                <span className="history-count">{signCount} ký hiệu</span>
                <span className="history-time">{formatTime(entry.time)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
