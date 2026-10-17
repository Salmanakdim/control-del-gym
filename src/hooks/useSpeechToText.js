import { useCallback, useEffect, useRef, useState } from 'react'

const SpeechRecognitionApi =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

// Dicta por voz y entrega cada frase final ya transcrita (ej. lang='ar-SA').
export function useSpeechToText({ lang = 'ar-SA', onResult } = {}) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => () => recognitionRef.current?.stop(), [])

  const start = useCallback(() => {
    if (!SpeechRecognitionApi || recognitionRef.current) return
    const recognition = new SpeechRecognitionApi()
    recognition.lang = lang
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) onResultRef.current?.(e.results[i][0].transcript.trim())
      }
    }
    recognition.onerror = () => { setListening(false); recognitionRef.current = null }
    recognition.onend = () => { setListening(false); recognitionRef.current = null }

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [lang])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
  }, [])

  const toggle = useCallback(() => {
    listening ? stop() : start()
  }, [listening, start, stop])

  return { listening, supported: !!SpeechRecognitionApi, toggle }
}
