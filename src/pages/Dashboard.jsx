import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { usePomodoro } from '../contexts/PomodoroContext'
import { totalVolume } from '../store/gymStore'
import { CheckCircle2, Circle, Star, Dumbbell, Play, ChevronRight, Plus, Pencil, X } from 'lucide-react'
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, rectSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { useQuickNav, QUICK_CATALOG } from '../lib/quickNav'
import { CSS } from '@dnd-kit/utilities'

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
function daysAgo(dateStr) {
  const diff = Math.round((new Date() - new Date(dateStr + 'T00:00:00')) / 86400000)
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'ayer'
  return `hace ${diff}d`
}
function fmtTime(t) { return t ? t.slice(0,5) : '' }
function fmtSleep(mins) {
  if (!mins) return null
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h${m > 0 ? m+'m' : ''}` : `${m}m`
}

const LEGACY = { blue:'#2563eb', violet:'#7c3aed', green:'#16a34a', red:'#dc2626', orange:'#ea580c', pink:'#db2777' }
function hColor(c) { return c?.startsWith('#') ? c : LEGACY[c] || '#2563eb' }
const EV_COLORS = { blue:'#3b82f6', violet:'#7c3aed', green:'#22c55e', red:'#ef4444', orange:'#f97316', pink:'#ec4899' }
function evColor(c) { return EV_COLORS[c] || '#3b82f6' }

// ── Sub-components ─────────────────────────────────────────────────
function SectionHeader({ title, action, onAction }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
      {action && (
        <button onClick={onAction} className="flex items-center gap-0.5 text-xs font-semibold text-blue-500">
          {action}<ChevronRight size={12}/>
        </button>
      )}
    </div>
  )
}

// Bloque arrastrable: mantener pulsado y mover arriba/abajo
function SortableBlock({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      // No arrastrar al pulsar dentro de un campo de texto (p. ej. editando el foco)
      onMouseDown={e => { if (!e.target.closest('input, textarea')) listeners?.onMouseDown?.(e) }}
      onTouchStart={e => { if (!e.target.closest('input, textarea')) listeners?.onTouchStart?.(e) }}
      onContextMenu={e => e.preventDefault()}
      className={`select-none rounded-3xl ${isDragging ? 'relative z-20 scale-[1.02] shadow-2xl ring-2 ring-blue-400 opacity-95' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition, WebkitTouchCallout: 'none' }}>
      {children}
    </div>
  )
}

// Acceso rápido arrastrable dentro de su cuadrícula (no mueve el bloque entero)
function SortableTile({ id, onOpen }) {
  const n = QUICK_CATALOG[id]
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <button ref={setNodeRef} {...attributes} {...listeners}
      onMouseDown={e => { e.stopPropagation(); listeners?.onMouseDown?.(e) }}
      onTouchStart={e => { e.stopPropagation(); listeners?.onTouchStart?.(e) }}
      onContextMenu={e => e.preventDefault()}
      onClick={() => onOpen(id)}
      className={`flex flex-col items-center gap-2 py-4 rounded-2xl select-none transition-shadow
        ${isDragging ? 'relative z-20 shadow-xl ring-2 ring-blue-400' : 'active:scale-95'}`}
      style={{ background: n.bg, transform: CSS.Transform.toString(transform), transition, WebkitTouchCallout: 'none' }}>
      <span className="text-2xl">{n.emoji}</span>
      <p className="text-xs font-bold" style={{ color: n.fg }}>{n.label}</p>
    </button>
  )
}

const ORDER_KEY     = 'fwd_dash_order'
const DEFAULT_ORDER = ['focus', 'events', 'habits', 'myday', 'gym', 'quick']
function loadOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]').filter(id => DEFAULT_ORDER.includes(id))
    return [...saved, ...DEFAULT_ORDER.filter(id => !saved.includes(id))]
  } catch { return DEFAULT_ORDER }
}

// ── Main ───────────────────────────────────────────────────────────
export default function Dashboard({ logs, routines, setPage, onStartRoutine }) {
  const { user } = useAuth()
  const { pom } = usePomodoro()

  const [myDayTasks,  setMyDayTasks]  = useState([])
  const [habits,      setHabits]      = useState([])
  const [todayLogs,   setTodayLogs]   = useState(new Set())
  const [todayEvents, setTodayEvents] = useState([])
  const [lastSleep,   setLastSleep]   = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [order,       setOrder]       = useState(loadOrder)
  const quick = useQuickNav()

  function handleQuickDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    quick.setAll(arrayMove(quick.ids, quick.ids.indexOf(active.id), quick.ids.indexOf(over.id)))
  }
  // TouchSensor bloquea el scroll del navegador una vez levantada la caja (PointerSensor no lo hace en móvil)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
  )

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    setOrder(prev => {
      const next = arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id))
      try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)) } catch (_) {}
      return next
    })
  }

  // ── Foco del día ──────────────────────────────────────────────────
  const FOCUS_KEY  = 'fwd_focus'
  const [focusText,    setFocusText]    = useState('')
  const [focusDone,    setFocusDone]    = useState(false)
  const [focusEditing, setFocusEditing] = useState(false)
  const [focusInput,   setFocusInput]   = useState('')
  const focusRef = useRef(null)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(FOCUS_KEY) || 'null')
      if (saved?.date === todayStr()) {
        setFocusText(saved.text || '')
        setFocusDone(saved.done || false)
      } else {
        localStorage.removeItem(FOCUS_KEY)
      }
    } catch (_) {}
  }, [])

  function saveFocus() {
    const text = focusInput.trim()
    if (!text) return
    setFocusText(text)
    setFocusDone(false)
    setFocusEditing(false)
    localStorage.setItem(FOCUS_KEY, JSON.stringify({ date: todayStr(), text, done: false }))
  }

  function toggleFocusDone() {
    const done = !focusDone
    setFocusDone(done)
    try {
      const saved = JSON.parse(localStorage.getItem(FOCUS_KEY) || '{}')
      localStorage.setItem(FOCUS_KEY, JSON.stringify({ ...saved, done }))
    } catch (_) {}
  }

  function clearFocus() {
    setFocusText(''); setFocusDone(false); setFocusEditing(false); setFocusInput('')
    localStorage.removeItem(FOCUS_KEY)
  }

  function startEditFocus() {
    setFocusInput(focusText)
    setFocusEditing(true)
    setTimeout(() => focusRef.current?.focus(), 50)
  }
  // ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const today = todayStr()
    Promise.all([
      supabase.from('tasks').select('id,title,completed,important')
        .eq('user_id', user.id).eq('my_day', true).eq('completed', false).limit(6),
      supabase.from('habits').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('habit_logs').select('habit_id').eq('user_id', user.id).eq('date', today),
      supabase.from('calendar_events').select('id,title,start_time,end_time,color,all_day')
        .eq('user_id', user.id).eq('date', today).order('start_time'),
      supabase.from('sleep_logs').select('*').eq('user_id', user.id)
        .not('wake_time', 'is', null).order('bed_time', { ascending:false }).limit(1),
    ]).then(([{data:tasks},{data:hab},{data:hl},{data:evs},{data:sl}]) => {
      setMyDayTasks(tasks || [])
      setHabits(hab || [])
      setTodayLogs(new Set((hl || []).map(l => l.habit_id)))
      setTodayEvents(evs || [])
      setLastSleep(sl?.[0] || null)
      setLoading(false)
    })
  }, [])

  async function toggleTask(task) {
    await supabase.from('tasks').update({ completed: true }).eq('id', task.id)
    setMyDayTasks(p => p.filter(t => t.id !== task.id))
  }

  async function toggleHabit(habitId) {
    const today = todayStr()
    if (todayLogs.has(habitId)) {
      await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', today).eq('user_id', user.id)
      setTodayLogs(p => { const n = new Set(p); n.delete(habitId); return n })
    } else {
      await supabase.from('habit_logs').upsert({ user_id: user.id, habit_id: habitId, date: today })
      setTodayLogs(p => new Set([...p, habitId]))
    }
  }

  const streak         = calcStreak(logs)
  const lastLog        = [...logs].sort((a,b) => b.date.localeCompare(a.date))[0]
  const completedHab   = todayLogs.size
  const totalHab       = habits.length
  const [g1, g2]       = headerGradient()
  const name           = user?.user_metadata?.name || user?.email?.split('@')[0] || 'tú'
  const initial        = name.charAt(0).toUpperCase()


  const block_focus = (
      <div>
        {!focusText && !focusEditing ? (
          /* Empty state — tap to set focus */
          <button onClick={() => { setFocusEditing(true); setTimeout(() => focusRef.current?.focus(), 50) }}
            className="w-full border-2 border-dashed border-slate-200 rounded-3xl px-5 py-5 flex items-center gap-4 active:bg-slate-50 transition-colors text-left">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl">🎯</div>
            <div>
              <p className="font-black text-slate-700 text-base">Foco del día</p>
              <p className="text-sm text-slate-400 mt-0.5">Toca para añadir tu intención</p>
            </div>
          </button>
        ) : focusEditing ? (
          /* Edit mode */
          <div className="bg-white rounded-3xl shadow-sm px-5 py-5 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <p className="font-black text-slate-800 text-base">Foco del día</p>
            </div>
            <textarea
              ref={focusRef}
              value={focusInput}
              onChange={e => setFocusInput(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); saveFocus() } }}
              placeholder="¿Cuál es tu intención para hoy?"
              rows={2}
              className="w-full text-slate-800 font-semibold text-base bg-slate-50 rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-300"
            />
            <div className="flex gap-2">
              <button onClick={() => { setFocusEditing(false); setFocusInput('') }}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-2xl text-sm">
                Cancelar
              </button>
              <button onClick={saveFocus} disabled={!focusInput.trim()}
                className="flex-1 py-2.5 bg-amber-400 text-white font-bold rounded-2xl text-sm disabled:opacity-40 active:bg-amber-500">
                Guardar foco
              </button>
            </div>
          </div>
        ) : (
          /* Focus set */
          <div className="rounded-3xl px-5 py-5 shadow-sm"
            style={{ background: focusDone ? 'linear-gradient(135deg,#d1fae5,#a7f3d0)' : 'linear-gradient(135deg,#fffbeb,#fef3c7)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="text-2xl mt-0.5 flex-shrink-0">{focusDone ? '✅' : '🎯'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest mb-1"
                    style={{ color: focusDone ? '#065f46' : '#92400e' }}>
                    Foco del día
                  </p>
                  <p className={`font-bold text-slate-800 text-base leading-snug ${focusDone ? 'line-through opacity-60' : ''}`}>
                    {focusText}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!focusDone && (
                  <button onClick={startEditFocus}
                    className="w-8 h-8 rounded-xl bg-white/60 flex items-center justify-center active:bg-white">
                    <Pencil size={13} className="text-slate-500"/>
                  </button>
                )}
                <button onClick={clearFocus}
                  className="w-8 h-8 rounded-xl bg-white/60 flex items-center justify-center active:bg-white">
                  <X size={13} className="text-slate-500"/>
                </button>
              </div>
            </div>
            <button onClick={toggleFocusDone}
              className="mt-4 w-full py-2.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
              style={{
                background: focusDone ? 'rgba(255,255,255,0.6)' : '#f59e0b',
                color: focusDone ? '#065f46' : 'white'
              }}>
              {focusDone ? '↩ Marcar como pendiente' : '✓ Marcar como completado'}
            </button>
          </div>
        )}
      </div>
      )

  const block_events = todayEvents.length > 0 && (
        <div>
          <SectionHeader title="Hoy en el calendario" action="Ver" onAction={() => setPage('calendar')}/>
          <div className="space-y-2">
            {todayEvents.slice(0, 3).map(ev => (
              <div key={ev.id} className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: evColor(ev.color) }}/>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 text-sm truncate">{ev.title}</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: evColor(ev.color) }}>
                    {ev.all_day ? 'Todo el día' : fmtTime(ev.start_time) + (ev.end_time ? ` – ${fmtTime(ev.end_time)}` : '')}
                  </p>
                </div>
              </div>
            ))}
            {todayEvents.length > 3 && (
              <button onClick={() => setPage('calendar')} className="w-full text-center text-xs text-blue-500 font-semibold py-1">
                +{todayEvents.length - 3} más
              </button>
            )}
          </div>
        </div>
      )

  const block_habits = habits.length > 0 && (
        <div>
          <SectionHeader
            title={`Hábitos · ${completedHab}/${totalHab}`}
            action="Ver todo"
            onAction={() => setPage('habits')}/>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            {/* Progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 mb-4 overflow-hidden">
              <div className="h-2 rounded-full transition-all duration-500"
                style={{ width: totalHab > 0 ? `${(completedHab/totalHab)*100}%` : '0%',
                  background: completedHab === totalHab && totalHab > 0 ? '#16a34a' : '#2563eb' }}/>
            </div>
            {/* Habit circles */}
            <div className="flex flex-wrap gap-3">
              {habits.map(h => {
                const done = todayLogs.has(h.id)
                const c    = hColor(h.color)
                return (
                  <button key={h.id} onClick={() => toggleHabit(h.id)}
                    className="flex flex-col items-center gap-1.5 active:scale-90 transition-transform">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl relative shadow-sm"
                      style={{ background: done ? c : c+'15', border: `2px solid ${done ? c : c+'40'}` }}>
                      {h.icon || '⭐'}
                      {done && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                          <span className="text-white text-[8px] font-black">✓</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium max-w-[48px] truncate text-center">{h.name}</p>
                  </button>
                )
              })}
            </div>
            {completedHab === totalHab && totalHab > 0 && (
              <p className="text-center text-green-600 font-bold text-xs mt-3">🎉 ¡Todos los hábitos completados!</p>
            )}
          </div>
        </div>
      )

  const block_myday = (
      <div>
        <SectionHeader title="Mi día" action="Ver todo" onAction={() => setPage('tasks', 'myday')}/>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-6 flex justify-center">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : myDayTasks.length === 0 ? (
            <div className="py-6 text-center px-4">
              <p className="text-slate-400 text-sm">Sin tareas para hoy</p>
              <button onClick={() => setPage('tasks', 'myday')}
                className="mt-2 text-blue-600 text-sm font-semibold flex items-center gap-1 mx-auto">
                <Plus size={14}/> Añadir tarea
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {myDayTasks.map(task => (
                <button key={task.id} onClick={() => toggleTask(task)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-slate-50 text-left">
                  <div className="w-5 h-5 rounded-full border-2 border-slate-300 flex-shrink-0 flex items-center justify-center">
                  </div>
                  <span className="text-sm font-medium text-slate-700 flex-1 leading-snug">{task.title}</span>
                  {task.important && <Star size={13} fill="#fbbf24" className="text-amber-400 flex-shrink-0"/>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      )

  const block_gym = (
      <div>
        <SectionHeader title="Gimnasio" action="Progreso" onAction={() => setPage('progress')}/>
        <div className="space-y-2">
          {/* Last workout */}
          {lastLog && (
            <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Dumbbell size={18} className="text-violet-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-400">Último entreno · {daysAgo(lastLog.date)}</p>
                <p className="text-sm font-bold text-slate-700 truncate">{lastLog.routineName}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-slate-400">Racha</p>
                <p className="text-lg font-black text-orange-500">{streak}🔥</p>
              </div>
            </div>
          )}
          {/* Routines quick launch */}
          {routines.slice(0, 3).map(r => (
            <button key={r.id} onClick={() => onStartRoutine(r.id)}
              className="w-full bg-white rounded-2xl shadow-sm px-4 py-3.5 flex items-center gap-3 active:bg-slate-50 text-left">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Dumbbell size={17} className="text-violet-600"/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 truncate">{r.name}</p>
                <p className="text-xs text-slate-400">{r.exercises?.length || 0} ejercicios</p>
              </div>
              <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
                <Play size={15} fill="white" className="text-white"/>
              </div>
            </button>
          ))}
          {routines.length === 0 && (
            <button onClick={() => setPage('log')}
              className="w-full bg-white rounded-2xl shadow-sm px-4 py-4 flex items-center gap-3 active:bg-slate-50">
              <Plus size={18} className="text-violet-500"/>
              <span className="text-sm font-semibold text-slate-500">Crear primera rutina</span>
            </button>
          )}
        </div>
      </div>
      )

  const block_quick = (
      <div>
        <SectionHeader title="Accesos rápidos"/>
        {quick.ids.length === 0 ? (
          <p className="bg-white rounded-2xl shadow-sm px-4 py-5 text-center text-sm text-slate-400">
            Mantén pulsada una sección del menú para añadirla aquí
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleQuickDragEnd}>
            <SortableContext items={quick.ids} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 gap-3">
                {quick.ids.map(id => <SortableTile key={id} id={id} onOpen={setPage}/>)}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
      )

  const blocks  = { focus: block_focus, events: block_events, habits: block_habits, myday: block_myday, gym: block_gym, quick: block_quick }
  const visible = order.filter(id => blocks[id])

  return (
    <div className="space-y-5 pb-8">

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

      {/* ── Bloques reordenables (mantener pulsado para mover) ── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={visible} strategy={verticalListSortingStrategy}>
          <div className="space-y-5">
            {visible.map(id => <SortableBlock key={id} id={id}>{blocks[id]}</SortableBlock>)}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
