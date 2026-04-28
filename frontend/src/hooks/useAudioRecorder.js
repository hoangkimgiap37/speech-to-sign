import { useCallback, useRef, useState } from 'react'

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  const startRecording = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }))
      stream.getTracks().forEach((t) => t.stop())
    }

    recorder.start()
    setIsRecording(true)
    setAudioBlob(null)
  }, [])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
    setIsRecording(false)
  }, [])

  return { isRecording, audioBlob, startRecording, stopRecording }
}
