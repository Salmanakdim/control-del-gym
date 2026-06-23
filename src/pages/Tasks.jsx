import { useState, useEffect, useRef } from 'react'
import { Plus, Star, Calendar, Sun, Inbox, ChevronLeft, ChevronRight, Trash2, Circle,
  CheckCircle2, Search, X, Bell, RotateCcw, FileText, Check, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const COLOR_OPTIONS = [
  { id: 'blue',   bg: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-600' },
  { id: 'purple', bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600' },
  { id: 'green',  bg: 'bg-green-500',  light: 'bg-green-50',  text: 'text-green-600' },
  { id: 'red',    bg: 'bg-red-500',    light: 'bg-red-50',    text: 'text-red-600' },
  { id: 'orange', bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-600' },
  { id: 'pink',   bg: 'bg-pink-500',   light: 'bg-pink-50',   text: 'text-pink-600' },
  { id: 'teal',   bg: 'bg-teal-500',   light: 'bg-teal-50',   text: 'text-teal-600' },
  { id: 'amber',  bg: 'bg-amber-500',  light: 'bg-amber-50',  text: 'text-amber-600' },
]
function getColor(id) { return COLOR_OPTIONS.find(c => c.id === id) || COLOR_OPTIONS[0] }
function today() { return new Date().toISOString().split('T')[0] }
function formatDate(d) {
  if (!d) return null
  const t = today()
  const tom = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  if (d === t) return 'Hoy'
  if (d === tom) return 'Mañana'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}
function formatDateTime(iso) {
  if (!iso) return null
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
function isPast(d) { return d && d < today() }
function uid() { return Math.random().toString(36).slice(2, 9) }
function timeAgo(iso) {
  if (!iso) return ''
  const diff = Math.floor((new Date() - new Date(iso)) / 86400000)
  if (diff === 0) return 'Creada hoy'
  if (diff === 1) return 'Creada ayer'
  return `Creada hace ${diff} días`
}
function initials(email) {
  if (!email) return '?'
  return email.split('@')[0].split(/[._-]/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const WEEK_DAYS = ['lun','mar','mié','jue','vie','sáb','dom']

// ── BOTTOM SHEET ──────────────────────────────────────────────
function BottomSheet({ title, onClose, onConfirm, confirmLabel = 'Listo', children }) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <ChevronLeft size={20} />
          </button>
          <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
          <button onClick={onConfirm || onClose} className="text-blue-600 font-semibold text-sm px-1">
            {confirmLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── CALENDAR PICKER ───────────────────────────────────────────
function CalendarPicker({ value, onChange }) {
  const ref = value ? new Date(value + 'T00:00:00') : new Date()
  const [viewYear, setViewYear] = useState(ref.getFullYear())
  const [viewMonth, setViewMonth] = useState(ref.getMonth())
  const todayStr = today()

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const daysInPrev = new Date(viewYear, viewMonth, 0).getDate()

  const cells = []
  for (let i = offset - 1; i >= 0; i--) cells.push({ d: daysInPrev - i, cur: false, m: viewMonth - 1, y: viewYear })
  for (let i = 1; i <= daysInMonth; i++) cells.push({ d: i, cur: true, m: viewMonth, y: viewYear })
  while (cells.length % 7 !== 0) cells.push({ d: cells.length - offset - daysInMonth + 1, cur: false, m: viewMonth + 1, y: viewYear })

  function cellStr(c) {
    const mo = ((c.m % 12) + 12) % 12
    const yr = c.m < 0 ? c.y - 1 : c.m > 11 ? c.y + 1 : c.y
    return `${yr}-${String(mo + 1).padStart(2, '0')}-${String(c.d).padStart(2, '0')}`
  }

  return (
    <div className="px-4 pb-2">
      <div className="flex items-center justify-between py-3">
        <button onClick={prevMonth} className="p-2 rounded-full hover:bg-slate-100 text-slate-600">
          <ChevronLeft size={18} />
        </button>
        <span className="font-semibold text-slate-800">{MONTHS[viewMonth]} de {viewYear}</span>
        <button onClick={nextMonth} className="p-2 rounded-full hover:bg-slate-100 text-slate-600">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map(d => <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          const s = cellStr(c)
          const sel = s === value
          const isT = s === todayStr
          return (
            <button key={i} onClick={() => c.cur && onChange(s)}
              className={`aspect-square flex items-center justify-center text-sm rounded-full mx-auto w-9 h-9 transition-colors
                ${sel ? 'bg-blue-600 text-white font-bold' : ''}
                ${isT && !sel ? 'text-blue-600 font-bold border-2 border-blue-400' : ''}
                ${!c.cur ? 'text-slate-300' : ''}
                ${c.cur && !sel && !isT ? 'text-slate-700 hover:bg-slate-100' : ''}
              `}>
              {c.d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── TIME PICKER ───────────────────────────────────────────────
function TimePicker({ hour, minute, onChange }) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 60 }, (_, i) => i)
  const hourRef = useRef(null)
  const minRef = useRef(null)
  const hourTimer = useRef(null)
  const minTimer = useRef(null)
  const ITEM_H = 44

  useEffect(() => {
    requestAnimationFrame(() => {
      if (hourRef.current) hourRef.current.scrollTop = hour * ITEM_H
      if (minRef.current) minRef.current.scrollTop = minute * ITEM_H
    })
  }, [])

  function handleHourScroll() {
    clearTimeout(hourTimer.current)
    hourTimer.current = setTimeout(() => {
      const h = Math.max(0, Math.min(23, Math.round(hourRef.current.scrollTop / ITEM_H)))
      const m = Math.max(0, Math.min(59, Math.round(minRef.current.scrollTop / ITEM_H)))
      hourRef.current.scrollTo({ top: h * ITEM_H, behavior: 'smooth' })
      onChange(h, m)
    }, 120)
  }
  function handleMinScroll() {
    clearTimeout(minTimer.current)
    minTimer.current = setTimeout(() => {
      const h = Math.max(0, Math.min(23, Math.round(hourRef.current.scrollTop / ITEM_H)))
      const m = Math.max(0, Math.min(59, Math.round(minRef.current.scrollTop / ITEM_H)))
      minRef.current.scrollTo({ top: m * ITEM_H, behavior: 'smooth' })
      onChange(h, m)
    }, 120)
  }

  function ScrollCol({ items, selected, ref_, onScroll }) {
    return (
      <div className="flex-1 relative">
        <div ref={ref_} onScroll={onScroll}
          className="h-[220px] overflow-y-scroll scrollbar-hide"
          style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ paddingTop: `${ITEM_H * 2}px`, paddingBottom: `${ITEM_H * 2}px` }}>
            {items.map(v => (
              <div key={v} style={{ height: ITEM_H, scrollSnapAlign: 'center' }} className="flex items-center justify-center">
                <span className={`text-2xl font-semibold transition-all ${v === selected ? 'text-slate-800' : 'text-slate-300'}`}>
                  {String(v).padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-x-0 top-[88px] h-[44px] border-t-2 border-b-2 border-slate-200 pointer-events-none rounded-lg" />
        <div className="absolute inset-x-0 top-0 h-[88px] bg-gradient-to-b from-white to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-[88px] bg-gradient-to-t from-white to-transparent pointer-events-none" />
      </div>
    )
  }

  return (
    <div className="flex items-center px-8 gap-2">
      <ScrollCol items={hours} selected={hour} ref_={hourRef} onScroll={handleHourScroll} />
      <span className="text-2xl font-bold text-slate-400">:</span>
      <ScrollCol items={minutes} selected={minute} ref_={minRef} onScroll={handleMinScroll} />
    </div>
  )
}

// ── REMINDER SHEET ────────────────────────────────────────────
function ReminderSheet({ current, onSave, onClose }) {
  const [subView, setSubView] = useState('quick') // 'quick' | 'calendar' | 'time'
  const [selDate, setSelDate] = useState(current ? current.split('T')[0] : today())
  const [selHour, setSelHour] = useState(current ? new Date(current).getHours() : 9)
  const [selMin, setSelMin] = useState(current ? new Date(current).getMinutes() : 0)

  const todayStr = today()
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const nextMonStr = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  function buildISO(dateStr, h, m) {
    return new Date(`${dateStr}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`).toISOString()
  }

  function dayLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })
  }

  if (subView === 'time') return (
    <BottomSheet title="Elegir hora" onClose={() => setSubView('calendar')}
      onConfirm={() => { onSave(buildISO(selDate, selHour, selMin)); onClose() }}
      confirmLabel="Establecer">
      <TimePicker hour={selHour} minute={selMin}
        onChange={(h, m) => { setSelHour(h); setSelMin(m) }} />
    </BottomSheet>
  )

  if (subView === 'calendar') return (
    <BottomSheet title={`${MONTHS[new Date(selDate + 'T00:00:00').getMonth()]} de ${new Date(selDate + 'T00:00:00').getFullYear()}`}
      onClose={() => setSubView('quick')}
      onConfirm={() => { onSave(buildISO(selDate, selHour, selMin)); onClose() }}
      confirmLabel="Establecer">
      <CalendarPicker value={selDate} onChange={setSelDate} />
      <div className="border-t border-slate-100">
        <button onClick={() => setSubView('time')}
          className="flex items-center justify-between w-full px-5 py-4 hover:bg-slate-50">
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-slate-400" />
            <span className="text-sm text-slate-700">Elegir hora</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-500 text-sm font-medium">
              {String(selHour).padStart(2,'0')}:{String(selMin).padStart(2,'0')}
            </span>
            <ChevronRight size={16} className="text-slate-300" />
          </div>
        </button>
      </div>
    </BottomSheet>
  )

  // Quick options
  const options = [
    { label: 'Más tarde hoy', sub: `${dayLabel(todayStr)}, 15:00`, h: 15, m: 0, date: todayStr, icon: Clock },
    { label: 'Mañana', sub: `${dayLabel(tomorrowStr)}, 9:00`, h: 9, m: 0, date: tomorrowStr, icon: Calendar },
    { label: 'Semana próxima', sub: `${dayLabel(nextMonStr)}, 9:00`, h: 9, m: 0, date: nextMonStr, icon: Calendar },
  ]

  return (
    <BottomSheet title="Aviso" onClose={onClose} onConfirm={onClose} confirmLabel="Listo">
      <div className="py-2">
        {options.map(o => (
          <button key={o.label} onClick={() => onSave(buildISO(o.date, o.h, o.m)) || onClose()}
            className="flex items-center justify-between w-full px-5 py-4 hover:bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <o.icon size={20} className="text-slate-400" />
              <span className="text-sm text-slate-700">{o.label}</span>
            </div>
            <span className="text-sm text-slate-400">{o.sub}</span>
          </button>
        ))}
        <button onClick={() => setSubView('calendar')}
          className="flex items-center justify-between w-full px-5 py-4 hover:bg-slate-50">
          <div className="flex items-center gap-4">
            <Calendar size={20} className="text-slate-400" />
            <span className="text-sm text-slate-700">Elegir una fecha y una hora</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>
      </div>
    </BottomSheet>
  )
}

// ── DUE DATE SHEET ────────────────────────────────────────────
function DueDateSheet({ current, onSave, onClose }) {
  const [subView, setSubView] = useState('quick')
  const [selDate, setSelDate] = useState(current || today())
  const todayStr = today()
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const nextWeekStr = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  function dayLabel(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })
  }

  if (subView === 'calendar') return (
    <BottomSheet title="Fecha de vencimiento" onClose={() => setSubView('quick')}
      onConfirm={() => { onSave(selDate); onClose() }} confirmLabel="Establecer">
      <CalendarPicker value={selDate} onChange={setSelDate} />
    </BottomSheet>
  )

  const options = [
    { label: 'Hoy',           sub: dayLabel(todayStr),    date: todayStr,    icon: Clock },
    { label: 'Mañana',        sub: dayLabel(tomorrowStr), date: tomorrowStr, icon: Calendar },
    { label: 'Semana próxima',sub: dayLabel(nextWeekStr), date: nextWeekStr, icon: Calendar },
  ]

  return (
    <BottomSheet title="Fecha de vencimiento" onClose={onClose} onConfirm={onClose} confirmLabel="Listo">
      <div className="py-2">
        {options.map(o => (
          <button key={o.label} onClick={() => { onSave(o.date); onClose() }}
            className="flex items-center justify-between w-full px-5 py-4 hover:bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <o.icon size={20} className="text-slate-400" />
              <span className="text-sm text-slate-700">{o.label}</span>
            </div>
            <span className="text-sm text-slate-400">{o.sub}</span>
          </button>
        ))}
        <button onClick={() => setSubView('calendar')}
          className="flex items-center justify-between w-full px-5 py-4 hover:bg-slate-50">
          <div className="flex items-center gap-4">
            <Calendar size={20} className="text-slate-400" />
            <span className="text-sm text-slate-700">Elegir una fecha</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>
      </div>
    </BottomSheet>
  )
}

// ── SMART LISTS ───────────────────────────────────────────────
const SMART_LISTS = [
  { id: 'myday',     label: 'Mi día',     icon: Sun,      color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'important', label: 'Importante', icon: Star,     color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { id: 'planned',   label: 'Planeado',   icon: Calendar, color: 'text-blue-500',   bg: 'bg-blue-50' },
  { id: 'inbox',     label: 'Tareas',     icon: Inbox,    color: 'text-slate-500',  bg: 'bg-slate-50' },
]
function getSmartTasks(tasks, id) {
  const p = tasks.filter(t => !t.completed)
  if (id === 'myday')     return p.filter(t => t.my_day)
  if (id === 'important') return p.filter(t => t.important)
  if (id === 'planned')   return p.filter(t => t.due_date)
  if (id === 'inbox')     return p.filter(t => !t.folder_id)
  return []
}

// ── TASK DETAIL ───────────────────────────────────────────────
function TaskDetail({ task, folders, onBack, onUpdate, onDelete }) {
  const [title, setTitle] = useState(task.title)
  const [note, setNote] = useState(task.note || '')
  const [steps, setSteps] = useState(task.steps || [])
  const [newStep, setNewStep] = useState('')
  const [sheet, setSheet] = useState(null) // 'reminder' | 'duedate'
  const folder = folders.find(f => f.id === task.folder_id)

  async function patch(updates) {
    await supabase.from('tasks').update(updates).eq('id', task.id)
    onUpdate({ ...task, ...updates })
  }

  async function addStep(e) {
    e.preventDefault()
    if (!newStep.trim()) return
    const updated = [...steps, { id: uid(), title: newStep.trim(), completed: false }]
    setSteps(updated); setNewStep('')
    patch({ steps: updated })
  }
  async function toggleStep(id) {
    const updated = steps.map(s => s.id === id ? { ...s, completed: !s.completed } : s)
    setSteps(updated); patch({ steps: updated })
  }
  async function deleteStep(id) {
    const updated = steps.filter(s => s.id !== id)
    setSteps(updated); patch({ steps: updated })
  }

  return (
    <div className="max-w-lg mx-auto pb-10 min-h-screen flex flex-col">
      {sheet === 'reminder' && (
        <ReminderSheet current={task.reminder}
          onSave={v => patch({ reminder: v })}
          onClose={() => setSheet(null)} />
      )}
      {sheet === 'duedate' && (
        <DueDateSheet current={task.due_date}
          onSave={v => patch({ due_date: v })}
          onClose={() => setSheet(null)} />
      )}

      {/* Header */}
      <div className="flex items-center py-4 px-1">
        <button onClick={onBack} className="text-blue-500 flex items-center gap-1 text-sm font-medium p-1">
          <ChevronLeft size={20} />
          {folder ? folder.name : 'Tareas'}
        </button>
      </div>

      {/* Title card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4 mb-3">
        <div className="flex items-start gap-3">
          <button onClick={() => { patch({ completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : null }); onBack() }}
            className="flex-shrink-0 mt-0.5 text-slate-300 hover:text-blue-500 transition-colors">
            {task.completed ? <CheckCircle2 size={24} className="text-blue-500" /> : <Circle size={24} />}
          </button>
          <input value={title} onChange={e => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && patch({ title: title.trim() })}
            className={`flex-1 text-lg font-semibold text-slate-800 outline-none bg-transparent ${task.completed ? 'line-through text-slate-400' : ''}`} />
          <button onClick={() => patch({ important: !task.important })}
            className={`flex-shrink-0 transition-colors ${task.important ? 'text-yellow-400' : 'text-slate-200 hover:text-yellow-300'}`}>
            <Star size={20} fill={task.important ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Steps */}
        {steps.map(s => (
          <div key={s.id} className="flex items-center gap-3 mt-3 pl-9 group">
            <button onClick={() => toggleStep(s.id)} className="flex-shrink-0 text-slate-300 hover:text-blue-400">
              {s.completed ? <CheckCircle2 size={18} className="text-blue-400" /> : <Circle size={18} />}
            </button>
            <span className={`flex-1 text-sm text-slate-700 ${s.completed ? 'line-through text-slate-400' : ''}`}>{s.title}</span>
            <button onClick={() => deleteStep(s.id)} className="opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-400">
              <X size={14} />
            </button>
          </div>
        ))}

        {/* Add step */}
        <form onSubmit={addStep} className="flex items-center gap-3 mt-3 pl-9">
          <Plus size={16} className="text-blue-500 flex-shrink-0" />
          <input value={newStep} onChange={e => setNewStep(e.target.value)} placeholder="Agregar paso"
            className="flex-1 text-sm text-slate-500 placeholder-slate-400 outline-none bg-transparent" />
          {newStep && <button type="submit" className="text-blue-600"><Check size={16} /></button>}
        </form>
      </div>

      {/* Options card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-3">
        {/* Mi día */}
        <button onClick={() => patch({ my_day: !task.my_day })}
          className="flex items-center gap-4 px-4 py-4 w-full text-left hover:bg-slate-50 border-b border-slate-100">
          <Sun size={18} className={task.my_day ? 'text-orange-400' : 'text-slate-400'} />
          <span className={`text-sm flex-1 ${task.my_day ? 'text-orange-500 font-medium' : 'text-slate-500'}`}>
            {task.my_day ? 'Añadido a Mi día' : 'Agregar a Mi día'}
          </span>
          {task.my_day && <Check size={15} className="text-orange-400" />}
        </button>

        {/* Reminder */}
        <button onClick={() => setSheet('reminder')}
          className="flex items-center gap-4 px-4 py-4 w-full text-left hover:bg-slate-50 border-b border-slate-100">
          <Bell size={18} className={task.reminder ? 'text-blue-400' : 'text-slate-400'} />
          <span className={`text-sm flex-1 ${task.reminder ? 'text-blue-500 font-medium' : 'text-slate-500'}`}>
            {task.reminder ? formatDateTime(task.reminder) : 'Recordarme'}
          </span>
          {task.reminder && (
            <button onClick={e => { e.stopPropagation(); patch({ reminder: null }) }}
              className="text-slate-300 hover:text-red-400"><X size={15} /></button>
          )}
        </button>

        {/* Due date */}
        <button onClick={() => setSheet('duedate')}
          className="flex items-center gap-4 px-4 py-4 w-full text-left hover:bg-slate-50 border-b border-slate-100">
          <Calendar size={18} className={task.due_date ? 'text-blue-400' : 'text-slate-400'} />
          <span className={`text-sm flex-1 ${task.due_date ? (isPast(task.due_date) ? 'text-red-500 font-medium' : 'text-blue-500 font-medium') : 'text-slate-500'}`}>
            {task.due_date ? formatDate(task.due_date) : 'Agregar fecha de vencimiento'}
          </span>
          {task.due_date && (
            <button onClick={e => { e.stopPropagation(); patch({ due_date: null }) }}
              className="text-slate-300 hover:text-red-400"><X size={15} /></button>
          )}
        </button>

        {/* Repeat (placeholder) */}
        <button disabled className="flex items-center gap-4 px-4 py-4 w-full text-left opacity-40">
          <RotateCcw size={18} className="text-slate-400" />
          <span className="text-sm text-slate-500">Repetir</span>
        </button>
      </div>

      {/* Note */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3.5 mb-3 flex items-start gap-3">
        <FileText size={17} className="text-slate-400 mt-0.5 flex-shrink-0" />
        <textarea value={note} onChange={e => setNote(e.target.value)}
          onBlur={() => note !== (task.note || '') && patch({ note })}
          placeholder="Agregar nota" rows={3}
          className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none bg-transparent" />
      </div>

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between px-2 pt-2 text-xs text-slate-400">
        <span>{timeAgo(task.created_at)}</span>
        <button onClick={() => { onDelete(task.id); onBack() }} className="text-slate-300 hover:text-red-500 p-1">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────
export default function Tasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('home')
  const [selectedTask, setSelectedTask] = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderColor, setFolderColor] = useState('blue')
  const [showSearch, setShowSearch] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: f }, { data: t }] = await Promise.all([
      supabase.from('folders').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    setFolders(f || []); setTasks(t || []); setLoading(false)
  }

  async function addTask(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const folder_id = folders.find(f => f.id === view)?.id || null
    const { data } = await supabase.from('tasks').insert({
      user_id: user.id, title: newTitle.trim(), folder_id,
      my_day: view === 'myday', important: view === 'important',
      due_date: view === 'planned' ? today() : null,
      completed: false, steps: [],
    }).select().single()
    if (data) setTasks(prev => [data, ...prev])
    setNewTitle('')
  }

  async function toggleTask(task) {
    const updates = { completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : null }
    await supabase.from('tasks').update(updates).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t))
  }

  async function toggleImportant(task, e) {
    e.stopPropagation()
    const updates = { important: !task.important }
    await supabase.from('tasks').update(updates).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t))
  }

  function handleUpdateTask(updated) {
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
    setSelectedTask(updated)
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    setSelectedTask(null)
  }

  async function addFolder(e) {
    e.preventDefault()
    if (!folderName.trim()) return
    const { data } = await supabase.from('folders').insert({
      user_id: user.id, name: folderName.trim(), color: folderColor
    }).select().single()
    if (data) { setFolders(prev => [...prev, data]); setView(data.id) }
    setFolderName(''); setShowNewFolder(false)
  }

  async function deleteFolder(id, e) {
    e.stopPropagation()
    await supabase.from('folders').delete().eq('id', id)
    setFolders(prev => prev.filter(f => f.id !== id))
    setTasks(prev => prev.map(t => t.folder_id === id ? { ...t, folder_id: null } : t))
    if (view === id) setView('home')
  }

  const smartList = SMART_LISTS.find(s => s.id === view)
  const currentFolder = folders.find(f => f.id === view)
  const isHome = view === 'home'
  let viewTasks = smartList ? getSmartTasks(tasks, view)
    : currentFolder ? tasks.filter(t => t.folder_id === view && !t.completed) : []
  const viewCompleted = currentFolder ? tasks.filter(t => t.folder_id === view && t.completed) : []
  const viewColor = currentFolder ? getColor(currentFolder.color) : null
  const viewTitle = smartList?.label || currentFolder?.name || 'Tareas'
  const searchResults = search.length > 1 ? tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase())) : []

  function TaskRow({ task }) {
    const folder = folders.find(f => f.id === task.folder_id)
    const fc = folder ? getColor(folder.color) : null
    return (
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 group border-b border-slate-100 last:border-0">
        <button onClick={() => toggleTask(task)} className="flex-shrink-0 text-slate-300 hover:text-blue-500 transition-colors">
          {task.completed ? <CheckCircle2 size={20} className="text-blue-400" /> : <Circle size={20} />}
        </button>
        <button className="flex-1 min-w-0 text-left" onClick={() => setSelectedTask(task)}>
          <p className={`text-sm text-slate-800 leading-snug ${task.completed ? 'line-through text-slate-400' : ''}`}>{task.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {folder && !currentFolder && <span className={`text-xs ${fc.text} font-medium`}>{folder.name}</span>}
            {task.my_day && !smartList && <span className="text-xs text-orange-400">Mi día</span>}
            {task.due_date && <span className={`text-xs ${isPast(task.due_date) && !task.completed ? 'text-red-400' : 'text-slate-400'}`}>{formatDate(task.due_date)}</span>}
            {task.reminder && <Bell size={11} className="text-blue-400" />}
            {task.steps?.length > 0 && <span className="text-xs text-slate-400">{task.steps.filter(s => s.completed).length}/{task.steps.length}</span>}
          </div>
        </button>
        <button onClick={e => toggleImportant(task, e)}
          className={`flex-shrink-0 ${task.important ? 'text-yellow-400' : 'text-slate-200 hover:text-yellow-300'}`}>
          <Star size={16} fill={task.important ? 'currentColor' : 'none'} />
        </button>
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  if (selectedTask) {
    const current = tasks.find(t => t.id === selectedTask.id) || selectedTask
    return <TaskDetail task={current} folders={folders} onBack={() => setSelectedTask(null)} onUpdate={handleUpdateTask} onDelete={deleteTask} />
  }

  if (isHome) return (
    <div className="max-w-lg mx-auto pb-10">
      <div className="flex items-center justify-between py-4 px-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">{initials(user.email)}</div>
          <span className="font-bold text-slate-800">{user.email?.split('@')[0]}</span>
        </div>
        <button onClick={() => setShowSearch(v => !v)} className="text-slate-400 hover:text-slate-600 p-1"><Search size={19} /></button>
      </div>
      {showSearch && (
        <div className="mx-1 mb-3 relative">
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tareas..."
            className="w-full bg-slate-100 rounded-xl px-4 py-2.5 text-sm outline-none text-slate-800 placeholder-slate-400 pr-10" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={15} /></button>}
          {search.length > 1 && (
            <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-lg border border-slate-100 mt-1 z-10 overflow-hidden">
              {searchResults.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">Sin resultados</p>
                : searchResults.map(t => <TaskRow key={t.id} task={t} />)}
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 mb-2 px-1">
        {SMART_LISTS.map(s => {
          const count = getSmartTasks(tasks, s.id).length
          const Icon = s.icon
          return (
            <button key={s.id} onClick={() => setView(s.id)} className={`${s.bg} rounded-2xl p-4 text-left hover:shadow-sm transition-shadow`}>
              <Icon size={20} className={`${s.color} mb-3`} />
              <p className="text-sm font-semibold text-slate-700">{s.label}</p>
              {count > 0 && <p className="text-xl font-black text-slate-800 mt-0.5">{count}</p>}
            </button>
          )
        })}
      </div>
      <div className="border-t border-slate-200 my-4 mx-1" />
      <div className="px-1 space-y-1">
        {folders.map(f => {
          const c = getColor(f.color)
          const count = tasks.filter(t => t.folder_id === f.id && !t.completed).length
          return (
            <div key={f.id} className="flex items-center group">
              <button onClick={() => setView(f.id)} className="flex-1 flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 text-left">
                <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
                  <span className="text-white text-xs font-bold">{f.name[0]?.toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium text-slate-700 flex-1">{f.name}</span>
                {count > 0 && <span className="text-sm text-slate-400 font-medium">{count}</span>}
                <ChevronRight size={16} className="text-slate-300" />
              </button>
              <button onClick={e => deleteFolder(f.id, e)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 px-2">
                <Trash2 size={15} />
              </button>
            </div>
          )
        })}
      </div>
      {showNewFolder ? (
        <form onSubmit={addFolder} className="mx-1 mt-3 bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <input autoFocus value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Nombre de la lista"
            className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 outline-none border-b border-slate-100 pb-2" />
          <div className="flex gap-2">
            {COLOR_OPTIONS.map(c => (
              <button key={c.id} type="button" onClick={() => setFolderColor(c.id)}
                className={`w-6 h-6 rounded-full ${c.bg} transition-transform ${folderColor === c.id ? 'scale-125 ring-2 ring-offset-1 ring-slate-300' : ''}`} />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg">Crear</button>
            <button type="button" onClick={() => setShowNewFolder(false)} className="text-slate-400 text-xs px-3 py-2">Cancelar</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-2 px-4 py-3 mt-3 text-blue-600 text-sm font-medium hover:bg-blue-50 rounded-xl w-full">
          <Plus size={18} />Nueva lista
        </button>
      )}
    </div>
  )

  return (
    <div className="max-w-lg mx-auto pb-24">
      <div className="flex items-center gap-3 py-4 px-1">
        <button onClick={() => setView('home')} className="text-slate-400 hover:text-slate-600 p-1"><ChevronLeft size={22} /></button>
        {viewColor && <div className={`w-7 h-7 rounded-lg ${viewColor.bg} flex items-center justify-center`}><span className="text-white text-xs font-bold">{currentFolder?.name[0]?.toUpperCase()}</span></div>}
        {smartList && <smartList.icon size={20} className={smartList.color} />}
        <h1 className="text-xl font-black text-slate-800 flex-1">{viewTitle}</h1>
        <span className="text-sm text-slate-400">{viewTasks.length}</span>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-3">
        {viewTasks.length === 0 && <div className="text-center py-12 text-slate-400"><CheckCircle2 size={36} className="mx-auto mb-2 text-slate-200" /><p className="text-sm">Sin tareas pendientes</p></div>}
        {viewTasks.map(t => <TaskRow key={t.id} task={t} />)}
        {viewCompleted.length > 0 && (
          <>
            <button onClick={() => setShowCompleted(v => !v)} className="flex items-center gap-2 px-4 py-3 text-xs font-semibold text-slate-400 hover:text-slate-600 w-full border-t border-slate-100">
              <CheckCircle2 size={14} />Completadas ({viewCompleted.length})
            </button>
            {showCompleted && viewCompleted.map(t => <TaskRow key={t.id} task={t} />)}
          </>
        )}
      </div>
      <div className="fixed bottom-0 left-0 right-0 lg:relative lg:bottom-auto bg-white border-t border-slate-200 lg:border lg:rounded-2xl lg:shadow-sm px-4 py-3">
        <form onSubmit={addTask} className="flex items-center gap-3">
          <Plus size={20} className="text-blue-500 flex-shrink-0" />
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Añadir tarea"
            className="flex-1 text-sm text-slate-800 placeholder-slate-400 outline-none" />
          {newTitle && <button type="submit" className="text-blue-600 text-sm font-semibold">Añadir</button>}
        </form>
      </div>
    </div>
  )
}
