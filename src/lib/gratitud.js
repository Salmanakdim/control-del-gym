import { useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../contexts/AuthContext'
import { appToday } from './pathConfig'

// 🤲 Gratitud en tres niveles. Las fotos de cada nivel van en los metadatos del
// usuario (clave `gratitud`); lo que se escribe cada día, en la tabla gratitude_entries.

export const LEVELS = [
  {
    id: 'salud', emoji: '❤️', title: 'Salud',
    color: 'from-emerald-500 to-teal-600',
    prompts: [
      '¿Qué ha podido hacer hoy tu cuerpo por lo que das gracias?',
      '¿Qué parte de tu salud das por hecha y es un regalo?',
      '¿Qué te ha hecho sentir fuerte o con energía hoy?',
    ],
  },
  {
    id: 'familia', emoji: '👨‍👩‍👧', title: 'Familia',
    color: 'from-rose-500 to-pink-600',
    prompts: [
      '¿Por qué persona de tu familia das gracias hoy, y por qué?',
      '¿Qué momento con los tuyos quieres recordar?',
      '¿Qué te han dado tu familia que no se compra con dinero?',
    ],
  },
  {
    id: 'logros', emoji: '🏆', title: 'Lo que tengo y he logrado',
    color: 'from-amber-500 to-orange-600',
    prompts: [
      '¿Qué tienes hoy que antes solo soñabas?',
      '¿Qué has conseguido, aunque sea pequeño, por lo que das gracias?',
      '¿Qué paso que diste en el pasado te ha traído hasta aquí?',
    ],
  },
]

// Una pregunta distinta cada día, para que no sea siempre lo mismo
export function promptOf(level, date = appToday()) {
  const day = Math.floor(Date.parse(date) / 86400000)
  return level.prompts[day % level.prompts.length]
}

export function useGratitudPhotos() {
  const { user } = useAuth()
  const [photos, setPhotos] = useState(() => user?.user_metadata?.gratitud?.photos || {})
  function save(next) {
    setPhotos(next)
    supabase.auth.updateUser({ data: { gratitud: { photos: next } } })
  }
  return [photos, save]
}

export async function loadEntries(userId) {
  const { data, error } = await supabase.from('gratitude_entries')
    .select('date, salud, familia, logros')
    .eq('user_id', userId).order('date', { ascending: false }).limit(400)
  if (error) throw error
  return data
}

export async function saveEntry(userId, date, level, text) {
  const { error } = await supabase.from('gratitude_entries')
    .upsert({ user_id: userId, date, [level]: text, updated_at: new Date().toISOString() })
  if (error) throw error
}

export const daysAgo = date => Math.round((Date.parse(appToday()) - Date.parse(date)) / 86400000)
