import { useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../contexts/AuthContext'
import { appToday, newId } from './pathConfig'

// 📿 Adhkar: listas de frases propias, cada una con su número de repeticiones.
// Las listas van en los metadatos del usuario (clave `adhkar`), iguales en el móvil
// y en el PC. Por dónde vas hoy se guarda solo en el dispositivo (cambia en cada toque).

const EXAMPLE = [{
  id: 'l_oracion', name: 'Después de la oración',
  items: [
    { id: 'i_subhan',  text: 'سُبْحَانَ ٱللَّٰهِ', note: 'SubhanAllah', count: 33 },
    { id: 'i_hamd',    text: 'ٱلْحَمْدُ لِلَّٰهِ', note: 'Alhamdulillah', count: 33 },
    { id: 'i_akbar',   text: 'ٱللَّٰهُ أَكْبَرُ', note: 'Allahu Akbar', count: 34 },
  ],
}]

export function useAdhkar() {
  const { user } = useAuth()
  const [lists, setLists] = useState(() => user?.user_metadata?.adhkar?.lists || EXAMPLE)
  function saveLists(next) {
    setLists(next)
    supabase.auth.updateUser({ data: { adhkar: { lists: next } } })
  }
  return [lists, saveLists]
}

export const newList = () => ({ id: newId('l_'), name: 'Nueva lista', items: [] })
export const newItem = () => ({ id: newId('i_'), text: '', note: '', count: 33 })

// Progreso de hoy de una lista: { idx, counts: { itemId: n } }
const progKey = id => `fwd_adhkar_${id}`
export function readProgress(listId) {
  try {
    const p = JSON.parse(localStorage.getItem(progKey(listId)) || 'null')
    if (p?.date === appToday()) return { idx: p.idx || 0, counts: p.counts || {} }
  } catch { /* sin almacenamiento */ }
  return { idx: 0, counts: {} }
}
export function writeProgress(listId, prog) {
  try { localStorage.setItem(progKey(listId), JSON.stringify({ date: appToday(), ...prog })) } catch { /* sin almacenamiento */ }
}

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
// La lista que corresponde a una parada: la que tenga su nombre dentro del de la parada
export function listForStop(lists, label) {
  const l = norm(label)
  return lists.find(x => x.name.trim() && l.includes(norm(x.name.trim()))) || null
}

export const isArabic = s => /\p{Script=Arabic}/u.test(s || '')
