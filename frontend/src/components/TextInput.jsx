import { useCallback, useState } from 'react'

export default function TextInput({ onSubmit, onStart, onError }) {
  const [text, setText]       = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    onStart?.()
    setLoading(true)

    try {
      const res = await fetch('/api/text-to-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      onSubmit?.({ transcript: data.transcript, all_glosses: data.glosses })
    } catch (err) {
      onError?.(err.message || 'Không thể kết nối máy chủ')
    } finally {
      setLoading(false)
    }
  }, [text, loading, onSubmit, onStart, onError])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
  }, [handleSubmit])

  return (
    <div className="text-input-card">
      <textarea
        className="text-input-area"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Nhập câu tiếng Việt..."
        rows={4}
        disabled={loading}
        spellCheck={false}
        autoCorrect="off"
      />
      <div className="text-input-footer">
        <span className="text-input-hint">Ctrl + Enter để gửi</span>
        <button
          className="text-submit-btn"
          onClick={handleSubmit}
          disabled={!text.trim() || loading}
        >
          {loading
            ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.25)' }} /> Đang xử lý...</>
            : 'Dịch ký hiệu →'}
        </button>
      </div>
    </div>
  )
}
