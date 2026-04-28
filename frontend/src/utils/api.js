const BASE = '/api'

export async function transcribeAudio(blob) {
  const form = new FormData()
  form.append('file', blob, 'recording.webm')

  const res = await fetch(`${BASE}/transcribe`, { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Lỗi ${res.status}`)
  }
  return res.json()
}
