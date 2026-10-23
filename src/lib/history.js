import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { localDate, isScheduled, marksFor, customDoneFor, focusFor } from './pathConfig'

// Historial de los últimos días para rachas, logros y resumen semanal.
// Hábitos: habit_logs. Paradas propias y foco: customLog/focusLog de la config
// (y path_logs si existe la tabla). Hoy siempre se toma del camino en vivo.

export const HISTORY_DAYS = 60

export function shiftDate(date, days) {
  const d = new Date(date + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return localDate(d)
}

// Día en que empezó a existir la parada (para no contar días en que no estaba)
export function stopSince(stop, habits) {
  if (stop.kind === 'habit') {
    const h = habits.find(x => x.id === stop.id)
    return h?.created_at ? localDate(new Date(h.created_at)) : null
  }
  if (stop.kind === 'custom') {
    // newId: prefijo + Date.now() en base 36 + 4 letras al azar
    const ms = parseInt(stop.id.replace(/^c_(pray_)?/, '').slice(0, -4), 36)
    return ms > 1.5e12 && ms < 4e12 ? localDate(new Date(ms)) : null
  }
  return null
}

// Carga una vez (y al cambiar de día) qué se hizo cada día: Set de "id|fecha"
export function useHistory(userId, today) {
  const [logs, setLogs] = useState(null)
  useEffect(() => {
    const from = shiftDate(today, -HISTORY_DAYS)
    Promise.all([
      supabase.from('habit_logs').select('habit_id,date').eq('user_id', userId).gte('date', from),
      supabase.from('path_logs').select('stop_id,date').eq('user_id', userId).gte('date', from).then(r => r, () => ({ data: [] })),
    ]).then(([hl, pl]) => {
      const set = new Set()
      ;(hl.data || []).forEach(r => set.add(`${r.habit_id}|${r.date}`))
      ;(pl.data || []).forEach(r => set.add(`${r.stop_id}|${r.date}`))
      setLogs(set)
    })
  }, [userId, today])
  return logs
}

// ¿Se hizo la parada ese día? Hoy manda el estado en vivo (liveDone).
export function makeIsDone({ logs, config, today, liveDone }) {
  return (id, date) => {
    if (date === today) return liveDone.has(id)
    if (logs?.has(`${id}|${date}`)) return true
    if (id === '__focus') return !!focusFor(config, date).done
    return customDoneFor(config, date).includes(id)
  }
}

// Racha de una parada: días seguidos hechos. Los días que no toca o saltados (⏭️) no la
// rompen; hoy, si aún no está hecha, tampoco (todavía hay tiempo).
export function stopStreak(id, { isDone, config, today, since = {} }) {
  let n = 0
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const d = shiftDate(today, -i)
    if (since[id] && d < since[id]) break
    if (!isScheduled(config, id, d) || marksFor(config, d)[id]?.s === 'skipped') continue
    if (isDone(id, d)) n++
    else if (d === today) continue
    else break
  }
  return n
}

// ¿Día completo? Todas las paradas que tocaban ese día (sin contar las saltadas) hechas.
export function dayComplete(date, stopIds, { isDone, config, since = {} }) {
  const due = stopIds.filter(id => !(since[id] && date < since[id]) && isScheduled(config, id, date) && marksFor(config, date)[id]?.s !== 'skipped')
  return due.length > 0 && due.every(id => isDone(id, date))
}

// Días perfectos seguidos (hoy cuenta si ya está completo; si no, desde ayer)
export function perfectStreak(stopIds, ctx) {
  let n = 0
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const d = shiftDate(ctx.today, -i)
    if (dayComplete(d, stopIds, ctx)) n++
    else if (i === 0) continue
    else break
  }
  return n
}

// Accesorios de Flowy según los días perfectos seguidos
export function flowyLevel(perfectDays) {
  return perfectDays >= 30 ? 4 : perfectDays >= 14 ? 3 : perfectDays >= 7 ? 2 : perfectDays >= 3 ? 1 : 0
}
