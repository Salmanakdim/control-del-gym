import { useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../contexts/AuthContext'
import { appToday } from './pathConfig'

// Corán por páginas del mushaf (604). Texto, traducciones y audio de alquran.cloud
// (gratis, sin clave). Los ajustes y el marcador van en los metadatos del usuario
// (clave `quran`), así son los mismos en el móvil y en el PC.

export const TOTAL_PAGES = 604

export const TRANSLATIONS = [
  { id: 'none',          label: 'Sin traducción' },
  { id: 'es.cortes',     label: 'Español · Julio Cortés' },
  { id: 'es.asad',       label: 'Español · Muhammad Asad' },
  { id: 'es.garcia',     label: 'Español · García' },
  { id: 'es.bornez',     label: 'Español · Bornez' },
  { id: 'en.sahih',      label: 'English · Saheeh International' },
  { id: 'fr.hamidullah', label: 'Français · Hamidullah' },
]

export const RECITERS = [
  { id: 'ar.alafasy',      label: 'Mishary Alafasy' },
  { id: 'ar.husary',       label: 'Mahmoud Al-Husary' },
  { id: 'ar.minshawi',     label: 'Al-Minshawi' },
  { id: 'ar.mahermuaiqly', label: 'Maher Al-Muaiqly' },
]

const DEFAULTS = { page: 1, translation: 'es.cortes', reciter: 'ar.alafasy', goal: 2, log: {} }

export function useQuranSettings() {
  const { user } = useAuth()
  const [q, setQ] = useState(() => ({ ...DEFAULTS, ...(user?.user_metadata?.quran || {}) }))
  function save(changes) {
    setQ(prev => {
      const next = { ...prev, ...changes }
      supabase.auth.updateUser({ data: { quran: next } })
      return next
    })
  }
  return [q, save]
}

// Páginas leídas hoy (y se guardan solo los últimos 30 días)
export const pagesToday = q => q.log?.[appToday()] || []
export function withPageRead(q, page) {
  const today = appToday()
  const day = [...new Set([...(q.log?.[today] || []), page])]
  const all = { ...(q.log || {}), [today]: day }
  return Object.fromEntries(Object.keys(all).sort().slice(-30).map(d => [d, all[d]]))
}

export const audioUrl = (reciter, ayah) => `https://cdn.islamic.network/quran/audio/128/${reciter}/${ayah}.mp3`

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ'
const cache = new Map()

// Una página: [{ n (nº global, para el audio), s, surah, surahEs, k (nº en la sura), juz, text, tr }]
export function loadPage(page, translation) {
  const key = `${page}|${translation}`
  if (!cache.has(key)) {
    const get = ed => fetch(`https://api.alquran.cloud/v1/page/${page}/${ed}`).then(r => r.json()).then(j => {
      if (j.code !== 200) throw new Error(j.data || 'error')
      return j.data.ayahs
    })
    const p = Promise.all([get('quran-uthmani'), translation === 'none' ? null : get(translation)]).then(([ar, tr]) =>
      ar.map((a, i) => {
        let text = a.text.trimStart()   // la página 1 empieza con un carácter invisible (BOM)
        // La bismillah viene pegada a la aleya 1 de cada sura (salvo la 1, donde es la aleya, y la 9)
        const bism = a.numberInSurah === 1 && a.surah.number !== 1 && text.startsWith(BISMILLAH)
        if (bism) text = text.slice(BISMILLAH.length).trim()
        return {
          n: a.number, s: a.surah.number, surah: a.surah.name, surahEs: a.surah.englishName,
          k: a.numberInSurah, juz: a.juz, text, bism, tr: tr?.[i]?.text || '',
        }
      }))
    p.catch(() => cache.delete(key))   // si falla (sin internet), se vuelve a intentar la próxima vez
    cache.set(key, p)
  }
  return cache.get(key)
}

// Números árabes para el final de cada aleya
export const arabicNumber = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d])
