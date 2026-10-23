import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePomodoro } from '../contexts/PomodoroContext'
import SuccessPath from '../components/SuccessPath'
import { StopSheet, InlinePage, ChestSheet, TimerSheet, PathSettingsSheet, StatsSheet } from '../components/PathSheets'
import { usePathConfig, PATH_LINKS, readOpenedChests, writeOpenedChests, PRAYERS, newId, useToday, appToday, withMark, withDayEntry, customDoneFor, focusFor, isScheduled, marksFor, weekdayOf } from '../lib/pathConfig'
import DayBar from '../components/DayBar'
import { usePrayerTimes, PRAYER_NAMES } from '../lib/prayerTimes'
import { useHistory, makeIsDone, stopStreak, perfectStreak, dayComplete, stopSince, flowyLevel, shiftDate, HISTORY_DAYS } from '../lib/history'
import { ACHIEVEMENTS, countOpenedChests } from '../lib/achievements'
import { AchievementsSheet, DayCompleteOverlay, MedalToast } from '../components/Motivation'
import { VISION_IMAGES, uploadVisionImage, deleteVisionImage } from '../lib/vision'
import { buildPath } from '../lib/pathModel'

// ── Helpers ────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 6)  return 'Buenas noches'
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}
function greetEmoji() {
  const h = new Date().getHours()
  if (h < 6)  return '🌙'
  if (h < 12) return '☀️'
  if (h < 18) return '⛅'
  return '🌆'
}
function headerGradient() {
  const h = new Date().getHours()
  if (h < 6)  return ['#1e1b4b','#312e81']
  if (h < 12) return ['#1d4ed8','#0ea5e9']
  if (h < 17) return ['#0369a1','#06b6d4']
  if (h < 20) return ['#b45309','#f97316']
  return ['#4338ca','#7c3aed']
}
function formatDate() {
  return new Date().toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' })
}
function calcStreak(logs) {
  const trained = new Set(logs.map(l => l.date))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    if (trained.has(d.toISOString().split('T')[0])) streak++
    else if (i > 0) break
  }
  return streak
}
function fmtSleep(mins) {
  if (!mins) return null
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h${m > 0 ? m+'m' : ''}` : `${m}m`
}

// ── Main ───────────────────────────────────────────────────────────
export default function Dashboard({ logs, setPage }) {
  const { user } = useAuth()
  const { pom } = usePomodoro()

  const [habits,      setHabits]      = useState([])
  const [todayLogs,   setTodayLogs]   = useState(new Set())
  const [todayEvents, setTodayEvents] = useState([])
  const [lastSleep,   setLastSleep]   = useState(null)
  const [loading,     setLoading]     = useState(true)

  const [config, saveConfig]          = usePathConfig()
  const [openedChests, setOpenedChests] = useState(readOpenedChests)
  const [stopSheet,   setStopSheet]   = useState(null)   // id de la parada abierta
  const [inlineLink,  setInlineLink]  = useState(null)   // sección abierta encima del camino
  const [chestSheet,  setChestSheet]  = useState(null)   // { k, alreadyOpen }
  const [showSettings, setShowSettings] = useState(false)
  const [showStats,   setShowStats]   = useState(false)

  // Día actual (local). A la hora de inicio del día (00:00 por defecto) cambia y el
  // camino vuelve a empezar de cero.
  const today = useToday(config.dayStart ?? 0)

  // Día que se está viendo en el camino: hoy (null) o uno pasado, que también se puede corregir
  const [viewDate, setViewDate] = useState(null)
  const day    = viewDate && viewDate < today ? viewDate : today
  const isPast = day !== today
  const [past, setPast] = useState({ date: null, logs: new Set(), extra: new Set() })
  useEffect(() => {
    if (!isPast) return
    Promise.all([
      supabase.from('habit_logs').select('habit_id').eq('user_id', user.id).eq('date', day),
      supabase.from('path_logs').select('stop_id').eq('user_id', user.id).eq('date', day).then(r => r, () => ({ data: [] })),
    ]).then(([{ data: hl }, { data: pl }]) => {
      setPast({ date: day, logs: new Set((hl || []).map(l => l.habit_id)), extra: new Set((pl || []).map(l => l.stop_id)) })
    })
  }, [day, isPast])
  const pastLoading = isPast && past.date !== day

  // ── Foco del día (es una parada más del camino) ───────────────────
  const FOCUS_KEY = 'fwd_focus'
  // Se lee al montar; si es de otro día, se descarta
  const [savedFocus] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FOCUS_KEY) || 'null')
      return saved?.date === appToday(config.dayStart ?? 0) ? saved : null
    } catch { return null }
  })
  const [focusText, setFocusText] = useState(savedFocus?.text || '')
  const [focusDone, setFocusDone] = useState(savedFocus?.done || false)

  // Al pasar la medianoche con la app abierta: todo pendiente otra vez
  const [shownDay, setShownDay] = useState(today)
  if (shownDay !== today) {
    setShownDay(today)
    setViewDate(null)
    setTodayLogs(new Set())
    setFocusText('')
    setFocusDone(false)
    setOpenedChests(readOpenedChests())
    setStopSheet(null)
    setInlineLink(null)
    setChestSheet(null)
  }

  function saveFocus(text) {
    setFocusText(text)
    saveConfig({ focusLog: withDayEntry(config.focusLog, today, { text, done: focusDone }) })
    try { localStorage.setItem(FOCUS_KEY, JSON.stringify({ date: today, text, done: focusDone })) } catch { /* sin almacenamiento */ }
  }

  function toggleFocusDone() {
    const done = !focusDone
    setFocusDone(done)
    logPath('__focus', done)
    saveConfig({ focusLog: withDayEntry(config.focusLog, today, { text: focusText, done }) })
    try { localStorage.setItem(FOCUS_KEY, JSON.stringify({ date: today, text: focusText, done })) } catch { /* sin almacenamiento */ }
  }

  // Historial de paradas propias y foco (para las estadísticas). Si la tabla
  // path_logs aún no existe, falla en silencio y el camino sigue funcionando.
  function logPath(stopId, done, date = today) {
    const q = done
      ? supabase.from('path_logs').upsert({ user_id: user.id, stop_id: stopId, date }, { onConflict: 'user_id,stop_id,date' })
      : supabase.from('path_logs').delete().eq('user_id', user.id).eq('stop_id', stopId).eq('date', date)
    q.then(() => {}, () => {})
  }

  useEffect(() => {
    Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_logs').select('habit_id').eq('user_id', user.id).eq('date', today),
      supabase.from('calendar_events').select('id').eq('user_id', user.id).eq('date', today),
      supabase.from('sleep_logs').select('*').eq('user_id', user.id)
        .not('wake_time', 'is', null).order('bed_time', { ascending:false }).limit(1),
    ]).then(([{data:hab},{data:hl},{data:evs},{data:sl}]) => {
      setHabits(hab || [])
      setTodayLogs(new Set((hl || []).map(l => l.habit_id)))
      setTodayEvents(evs || [])
      setLastSleep(sl?.[0] || null)
      setLoading(false)
    })
  }, [today])

  // Marca/desmarca un hábito en el día que se está viendo (hoy o uno pasado)
  async function toggleHabit(habitId) {
    const logsNow = isPast ? past.logs : todayLogs
    const setLogs = fn => isPast ? setPast(p => ({ ...p, logs: fn(p.logs) })) : setTodayLogs(fn)
    if (logsNow.has(habitId)) {
      setLogs(p => { const n = new Set(p); n.delete(habitId); return n })
      await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', day).eq('user_id', user.id)
    } else {
      setLogs(p => new Set([...p, habitId]))
      await supabase.from('habit_logs').upsert({ user_id: user.id, habit_id: habitId, date: day })
    }
  }

  // ── Camino ────────────────────────────────────────────────────────
  // Modo editar del camino: orden, colores y cofres van a un borrador hasta pulsar Guardar
  const [draft, setDraft] = useState(null)
  const cfg  = draft ? { ...config, ...draft } : config
  // En un día pasado: hábitos de ese día, foco de su historial y paradas propias de
  // customLog + path_logs (si existe la tabla)
  const dayFocus = isPast
    ? { text: focusFor(config, day).text, done: focusFor(config, day).done || past.extra.has('__focus') }
    : { text: focusText, done: focusDone }
  const cfgDay = isPast
    ? { ...cfg, customLog: { ...(cfg.customLog || {}), [day]: [...new Set([...customDoneFor(cfg, day), ...[...past.extra].filter(id => id.startsWith('c_'))])] } }
    : cfg
  const path = buildPath({ config: cfgDay, habits, todayLogs: isPast ? past.logs : todayLogs, focusText: dayFocus.text, focusDone: dayFocus.done, today: day })
  const { custom, customDone, linkOf, chestList, legacyChests, colorsOf } = path

  // Horas de oración (según tu ubicación) en las paradas Fajr, Dhuhr, Asr, Maghrib e Isha
  const hasPrayerStops = path.stops.some(st => st.kind === 'custom' && PRAYER_NAMES.includes(st.label))
  const prayer = usePrayerTimes(day, hasPrayerStops)
  // ── Motivación: rachas por parada, Flowy que evoluciona y logros ──────
  const hist = useHistory(user.id, today)
  const histReady = !!hist && !isPast
  const liveDone = new Set(isPast ? [] : path.stops.filter(st => st.done).map(st => st.id))
  const visibleIds = path.allStops.filter(st => !(config.hidden || []).includes(st.id)).map(st => st.id)
  const logStart = m => Object.keys(m || {}).sort()[0] || today   // desde cuándo hay historial guardado
  const since = Object.fromEntries(path.allStops.map(st => {
    let d = stopSince(st, habits)
    if (st.kind === 'custom') d = [d, logStart(config.customLog)].filter(Boolean).sort().at(-1)
    if (st.kind === 'focus') d = logStart(config.focusLog)
    return [st.id, d]
  }))
  const hctx = { isDone: makeIsDone({ logs: hist, config, today, liveDone }), config, today, since }
  const streaks = histReady ? Object.fromEntries(path.stops.map(st => [st.id, stopStreak(st.id, hctx)])) : {}
  const perfect = histReady ? perfectStreak(visibleIds, hctx) : 0
  const level   = flowyLevel(perfect)
  const lateNight = new Date().getHours() >= 20

  // Estadísticas para los logros
  let bestPerfect = 0
  if (histReady) {
    let run = 0
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const d = shiftDate(today, -i)
      if (dayComplete(d, visibleIds, hctx)) { run++; bestPerfect = Math.max(bestPerfect, run) }
      else if (d !== today) run = 0
    }
  }
  const fajrStop = path.stops.find(st => st.kind === 'custom' && st.label === 'Fajr')
  const medalStats = histReady ? {
    totalDone: [...hist].filter(k => !k.endsWith('|' + today)).length
      + Object.entries(config.customLog || {}).filter(([d]) => d !== today).reduce((n, [, ids]) => n + ids.length, 0)
      + Object.entries(config.focusLog || {}).filter(([d, f]) => d !== today && f.done).length
      + liveDone.size,
    bestPerfect,
    bestStop: Math.max(0, ...Object.values(streaks)),
    fajrStreak: fajrStop ? streaks[fajrStop.id] || 0 : 0,
    chests: countOpenedChests(),
  } : null
  const unlocked = config.achievements || {}
  const newly = medalStats ? ACHIEVEMENTS.filter(a => !unlocked[a.id] && a.test(medalStats)) : []
  const newlyKey = newly.map(a => a.id).join(',')
  const [toast, setToast] = useState(null)
  const [showAch, setShowAch] = useState(false)
  useEffect(() => {
    if (!newlyKey) return
    const t = setTimeout(() => {
      const ids = newlyKey.split(',')
      saveConfig({ achievements: { ...(config.achievements || {}), ...Object.fromEntries(ids.map(id => [id, today])) } })
      setToast(ACHIEVEMENTS.find(a => a.id === ids[0]))
    }, 0)
    return () => clearTimeout(t)
  }, [newlyKey])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // 📅 Resumen de la semana: % del camino cada día y motivos de ❌ más repetidos
  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDate(today, i - 6))
  const week = histReady ? weekDays.map(d => {
    const due = visibleIds.filter(id => !(since[id] && d < since[id]) && isScheduled(config, id, d) && marksFor(config, d)[id]?.s !== 'skipped')
    const n = due.filter(id => hctx.isDone(id, d)).length
    return { date: d, pct: due.length ? Math.round((n / due.length) * 100) : null }
  }) : null
  const reasonCount = {}
  weekDays.forEach(d => Object.values(marksFor(config, d)).forEach(m => {
    const why = m.s === 'missed' && m.why?.trim()
    if (why) { const k = why.toLowerCase(); reasonCount[k] = { text: why, n: (reasonCount[k]?.n || 0) + 1 } }
  }))
  const reasons = Object.values(reasonCount).sort((a, b) => b.n - a.n).slice(0, 3)
  const [weekSeen, setWeekSeen] = useState(() => { try { return localStorage.getItem('fwd_week_seen') } catch { return null } })
  const showWeekBanner = !isPast && weekdayOf(today) === 6 && weekSeen !== today

  // ¡Día completado! (una vez al día, al llegar al trofeo)
  const dayWin = histReady && path.stops.some(st => !st.skipped) && path.stops.filter(st => !st.skipped).every(st => st.done)
  const [celebrate, setCelebrate] = useState(false)
  useEffect(() => {
    if (!dayWin) return
    let seen = null
    try { seen = localStorage.getItem('fwd_celebrated') } catch { /* sin almacenamiento */ }
    if (seen === today) return
    const t = setTimeout(() => {
      setCelebrate(true)
      navigator.vibrate?.([100, 50, 100, 50, 300])
      try { localStorage.setItem('fwd_celebrated', today) } catch { /* sin almacenamiento */ }
    }, 900)
    return () => clearTimeout(t)
  }, [dayWin, today])

  const sequence = path.sequence
    .map(n => n.type === 'stop' && n.kind === 'custom' && PRAYER_NAMES.includes(n.label) && prayer.times
      ? { ...n, label: `${n.label} · ${prayer.times[n.label]}` }
      : n)
    .map(n => n.type === 'stop' && !isPast && config.timers?.[n.id] ? { ...n, timer: config.timers[n.id] } : n)
    .map(n => n.type === 'stop' && config.parts?.[n.id] ? { ...n, part: config.parts[n.id] } : n)
    .map(n => n.type === 'stop' && streaks[n.id] ? { ...n, streak: streaks[n.id], atRisk: !n.done && !n.skipped && lateNight && streaks[n.id] >= 3 } : n)

  // ⏱️ Temporizador de parada: { id, endAt, date }, guardado en el móvil para que siga
  // contando aunque se cierre la ventana. Al llegar a 0 la parada se marca hecha sola.
  const TIMER_KEY = 'fwd_stop_timer'
  const [stopTimer, setStopTimer] = useState(() => {
    try { const t = JSON.parse(localStorage.getItem(TIMER_KEY)); return t?.endAt ? t : null } catch { return null }
  })
  const [timerSheet, setTimerSheet] = useState(null)   // id de la parada con la hoja abierta
  const [clock, setClock] = useState(() => Date.now())
  function saveTimer(t) {
    setStopTimer(t)
    try { t ? localStorage.setItem(TIMER_KEY, JSON.stringify(t)) : localStorage.removeItem(TIMER_KEY) } catch { /* sin almacenamiento */ }
  }
  useEffect(() => {
    if (!stopTimer) return
    const t = setInterval(() => setClock(Date.now()), 1000)
    return () => clearInterval(t)
  }, [stopTimer])
  const timerLeft = stopTimer ? Math.max(0, Math.ceil((stopTimer.endAt - clock) / 1000)) : null
  const items = path.stops

  function updateLayout(changes) {
    if (draft) setDraft(d => ({ ...d, ...changes }))
    else saveConfig(changes)
  }
  function addChest() {
    const id = newId('chest_')
    updateLayout({ chestList: [...chestList, id], order: [...sequence.map(n => n.id), id] })
  }
  function deleteChest(id) {
    updateLayout({ chestList: chestList.filter(c => c !== id), order: sequence.map(n => n.id).filter(x => x !== id) })
  }
  function setLink(id, link) {
    if (custom.some(x => x.id === id)) saveConfig({ custom: custom.map(x => x.id === id ? { ...x, link } : x) })
    else saveConfig({ links: { ...config.links, [id]: link } })
  }

  // ── Personalizar: todo va a un borrador (config + hábitos) hasta "Guardar cambios" ──
  const [sDraft, setSDraft] = useState(null)   // { config, habits, ops: [cambios de hábitos], dirty }
  const sp = sDraft && buildPath({ config: sDraft.config, habits: sDraft.habits, todayLogs, focusText, focusDone, today, allDays: true })

  function openSettings() {
    setSDraft({ config: { ...config, chestList, order: sequence.map(n => n.id) }, habits: [...habits], ops: [], dirty: false })
    setShowSettings(true)
  }
  function sSet(changes) {
    setSDraft(d => ({ ...d, dirty: true, config: { ...d.config, ...changes } }))
  }
  function sSetLink(id, link) {
    const c = sDraft.config
    if ((c.custom || []).some(x => x.id === id)) sSet({ custom: c.custom.map(x => x.id === id ? { ...x, link } : x) })
    else sSet({ links: { ...(c.links || {}), [id]: link } })
  }
  function sAddChest() {
    const id = newId('chest_')
    sSet({ chestList: [...sp.chestList, id], order: [...sp.sequence.map(n => n.id), id] })
  }
  function sEditStop(id, { icon, label }) {
    const c = sDraft.config
    if ((c.custom || []).some(x => x.id === id)) return sSet({ custom: c.custom.map(x => x.id === id ? { ...x, icon, label } : x) })
    setSDraft(d => ({
      ...d, dirty: true,
      habits: d.habits.map(h => h.id === id ? { ...h, icon, name: label } : h),
      ops: [...d.ops, { type: 'update', id, icon, name: label }],
    }))
  }
  function sDeleteStop(id) {
    const c = sDraft.config
    if (sp.chestList.includes(id)) {
      return sSet({ chestList: sp.chestList.filter(x => x !== id), order: (c.order || []).filter(x => x !== id) })
    }
    const clean = { hidden: (c.hidden || []).filter(x => x !== id), order: (c.order || []).filter(x => x !== id) }
    if ((c.custom || []).some(x => x.id === id)) {
      return sSet({
        ...clean,
        custom: c.custom.filter(x => x.id !== id),
        customDone: { ...c.customDone, ids: (c.customDone?.ids || []).filter(x => x !== id) },
      })
    }
    setSDraft(d => ({
      ...d, dirty: true,
      config: { ...d.config, ...clean },
      habits: d.habits.filter(h => h.id !== id),
      ops: [...d.ops, { type: 'delete', id }],
    }))
  }
  function sAddPrayers() {
    const c = sDraft.config
    const have = new Set((c.custom || []).map(x => x.label))
    const add = PRAYERS.filter(pr => !have.has(pr.label))
      .map(pr => ({ id: newId('c_pray_'), icon: pr.icon, label: pr.label, link: 'none' }))
    if (!add.length) return
    sSet({
      custom: [...(c.custom || []), ...add],
      colors: { ...(c.colors || {}), ...Object.fromEntries(add.map(x => [x.id, 'teal'])) },
    })
  }
  // Vision board en Personalizar: las fotos se suben al momento, pero la lista solo
  // cambia al guardar; si se cancela, se borran las recién subidas.
  async function sAddVision(files) {
    const urls = []
    for (const f of files) urls.push(await uploadVisionImage(f, user.id))
    setSDraft(d => ({
      ...d, dirty: true,
      uploaded: [...(d.uploaded || []), ...urls],
      config: { ...d.config, vision: [...(d.config.vision || VISION_IMAGES), ...urls] },
    }))
  }
  function sRemoveVision(url) {
    setSDraft(d => ({ ...d, dirty: true, config: { ...d.config, vision: (d.config.vision || VISION_IMAGES).filter(u => u !== url) } }))
  }

  async function saveSettings() {
    const { config: c, habits: hs, ops } = sDraft
    const before = config.vision || VISION_IMAGES
    const after  = c.vision || VISION_IMAGES
    before.filter(u => !after.includes(u)).forEach(u => deleteVisionImage(u))
    ;(sDraft.uploaded || []).filter(u => !after.includes(u)).forEach(u => deleteVisionImage(u))
    saveConfig(c)
    setHabits(hs)
    setSDraft(null)
    setShowSettings(false)
    for (const op of ops) {
      if (op.type === 'delete') await supabase.from('habits').delete().eq('id', op.id).eq('user_id', user.id)
      else await supabase.from('habits').update({ icon: op.icon, name: op.name }).eq('id', op.id).eq('user_id', user.id)
    }
  }
  function closeSettings() {
    ;(sDraft?.uploaded || []).forEach(u => deleteVisionImage(u))   // subidas sin guardar
    setSDraft(null)
    setShowSettings(false)
  }

  const openItem = items.find(i => i.id === stopSheet)

  // Paradas propias hechas en el día visto (hoy también actualiza el antiguo customDone)
  function customDoneChange(ids) {
    return { customLog: withDayEntry(config.customLog, day, ids), ...(isPast ? {} : { customDone: { date: today, ids } }) }
  }
  // Foco del día visto: hoy usa el de siempre; en un día pasado, su historial
  function toggleDayFocus() {
    if (!isPast) return toggleFocusDone()
    const done = !dayFocus.done
    logPath('__focus', done, day)
    saveConfig({ focusLog: withDayEntry(config.focusLog, day, { text: dayFocus.text, done }) })
  }
  function saveDayFocus(text) {
    if (!isPast) return saveFocus(text)
    saveConfig({ focusLog: withDayEntry(config.focusLog, day, { text, done: dayFocus.done }) })
  }

  // ❌ No lo hice (con motivo opcional) / ⏭️ Saltar hoy / null = volver a pendiente
  function setMark(id, mark) {
    saveConfig({ dayMarks: withMark(config, day, id, mark) })
  }

  function toggleItem(id) {
    const node = items.find(i => i.id === id)
    const clearMark = node && (node.missed || node.skipped) ? { dayMarks: withMark(config, day, id, null) } : {}
    if (id === '__focus') {
      if (clearMark.dayMarks) saveConfig(clearMark)
      return toggleDayFocus()
    }
    if (custom.some(x => x.id === id)) {
      const done = !customDone.includes(id)
      const ids  = done ? [...customDone, id] : customDone.filter(x => x !== id)
      logPath(id, done, day)
      return saveConfig({ ...customDoneChange(ids), ...clearMark })
    }
    if (clearMark.dayMarks) saveConfig(clearMark)
    toggleHabit(id)
  }

  // Toque en una parada: si estaba en ❌ o ⏭️, vuelve a pendiente; si no, hecho/pendiente
  function tapStop(id) {
    const node = items.find(i => i.id === id)
    if (node && (node.missed || node.skipped)) return setMark(id, null)
    toggleItem(id)
  }

  // Terminado: se avisa y se marca la parada (si sigue pendiente y es de hoy)
  const timerDone = !!stopTimer && timerLeft === 0 && !loading
  useEffect(() => {
    if (!timerDone) return
    const t = setTimeout(() => {
      const node = path.stops.find(st => st.id === stopTimer.id)
      saveTimer(null)
      navigator.vibrate?.([200, 100, 200])
      if (node && !node.done && stopTimer.date === today) toggleItem(node.id)
    }, 0)
    return () => clearTimeout(t)
  }, [timerDone])

  // Marcar ❌ o ⏭️ una parada hecha: primero se deshace el "hecho"
  function markStop(id, mark) {
    const node = items.find(i => i.id === id)
    if (node?.done) {
      if (id === '__focus') toggleDayFocus()
      else if (custom.some(x => x.id === id)) {
        logPath(id, false, day)
        return saveConfig({ ...customDoneChange(customDone.filter(x => x !== id)), dayMarks: withMark(config, day, id, mark) })
      } else toggleHabit(id)
    }
    setMark(id, mark)
  }

  function doNow(id = openItem.id) {
    const link = linkOf(id)
    if (PATH_LINKS[link]?.inline) { setStopSheet(id); setInlineLink(link) }
    else { setStopSheet(null); setPage(link) }
  }

  function markOpened(k) {
    const next = new Set(openedChests); next.add(k)
    setOpenedChests(next); writeOpenedChests(next)
  }

  const streak       = calcStreak(logs)
  const completedHab = todayLogs.size
  const totalHab     = habits.length
  const [g1, g2]     = headerGradient()
  const name         = user?.user_metadata?.name || user?.email?.split('@')[0] || 'tú'
  const initial      = name.charAt(0).toUpperCase()

  return (
    <>
    <div className="space-y-6 pb-8">

      {/* ── Hero header ─────────────────────────────────────── */}
      <div className="rounded-3xl overflow-hidden shadow-lg"
        style={{ background: `linear-gradient(135deg, ${g1}, ${g2})` }}>
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/70 text-sm font-semibold capitalize">{formatDate()}</p>
              <h1 className="text-white text-2xl font-black mt-0.5">
                {greeting()}, {name} {greetEmoji()}
              </h1>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg font-black">{initial}</span>
            </div>
          </div>

          {/* Stats pills */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
            {[
              { v: streak > 0 ? `${streak}d` : '—', l:'racha', e:'🔥', show:true },
              { v: `${completedHab}/${totalHab}`, l:'hábitos', e:'✅', show: totalHab > 0 },
              { v: pom.pomoCount, l:'pomodoros', e:'🍅', show: pom.pomoCount > 0 },
              { v: fmtSleep(lastSleep?.duration_min) || '—', l:'anoche', e:'😴', show: !!lastSleep },
              { v: todayEvents.length, l:'eventos', e:'📅', show: todayEvents.length > 0 },
            ].filter(s => s.show).map((s,i) => (
              <div key={i} className="flex-shrink-0 bg-white/15 backdrop-blur rounded-2xl px-3 py-2 text-center min-w-[60px]">
                <p className="text-base">{s.e}</p>
                <p className="text-white font-black text-sm leading-tight">{s.v}</p>
                <p className="text-white/60 text-[10px] leading-tight">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Día que se ve (hoy o pasado) ──────────────────────── */}
      <div className="space-y-2">
        <DayBar day={day} today={today} userId={user.id} config={config}
          habitIds={habits.filter(h => !(config.hidden || []).includes(h.id)).map(h => h.id)}
          onChange={d => { setViewDate(d); setStopSheet(null); setInlineLink(null); setDraft(null) }} />
        {showWeekBanner && (
          <button onClick={() => { setShowStats(true); setWeekSeen(today); try { localStorage.setItem('fwd_week_seen', today) } catch { /* sin almacenamiento */ } }}
            className="w-full bg-violet-50 border border-violet-100 rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:bg-violet-100">
            <span className="text-2xl">📊</span>
            <span className="flex-1">
              <span className="block text-sm font-black text-violet-800">Tu resumen de la semana está listo</span>
              <span className="block text-xs font-semibold text-violet-600">Mira cómo te ha ido estos 7 días</span>
            </span>
          </button>
        )}
        {hasPrayerStops && (prayer.status === 'noloc' || prayer.status === 'error') && (
          <div className="bg-teal-50 border border-teal-100 rounded-2xl px-4 py-2.5 flex items-center gap-3">
            <p className="flex-1 text-xs font-semibold text-teal-800">
              🕌 {prayer.status === 'noloc' ? 'Activa la ubicación para ver las horas de oración.' : 'No se pudieron cargar las horas de oración.'}
            </p>
            <button onClick={prayer.retry} className="px-3 py-2 rounded-xl bg-teal-600 text-white text-xs font-black flex-shrink-0">
              {prayer.status === 'noloc' ? 'Activar' : 'Reintentar'}
            </button>
          </div>
        )}
        {isPast && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl px-4 py-2.5 flex items-center gap-3">
            <p className="flex-1 text-xs font-semibold text-blue-800">
              Estás viendo un día pasado. Puedes corregirlo: toca para marcar, mantén pulsado para ❌ / ⏭️.
            </p>
            <button onClick={() => setViewDate(null)} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-black flex-shrink-0">Hoy</button>
          </div>
        )}
      </div>

      {/* ── Camino al éxito ─────────────────────────────────── */}
      {loading || pastLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <SuccessPath
          key={day}
          visionImages={config.vision || VISION_IMAGES}
          sequence={isPast ? sequence.map(n => n.type === 'stop' ? { ...n, canDo: false } : n) : sequence}
          colorsOf={colorsOf}
          openedChests={isPast ? new Set() : openedChests}
          onToggle={tapStop}
          onMiss={(id, why) => markStop(id, { s: 'missed', ...(why ? { why } : {}) })}
          onSkip={id => markStop(id, { s: 'skipped' })}
          onClearMark={id => setMark(id, null)}
          onTimer={id => setTimerSheet(id)}
          flowyLevel={level}
          onOpenAchievements={() => setShowAch(true)}
          medals={`${Object.keys(unlocked).length}/${ACHIEVEMENTS.length}`}
          onOpenStop={id => setStopSheet(id)}
          onDo={id => doNow(id)}
          onOpenChest={(id, available) => !isPast && available && setChestSheet({ k: id, alreadyOpen: openedChests.has(id) })}
          onOpenSettings={openSettings}
          onOpenStats={() => setShowStats(true)}
          edit={!!draft}
          onStartEdit={() => setDraft({ order: sequence.map(n => n.id), chestList, colors: { ...(config.colors || {}) } })}
          onSaveEdit={() => { saveConfig(draft); setDraft(null) }}
          onCancelEdit={() => setDraft(null)}
          onReorder={ids => updateLayout({ order: ids, ...(legacyChests ? { chestList } : {}) })}
          onSetColor={(id, k) => updateLayout({ colors: { ...(cfg.colors || {}), [id]: k } })}
          onAddChest={addChest}
          onDeleteChest={deleteChest}/>
      )}
    </div>

      {/* Paneles fuera del contenedor con space-y (su margen desplazaba los fixed) */}
      {openItem && !inlineLink && (
        <StopSheet
          item={openItem}
          link={linkOf(openItem.id)}
          onLinkChange={link => setLink(openItem.id, link)}
          onDo={() => doNow()}
          onToggle={() => { const wasDone = openItem.done; toggleItem(openItem.id); if (!wasDone) setStopSheet(null) }}
          onClose={() => setStopSheet(null)}
          focusText={dayFocus.text}
          onSaveFocus={saveDayFocus}/>
      )}

      {openItem && inlineLink && (
        <InlinePage
          link={inlineLink}
          item={openItem}
          onDone={() => { toggleItem(openItem.id); setInlineLink(null); setStopSheet(null) }}
          onClose={() => { setInlineLink(null); setStopSheet(null) }}/>
      )}

      {timerSheet && items.find(i => i.id === timerSheet) && (
        <TimerSheet
          item={items.find(i => i.id === timerSheet)}
          minutes={config.timers?.[timerSheet] || 10}
          endAt={stopTimer?.id === timerSheet ? stopTimer.endAt : null}
          onStart={() => saveTimer({ id: timerSheet, endAt: Date.now() + (config.timers?.[timerSheet] || 10) * 60000, date: today })}
          onCancel={() => saveTimer(null)}
          onClose={() => setTimerSheet(null)}/>
      )}

      {/* Temporizador en marcha: aviso flotante para volver a él */}
      {stopTimer && timerLeft > 0 && !timerSheet && (
        <button onClick={() => setTimerSheet(stopTimer.id)}
          className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-violet-600 text-white shadow-xl">
          <span className="text-sm">⏱️</span>
          <span className="text-sm font-black truncate max-w-[140px]">{items.find(i => i.id === stopTimer.id)?.label || 'Temporizador'}</span>
          <span className="text-sm font-black tabular-nums">{String(Math.floor(timerLeft / 60)).padStart(2, '0')}:{String(timerLeft % 60).padStart(2, '0')}</span>
        </button>
      )}

      {showAch && <AchievementsSheet unlocked={unlocked} perfect={perfect} level={level} onClose={() => setShowAch(false)} />}
      {celebrate && <DayCompleteOverlay perfect={perfect} level={level} onClose={() => setCelebrate(false)} />}
      {toast && <MedalToast achievement={toast} onClose={() => setToast(null)} />}

      {chestSheet && (
        <ChestSheet
          rewards={config.rewards}
          assigned={config.rewards.includes(config.chestRewards?.[chestSheet.k]) ? config.chestRewards[chestSheet.k] : null}
          breakMin={config.breakMin}
          alreadyOpen={chestSheet.alreadyOpen}
          onOpened={() => markOpened(chestSheet.k)}
          onClose={() => setChestSheet(null)}/>
      )}

      {showStats && (
        <StatsSheet
          userId={user.id}
          stops={items}
          habits={habits}
          today={today}
          week={week}
          reasons={reasons}
          onClose={() => setShowStats(false)}/>
      )}

      {showSettings && sDraft && (
        <PathSettingsSheet
          config={sDraft.config}
          save={sSet}
          stops={sp.allStops.map(st => ({ ...st, link: sp.linkOf(st.id), hidden: sp.hidden.includes(st.id) }))}
          sequence={sp.sequence.map(n => n.type === 'stop' ? { ...n, link: sp.linkOf(n.id) } : n)}
          setLink={sSetLink}
          onSaveOrder={ids => sSet({ order: ids })}
          onAddChest={sAddChest}
          onEditStop={sEditStop}
          onDeleteStop={sDeleteStop}
          onAddPrayers={sAddPrayers}
          hasPrayers={PRAYERS.every(pr => sp.custom.some(c => c.label === pr.label))}
          dirty={sDraft.dirty}
          visionList={sDraft.config.vision || VISION_IMAGES}
          onAddVision={sAddVision}
          onRemoveVision={sRemoveVision}
          onSaveAll={saveSettings}
          onClose={closeSettings}/>
      )}
    </>
  )
}
