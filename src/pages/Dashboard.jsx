import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePomodoro } from '../contexts/PomodoroContext'
import SuccessPath from '../components/SuccessPath'
import { StopSheet, InlinePage, ChestSheet, PathSettingsSheet, StatsSheet } from '../components/PathSheets'
import { usePathConfig, PATH_LINKS, readOpenedChests, writeOpenedChests, PRAYERS, newId, useToday, appToday, withMark, withDayEntry, customDoneFor, focusFor } from '../lib/pathConfig'
import DayBar from '../components/DayBar'
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
  const { custom, customDone, linkOf, sequence, chestList, legacyChests, colorsOf } = path
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
  async function saveSettings() {
    const { config: c, habits: hs, ops } = sDraft
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
          sequence={isPast ? sequence.map(n => n.type === 'stop' ? { ...n, canDo: false } : n) : sequence}
          colorsOf={colorsOf}
          openedChests={isPast ? new Set() : openedChests}
          onToggle={tapStop}
          onMiss={(id, why) => markStop(id, { s: 'missed', ...(why ? { why } : {}) })}
          onSkip={id => markStop(id, { s: 'skipped' })}
          onClearMark={id => setMark(id, null)}
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
          onSaveAll={saveSettings}
          onClose={closeSettings}/>
      )}
    </>
  )
}
