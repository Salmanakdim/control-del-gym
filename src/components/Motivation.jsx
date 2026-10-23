import { X } from 'lucide-react'
import Flowy from './Flowy'
import { ACHIEVEMENTS } from '../lib/achievements'

// Hoja con todas las medallas (conseguidas en color, el resto en gris) y el nivel de Flowy
export function AchievementsSheet({ unlocked, perfect, level, onClose }) {
  const NEXT = [[3, 'una cinta 🎽'], [7, 'gafas de sol 😎'], [14, 'una corona 👑'], [30, 'la corona dorada ✨']]
  const next = NEXT.find(([d]) => perfect < d)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl px-5 pt-3 pb-8 max-h-[88vh] overflow-y-auto sheet-up"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />
        <button onClick={onClose} aria-label="Cerrar"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          <X size={16} />
        </button>

        <div className="flex items-center gap-4">
          <Flowy mood={perfect > 0 ? 'win' : 'idle'} size={84} level={level} />
          <div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Días perfectos seguidos</p>
            <p className="text-4xl font-black text-slate-800 tabular-nums">{perfect}</p>
            <p className="text-xs text-slate-500 font-semibold">
              {next ? `Con ${next[0]} días, Flowy gana ${next[1]}` : '¡Flowy está al máximo!'}
            </p>
          </div>
        </div>

        <p className="mt-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">
          🏅 Logros · {Object.keys(unlocked).length}/{ACHIEVEMENTS.length}
        </p>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {ACHIEVEMENTS.map(a => {
            const got = unlocked[a.id]
            return (
              <div key={a.id} className={`rounded-2xl p-3 border ${got ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                <p className="text-3xl" style={got ? undefined : { filter: 'grayscale(1)', opacity: 0.35 }}>{a.emoji}</p>
                <p className={`mt-1 text-sm font-black ${got ? 'text-slate-800' : 'text-slate-400'}`}>{a.title}</p>
                <p className="text-[11px] text-slate-500 leading-snug">{a.desc}</p>
                {got && <p className="mt-1 text-[10px] font-bold text-amber-600">✓ {new Date(got + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Pantalla de "¡Día completado!" (una vez al día)
export function DayCompleteOverlay({ perfect, level, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-gradient-to-b from-amber-300/95 to-orange-400/95 reward-pop"
      onClick={onClose}>
      <div className="text-center">
        <div className="flex justify-center"><Flowy mood="win" size={150} level={level} /></div>
        <h2 className="mt-4 text-4xl font-black text-white drop-shadow">¡Día completado!</h2>
        <p className="mt-2 text-lg font-bold text-white/90">
          {perfect > 1 ? `🔥 ${perfect} días perfectos seguidos` : 'Has llegado al 🏆. ¡Así se hace!'}
        </p>
        <button onClick={onClose} className="mt-8 px-8 py-3.5 rounded-2xl bg-white text-orange-600 font-black text-sm uppercase tracking-wide shadow-[0_5px_0_#fed7aa]">
          Seguir
        </button>
      </div>
    </div>
  )
}

// Aviso de medalla nueva
export function MedalToast({ achievement, onClose }) {
  return (
    <button onClick={onClose}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 pl-3 pr-5 py-3 rounded-2xl bg-white shadow-2xl border border-amber-200 sheet-up">
      <span className="text-3xl">{achievement.emoji}</span>
      <span className="text-left">
        <span className="block text-[10px] font-black text-amber-600 uppercase tracking-widest">¡Nuevo logro!</span>
        <span className="block text-sm font-black text-slate-800">{achievement.title}</span>
      </span>
    </button>
  )
}
