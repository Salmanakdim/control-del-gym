import { useState, useEffect } from 'react'

// Accesos rápidos del Inicio: se eligen desde el menú (mantener pulsado → Añadir al Inicio)
export const QUICK_CATALOG = {
  mentor:       { emoji: '🧠', label: 'Mentor',        bg: '#ede9fe', fg: '#6d28d9' },
  tasks:        { emoji: '✅', label: 'Tareas',        bg: '#dbeafe', fg: '#1d4ed8' },
  calendar:     { emoji: '📅', label: 'Calendario',    bg: '#dbeafe', fg: '#1d4ed8' },
  pomodoro:     { emoji: '🍅', label: 'Pomodoro',      bg: '#fee2e2', fg: '#b91c1c' },
  notes:        { emoji: '📝', label: 'Notas',         bg: '#f3e8ff', fg: '#7c3aed' },
  afirmaciones: { emoji: '✨', label: 'Afirmaciones',  bg: '#fdf4ff', fg: '#7c3aed' },
  revision:     { emoji: '📋', label: 'Revisión',      bg: '#ecfccb', fg: '#4d7c0f' },
  habits:       { emoji: '🔥', label: 'Hábitos',       bg: '#ffedd5', fg: '#c2410c' },
  metas:        { emoji: '🎯', label: 'Metas',         bg: '#eff6ff', fg: '#1d4ed8' },
  respiracion:  { emoji: '🧘', label: 'Meditación',    bg: '#e0f2fe', fg: '#0369a1' },
  log:          { emoji: '🏋️', label: 'Entreno',       bg: '#ede9fe', fg: '#6d28d9' },
  cuerpo:       { emoji: '⚖️', label: 'Mi cuerpo',     bg: '#fef3c7', fg: '#b45309' },
  exercises:    { emoji: '📚', label: 'Ejercicios',    bg: '#f1f5f9', fg: '#334155' },
  progress:     { emoji: '📈', label: 'Progreso',      bg: '#dcfce7', fg: '#15803d' },
  sueno:        { emoji: '😴', label: 'Sueño',         bg: '#e0e7ff', fg: '#4338ca' },
}

const KEY     = 'fwd_quick_nav'
const EVENT   = 'fwd-quick-nav-changed'
const DEFAULT = ['calendar', 'pomodoro', 'respiracion', 'notes', 'afirmaciones', 'metas', 'cuerpo', 'progress']

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    return Array.isArray(saved) ? saved.filter(id => QUICK_CATALOG[id]) : DEFAULT
  } catch { return DEFAULT }
}

function write(ids) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new Event(EVENT))
}

export function useQuickNav() {
  const [ids, setIds] = useState(read)

  useEffect(() => {
    const sync = () => setIds(read())
    window.addEventListener(EVENT, sync)
    return () => window.removeEventListener(EVENT, sync)
  }, [])

  return {
    ids,
    has:    id => ids.includes(id),
    toggle: id => write(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]),
    setAll: write,
  }
}
