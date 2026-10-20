import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { localDate } from '../lib/pathConfig'
import { Plus, Flame, Check, X, Settings2, Pencil, ChevronLeft, Trash2, ChevronDown, GripVertical } from 'lucide-react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function loadHabitOrder(userId) {
  try { return JSON.parse(localStorage.getItem(`habits_order_${userId}`) || 'null') } catch { return null }
}
function saveHabitOrder(userId, ids) {
  localStorage.setItem(`habits_order_${userId}`, JSON.stringify(ids))
}
function applyOrder(habits, order) {
  if (!order) return habits
  const map = Object.fromEntries(habits.map(h => [h.id, h]))
  const sorted = order.filter(id => map[id]).map(id => map[id])
  const rest = habits.filter(h => !order.includes(h.id))
  return [...sorted, ...rest]
}

const ICON_GROUPS = [
  { label: 'Fitness',   icons: ['💪','🏃','🤸','🧘','🥊','🏋️','⚽','🚴','🏊','🧗','🤾','🎽'] },
  { label: 'Salud',     icons: ['💧','🥗','🥤','😴','💊','🌿','🍎','🥦','🦷','❤️','🩺','🧴'] },
  { label: 'Mente',     icons: ['📚','✍️','🎯','💻','🧠','📖','⏰','📊','💡','🎓','🔬','📝'] },
  { label: 'Bienestar', icons: ['🙏','🌅','🛁','🌸','🧹','🌙','☀️','🕯️','🌱','🌊','🫧','🌺'] },
  { label: 'Arte',      icons: ['🎵','🎨','🎸','✏️','📷','🎬','🎹','🖌️','🎤','🎭','📸','🖼️'] },
  { label: 'Vida',      icons: ['⭐','🔥','🏆','💰','🚗','✈️','🎉','🌍','📱','💼','🏠','🛒'] },
]

// Preset swatches — stored as hex so we can mix with custom picker freely
const PRESET_COLORS = [
  '#2563eb','#7c3aed','#16a34a','#dc2626',
  '#ea580c','#db2777','#0891b2','#ca8a04','#0f172a',
]

// Backwards-compatible with old 'blue','violet'… values in DB
const LEGACY = { blue:'#2563eb',violet:'#7c3aed',green:'#16a34a',red:'#dc2626',orange:'#ea580c',pink:'#db2777' }

function cBg(color) {
  if (!color) return '#2563eb'
  if (color.startsWith('#')) return color
  return LEGACY[color] || '#2563eb'
}
function cLight(color) {
  const hex = cBg(color)
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},0.13)`
}

// Fecha local (toISOString usaría UTC y el día cambiaría a la 01:00/02:00)
function toStr(d) { return localDate(d) }

function getStreak(logSet, habitId) {
  const set = new Set([...logSet].filter(k => k.startsWith(habitId+'|')).map(k => k.split('|')[1]))
  let streak = 0
  const d = new Date(); d.setHours(0,0,0,0)
  if (!set.has(toStr(d))) d.setDate(d.getDate()-1)
  while (set.has(toStr(d))) { streak++; d.setDate(d.getDate()-1) }
  return streak
}

function getLast2(logSet, habitId) {
  return Array.from({ length: 2 }, (_, i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-(2-i))
    const key = `${habitId}|${toStr(d)}`
    return { date: toStr(d), done: logSet.has(key) }
  })
}

const DAY_LABELS = ['D','L','M','X','J','V','S']
function getLast7(logSet, habitId) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-(6-i))
    return { done: logSet.has(`${habitId}|${toStr(d)}`), label: DAY_LABELS[d.getDay()], isToday: i===6 }
  })
}

function getBestStreak(logSet, habitId) {
  const dates = [...logSet].filter(k=>k.startsWith(habitId+'|')).map(k=>k.split('|')[1]).sort()
  let best=0, cur=0, prev=null
  for (const s of dates) {
    if (prev && (new Date(s)-new Date(prev))/(86400000)===1) cur++
    else cur=1
    if (cur>best) best=cur
    prev=s
  }
  return best
}

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function effectiveDays(habit, range) {
  const created = new Date(habit.created_at); created.setHours(0,0,0,0)
  const today   = new Date(); today.setHours(0,0,0,0)
  const age = Math.floor((today - created) / 86400000) + 1
  return Math.min(range, age)
}

function getRangePct(logSet, habit, range) {
  const days = effectiveDays(habit, range)
  let done = 0
  const d = new Date(); d.setHours(0,0,0,0)
  for (let i = 0; i < days; i++) {
    if (logSet.has(`${habit.id}|${toStr(d)}`)) done++
    d.setDate(d.getDate()-1)
  }
  return Math.round(done/days*100)
}

function HeatmapGrid({ logSet, habit, range, color }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const days  = effectiveDays(habit, range)
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate()-(days-1-i))
    const s = toStr(d)
    return { s, done: logSet.has(`${habit.id}|${s}`), isToday: i===days-1 }
  })
  const done   = dates.filter(d=>d.done).length
  const streak = getStreak(logSet, habit.id)
  const best   = getBestStreak(logSet, habit.id)
  const cellSize = days <= 30 ? 14 : 10
  return (
    <div className="px-4 pb-4 border-t border-slate-100">
      <div className="flex flex-wrap gap-0.5 mt-3 mb-3">
        {dates.map((d,i) => (
          <div key={i} style={{ width:cellSize, height:cellSize, borderRadius:3,
            background: d.done ? color : '#f1f5f9',
            outline: d.isToday ? `2px solid ${color}` : 'none', outlineOffset:1 }}/>
        ))}
      </div>
      <div className="flex gap-4 text-xs text-slate-500">
        <span>✅ <span className="font-bold text-slate-700">{done}</span> días</span>
        <span>🔥 <span className="font-bold text-slate-700">{streak}</span> racha</span>
        <span>🏆 <span className="font-bold text-slate-700">{best}</span> mejor</span>
      </div>
    </div>
  )
}

function MonthlyBars({ logSet, habitId, color }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const months = Array.from({ length: 12 }, (_, m) => {
    const d = new Date(today); d.setDate(1); d.setMonth(d.getMonth()-11+m)
    const yr = d.getFullYear(), mo = d.getMonth()
    const daysInMonth = new Date(yr, mo+1, 0).getDate()
    const isCurrent = m===11
    const lastDay = isCurrent ? today.getDate() : daysInMonth
    let done = 0
    for (let day=1; day<=lastDay; day++) {
      const s = `${yr}-${String(mo+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
      if (logSet.has(`${habitId}|${s}`)) done++
    }
    return { label: MONTH_NAMES[mo], pct: Math.round(done/lastDay*100) }
  })
  const maxPct = Math.max(...months.map(m=>m.pct), 1)
  return (
    <div className="px-4 pb-4 border-t border-slate-100">
      <div className="flex items-end gap-1 h-14 mt-3">
        {months.map((m,i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full rounded-t" style={{ height: Math.max(2, m.pct/maxPct*44),
              background: m.pct>=70?'#16a34a':m.pct>=40?'#f59e0b':m.pct>0?'#ef4444':'#f1f5f9' }}/>
          </div>
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {months.map((m,i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[8px] font-bold text-slate-400">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SortableHabitItem({ habit }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id })
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-slate-50">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
        style={{ background: cLight(habit.color) }}>{habit.icon || null}</div>
      <p className="flex-1 font-semibold text-slate-800 text-sm truncate">{habit.name}</p>
      <button {...attributes} {...listeners}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-white shadow-sm cursor-grab active:cursor-grabbing touch-none">
        <GripVertical size={18} className="text-slate-400"/>
      </button>
    </div>
  )
}

export default function Habits() {
  const { user } = useAuth()
  const todayStr = toStr(new Date())

  const [habits, setHabits]     = useState([])
  const [logSet, setLogSet]     = useState(new Set())
  const [showAdd, setShowAdd]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newIcon, setNewIcon]   = useState('💪')
  const [newColor, setNewColor] = useState('#2563eb')
  const [loading, setLoading]   = useState(true)

  const [editingId, setEditingId]     = useState(null)
  const [editingName, setEditingName] = useState('')
  const editInputRef = useRef(null)
  const [expandedId, setExpandedId]   = useState(null)

  const [showManage, setShowManage]   = useState(false)
  const [manageHabit, setManageHabit] = useState(null)
  const [manageView, setManageView]   = useState('list')
  const [mName, setMName]             = useState('')
  const [mIcon, setMIcon]             = useState('💪')
  const [mColor, setMColor]           = useState('#2563eb')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } }))

  const [view, setView]               = useState('today')
  const [statsRange, setStatsRange]   = useState(30)
  const [statsLogSet, setStatsLogSet] = useState(new Set())
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsExpanded, setStatsExpanded] = useState(null)

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (view === 'stats') loadStatsLogs(statsRange)
  }, [view, statsRange])

  async function load() {
    const since = new Date(); since.setDate(since.getDate()-30)
    const [{ data: h }, { data: l }] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_logs').select('habit_id, date').eq('user_id', user.id).gte('date', toStr(since)),
    ])
    const ordered = applyOrder(h || [], loadHabitOrder(user.id))
    setHabits(ordered)
    setLogSet(new Set((l||[]).map(r => `${r.habit_id}|${r.date}`)))
    setLoading(false)
  }

  async function loadStatsLogs(days) {
    setStatsLoading(true)
    const since = new Date(); since.setDate(since.getDate()-days)
    const { data } = await supabase.from('habit_logs').select('habit_id, date')
      .eq('user_id', user.id).gte('date', toStr(since))
    setStatsLogSet(new Set((data||[]).map(r=>`${r.habit_id}|${r.date}`)))
    setStatsLoading(false)
  }

  async function addHabit() {
    if (!newName.trim()) return
    const { data } = await supabase.from('habits').insert({
      user_id: user.id, name: newName.trim(), icon: newIcon, color: newColor,
    }).select().single()
    if (data) setHabits(p => [...p, data])
    setNewName(''); setNewIcon('💪'); setNewColor('#2563eb'); setShowAdd(false)
  }

  async function deleteHabit(id) {
    await supabase.from('habits').delete().eq('id', id)
    setHabits(p => p.filter(h => h.id !== id))
    setLogSet(prev => { const s = new Set(prev); [...s].filter(k => k.startsWith(id+'|')).forEach(k => s.delete(k)); return s })
  }

  async function toggleToday(habit) {
    const key = `${habit.id}|${todayStr}`
    const done = logSet.has(key)
    if (done) {
      const { error } = await supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('date', todayStr).eq('user_id', user.id)
      if (!error) setLogSet(prev => { const s = new Set(prev); s.delete(key); return s })
    } else {
      try { navigator.vibrate?.([40, 30, 80]) } catch (_) {}
      const { error } = await supabase.from('habit_logs').insert({ user_id: user.id, habit_id: habit.id, date: todayStr })
      if (!error) setLogSet(prev => new Set([...prev, key]))
    }
  }

  function startEdit(habit) {
    setEditingId(habit.id); setEditingName(habit.name)
    setTimeout(() => editInputRef.current?.focus(), 30)
  }
  function openManageEdit(habit) {
    setManageHabit(habit)
    setMName(habit.name)
    setMIcon(habit.icon || '💪')
    setMColor(cBg(habit.color))
  }
  async function saveManageEdit() {
    if (!mName.trim()) return
    const updates = { name: mName.trim(), icon: mIcon, color: mColor }
    setHabits(p => p.map(h => h.id === manageHabit.id ? { ...h, ...updates } : h))
    setManageHabit(null)
    await supabase.from('habits').update(updates).eq('id', manageHabit.id)
  }

  async function commitEdit(habitId) {
    const name = editingName.trim()
    if (!name) { setEditingId(null); return }
    setHabits(p => p.map(h => h.id === habitId ? { ...h, name } : h))
    setEditingId(null)
    await supabase.from('habits').update({ name }).eq('id', habitId)
  }

  function handleHabitDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIndex = habits.findIndex(h => h.id === active.id)
    const newIndex = habits.findIndex(h => h.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const next = arrayMove(habits, oldIndex, newIndex)
    setHabits(next)
    saveHabitOrder(user.id, next.map(h => h.id))
  }

  const todayDone = habits.filter(h => logSet.has(`${h.id}|${todayStr}`)).length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="space-y-4 pb-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Hábitos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {habits.length === 0 ? 'Añade tu primer hábito' : `${todayDone} de ${habits.length} hoy`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setManageHabit(null); setManageView('list'); setShowManage(true) }}
            className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shadow-sm active:bg-slate-200">
            <Settings2 size={20} className="text-slate-600"/>
          </button>
          <button onClick={() => setShowAdd(true)}
            className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md active:bg-blue-700">
            <Plus size={20} className="text-white"/>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
        <button onClick={() => setView('today')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${view==='today'?'bg-white text-slate-800 shadow-sm':'text-slate-500'}`}>
          Hoy
        </button>
        <button onClick={() => setView('stats')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${view==='stats'?'bg-white text-slate-800 shadow-sm':'text-slate-500'}`}>
          Estadísticas
        </button>
      </div>

      {/* ── Stats view ── */}
      {view === 'stats' && (
        <div className="space-y-4">
          {/* Range selector */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
            {[{v:7,l:'7 días'},{v:30,l:'30 días'},{v:90,l:'3 meses'},{v:365,l:'1 año'}].map(({v,l}) => (
              <button key={v} onClick={() => setStatsRange(v)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${statsRange===v?'bg-white text-slate-800 shadow-sm':'text-slate-500'}`}>
                {l}
              </button>
            ))}
          </div>

          {statsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : (
            <>
              {/* Ranking */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Ranking</p>
                <div className="space-y-3">
                  {[...habits]
                    .map(h => ({ ...h, pct: getRangePct(statsLogSet, h, statsRange) }))
                    .sort((a,b) => b.pct-a.pct)
                    .map((h,i) => {
                      const pc = h.pct>=70?'#16a34a':h.pct>=40?'#f59e0b':'#ef4444'
                      return (
                        <div key={h.id} className="flex items-center gap-3">
                          <span className="text-xs font-black text-slate-400 w-4">{i+1}</span>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                            style={{ background: cLight(h.color) }}>{h.icon}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate mb-1">{h.name}</p>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width:`${h.pct}%`, background: pc }}/>
                            </div>
                          </div>
                          <span className="text-xs font-black w-9 text-right" style={{ color:pc }}>{h.pct}%</span>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Per-habit detail */}
              <div className="space-y-2">
                {habits.map(habit => {
                  const isExp = statsExpanded === habit.id
                  const pct = getRangePct(statsLogSet, habit, statsRange)
                  const pc = pct>=70?'#16a34a':pct>=40?'#f59e0b':'#ef4444'
                  return (
                    <div key={habit.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      <button className="w-full flex items-center gap-3 px-4 py-3"
                        onClick={() => setStatsExpanded(isExp?null:habit.id)}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                          style={{ background: cLight(habit.color) }}>{habit.icon}</div>
                        <p className="flex-1 text-left font-semibold text-slate-800 text-sm truncate">{habit.name}</p>
                        <span className="text-xs font-black px-2 py-0.5 rounded-full text-white"
                          style={{ background: pc }}>{pct}%</span>
                        <ChevronDown size={14} className="text-slate-400 transition-transform flex-shrink-0"
                          style={{ transform: isExp?'rotate(180deg)':'rotate(0deg)' }}/>
                      </button>
                      {isExp && (
                        statsRange === 365
                          ? <MonthlyBars logSet={statsLogSet} habitId={habit.id} color={cBg(habit.color)}/>
                          : <HeatmapGrid logSet={statsLogSet} habit={habit} range={statsRange} color={cBg(habit.color)}/>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Today view ── */}
      {view === 'today' && <>

      {/* Progress bar */}
      {habits.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-semibold text-slate-700">Progreso de hoy</span>
            <span className="text-sm font-black" style={{ color: todayDone===habits.length ? '#16a34a' : '#2563eb' }}>
              {Math.round(todayDone/habits.length*100)}%
            </span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width:`${todayDone/habits.length*100}%`, background: todayDone===habits.length?'#16a34a':'#2563eb' }}/>
          </div>
          {todayDone === habits.length && habits.length > 0 && (
            <p className="text-xs text-green-600 font-semibold mt-2 text-center">🎉 ¡Todos los hábitos completados!</p>
          )}
        </div>
      )}

      {/* Empty state */}
      {habits.length === 0 && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎯</div>
          <p className="text-slate-600 font-bold text-lg">Sin hábitos todavía</p>
          <p className="text-slate-400 text-sm mt-1 mb-5">Construye rutinas que te cambien la vida</p>
          <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white font-bold px-6 py-3 rounded-2xl text-sm shadow-md">
            + Añadir primer hábito
          </button>
        </div>
      )}

      {/* Habits list */}
      <div className="space-y-3">
        {habits.map((habit) => {
          const streak    = getStreak(logSet, habit.id)
          const last2     = getLast2(logSet, habit.id)
          const doneToday = logSet.has(`${habit.id}|${todayStr}`)
          const bg        = cBg(habit.color)
          const light     = cLight(habit.color)
          const isOpen    = expandedId === habit.id
          const last7     = isOpen ? getLast7(logSet, habit.id) : null
          const eff7      = isOpen ? effectiveDays(habit, 7) : 7
          const pct       = last7 ? Math.round(last7.slice(-eff7).filter(d=>d.done).length/eff7*100) : 0
          const bestStr   = isOpen ? getBestStreak(logSet, habit.id) : 0
          const pctColor  = pct>=70?'#16a34a':pct>=40?'#f59e0b':'#ef4444'
          const pctLabel  = pct===100?'Perfecto 🎯':pct>=70?'En racha':pct>=40?'Puede mejorar':'Necesita atención'

          return (
            <div key={habit.id} className="relative">
              <div className="relative bg-white rounded-2xl shadow-sm select-none">
                <div className="flex items-center gap-3 px-4 py-4">
                  <button
                    onTouchEnd={e=>{e.stopPropagation();e.preventDefault();setExpandedId(isOpen?null:habit.id)}}
                    onClick={e=>{e.stopPropagation();setExpandedId(isOpen?null:habit.id)}}
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 active:scale-95 transition-transform"
                    style={{ background:light, outline: isOpen?`2px solid ${bg}`:'none', outlineOffset:1 }}>
                    {habit.icon || null}
                  </button>
                  <div className="flex-1 min-w-0">
                    {editingId === habit.id ? (
                      <input ref={editInputRef} value={editingName} onChange={e => setEditingName(e.target.value)}
                        onBlur={() => commitEdit(habit.id)}
                        onKeyDown={e => { if(e.key==='Enter') commitEdit(habit.id); if(e.key==='Escape') setEditingId(null) }}
                        className="font-bold text-slate-800 text-base bg-transparent border-b-2 border-blue-500 outline-none w-full leading-tight pb-0.5"/>
                    ) : (
                      <p onTouchEnd={e=>{e.stopPropagation();startEdit(habit)}} onClick={e=>{e.stopPropagation();startEdit(habit)}}
                        className="font-bold text-slate-800 text-base leading-tight active:opacity-60">
                        {habit.name}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-0.5">
                      <Flame size={14}
                        color={streak>0?'#f97316':'#cbd5e1'}
                        className={doneToday && streak>0 ? 'animate-bounce' : ''}
                        style={doneToday && streak>0 ? { filter:'drop-shadow(0 0 5px #f97316)' } : {}}/>
                      <span className="text-xs font-black" style={{ color: streak>0?'#f97316':'#94a3b8' }}>
                        {streak}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 items-center flex-shrink-0">
                    {last2.map((d,i) => (
                      <div key={i} className="flex items-center justify-center rounded-full flex-shrink-0"
                        style={{ width:18, height:18, background:d.done?bg:'#f1f5f9' }}>
                        {d.done && <Check size={9} color="white"/>}
                      </div>
                    ))}
                  </div>
                  <button
                    onTouchEnd={e=>{e.stopPropagation();toggleToday(habit)}}
                    onClick={e=>{e.stopPropagation();toggleToday(habit)}}
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ml-1 transition-all active:scale-95"
                    style={{ background:doneToday?bg:'#f8fafc', border:`2px solid ${doneToday?bg:'#e2e8f0'}`,
                      boxShadow:doneToday?`0 4px 12px ${bg}44`:'none' }}>
                    {doneToday && <Check size={20} color="white" strokeWidth={3}/>}
                  </button>
                </div>

                {/* ── Accordion stats ── */}
                <div style={{ display:'grid', gridTemplateRows: isOpen?'1fr':'0fr', transition:'grid-template-rows 0.3s ease' }}>
                  <div style={{ overflow:'hidden' }}>
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold" style={{ color:pctColor }}>{pctLabel}</span>
                        <span className="text-xs font-black px-2 py-0.5 rounded-full text-white" style={{ background:pctColor }}>
                          {pct}%
                        </span>
                      </div>
                      <div className="flex justify-between gap-1">
                        {last7 && last7.map((d,i) => (
                          <div key={i} className="flex flex-col items-center gap-1 flex-1">
                            <div className="rounded-md flex items-center justify-center"
                              style={{ width:28, height:28,
                                background: d.done ? bg : '#f1f5f9',
                                border: d.isToday ? `2px solid ${bg}` : '2px solid transparent',
                                opacity: d.done ? 1 : 0.5 }}>
                              {d.done && <Check size={12} color="white" strokeWidth={3}/>}
                            </div>
                            <span className="text-[9px] font-bold" style={{ color: d.isToday?bg:'#94a3b8' }}>{d.label}</span>
                          </div>
                        ))}
                      </div>
                      {bestStr > streak && (
                        <p className="text-[10px] text-slate-400 mt-2 text-center">Mejor racha: <span className="font-black text-slate-600">{bestStr} días</span></p>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )
        })}
      </div>

      </> /* end today view */}

      {/* ── Add modal ─────────────────────────────────────── */}
      {/* ── Manage modal ─────────────────────────────────────── */}
      {showManage && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={() => { setShowManage(false); setManageHabit(null); setManageView('list') }}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>

            {manageView === 'organize' ? (
              /* ── Organize view ── */
              <>
                <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                  <button onClick={() => setManageView('list')}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100">
                    <ChevronLeft size={16} className="text-slate-500"/>
                  </button>
                  <h3 className="font-bold text-slate-800 text-lg flex-1">Ordenar hábitos</h3>
                  <button onClick={() => { setShowManage(false); setManageView('list') }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100">
                    <X size={16} className="text-slate-500"/>
                  </button>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleHabitDragEnd}>
                  <SortableContext items={habits.map(h => h.id)} strategy={verticalListSortingStrategy}>
                    <div className="px-5 pb-6 space-y-2 overflow-y-auto max-h-[70vh]">
                      {habits.map(habit => (
                        <SortableHabitItem key={habit.id} habit={habit}/>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </>
            ) : manageHabit === null ? (
              /* ── List view ── */
              <>
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <h3 className="font-bold text-slate-800 text-lg">Gestionar hábitos</h3>
                  <button onClick={() => setShowManage(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100">
                    <X size={16} className="text-slate-500"/>
                  </button>
                </div>
                <div className="px-5 pb-6 space-y-2 overflow-y-auto max-h-[70vh]">
                  {habits.length > 1 && (
                    <button onClick={() => setManageView('organize')}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl bg-blue-50 active:bg-blue-100">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <GripVertical size={18} className="text-blue-600"/>
                      </div>
                      <p className="flex-1 font-semibold text-blue-700 text-sm text-left">Ordenar hábitos</p>
                      <ChevronDown size={16} className="text-blue-400 -rotate-90"/>
                    </button>
                  )}
                  {habits.map(habit => (
                    <div key={habit.id} className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-slate-50">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: cLight(habit.color) }}>
                        {habit.icon || null}
                      </div>
                      <p className="flex-1 font-semibold text-slate-800 text-sm truncate">{habit.name}</p>
                      <button onClick={() => openManageEdit(habit)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm active:bg-slate-100">
                        <Pencil size={14} className="text-slate-500"/>
                      </button>
                      <button onClick={() => deleteHabit(habit.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-50 active:bg-red-100">
                        <Trash2 size={14} className="text-red-500"/>
                      </button>
                    </div>
                  ))}
                  {habits.length === 0 && (
                    <p className="text-center text-slate-400 text-sm py-8">Sin hábitos todavía</p>
                  )}
                </div>
              </>
            ) : (
              /* ── Edit view ── */
              <>
                <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                  <button onClick={() => setManageHabit(null)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100">
                    <ChevronLeft size={16} className="text-slate-500"/>
                  </button>
                  <h3 className="font-bold text-slate-800 text-lg flex-1">Editar hábito</h3>
                  <button onClick={() => { setShowManage(false); setManageHabit(null) }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100">
                    <X size={16} className="text-slate-500"/>
                  </button>
                </div>

                <div className="px-5 pb-2 overflow-y-auto max-h-[68vh] space-y-5">
                  {/* Preview */}
                  <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: cLight(mColor) }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: cBg(mColor) + '33' }}>
                      {mIcon || null}
                    </div>
                    <span className="font-bold text-slate-800 flex-1 truncate">{mName || 'Nombre del hábito'}</span>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: cBg(mColor) }}>
                      <Check size={16} color="white"/>
                    </div>
                  </div>

                  {/* Name */}
                  <input autoFocus value={mName} onChange={e => setMName(e.target.value)}
                    onKeyDown={e => e.key==='Enter' && saveManageEdit()}
                    placeholder="Nombre del hábito..."
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>

                  {/* Color */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Color</p>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 28px)', gap:10 }}>
                      {PRESET_COLORS.map(hex => (
                        <button key={hex} onClick={() => setMColor(hex)}
                          className="rounded-full transition-shadow"
                          style={{ width:28, height:28, background:hex,
                            boxShadow: mColor===hex ? `0 0 0 2px white, 0 0 0 4px ${hex}` : 'none' }}/>
                      ))}
                      <label className="relative cursor-pointer rounded-full overflow-hidden"
                        style={{ width:28, height:28,
                          background:'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                          boxShadow: !PRESET_COLORS.includes(mColor) ? `0 0 0 2px white, 0 0 0 4px ${mColor}` : 'none' }}>
                        <input type="color" value={mColor.startsWith('#') ? mColor : '#2563eb'}
                          onChange={e => setMColor(e.target.value)}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                      </label>
                    </div>
                  </div>

                  {/* Icon */}
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Icono</p>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 mb-3">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-slate-500 leading-none mb-0.5">Pega cualquier emoji</p>
                        <p className="text-[10px] text-slate-400">Desde el teclado emoji de tu móvil</p>
                      </div>
                      <div className="relative">
                        <input value={mIcon}
                          onChange={e => setMIcon([...e.target.value].slice(0,4).join(''))}
                          placeholder="😀"
                          className="w-14 h-12 text-center text-2xl border-2 rounded-xl outline-none bg-white transition-colors"
                          style={{ borderColor: mIcon ? cBg(mColor) : '#e2e8f0' }}/>
                        {mIcon && (
                          <button onClick={() => setMIcon('')}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-slate-400 rounded-full flex items-center justify-center">
                            <X size={9} color="white"/>
                          </button>
                        )}
                      </div>
                    </div>
                    <button onClick={() => setMIcon('')}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-semibold mb-3 transition-colors
                        ${mIcon==='' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: mIcon===''?cLight(mColor):'#f1f5f9' }}>
                        <span className="text-slate-400 text-xs font-black">∅</span>
                      </div>
                      Sin emoji — solo color
                    </button>
                    {ICON_GROUPS.map(group => (
                      <div key={group.label} className="mb-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{group.label}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.icons.map(ic => (
                            <button key={ic} onClick={() => setMIcon(ic)}
                              className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-colors
                                ${mIcon===ic ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-slate-100 active:bg-slate-200'}`}>
                              {ic}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-5 pt-3 pb-5 border-t border-slate-100 flex gap-2 flex-shrink-0">
                  <button onClick={() => setManageHabit(null)}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl text-sm">
                    Volver
                  </button>
                  <button onClick={saveManageEdit}
                    className="flex-1 py-3 text-white font-bold rounded-xl text-sm shadow-md"
                    style={{ background: cBg(mColor) }}>
                    Guardar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-bold text-slate-800 text-lg">Nuevo hábito</h3>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100">
                <X size={16} className="text-slate-500"/>
              </button>
            </div>

            <div className="px-5 pb-2 overflow-y-auto max-h-[68vh] space-y-5">

              {/* Live preview */}
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: cLight(newColor) }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: cBg(newColor) + '33' }}>
                  {newIcon || null}
                </div>
                <span className="font-bold text-slate-800 flex-1 truncate">{newName || 'Nombre del hábito'}</span>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: cBg(newColor) }}>
                  <Check size={16} color="white"/>
                </div>
              </div>

              {/* Name */}
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key==='Enter' && addHabit()}
                placeholder="Nombre del hábito..."
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>

              {/* ── COLOR (above icons) ───────────────── */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Color</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 28px)', gap: 10 }}>
                  {PRESET_COLORS.map(hex => (
                    <button key={hex} onClick={() => setNewColor(hex)}
                      className="rounded-full transition-shadow"
                      style={{
                        width: 28, height: 28,
                        background: hex,
                        boxShadow: newColor === hex ? `0 0 0 2px white, 0 0 0 4px ${hex}` : 'none',
                      }}/>
                  ))}
                  {/* Rainbow — custom color picker */}
                  <label className="relative cursor-pointer rounded-full overflow-hidden transition-shadow"
                    style={{
                      width: 28, height: 28,
                      background: 'conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
                      boxShadow: !PRESET_COLORS.includes(newColor) ? `0 0 0 2px white, 0 0 0 4px ${newColor}` : 'none',
                    }}>
                    <input type="color" value={newColor.startsWith('#') ? newColor : '#2563eb'}
                      onChange={e => setNewColor(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"/>
                  </label>
                </div>

                {/* Hex display when using custom color */}
                {!PRESET_COLORS.includes(newColor) && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: newColor }}/>
                    <span className="text-xs font-mono text-slate-500">{newColor}</span>
                  </div>
                )}
              </div>

              {/* ── ICON (below color) ────────────────── */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Icono</p>

                {/* Custom emoji paste input */}
                <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5 mb-3">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-slate-500 leading-none mb-0.5">Pega cualquier emoji</p>
                    <p className="text-[10px] text-slate-400">Desde el teclado emoji de tu móvil</p>
                  </div>
                  <div className="relative">
                    <input value={newIcon}
                      onChange={e => setNewIcon([...e.target.value].slice(0,4).join(''))}
                      placeholder="😀"
                      className="w-14 h-12 text-center text-2xl border-2 rounded-xl outline-none bg-white transition-colors"
                      style={{ borderColor: newIcon ? cBg(newColor) : '#e2e8f0' }}/>
                    {newIcon && (
                      <button onClick={() => setNewIcon('')}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-slate-400 rounded-full flex items-center justify-center">
                        <X size={9} color="white"/>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sin emoji */}
                <button onClick={() => setNewIcon('')}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-semibold mb-3 transition-colors
                    ${newIcon==='' ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: newIcon===''?cLight(newColor):'#f1f5f9' }}>
                    <span className="text-slate-400 text-xs font-black">∅</span>
                  </div>
                  Sin emoji — solo color
                </button>

                {/* Icon groups */}
                {ICON_GROUPS.map(group => (
                  <div key={group.label} className="mb-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{group.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.icons.map(ic => (
                        <button key={ic} onClick={() => setNewIcon(ic)}
                          className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border-2 transition-colors
                            ${newIcon===ic ? 'border-blue-500 bg-blue-50' : 'border-transparent bg-slate-100 active:bg-slate-200'}`}>
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Buttons — always visible, never scroll */}
            <div className="px-5 pt-3 pb-5 border-t border-slate-100 flex gap-2 flex-shrink-0">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl text-sm">Cancelar</button>
              <button onClick={addHabit} className="flex-1 py-3 text-white font-bold rounded-xl text-sm shadow-md"
                style={{ background: cBg(newColor) }}>
                Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
