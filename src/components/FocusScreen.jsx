import { useState } from 'react'
import { X, Check, Play } from 'lucide-react'
import Flowy from './Flowy'
import { visionForToday } from '../lib/vision'

// Pantalla de concentración: se abre al tocar un recordatorio. Fondo del color de la
// parada que toca, con una foto del vision board difuminada detrás, y por dónde vas.
const PHRASES = [
  'Concéntrate 🎯',
  'Un paso más 💪',
  'Enfócate en lo que toca 🧠',
  'Menos móvil, más camino 📵',
  'Tu yo del futuro te lo agradecerá ✨',
  'Sigue, vas bien 🌱',
  'Ahora es el momento ⏳',
]
const GOLD = { bg: '#ffc800', shadow: '#e0a800' }

// doLabel(parada): nombre de la sección de la app donde se hace (Metas, Afirmaciones…) o null
export default function FocusScreen({ stops, colorsOf, visionImages, onDone, onDo, doLabel, onClose }) {
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)])
  const [img] = useState(() => {
    const list = visionForToday(visionImages)
    return list[Math.floor(Math.random() * Math.min(list.length, 4))] || null
  })

  const todo    = stops.filter(st => !st.skipped)
  const done    = todo.filter(st => st.done).length
  const total   = todo.length
  const current = todo.find(st => !st.done) || null
  const pct     = total ? Math.round((done / total) * 100) : 0
  const colors  = current ? colorsOf(current.id) : GOLD
  const where   = current && current.canDo ? doLabel(current) : null

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden flex flex-col sheet-up"
      style={{ background: `linear-gradient(160deg, ${colors.bg}, ${colors.shadow})` }}>
      {img && <img src={img} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40 pointer-events-none select-none" />}
      <div className="absolute inset-0 bg-black/25 pointer-events-none" />

      <div className="relative flex-1 flex flex-col px-6"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
        <button onClick={onClose} aria-label="Cerrar"
          className="self-end w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center active:bg-white/30">
          <X size={20} />
        </button>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <Flowy mood={current ? 'push' : 'win'} size={96} />
          <h1 className="mt-5 text-white text-3xl font-black leading-tight drop-shadow-sm">
            {current ? phrase : '¡Camino completado! 🏆'}
          </h1>

          {current ? (
            <>
              <p className="mt-8 text-white/75 text-xs font-black uppercase tracking-widest">Ahora toca</p>
              <div className="mt-3 flex items-center gap-3 bg-white/95 rounded-3xl pl-3 pr-5 py-3 shadow-lg max-w-full">
                <span className="w-14 h-14 flex-shrink-0 rounded-2xl flex items-center justify-center text-3xl"
                  style={{ background: colors.bg, boxShadow: `0 4px 0 ${colors.shadow}` }}>{current.icon}</span>
                <span className="text-left text-lg font-black text-slate-800 leading-snug line-clamp-2">{current.label}</span>
              </div>
            </>
          ) : (
            <p className="mt-4 text-white/85 text-sm font-bold">Hoy ya lo has hecho todo. Disfruta del descanso.</p>
          )}

          {total > 0 && (
            <div className="mt-10 w-full max-w-xs">
              <div className="h-3 bg-white/25 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-white text-sm font-black tabular-nums">{done} de {total} paradas · {pct} %</p>
            </div>
          )}
        </div>

        {current ? (
          <div className="space-y-2">
            {/* Se hace dentro de la app (Metas, Afirmaciones…): se abre ahí y al terminar se marca */}
            {where && (
              <button onClick={() => onDo(current)}
                className="w-full py-4 rounded-2xl bg-white text-lg font-black flex items-center justify-center gap-2 active:translate-y-1 transition-transform"
                style={{ color: colors.shadow, boxShadow: '0 5px 0 rgba(0,0,0,.18)' }}>
                <Play size={20} fill="currentColor" /> Hacer ahora · {where}
              </button>
            )}
            <button onClick={() => onDone(current)}
              className={where
                ? 'w-full py-3.5 rounded-2xl bg-white/20 text-white text-base font-black flex items-center justify-center gap-2 active:bg-white/30'
                : 'w-full py-4 rounded-2xl bg-white text-lg font-black flex items-center justify-center gap-2 active:translate-y-1 transition-transform'}
              style={where ? undefined : { color: colors.shadow, boxShadow: '0 5px 0 rgba(0,0,0,.18)' }}>
              <Check size={where ? 19 : 22} strokeWidth={3} /> {current.canCheck === false ? 'Escribir mi foco' : where ? 'Ya está hecho' : 'Hecho'}
            </button>
            <button onClick={onClose} className="w-full py-3 text-white/85 text-sm font-black">Ahora no</button>
          </div>
        ) : (
          <button onClick={onClose}
            className="w-full py-4 rounded-2xl bg-white text-lg font-black text-amber-600" style={{ boxShadow: '0 5px 0 rgba(0,0,0,.18)' }}>
            Volver al camino
          </button>
        )}
      </div>
    </div>
  )
}
