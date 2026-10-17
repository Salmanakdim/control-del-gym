import { Mic, MicOff } from 'lucide-react'
import { useSpeechToText } from '../hooks/useSpeechToText'

// Botón de micrófono: dicta en árabe y añade cada frase reconocida al texto actual.
export default function MicButton({ onText, lang = 'ar-SA', size = 15, className = '' }) {
  const { listening, supported, toggle } = useSpeechToText({ lang, onResult: onText })

  if (!supported) return null

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? 'Detener dictado' : 'Dictar en árabe'}
      className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
        listening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 active:bg-slate-200'
      } ${className}`}
    >
      {listening ? <MicOff size={size} /> : <Mic size={size} />}
    </button>
  )
}
