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
  hidden:   [],       // paradas ocultas (id de hábito o '__focus')
  custom:   [],       // paradas propias: [{ id, icon, label, link }]
  customDone: { date: '', ids: [] }, // paradas propias hechas hoy
  colors:   {},       // { id: 'green' | 'blue' | ... }
  // chestList: ['chest_xxx', ...] — cofres; su posición va en `order` junto a las paradas
}

// Colores que se pueden elegir para cada parada (relleno + sombra 3D)
export const STOP_COLORS = {
  green:  { bg: '#58cc02', shadow: '#46a302' },
  blue:   { bg: '#1cb0f6', shadow: '#1899d6' },
  purple: { bg: '#ce82ff', shadow: '#a568cc' },
  pink:   { bg: '#ff86d0', shadow: '#e06bb5' },
  orange: { bg: '#ff9600', shadow: '#e08600' },
  red:    { bg: '#ff4b4b', shadow: '#d33a3a' },
  teal:   { bg: '#00cd9c', shadow: '#00a881' },
  indigo: { bg: '#6366f1', shadow: '#4f46e5' },
}

// Id único para paradas y cofres nuevos
export function newId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// Las 5 oraciones del día, para añadirlas como paradas
export const PRAYERS = [
  { icon: '🌅', label: 'Fajr' },
  { icon: '☀️', label: 'Dhuhr' },
  { icon: '🌤️', label: 'Asr' },
  { icon: '🌇', label: 'Maghrib' },
  { icon: '🌙', label: 'Isha' },
]

export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
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
