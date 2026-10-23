import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { localDate } from '../lib/pathConfig'

// Barra encima del camino para ir a días anteriores (y volver a hoy).
// El calendario colorea cada día según los hábitos del camino que se hicieron.

const MAX_BACK = 45   // lo mismo que se guarda del historial de paradas propias y foco

function shift(date, days) {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return localDate(d)
}
function label(date, today) {
  if (date === today) return 'Hoy'
  if (date === shift(today, -1)) return 'Ayer'
  return new Date(date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })
}
function colorFor(ratio) {
  if (ratio == null) return 'bg-slate-50 text-slate-300'
  if (ratio >= 1)    return 'bg-[#ffc800] text-amber-900'
  if (ratio >= 0.7)  return 'bg-[#58cc02] text-white'
  if (ratio >= 0.4)  return 'bg-lime-300 text-lime-900'
  if (ratio > 0)     return 'bg-amber-200 text-amber-900'
  return 'bg-slate-200 text-slate-500'
}

export default function DayBar({ day, today, userId, habitIds, onChange }) {
  const [open, setOpen]   = useState(false)
  const [month, setMonth] = useState(() => ({ y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)) - 1 }))
  const [counts, setCounts] = useState(null)   // { fecha: hábitos hechos }
  const oldest = shift(today, -MAX_BACK)

  // Al abrir el calendario: cuántos hábitos del camino se hicieron cada día
  const habitKey = habitIds.join(',')   // clave estable (el array se crea en cada render)
  useEffect(() => {
    if (!open) return
    const ids = new Set(habitKey.split(','))
    supabase.from('habit_logs').select('habit_id,date').eq('user_id', userId).gte('date', oldest)
      .then(({ data }) => {
        const c = {}
        ;(data || []).forEach(l => { if (ids.has(l.habit_id)) c[l.date] = (c[l.date] || 0) + 1 })
        setCounts(c)
      })
  }, [open, userId, oldest, habitKey])

  const first  = new Date(month.y, month.m, 1)
  const pad    = (first.getDay() + 6) % 7   // lunes = 0
  const total  = new Date(month.y, month.m + 1, 0).getDate()
  const days   = [...Array(pad).fill(null), ...Array.from({ length: total }, (_, i) => localDate(new Date(month.y, month.m, i + 1)))]
  const rawTitle = first.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const title  = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1)   // "Octubre de 2026"
  const go     = d => { onChange(d === today ? null : d); setOpen(false) }
  const moveMonth = delta => { const d = new Date(month.y, month.m + delta, 1); setMonth({ y: d.getFullYear(), m: d.getMonth() }) }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button onClick={() => day > oldest && onChange(shift(day, -1))} disabled={day <= oldest} aria-label="Día anterior"
          className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-500 active:bg-slate-50 disabled:opacity-30">
          <ChevronLeft size={18} />
        </button>
        <button onClick={() => { setOpen(o => !o); setMonth({ y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)) - 1 }) }}
          className={`flex-1 h-10 rounded-xl shadow-sm flex items-center justify-center gap-2 text-sm font-black capitalize
            ${day === today ? 'bg-white text-slate-700' : 'bg-blue-600 text-white'}`}>
          <CalendarDays size={15} /> {label(day, today)}
        </button>
        <button onClick={() => day < today && onChange(shift(day, 1) === today ? null : shift(day, 1))} disabled={day >= today} aria-label="Día siguiente"
          className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-500 active:bg-slate-50 disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-12 z-40 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 sheet-up">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => moveMonth(-1)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 active:bg-slate-100"><ChevronLeft size={18} /></button>
              <p className="text-sm font-black text-slate-700">{title}</p>
              <button onClick={() => moveMonth(1)} className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 active:bg-slate-100"><ChevronRight size={18} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(w => <p key={w} className="text-center text-[10px] font-black text-slate-400 py-1">{w}</p>)}
              {days.map((d, i) => {
                if (!d) return <div key={i} />
                const enabled = d >= oldest && d <= today
                const ratio = counts && enabled && habitIds.length ? (counts[d] || 0) / habitIds.length : null
                return (
                  <button key={d} disabled={!enabled} onClick={() => go(d)}
                    className={`aspect-square rounded-lg text-xs font-bold flex items-center justify-center disabled:opacity-25
                      ${colorFor(ratio)} ${d === day ? 'ring-2 ring-blue-600 ring-offset-1' : ''} ${d === today && d !== day ? 'ring-1 ring-slate-400' : ''}`}>
                    {Number(d.slice(8))}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] text-slate-400 text-center mt-2">Color según los hábitos hechos · 🟨 todos</p>
            {day !== today && (
              <button onClick={() => go(today)} className="w-full mt-2 py-2 rounded-xl bg-slate-100 text-xs font-black text-slate-600">Volver a hoy</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
