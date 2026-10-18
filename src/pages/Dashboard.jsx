import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePomodoro } from '../contexts/PomodoroContext'
import SuccessPath from '../components/SuccessPath'
import { StopSheet, InlinePage, ChestSheet, PathSettingsSheet } from '../components/PathSheets'
import { usePathConfig, PATH_LINKS, readOpenedChests, writeOpenedChests, todayKey, PRAYERS, newId } from '../lib/pathConfig'
import { buildPath } from '../lib/pathModel'

// ── Helpers ────────────────────────────────────────────────────────
function todayStr() { return new Date().toISOString().split('T')[0] }

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

  // ── Foco del día (es una parada más del camino) ───────────────────
  const FOCUS_KEY = 'fwd_focus'
  // Se lee al montar; si es de otro día, se descarta
  const [savedFocus] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FOCUS_KEY) || 'null')
      return saved?.date === todayStr() ? saved : null
    } catch { return null }
  })
  const [focusText, setFocusText] = useState(savedFocus?.text || '')
  const [focusDone, setFocusDone] = useState(savedFocus?.done || false)

  function saveFocus(text) {
    setFocusText(text)
    try { localStorage.setItem(FOCUS_KEY, JSON.stringify({ date: todayStr(), text, done: focusDone })) } catch { /* sin almacenamiento */ }
  }

  function toggleFocusDone() {
    const done = !focusDone
    setFocusDone(done)
    try { localStorage.setItem(FOCUS_KEY, JSON.stringify({ date: todayStr(), text: focusText, done })) } catch { /* sin almacenamiento */ }
  }

  useEffect(() => {
    const today = todayStr()
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
  }, [])

  async function toggleHabit(habitId) {
    const today = todayStr()
    if (todayLogs.has(habitId)) {
      setTodayLogs(p => { const n = new Set(p); n.delete(habitId); return n })
      await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', today).eq('user_id', user.id)
    } else {
      setTodayLogs(p => new Set([...p, habitId]))
      await supabase.from('habit_logs').upsert({ user_id: user.id, habit_id: habitId, date: today })
    }
  }

  // ── Camino ────────────────────────────────────────────────────────
  // Modo editar del camino: orden, colores y cofres van a un borrador hasta pulsar Guardar
  const [draft, setDraft] = useState(null)
  const cfg  = draft ? { ...config, ...draft } : config
  const path = buildPath({ config: cfg, habits, todayLogs, focusText, focusDone })
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
  const sp = sDraft && buildPath({ config: sDraft.config, habits: sDraft.habits, todayLogs, focusText, focusDone })

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

  function toggleItem(id) {
    if (id === '__focus') return toggleFocusDone()
    if (custom.some(x => x.id === id)) {
      const ids = customDone.includes(id) ? customDone.filter(x => x !== id) : [...customDone, id]
      return saveConfig({ customDone: { date: todayKey(), ids } })
    }
    toggleHabit(id)
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

      {/* ── Camino al éxito ─────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <SuccessPath
          sequence={sequence}
          colorsOf={colorsOf}
          openedChests={openedChests}
          onToggle={id => toggleItem(id)}
          onOpenStop={id => setStopSheet(id)}
          onDo={id => doNow(id)}
          onOpenChest={(id, available) => available && setChestSheet({ k: id, alreadyOpen: openedChests.has(id) })}
          onOpenSettings={openSettings}
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
          focusText={focusText}
          onSaveFocus={saveFocus}/>
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
          breakMin={config.breakMin}
          alreadyOpen={chestSheet.alreadyOpen}
          onOpened={() => markOpened(chestSheet.k)}
          onClose={() => setChestSheet(null)}/>
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
