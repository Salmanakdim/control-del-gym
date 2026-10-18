import { useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../contexts/AuthContext'

// Configuración del Camino al éxito. Se guarda en los metadatos del usuario de Supabase
// para que sea la misma en el móvil y en el PC (sin tabla nueva).

// Secciones de la app donde se puede "hacer" una parada.
// inline: se abre dentro de un panel encima del camino; si no, se navega a la sección.
export const PATH_LINKS = {
  none:         { label: 'Fuera de la app',  emoji: '🌍' },
  metas:        { label: 'Metas',            emoji: '🎯', inline: true },
  afirmaciones: { label: 'Afirmaciones',     emoji: '✨', inline: true },
  respiracion:  { label: 'Meditación',       emoji: '🧘', inline: true },
  sueno:        { label: 'Sueño',            emoji: '😴', inline: true },
  notes:        { label: 'Notas',            emoji: '📝', inline: true },
  pomodoro:     { label: 'Pomodoro',         emoji: '🍅', inline: true },
  revision:     { label: 'Revisión diaria',  emoji: '📋', inline: true },
  cuerpo:       { label: 'Mi cuerpo',        emoji: '⚖️', inline: true },
  log:          { label: 'Entrenamiento',    emoji: '🏋️' },
  tasks:        { label: 'Tareas',           emoji: '✅' },
  calendar:     { label: 'Calendario',       emoji: '📅' },
}

// Propuesta inicial según el nombre del hábito (luego se cambia en el panel)
export function guessLink(name = '') {
  const n = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (n.includes('meta')) return 'metas'
  if (n.includes('afirm')) return 'afirmaciones'
  if (n.includes('medit') || n.includes('respir')) return 'respiracion'
  if (n.includes('dorm') || n.includes('suen')) return 'sueno'
  if (n.includes('revis')) return 'revision'
  if (n.includes('pomodoro') || n.includes('estudi')) return 'pomodoro'
  if (n.includes('gym') || n.includes('entren')) return 'log'
  if (n.includes('peso') || n.includes('cuerpo')) return 'cuerpo'
  if (n.includes('nota') || n.includes('diario')) return 'notes'
  return 'none'
}

export const DEFAULT_REWARDS = [
  '🎧 Escuchar música',
  '🎮 Jugar a un videojuego',
  '🚶 Dar un paseo corto',
  '☕ Tomar un café o un té con calma',
  '🌞 Salir a tomar el aire',
  '🤸 Estirar el cuerpo',
  '📞 Hablar con alguien que quieres',
  '📖 Leer algo que te guste',
]

const DEFAULTS = {
  chests:   [3, 7],   // cofre después de la parada nº 3 y nº 7
  rewards:  DEFAULT_REWARDS,
  breakMin: 10,
  links:    {},       // { habitId: 'metas' | ... }
}

export function usePathConfig() {
  const { user } = useAuth()
  const [config, setConfig] = useState(() => ({ ...DEFAULTS, ...(user?.user_metadata?.flow_path || {}) }))

  function save(changes) {
    setConfig(prev => {
      const next = { ...prev, ...changes }
      supabase.auth.updateUser({ data: { flow_path: next } })
      return next
    })
  }

  return [config, save]
}

// Cofres abiertos hoy (solo en este dispositivo, se reinicia cada día)
function chestKey() {
  const d = new Date()
  return `fwd_chests_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}
export function readOpenedChests() {
  try { return new Set(JSON.parse(localStorage.getItem(chestKey()) || '[]')) } catch { return new Set() }
}
export function writeOpenedChests(set) {
  try { localStorage.setItem(chestKey(), JSON.stringify([...set])) } catch { /* sin almacenamiento */ }
}
