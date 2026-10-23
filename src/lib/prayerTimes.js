import { useState, useEffect } from 'react'

// Horas de oración del día según tu ubicación (API gratuita de Aladhan, método 3 =
// Liga Mundial Musulmana). La ubicación y las horas de cada día se guardan en el
// móvil para no pedirlas cada vez.

const LOC_KEY   = 'fwd_prayer_loc'     // { lat, lng, at }
const CACHE_KEY = 'fwd_prayer_times'   // { 'AAAA-MM-DD': { Fajr, Dhuhr, Asr, Maghrib, Isha } }
const METHOD    = 3
export const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* sin almacenamiento */ }
}

export function savedLocation() { return read(LOC_KEY, null) }

// Pide la ubicación al móvil (redondeada a ~1 km) y la guarda
export function askLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Este dispositivo no da la ubicación'))
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: +pos.coords.latitude.toFixed(2), lng: +pos.coords.longitude.toFixed(2), at: Date.now() }
        write(LOC_KEY, loc)
        resolve(loc)
      },
      err => reject(err),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 6 * 3600 * 1000 },
    )
  })
}

async function fetchTimes(date, loc) {
  const [y, m, d] = date.split('-')
  const url = `https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${loc.lat}&longitude=${loc.lng}&method=${METHOD}`
  const res = await fetch(url)
  const json = await res.json()
  const t = json?.data?.timings
  if (!t) throw new Error('Sin horas')
  return Object.fromEntries(PRAYER_NAMES.map(n => [n, String(t[n]).slice(0, 5)]))
}

// Horas de oración de un día. status: 'ok' | 'loading' | 'noloc' (sin permiso) | 'error'
export function usePrayerTimes(date, enabled) {
  const [state, setState] = useState(() => {
    const cached = read(CACHE_KEY, {})[date]
    return cached ? { times: cached, status: 'ok' } : { times: null, status: 'loading' }
  })
  const [tick, setTick] = useState(0)   // para reintentar tras dar permiso

  useEffect(() => {
    if (!enabled) return
    let alive = true
    const cache = read(CACHE_KEY, {})
    if (cache[date]) { Promise.resolve().then(() => alive && setState({ times: cache[date], status: 'ok' })); return () => { alive = false } }
    const loc = savedLocation()
    const getLoc = loc && Date.now() - loc.at < 7 * 86400000 ? Promise.resolve(loc) : askLocation()
    getLoc
      .then(l => fetchTimes(date, l))
      .then(times => {
        const all = { ...read(CACHE_KEY, {}), [date]: times }
        const keep = Object.keys(all).sort().slice(-14)
        write(CACHE_KEY, Object.fromEntries(keep.map(k => [k, all[k]])))
        if (alive) setState({ times, status: 'ok' })
      })
      .catch(err => { if (alive) setState({ times: null, status: err?.code === 1 ? 'noloc' : 'error' }) })
    return () => { alive = false }
  }, [date, enabled, tick])

  function retry() {
    askLocation().then(() => {
      write(CACHE_KEY, {})   // la ubicación cambió: recalcular
      setTick(t => t + 1)
    }).catch(() => setState({ times: null, status: 'noloc' }))
  }

  return { ...state, retry }
}
