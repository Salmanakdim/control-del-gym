import { useState, useEffect, useRef } from 'react'
import { Plus, Star, Calendar, Sun, Inbox, ChevronLeft, ChevronRight, Trash2, Circle,
  CheckCircle2, Search, X, Bell, RotateCcw, FileText, Check, Clock, FolderInput, Layers, GripVertical,
  MoreHorizontal, Pencil, ArrowUpDown, Palette, List, ListChecks, Copy, CalendarClock, AlignJustify } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import MicButton from '../components/MicButton'
import { requestNotificationPermission, scheduleReminder, cancelReminder, scheduleAllReminders, createNotificationChannel, testNotificationNow } from '../lib/notifications'
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay, closestCenter, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const COLOR_OPTIONS = [
  { id: 'blue',   bg: 'bg-blue-500',   light: 'bg-blue-50',   text: 'text-blue-600',   hex: '#3b82f6' },
  { id: 'purple', bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600', hex: '#a855f7' },
  { id: 'green',  bg: 'bg-green-500',  light: 'bg-green-50',  text: 'text-green-600',  hex: '#22c55e' },
  { id: 'red',    bg: 'bg-red-500',    light: 'bg-red-50',    text: 'text-red-600',    hex: '#ef4444' },
  { id: 'orange', bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-600', hex: '#f97316' },
  { id: 'pink',   bg: 'bg-pink-500',   light: 'bg-pink-50',   text: 'text-pink-600',   hex: '#ec4899' },
  { id: 'teal',   bg: 'bg-teal-500',   light: 'bg-teal-50',   text: 'text-teal-600',   hex: '#14b8a6' },
  { id: 'amber',  bg: 'bg-amber-500',  light: 'bg-amber-50',  text: 'text-amber-600',  hex: '#f59e0b' },
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
function BottomSheet({ title, onClose, onConfirm, confirmLabel = 'Listo', onRemove, children }) {
  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          {onRemove ? (
            <button onClick={onRemove} className="text-red-500 font-semibold text-sm px-1">
              Quitar
            </button>
          ) : (
            <button onClick={onClose} className="p-1 text-slate-400">
              <ChevronLeft size={20} />
            </button>
          )}
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

// ── SCROLL COLUMN (fuera de TimePicker para evitar remount) ───
const TP_ITEM_H = 44

function ScrollCol({ items, divRef, onScroll }) {
  return (
    <div className="flex-1 relative">
      <div ref={divRef} onScroll={onScroll}
        className="h-[220px] overflow-y-scroll scrollbar-hide"
        style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ paddingTop: `${TP_ITEM_H * 2}px`, paddingBottom: `${TP_ITEM_H * 2}px` }}>
          {items.map(v => (
            <div key={v} style={{ height: TP_ITEM_H, scrollSnapAlign: 'center' }} className="flex items-center justify-center">
              <span className="text-2xl font-semibold text-slate-800">
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

// ── TIME PICKER ───────────────────────────────────────────────
function TimePicker({ hour: initHour, minute: initMin, onChange }) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 60 }, (_, i) => i)
  const [selHour, setSelHour] = useState(initHour)
  const [selMin, setSelMin] = useState(initMin)
  const hourRef = useRef(null)
  const minRef = useRef(null)
  const hourTimer = useRef(null)
  const minTimer = useRef(null)
  const selHourRef = useRef(initHour)
  const selMinRef = useRef(initMin)

  useEffect(() => {
    requestAnimationFrame(() => {
      if (hourRef.current) hourRef.current.scrollTop = initHour * TP_ITEM_H
      if (minRef.current) minRef.current.scrollTop = initMin * TP_ITEM_H
    })
  }, [])

  function handleHourScroll() {
    clearTimeout(hourTimer.current)
    hourTimer.current = setTimeout(() => {
      const h = Math.max(0, Math.min(23, Math.round(hourRef.current.scrollTop / TP_ITEM_H)))
      hourRef.current.scrollTo({ top: h * TP_ITEM_H, behavior: 'smooth' })
      selHourRef.current = h
      setSelHour(h)
      onChange(h, selMinRef.current)
    }, 120)
  }

  function handleMinScroll() {
    clearTimeout(minTimer.current)
    minTimer.current = setTimeout(() => {
      const m = Math.max(0, Math.min(59, Math.round(minRef.current.scrollTop / TP_ITEM_H)))
      minRef.current.scrollTo({ top: m * TP_ITEM_H, behavior: 'smooth' })
      selMinRef.current = m
      setSelMin(m)
      onChange(selHourRef.current, m)
    }, 120)
  }

  return (
    <div className="flex items-center px-8 gap-2 py-4">
      <ScrollCol items={hours} divRef={hourRef} onScroll={handleHourScroll} />
      <span className="text-2xl font-bold text-slate-400 flex-shrink-0">:</span>
      <ScrollCol items={minutes} divRef={minRef} onScroll={handleMinScroll} />
    </div>
  )
}

// ── REMINDER SHEET ────────────────────────────────────────────
function ReminderSheet({ current, onSave, onClose, onRemove }) {
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
    <BottomSheet title="Aviso" onClose={onClose} onConfirm={onClose} confirmLabel="Listo" onRemove={onRemove}>
      <div className="py-2">
        {options.map(o => (
          <button key={o.label} onClick={() => { onSave(buildISO(o.date, o.h, o.m)); onClose() }}
            className="flex items-center justify-between w-full px-5 py-4 active:bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <o.icon size={20} className="text-slate-400" />
              <span className="text-sm text-slate-700">{o.label}</span>
            </div>
            <span className="text-sm text-slate-400">{o.sub}</span>
          </button>
        ))}
        <button onClick={() => setSubView('calendar')}
          className="flex items-center justify-between w-full px-5 py-4 active:bg-slate-50">
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
function DueDateSheet({ current, currentTime, onSave, onClose, onRemove }) {
  const [subView, setSubView] = useState('quick')
  const [selDate, setSelDate] = useState(current || today())
  const [selHour, setSelHour] = useState(currentTime ? parseInt(currentTime.split(':')[0]) : 9)
  const [selMin, setSelMin] = useState(currentTime ? parseInt(currentTime.split(':')[1]) : 0)
  const todayStr = today()
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const nextWeekStr = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  function dayLabel(d) {
    return new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })
  }
  function timeStr() {
    return `${String(selHour).padStart(2,'0')}:${String(selMin).padStart(2,'0')}`
  }

  if (subView === 'time') return (
    <BottomSheet title="Elegir hora" onClose={() => setSubView('calendar')}
      onConfirm={() => { onSave(selDate, timeStr()); onClose() }} confirmLabel="Establecer">
      <TimePicker hour={selHour} minute={selMin} onChange={(h, m) => { setSelHour(h); setSelMin(m) }} />
    </BottomSheet>
  )

  if (subView === 'calendar') return (
    <BottomSheet title="Fecha de vencimiento" onClose={() => setSubView('quick')}
      onConfirm={() => { onSave(selDate, timeStr()); onClose() }} confirmLabel="Establecer">
      <CalendarPicker value={selDate} onChange={setSelDate} />
      <div className="border-t border-slate-100">
        <button onClick={() => setSubView('time')}
          className="flex items-center justify-between w-full px-5 py-4 hover:bg-slate-50">
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-slate-400" />
            <span className="text-sm text-slate-700">Elegir hora</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-500 text-sm font-medium">{timeStr()}</span>
            <ChevronRight size={16} className="text-slate-300" />
          </div>
        </button>
      </div>
    </BottomSheet>
  )

  const options = [
    { label: 'Hoy',            sub: `${dayLabel(todayStr)}, 9:00`,    date: todayStr,    h: 9, icon: Clock },
    { label: 'Mañana',         sub: `${dayLabel(tomorrowStr)}, 9:00`, date: tomorrowStr, h: 9, icon: Calendar },
    { label: 'Semana próxima', sub: `${dayLabel(nextWeekStr)}, 9:00`, date: nextWeekStr, h: 9, icon: Calendar },
  ]

  return (
    <BottomSheet title="Fecha de vencimiento" onClose={onClose} onConfirm={onClose} confirmLabel="Listo" onRemove={onRemove}>
      <div className="py-2">
        {options.map(o => (
          <button key={o.label} onClick={() => { onSave(o.date, `${String(o.h).padStart(2,'0')}:00`); onClose() }}
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
            <span className="text-sm text-slate-700">Elegir una fecha y hora</span>
          </div>
          <ChevronRight size={16} className="text-slate-300" />
        </button>
      </div>
    </BottomSheet>
  )
}

// ── REPEAT SHEET ──────────────────────────────────────────────
function DotGridIcon({ pattern, className = '' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className={className}>
      {[0,1,2].map(row => [0,1,2].map(col => {
        const filled = pattern[row * 3 + col]
        return <circle key={`${row}-${col}`}
          cx={4 + col * 6} cy={4 + row * 6} r={2}
          fill={filled ? 'currentColor' : 'none'}
          stroke="currentColor" strokeWidth={filled ? 0 : 0.7}
          opacity={filled ? 1 : 0.22} />
      }))}
    </svg>
  )
}

const REPEAT_OPTIONS = [
  { id: 'daily',    label: 'Diariamente',     pattern: [1,1,1, 1,1,1, 1,1,1] },
  { id: 'weekly',   label: 'Semanalmente',    pattern: [1,1,1, 1,1,1, 0,0,0] },
  { id: 'weekdays', label: 'Días laborables', pattern: [1,1,1, 1,1,0, 0,0,0] },
  { id: 'monthly',  label: 'Mensualmente',    pattern: [1,1,0, 0,1,0, 0,0,0] },
  { id: 'yearly',   label: 'Anualmente',      pattern: [1,0,0, 0,1,0, 0,0,1] },
]
const REPEAT_UNITS = ['Días', 'Semanas', 'Meses', 'Años']
const WEEK_DAYS_ES = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

function repeatRuleLabel(rule) {
  if (!rule) return null
  const found = REPEAT_OPTIONS.find(r => r.id === rule)
  if (found) return found.label
  if (rule.startsWith('custom:')) {
    const parts = rule.split(':')
    return `Cada ${parts[1]} ${parts[2]}`
  }
  return rule
}

function RepeatSheet({ current, onSave, onClose, onRemove }) {
  const [subView, setSubView] = useState('quick')

  const parseCustom = () => {
    if (!current?.startsWith('custom:')) return { n: 1, unitIdx: 1, days: [WEEK_DAYS_ES[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]] }
    const parts = current.split(':')
    const n = parseInt(parts[1]) || 1
    const unitIdx = Math.max(0, REPEAT_UNITS.findIndex(u => u.toLowerCase().startsWith(parts[2])))
    const days = parts[3] ? parts[3].split(',') : []
    return { n, unitIdx, days }
  }
  const init = parseCustom()

  const [selN, setSelN] = useState(init.n)
  const [selUnitIdx, setSelUnitIdx] = useState(init.unitIdx)
  const [selDays, setSelDays] = useState(init.days)
  const selNRef = useRef(init.n)
  const selUnitRef = useRef(init.unitIdx)
  const numScrollRef = useRef(null)
  const unitScrollRef = useRef(null)
  const numTimer = useRef(null)
  const unitTimer = useRef(null)
  const numbers = Array.from({ length: 30 }, (_, i) => i + 1)

  useEffect(() => {
    if (subView !== 'custom') return
    setTimeout(() => {
      if (numScrollRef.current) numScrollRef.current.scrollTop = (selN - 1) * TP_ITEM_H
      if (unitScrollRef.current) unitScrollRef.current.scrollTop = selUnitIdx * TP_ITEM_H
    }, 60)
  }, [subView])

  function handleNumScroll() {
    clearTimeout(numTimer.current)
    numTimer.current = setTimeout(() => {
      if (!numScrollRef.current) return
      const idx = Math.max(0, Math.min(numbers.length - 1, Math.round(numScrollRef.current.scrollTop / TP_ITEM_H)))
      selNRef.current = numbers[idx]; setSelN(numbers[idx])
    }, 120)
  }
  function handleUnitScroll() {
    clearTimeout(unitTimer.current)
    unitTimer.current = setTimeout(() => {
      if (!unitScrollRef.current) return
      const idx = Math.max(0, Math.min(REPEAT_UNITS.length - 1, Math.round(unitScrollRef.current.scrollTop / TP_ITEM_H)))
      selUnitRef.current = idx; setSelUnitIdx(idx)
    }, 120)
  }

  if (subView === 'custom') {
    const unit = REPEAT_UNITS[selUnitIdx]
    const rule = unit === 'Semanas' && selDays.length > 0
      ? `custom:${selN}:${unit.toLowerCase()}:${selDays.join(',')}`
      : `custom:${selN}:${unit.toLowerCase()}`
    return (
      <BottomSheet title="Repita cada..." onClose={() => setSubView('quick')}
        onConfirm={() => { onSave(rule); onClose() }} confirmLabel="Establecer">
        <div className="flex">
          {/* Número */}
          <div className="flex-1 relative">
            <div ref={numScrollRef} onScroll={handleNumScroll}
              className="h-[220px] overflow-y-scroll scrollbar-hide"
              style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ paddingTop: `${TP_ITEM_H * 2}px`, paddingBottom: `${TP_ITEM_H * 2}px` }}>
                {numbers.map(n => (
                  <div key={n} style={{ height: TP_ITEM_H, scrollSnapAlign: 'center' }}
                    className="flex items-center justify-center">
                    <span className="text-2xl font-semibold text-slate-800">{n}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute top-0 inset-x-0 pointer-events-none" style={{ height: `${TP_ITEM_H * 2}px`, background: 'linear-gradient(to bottom, white, transparent)' }} />
            <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{ height: `${TP_ITEM_H * 2}px`, background: 'linear-gradient(to top, white, transparent)' }} />
            <div className="absolute inset-x-0 pointer-events-none border-t border-b border-slate-200" style={{ top: `${TP_ITEM_H * 2}px`, height: TP_ITEM_H }} />
          </div>
          {/* Unidad */}
          <div className="flex-1 relative">
            <div ref={unitScrollRef} onScroll={handleUnitScroll}
              className="h-[220px] overflow-y-scroll scrollbar-hide"
              style={{ scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ paddingTop: `${TP_ITEM_H * 2}px`, paddingBottom: `${TP_ITEM_H * 2}px` }}>
                {REPEAT_UNITS.map(u => (
                  <div key={u} style={{ height: TP_ITEM_H, scrollSnapAlign: 'center' }}
                    className="flex items-center justify-center">
                    <span className="text-xl font-semibold text-slate-800">{u}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute top-0 inset-x-0 pointer-events-none" style={{ height: `${TP_ITEM_H * 2}px`, background: 'linear-gradient(to bottom, white, transparent)' }} />
            <div className="absolute bottom-0 inset-x-0 pointer-events-none" style={{ height: `${TP_ITEM_H * 2}px`, background: 'linear-gradient(to top, white, transparent)' }} />
            <div className="absolute inset-x-0 pointer-events-none border-t border-b border-slate-200" style={{ top: `${TP_ITEM_H * 2}px`, height: TP_ITEM_H }} />
          </div>
        </div>
        {unit === 'Semanas' && (
          <div className="flex justify-between px-3 pt-4 pb-2 gap-1">
            {WEEK_DAYS_ES.map(d => (
              <button key={d} onClick={() => setSelDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                className={`flex-1 h-10 rounded-full text-xs font-semibold transition-colors flex items-center justify-center
                  ${selDays.includes(d) ? 'bg-blue-500 text-white' : 'border border-slate-200 text-slate-500'}`}>
                {d}
              </button>
            ))}
          </div>
        )}
      </BottomSheet>
    )
  }

  return (
    <BottomSheet title="Repetir" onClose={onClose} onConfirm={onClose} confirmLabel="Listo" onRemove={onRemove}>
      <div className="py-2">
        {REPEAT_OPTIONS.map(o => (
          <button key={o.id} onClick={() => { onSave(o.id); onClose() }}
            className="flex items-center gap-4 px-5 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100">
            <DotGridIcon pattern={o.pattern} className="text-slate-500 flex-shrink-0" />
            <span className="text-sm text-slate-700 flex-1">{o.label}</span>
            {current === o.id && <Check size={16} className="text-blue-500" />}
          </button>
        ))}
        <button onClick={() => setSubView('custom')}
          className="flex items-center gap-4 px-5 py-4 w-full text-left active:bg-slate-50">
          <DotGridIcon pattern={[1,0,1, 0,1,0, 1,0,1]} className="text-slate-500 flex-shrink-0" />
          <span className="text-sm text-slate-700 flex-1">Personalizado</span>
          {current?.startsWith('custom:') && <span className="text-blue-500 text-xs">{repeatRuleLabel(current)}</span>}
          <ChevronRight size={16} className="text-slate-300" />
        </button>
      </div>
    </BottomSheet>
  )
}

// ── SORTABLE FOLDER ITEM ──────────────────────────────────────
function SortableFolder({ folder, tasks, onView, onDelete, indent = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: folder.id })
  const c = getColor(folder.color)
  const count = tasks.filter(t => t.folder_id === folder.id && !t.completed).length
  const [swipeX, setSwipeX] = useState(0)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const swipingH = useRef(false)
  const DEL_THRESHOLD = 80

  function onTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    swipingH.current = false
  }
  function onTouchMove(e) {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    if (!swipingH.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8 && dx < 0) swipingH.current = true
    if (swipingH.current) { e.preventDefault(); e.stopPropagation(); setSwipeX(Math.max(-150, dx)) }
  }
  function onTouchEnd() {
    if (swipeX < -DEL_THRESHOLD) { onDelete(folder.id) } else { setSwipeX(0) }
    swipingH.current = false
  }

  const isSwiping = swipeX !== 0
  return (
    <div className={`relative overflow-hidden rounded-xl ${indent ? 'pl-4' : ''}`}>
      {swipeX < 0 && (
        <div className="absolute inset-0 bg-red-500 rounded-xl flex items-center justify-end pr-5">
          <Trash2 size={20} className="text-white" />
        </div>
      )}
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: isSwiping ? `translateX(${swipeX}px)` : CSS.Transform.toString(transform),
          transition: swipingH.current ? 'none' : isSwiping ? 'transform 0.25s ease' : transition,
          opacity: isDragging ? 0.3 : 1,
          touchAction: 'manipulation',
        }}
        className="flex items-center cursor-grab active:cursor-grabbing bg-transparent"
      >
        <button onClick={() => !isDragging && !isSwiping && onView(folder.id)} className="flex-1 flex items-center gap-3 px-3 py-3 rounded-xl active:bg-slate-50 text-left min-w-0">
          <List size={18} className={`${c.text} flex-shrink-0`} />
          <span className="text-sm font-medium text-slate-700 flex-1 truncate">{folder.name}</span>
          <span className="text-sm text-slate-400 font-medium">{count}</span>
        </button>
      </div>
    </div>
  )
}

function DroppableGroupZone({ id, children, isOver }) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`rounded-xl transition-all ${isOver ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : ''}`}>
      {children}
    </div>
  )
}

function FolderDropTarget({ folder, c, isOver }) {
  const { setNodeRef } = useDroppable({ id: `ftarget::${folder.id}` })
  return (
    <div ref={setNodeRef} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors flex-shrink-0 ${isOver ? 'bg-blue-100 ring-1 ring-blue-400' : 'bg-slate-50'}`}>
      <List size={18} className={c.text} />
      <span className="text-xs text-slate-600 whitespace-nowrap max-w-[64px] truncate">{folder.name}</span>
    </div>
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
  const fc = folder ? getColor(folder.color) : null
  const accentHex = fc?.hex || '#3b82f6'
  const accentText = fc?.text || 'text-blue-500'
  const [detailBurst, setDetailBurst] = useState(false)
  const DOTS = [
    { tx: '0px', ty: '-26px' }, { tx: '18px', ty: '-18px' },
    { tx: '26px', ty: '0px' },  { tx: '18px', ty: '18px' },
    { tx: '0px', ty: '26px' },  { tx: '-18px', ty: '-18px' },
  ]

  async function patch(updates) {
    await supabase.from('tasks').update(updates).eq('id', task.id)
    const updated = { ...task, ...updates }
    onUpdate(updated)
    if ('reminder' in updates) {
      if (updates.reminder) scheduleReminder(updated)
      else cancelReminder(task.id)
    }
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
    <div className="fixed inset-0 lg:left-60 z-0 flex flex-col bg-slate-100">
      {sheet === 'reminder' && (
        <ReminderSheet current={task.reminder}
          onSave={v => patch({ reminder: v })}
          onClose={() => setSheet(null)}
          onRemove={task.reminder ? () => { patch({ reminder: null }); setSheet(null) } : null} />
      )}
      {sheet === 'duedate' && (
        <DueDateSheet current={task.due_date} currentTime={task.due_time}
          onSave={(d, t) => patch({ due_date: d, due_time: t })}
          onClose={() => setSheet(null)}
          onRemove={task.due_date ? () => { patch({ due_date: null, due_time: null }); setSheet(null) } : null} />
      )}
      {sheet === 'repeat' && (
        <RepeatSheet current={task.repeat_rule}
          onSave={v => { patch({ repeat_rule: v }); setSheet(null) }}
          onClose={() => setSheet(null)}
          onRemove={task.repeat_rule ? () => { patch({ repeat_rule: null }); setSheet(null) } : null} />
      )}

      {/* Header fijo */}
      <div className="flex-shrink-0 bg-slate-100 pt-14 pb-2 px-4 lg:pt-4">
        <div className="flex items-center py-2">
          <button onClick={onBack} className="text-blue-500 flex items-center gap-1 text-sm font-medium p-1">
            <ChevronLeft size={20} />
            {folder ? folder.name : 'Tareas'}
          </button>
        </div>
      </div>

      {/* Contenido desplazable */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-3">
        {/* Title card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-4">
          <div className="flex items-start gap-3">
            <button
              onClick={() => {
                if (!task.completed) { setDetailBurst(true); setTimeout(() => setDetailBurst(false), 500) }
                patch({ completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : null })
                setTimeout(onBack, task.completed ? 0 : 450)
              }}
              className="flex-shrink-0 relative mt-0.5" style={{ width: 28, height: 28 }}>
              {detailBurst && (
                <span className="check-ring absolute inset-0 rounded-full border-2 pointer-events-none"
                  style={{ borderColor: accentHex }} />
              )}
              {detailBurst && DOTS.map((d, i) => (
                <span key={i} className="check-dot absolute rounded-full pointer-events-none"
                  style={{ width: 6, height: 6, top: '50%', left: '50%', marginTop: -3, marginLeft: -3,
                    backgroundColor: i % 2 === 0 ? accentHex : '#fbbf24',
                    '--tx': d.tx, '--ty': d.ty, animationDelay: `${i * 20}ms` }} />
              ))}
              <span className={`absolute inset-0 flex items-center justify-center ${detailBurst ? 'check-pop' : ''}`}>
                {task.completed
                  ? <span style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: accentHex, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={14} color="white" strokeWidth={3} /></span>
                  : <Circle size={24} className="text-slate-300" />}
              </span>
            </button>
            <input value={title} onChange={e => setTitle(e.target.value)}
              onBlur={() => title.trim() && title !== task.title && patch({ title: title.trim() })}
              style={{ fontSize: '16px' }}
              className={`flex-1 font-semibold text-slate-800 outline-none bg-transparent ${task.completed ? 'line-through text-slate-400' : ''}`} />
            <MicButton onText={t => { const v = (title ? title + ' ' : '') + t; setTitle(v); v.trim() && patch({ title: v.trim() }) }} />
            <button onClick={() => patch({ important: !task.important })}
              className="flex-shrink-0 transition-colors"
              style={{ color: task.important ? (accentHex) : '#94a3b8' }}>
              <Star size={22} fill={task.important ? 'currentColor' : 'none'} strokeWidth={1.5} />
            </button>
          </div>

          {steps.map(s => (
            <div key={s.id} className="flex items-center gap-3 mt-3 pl-9">
              <button onClick={() => toggleStep(s.id)} className="flex-shrink-0 transition-colors"
                style={{ color: s.completed ? accentHex : '#94a3b8' }}>
                {s.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              </button>
              <span className={`flex-1 text-sm text-slate-700 ${s.completed ? 'line-through text-slate-400' : ''}`}>{s.title}</span>
              <button onClick={() => deleteStep(s.id)} className="text-slate-400 active:text-red-500 p-1">
                <X size={16} />
              </button>
            </div>
          ))}

          <form onSubmit={addStep} className="flex items-center gap-3 mt-3 pl-9">
            <Plus size={18} className="flex-shrink-0" style={{ color: accentHex }} />
            <input value={newStep} onChange={e => setNewStep(e.target.value)} placeholder="Agregar paso"
              className="flex-1 text-sm text-slate-500 placeholder-slate-400 outline-none bg-transparent"
              style={{ fontSize: '16px' }} />
            <MicButton size={13} className="w-6 h-6" onText={t => setNewStep(v => (v ? v + ' ' : '') + t)} />
            {newStep && (
              <button type="submit" className="p-1 rounded-lg" style={{ color: accentHex }}>
                <Check size={18} />
              </button>
            )}
          </form>
        </div>

        {/* Options card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <button onClick={() => patch({ my_day: !task.my_day })}
            className="flex items-center gap-4 px-4 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100">
            <Sun size={18} className={task.my_day ? 'text-orange-400' : 'text-slate-400'} />
            <span className={`text-sm flex-1 ${task.my_day ? 'text-orange-500 font-medium' : 'text-slate-500'}`}>
              {task.my_day ? 'Añadido a Mi día' : 'Agregar a Mi día'}
            </span>
            {task.my_day && <Check size={15} className="text-orange-400" />}
          </button>

          <button onClick={() => setSheet('reminder')}
            className="flex items-center gap-4 px-4 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100">
            <Bell size={18} className={task.reminder ? 'text-blue-400' : 'text-slate-400'} />
            <span className={`text-sm flex-1 ${task.reminder ? 'text-blue-500 font-medium' : 'text-slate-500'}`}>
              {task.reminder ? formatDateTime(task.reminder) : 'Recordarme'}
            </span>
            {task.reminder && (
              <button onClick={e => { e.stopPropagation(); patch({ reminder: null }) }}
                className="text-slate-400 active:text-red-500 p-1"><X size={18} /></button>
            )}
          </button>

          <button onClick={() => setSheet('duedate')}
            className="flex items-center gap-4 px-4 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100">
            <Calendar size={18} className={task.due_date ? 'text-blue-400' : 'text-slate-400'} />
            <span className={`text-sm flex-1 ${task.due_date ? (isPast(task.due_date) ? 'text-red-500 font-medium' : 'text-blue-500 font-medium') : 'text-slate-500'}`}>
              {task.due_date ? `${formatDate(task.due_date)}${task.due_time ? ', ' + task.due_time : ''}` : 'Agregar fecha de vencimiento'}
            </span>
            {task.due_date && (
              <button onClick={e => { e.stopPropagation(); patch({ due_date: null, due_time: null }) }}
                className="text-slate-400 active:text-red-500 p-1"><X size={18} /></button>
            )}
          </button>

          <button onClick={() => setSheet('repeat')}
            className="flex items-center gap-4 px-4 py-4 w-full text-left active:bg-slate-50">
            <RotateCcw size={18} className={task.repeat_rule ? 'text-blue-400' : 'text-slate-400'} />
            <span className={`text-sm flex-1 ${task.repeat_rule ? 'text-blue-500 font-medium' : 'text-slate-500'}`}>
              {task.repeat_rule ? repeatRuleLabel(task.repeat_rule) : 'Repetir'}
            </span>
            {task.repeat_rule && (
              <button onClick={e => { e.stopPropagation(); patch({ repeat_rule: null }) }}
                className="text-slate-400 active:text-red-500 p-1"><X size={18} /></button>
            )}
          </button>
        </div>

        {/* Note */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3.5 flex items-start gap-3">
          <FileText size={17} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <textarea value={note} onChange={e => setNote(e.target.value)}
            onBlur={() => note !== (task.note || '') && patch({ note })}
            placeholder="Agregar nota" rows={3}
            className="flex-1 text-sm text-slate-700 placeholder-slate-400 outline-none resize-none bg-transparent" />
          <MicButton onText={t => setNote(v => { const nv = (v ? v + ' ' : '') + t; patch({ note: nv }); return nv })} />
        </div>
      </div>

      {/* Footer fijo */}
      <div className="flex-shrink-0 bg-white border-t border-slate-100 px-4 py-3 flex items-center justify-between">
        <span className="text-xs text-slate-400">{timeAgo(task.created_at)}</span>
        <button onClick={() => { onDelete(task.id); onBack() }} className="text-slate-300 active:text-red-500 p-1">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────
export default function Tasks({ initialView = 'home' }) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState(initialView)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newMyDay, setNewMyDay] = useState(false)
  const [newReminder, setNewReminder] = useState(null)
  const [newDueDate, setNewDueDate] = useState(null)
  const [newDueTime, setNewDueTime] = useState(null)
  const [newTaskFocused, setNewTaskFocused] = useState(false)
  const [newTaskSheet, setNewTaskSheet] = useState(null)
  const [groups, setGroups] = useState([])
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())
  const [activeDragId, setActiveDragId] = useState(null)
  const [dragOverType, setDragOverType] = useState(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 300, tolerance: 5 } }))
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [folderColor, setFolderColor] = useState('blue')
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [groupName, setGroupName] = useState('Grupo sin título')
  const [showAddListsSheet, setShowAddListsSheet] = useState(false)
  const [pendingGroup, setPendingGroup] = useState(null)
  const [selectedFolderIds, setSelectedFolderIds] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [search, setSearch] = useState('')
  const [moveTask, setMoveTask] = useState(null)
  const [showFolderOptions, setShowFolderOptions] = useState(false)
  const [folderOptionsSheet, setFolderOptionsSheet] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [sortOrder, setSortOrder] = useState('custom')
  const [activeGroupId, setActiveGroupId] = useState(null)
  const [activeTaskDragId, setActiveTaskDragId] = useState(null)
  const [taskDragOver, setTaskDragOver] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set())
  const [moveSelectedMode, setMoveSelectedMode] = useState(false)
  const [showBulkDate, setShowBulkDate] = useState(false)
  const [copyToFolderMode, setCopyToFolderMode] = useState(false)
  const [showGroupOptions, setShowGroupOptions] = useState(false)
  const [groupOptionsSheet, setGroupOptionsSheet] = useState(null)
  const [renameGroupName, setRenameGroupName] = useState('')

  useEffect(() => {
    createNotificationChannel()
    requestNotificationPermission()
    loadAll()
  }, [])

  async function loadAll() {
    const [{ data: g }, { data: f }, { data: t }] = await Promise.all([
      supabase.from('groups').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('folders').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ])
    setGroups(g || []); setFolders(f || [])
    const taskList = t || []
    setTasks(taskList)
    setLoading(false)
    scheduleAllReminders(taskList)
  }

  function resetNewTask() {
    setNewTitle(''); setNewMyDay(false); setNewReminder(null)
    setNewDueDate(null); setNewDueTime(null); setNewTaskFocused(false)
  }

  async function addTask(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    const folder_id = folders.find(f => f.id === view)?.id ?? null
    const title = newTitle.trim()
    resetNewTask()
    const { data, error } = await supabase.from('tasks').insert({
      user_id: user.id, title, folder_id,
      my_day: newMyDay || view === 'myday',
      important: view === 'important',
      reminder: newReminder,
      due_date: newDueDate || (view === 'planned' ? today() : null),
      due_time: newDueTime,
      completed: false, steps: [],
    }).select().single()
    if (error) { console.error('addTask error:', error); return }
    if (data) { setTasks(prev => [data, ...prev]); if (data.reminder) scheduleReminder(data) }
  }

  async function toggleTask(task) {
    const updates = { completed: !task.completed, completed_at: !task.completed ? new Date().toISOString() : null }
    await supabase.from('tasks').update(updates).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updates } : t))
  }

  async function toggleImportant(task, e) {
    e.stopPropagation()
    const nowImportant = !task.important
    const updates = { important: nowImportant }
    await supabase.from('tasks').update(updates).eq('id', task.id)
    setTasks(prev => {
      const updated = prev.map(t => t.id === task.id ? { ...t, ...updates } : t)
      if (nowImportant) {
        const target = updated.find(t => t.id === task.id)
        return [target, ...updated.filter(t => t.id !== task.id)]
      }
      return updated
    })
  }

  function handleUpdateTask(updated) {
    setTasks(prev => {
      const wasImportant = prev.find(t => t.id === updated.id)?.important
      const newTasks = prev.map(t => t.id === updated.id ? updated : t)
      if (updated.important && !wasImportant) {
        return [newTasks.find(t => t.id === updated.id), ...newTasks.filter(t => t.id !== updated.id)]
      }
      return newTasks
    })
    setSelectedTask(updated)
  }

  async function moveTaskToFolder(taskId, folderId) {
    await supabase.from('tasks').update({ folder_id: folderId }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, folder_id: folderId } : t))
    setMoveTask(null)
  }

  async function handleTaskDragEnd({ active, over }) {
    setActiveTaskDragId(null); setTaskDragOver(null)
    if (!over) return
    const draggedId = active.id
    const overId = over.id.toString()
    if (draggedId === overId) return
    const sorted = [...viewTasksForDrag].sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999))
    const oldIndex = sorted.findIndex(t => t.id === draggedId)
    const newIndex = sorted.findIndex(t => t.id === overId)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(sorted, oldIndex, newIndex).map((t, i) => ({ ...t, position: i }))
    setTasks(prev => {
      const ids = new Set(reordered.map(t => t.id))
      return [...prev.filter(t => !ids.has(t.id)), ...reordered]
    })
    await Promise.all(reordered.map(t => supabase.from('tasks').update({ position: t.position }).eq('id', t.id)))
  }

  function toggleSelectTask(id) {
    setSelectedTaskIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function selectAll(taskList) {
    setSelectedTaskIds(prev => prev.size === taskList.length ? new Set() : new Set(taskList.map(t => t.id)))
  }
  function exitEditMode() { setEditMode(false); setSelectedTaskIds(new Set()); setMoveSelectedMode(false) }

  async function copySelectedTasks(folderId) {
    const selected = tasks.filter(t => selectedTaskIds.has(t.id))
    const inserts = selected.map(t => ({ user_id: user.id, title: t.title, folder_id: folderId, important: t.important, notes: t.notes || null, steps: t.steps || [] }))
    const { data } = await supabase.from('tasks').insert(inserts).select()
    if (data) setTasks(prev => [...prev, ...data])
    setCopyToFolderMode(false); exitEditMode()
  }
  async function applyBulkDate(date, time) {
    const ids = [...selectedTaskIds]
    await Promise.all(ids.map(id => supabase.from('tasks').update({ due_date: date, due_time: time || null }).eq('id', id)))
    setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, due_date: date, due_time: time || null } : t))
    setShowBulkDate(false); exitEditMode()
  }
  async function deleteSelectedTasks() {
    const ids = [...selectedTaskIds]
    await Promise.all(ids.map(id => supabase.from('tasks').delete().eq('id', id)))
    setTasks(prev => prev.filter(t => !ids.includes(t.id)))
    exitEditMode()
  }
  async function moveSelectedToFolder(folderId) {
    const ids = [...selectedTaskIds]
    await Promise.all(ids.map(id => supabase.from('tasks').update({ folder_id: folderId }).eq('id', id)))
    setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, folder_id: folderId } : t))
    exitEditMode()
  }

  async function deleteTask(id) {
    cancelReminder(id)
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

  async function handleDragEnd({ active, over }) {
    setActiveDragId(null)
    setDragOverType(null)
    if (!over) return
    const draggedId = active.id
    const overId = over.id.toString()

    // Drop on a group header → assign to that group
    if (overId.startsWith('group::')) {
      const groupId = overId.replace('group::', '')
      await supabase.from('folders').update({ group_id: groupId }).eq('id', draggedId)
      setFolders(prev => prev.map(f => f.id === draggedId ? { ...f, group_id: groupId } : f))
      return
    }

    if (draggedId === overId) return

    // Reorder: inherit group from the folder we drop near
    const sorted = [...folders].sort((a, b) => (a.position || 0) - (b.position || 0))
    const oldIndex = sorted.findIndex(f => f.id === draggedId)
    const newIndex = sorted.findIndex(f => f.id === overId)
    if (oldIndex === -1 || newIndex === -1) return

    const targetGroupId = sorted[newIndex]?.group_id || null
    const reordered = arrayMove(sorted, oldIndex, newIndex).map((f, i) => ({
      ...f,
      position: i,
      group_id: f.id === draggedId ? targetGroupId : f.group_id,
    }))
    setFolders(reordered)
    await Promise.all(reordered.map(f =>
      supabase.from('folders').update({ position: f.position, group_id: f.group_id }).eq('id', f.id)
    ))
  }

  async function addGroup(e) {
    e.preventDefault()
    if (!groupName.trim()) return
    const { data } = await supabase.from('groups').insert({
      user_id: user.id, name: groupName.trim()
    }).select().single()
    if (data) {
      setGroups(prev => [...prev, data])
      setPendingGroup(data)
      setSelectedFolderIds([])
      setShowNewGroup(false)
      setShowAddListsSheet(true)
    }
    setGroupName('Grupo sin título')
  }

  async function assignFoldersToGroup(groupId, folderIds) {
    if (folderIds.length > 0) {
      await supabase.from('folders').update({ group_id: groupId }).in('id', folderIds)
      setFolders(prev => prev.map(f => folderIds.includes(f.id) ? { ...f, group_id: groupId } : f))
    }
    setShowAddListsSheet(false)
    setPendingGroup(null)
    setSelectedFolderIds([])
  }

  async function handleRenameGroup() {
    if (!renameGroupName.trim() || !activeGroupId) return
    await supabase.from('groups').update({ name: renameGroupName.trim() }).eq('id', activeGroupId)
    setGroups(prev => prev.map(g => g.id === activeGroupId ? { ...g, name: renameGroupName.trim() } : g))
    setGroupOptionsSheet(null)
    setShowGroupOptions(false)
  }

  async function deleteGroup(id) {
    await supabase.from('folders').update({ group_id: null }).eq('group_id', id)
    await supabase.from('groups').delete().eq('id', id)
    setFolders(prev => prev.map(f => f.group_id === id ? { ...f, group_id: null } : f))
    setGroups(prev => prev.filter(g => g.id !== id))
    setShowGroupOptions(false)
  }

  async function handleRenameFolder() {
    if (!renameName.trim() || !currentFolder) return
    await supabase.from('folders').update({ name: renameName.trim() }).eq('id', currentFolder.id)
    setFolders(prev => prev.map(f => f.id === currentFolder.id ? { ...f, name: renameName.trim() } : f))
    setFolderOptionsSheet(null)
    setShowFolderOptions(false)
  }

  async function handleChangeColor(colorId) {
    if (!currentFolder) return
    await supabase.from('folders').update({ color: colorId }).eq('id', currentFolder.id)
    setFolders(prev => prev.map(f => f.id === currentFolder.id ? { ...f, color: colorId } : f))
  }

  async function handleMoveFolderToGroup(groupId) {
    if (!currentFolder) return
    await supabase.from('folders').update({ group_id: groupId }).eq('id', currentFolder.id)
    setFolders(prev => prev.map(f => f.id === currentFolder.id ? { ...f, group_id: groupId } : f))
    setFolderOptionsSheet(null)
    setShowFolderOptions(false)
  }

  async function deleteFolder(id, e) {
    e?.stopPropagation()
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
  const viewTasksForDrag = [...viewTasks].sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999))
  if (sortOrder === 'alpha') viewTasks = [...viewTasks].sort((a, b) => a.title.localeCompare(b.title))
  else if (sortOrder === 'duedate') viewTasks = [...viewTasks].sort((a, b) => (a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1)
  else if (sortOrder === 'importance') viewTasks = [...viewTasks].sort((a, b) => (b.important ? 1 : 0) - (a.important ? 1 : 0))
  else if (sortOrder === 'created') viewTasks = [...viewTasks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  else viewTasks = viewTasksForDrag
  const viewCompleted = currentFolder ? tasks.filter(t => t.folder_id === view && t.completed) : []
  const viewColor = currentFolder ? getColor(currentFolder.color) : null
  const viewTitle = smartList?.label || currentFolder?.name || 'Tareas'
  const searchResults = search.length > 1 ? tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase())) : []

  function TaskRow({ task }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: task.id,
      disabled: sortOrder !== 'custom' || !!smartList,
    })
    const folder = folders.find(f => f.id === task.folder_id)
    const fc = folder ? getColor(folder.color) : null
    const borderColor = fc?.hex || viewColor?.hex || '#e2e8f0'
    const [swipeX, setSwipeX] = useState(0)
    const [rightRevealed, setRightRevealed] = useState(false)
    const [burst, setBurst] = useState(false)

    function handleCheck() {
      if (!task.completed) { setBurst(true); setTimeout(() => setBurst(false), 500) }
      toggleTask(task)
      dismiss()
    }

    const burstColor = fc?.hex || viewColor?.hex || '#3b82f6'
    const DOTS = [
      { tx: '0px',    ty: '-22px' },
      { tx: '16px',   ty: '-16px' },
      { tx: '22px',   ty: '0px'   },
      { tx: '16px',   ty: '16px'  },
      { tx: '0px',    ty: '22px'  },
      { tx: '-16px',  ty: '-16px' },
    ]
    const touchStartX = useRef(0)
    const touchStartY = useRef(0)
    const swiping = useRef(false)
    const SNAP = 130   // px donde se detiene al revelar botones derecha
    const DEL_THRESHOLD = 80
    const RIGHT_THRESHOLD = 60

    function onTouchStart(e) {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      swiping.current = false
    }
    function onTouchMove(e) {
      if (isDragging) return
      const dx = e.touches[0].clientX - touchStartX.current
      const dy = e.touches[0].clientY - touchStartY.current
      if (!swiping.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) swiping.current = true
      if (swiping.current) {
        e.preventDefault()
        if (rightRevealed) {
          setSwipeX(Math.max(0, Math.min(SNAP, SNAP + dx)))
        } else {
          setSwipeX(Math.max(-140, Math.min(SNAP, dx)))
        }
      }
    }
    function onTouchEnd() {
      if (swipeX < -DEL_THRESHOLD) {
        deleteTask(task.id)
        setSwipeX(0)
      } else if (swipeX > RIGHT_THRESHOLD) {
        setSwipeX(SNAP)
        setRightRevealed(true)
      } else {
        setSwipeX(0)
        setRightRevealed(false)
      }
    }
    function dismiss() { setSwipeX(0); setRightRevealed(false) }

    const cardX = rightRevealed && !swiping.current ? SNAP : swipeX

    if (editMode) {
      const isSelected = selectedTaskIds.has(task.id)
      return (
        <div onClick={() => toggleSelectTask(task.id)} className="flex items-center gap-4 px-4 py-4 bg-white rounded-2xl shadow-sm active:bg-slate-50 cursor-pointer select-none">
          <div style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: isSelected ? 'none' : `2.5px solid ${burstColor}`, backgroundColor: isSelected ? burstColor : 'transparent', transition: 'all 0.15s ease' }}>
            {isSelected && <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'white' }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-[15px] leading-snug ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</p>
            {task.due_date && <p className={`text-xs mt-0.5 ${isPast(task.due_date) && !task.completed ? 'text-red-400' : 'text-slate-400'}`}>{formatDate(task.due_date)}</p>}
          </div>
          <AlignJustify size={18} className="text-slate-300 flex-shrink-0" />
        </div>
      )
    }

    return (
      <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }} {...attributes} {...listeners}>
      <div className="relative">
        {/* Fondo rojo solo cuando se desliza a la izquierda */}
        {cardX <= 0 && (
          <div className="absolute inset-0 bg-red-500 rounded-2xl flex items-center justify-end pr-5">
            <Trash2 size={24} className="text-white" />
          </div>
        )}
        {/* Fondo blanco cuando se desliza a la derecha */}
        {cardX > 0 && (
          <div className="absolute inset-0 bg-white rounded-2xl" />
        )}
        {/* Dos círculos (deslizar der = acciones) */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 flex pl-4 gap-3">
          <button onTouchEnd={e => { e.stopPropagation(); const next = !task.my_day; supabase.from('tasks').update({ my_day: next }).eq('id', task.id); setTasks(prev => prev.map(t => t.id === task.id ? { ...t, my_day: next } : t)); dismiss() }}
            className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-md">
            <Sun size={18} className="text-white" />
          </button>
          <button onTouchEnd={e => { e.stopPropagation(); setMoveTask(task); dismiss() }}
            className="w-10 h-10 rounded-full bg-orange-400 flex items-center justify-center flex-shrink-0 shadow-md">
            <FolderInput size={18} className="text-white" />
          </button>
        </div>
        {/* Tarjeta deslizable */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ transform: `translateX(${cardX}px)`, transition: swiping.current ? 'none' : 'transform 0.25s ease' }}
          className="relative flex items-center gap-4 px-4 py-4 bg-white rounded-2xl shadow-sm">
          <button onClick={handleCheck} className="flex-shrink-0 relative" style={{ width: 26, height: 26 }}>
            {/* Anillo expansivo */}
            {burst && (
              <span className="check-ring absolute inset-0 rounded-full border-2 pointer-events-none"
                style={{ borderColor: burstColor }} />
            )}
            {/* Puntos partículas */}
            {burst && DOTS.map((d, i) => (
              <span key={i} className="check-dot absolute rounded-full pointer-events-none"
                style={{ width: 5, height: 5, top: '50%', left: '50%', marginTop: -2.5, marginLeft: -2.5,
                  backgroundColor: i % 2 === 0 ? burstColor : '#fbbf24',
                  '--tx': d.tx, '--ty': d.ty, animationDelay: `${i * 20}ms` }} />
            ))}
            {/* Círculo con pop */}
            <span className={`absolute inset-0 flex items-center justify-center ${burst ? 'check-pop' : ''}`}>
              {task.completed
                ? <span style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: burstColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Check size={14} color="white" strokeWidth={3} /></span>
                : <Circle size={24} className="text-slate-300" />}
            </span>
          </button>
          <button className="flex-1 min-w-0 text-left" onClick={() => { setSelectedTask(task); dismiss() }}>
            <p className={`text-[15px] text-slate-800 leading-snug ${task.completed ? 'line-through text-slate-400' : ''}`}>{task.title}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {folder && !currentFolder && <span className={`text-xs ${fc.text} font-medium`}>{folder.name}</span>}
              {task.my_day && !smartList && <span className="text-xs text-orange-400">Mi día</span>}
              {task.due_date && <span className={`text-xs ${isPast(task.due_date) && !task.completed ? 'text-red-400' : 'text-slate-400'}`}>{formatDate(task.due_date)}{task.due_time ? ` ${task.due_time}` : ''}</span>}
              {task.reminder && <Bell size={12} className="text-blue-400" />}
              {task.steps?.length > 0 && <span className="text-xs text-slate-400">{task.steps.filter(s => s.completed).length}/{task.steps.length}</span>}
            </div>
          </button>
          <button onClick={e => { toggleImportant(task, e); dismiss() }}
            className="flex-shrink-0 transition-colors"
            style={{ color: task.important ? (fc?.hex || viewColor?.hex || '#facc15') : '#cbd5e1' }}>
            <Star size={22} fill={task.important ? 'currentColor' : 'none'} strokeWidth={1.5} />
          </button>
        </div>
      </div>
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  if (selectedTask) {
    const current = tasks.find(t => t.id === selectedTask.id) || selectedTask
    return <TaskDetail task={current} folders={folders} onBack={() => setSelectedTask(null)} onUpdate={handleUpdateTask} onDelete={deleteTask} />
  }

  if (isHome) return (
    <div className="fixed inset-0 lg:left-60 z-0 flex flex-col bg-slate-100">
      {/* Header siempre visible arriba */}
      <div className="flex-shrink-0 bg-slate-100 pt-14 pb-2 px-4 lg:pt-4">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">{initials(user.email)}</div>
            <span className="font-bold text-slate-800">{user.email?.split('@')[0]}</span>
          </div>
          <button onClick={() => setShowSearch(v => !v)} className="text-slate-400 hover:text-slate-600 p-1"><Search size={19} /></button>
        </div>
        {showSearch && (
          <div className="pb-2 relative">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar tareas..."
              className="w-full bg-white rounded-xl px-4 py-2.5 text-sm outline-none text-slate-800 placeholder-slate-400 pr-10 border border-slate-200" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={15} /></button>}
            {search.length > 1 && (
              <div className="absolute top-full left-0 right-0 bg-white rounded-xl shadow-lg border border-slate-100 mt-1 z-10 overflow-hidden">
                {searchResults.length === 0 ? <p className="text-sm text-slate-400 text-center py-4">Sin resultados</p>
                  : searchResults.map(t => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zona desplazable */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
        <div className="grid grid-cols-2 gap-2 mb-2 mt-1">
          {SMART_LISTS.map(s => {
            const count = getSmartTasks(tasks, s.id).length
            const Icon = s.icon
            return (
              <button key={s.id} onClick={() => setView(s.id)} className={`${s.bg} rounded-2xl p-4 text-left active:opacity-80 transition-opacity`}>
                <Icon size={20} className={`${s.color} mb-3`} />
                <p className="text-sm font-semibold text-slate-700">{s.label}</p>
                {count > 0 && <p className="text-xl font-black text-slate-800 mt-0.5">{count}</p>}
              </button>
            )
          })}
        </div>
        <div className="border-t border-slate-200 my-3" />
        {(() => {
          const sortedFolders = [...folders].sort((a, b) => (a.position || 0) - (b.position || 0))
          const ungroupedFolders = sortedFolders.filter(f => !f.group_id)
          return (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={({ active }) => setActiveDragId(active.id)}
              onDragOver={({ over }) => setDragOverType(over?.id?.toString() || null)}
              onDragEnd={handleDragEnd}
              onDragCancel={() => { setActiveDragId(null); setDragOverType(null) }}
            >
              <SortableContext items={sortedFolders.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {ungroupedFolders.map(f => (
                    <SortableFolder key={f.id} folder={f} tasks={tasks} onView={setView} onDelete={deleteFolder} />
                  ))}
                  {groups.map(g => {
                    const isCollapsed = collapsedGroups.has(g.id)
                    const groupFolders = sortedFolders.filter(f => f.group_id === g.id)
                    const isOver = dragOverType === `group::${g.id}`
                    return (
                      <DroppableGroupZone key={g.id} id={`group::${g.id}`} isOver={isOver}>
                        <div className="flex items-center pr-2">
                          <button
                            onClick={() => setCollapsedGroups(prev => {
                              const next = new Set(prev)
                              if (next.has(g.id)) next.delete(g.id)
                              else next.add(g.id)
                              return next
                            })}
                            className="flex items-center gap-2 px-3 pt-3 pb-1 flex-1 text-left active:opacity-70"
                          >
                            <ChevronRight size={13} className={`text-slate-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`} />
                            <Layers size={13} className={isOver ? 'text-blue-500' : 'text-slate-400'} />
                            <span className={`text-sm font-semibold flex-1 ${isOver ? 'text-blue-500' : 'text-slate-800'}`}>{g.name}</span>
                            <span className="text-xs text-slate-300 mr-1">{groupFolders.length}</span>
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setActiveGroupId(g.id); setShowGroupOptions(true) }}
                            className="p-1 text-slate-400 active:text-slate-700 mt-1"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </div>
                        {!isCollapsed && groupFolders.map(f => (
                          <SortableFolder key={f.id} folder={f} tasks={tasks} onView={setView} onDelete={deleteFolder} indent />
                        ))}
                        {(isCollapsed || groupFolders.length === 0) && isOver && (
                          <div className="h-8 mx-3 mb-2 rounded-lg border-2 border-dashed border-blue-300 flex items-center justify-center">
                            <span className="text-xs text-blue-400">Soltar aquí</span>
                          </div>
                        )}
                      </DroppableGroupZone>
                    )
                  })}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeDragId && (() => {
                  const f = folders.find(f => f.id === activeDragId)
                  if (!f) return null
                  const c = getColor(f.color)
                  return (
                    <div className="flex items-center bg-white rounded-xl shadow-2xl px-3 py-3 gap-3 ring-2 ring-blue-400">
                      <List size={18} className={`${c.text} flex-shrink-0`} />
                      <span className="text-sm font-medium text-slate-700">{f.name}</span>
                    </div>
                  )
                })()}
              </DragOverlay>
            </DndContext>
          )
        })()}
        {showNewFolder && (
          <form onSubmit={addFolder} className="mt-3 bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
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
        )}
      </div>

      {/* Footer siempre visible abajo */}
      <div className="flex-shrink-0 bg-slate-100 border-t border-slate-200 px-4 py-2">
        {!showNewFolder && !showNewGroup && (
          <div className="flex items-center">
            <button onClick={() => setShowNewFolder(true)} className="flex items-center gap-2 px-3 py-3 text-blue-600 text-sm font-medium active:bg-blue-50 rounded-xl flex-1">
              <Plus size={18} />Nueva lista
            </button>
            <button
              onClick={() => { setShowNewGroup(true); setGroupName('Grupo sin título') }}
              className="flex items-center gap-1.5 px-3 py-3 text-blue-600 text-sm font-medium active:bg-blue-50 rounded-xl"
              title="Nuevo grupo"
            >
              <Layers size={18} />
              <span className="text-xs">Nuevo grupo</span>
            </button>
          </div>
        )}
        {showNewGroup && (
          <form onSubmit={addGroup} className="mt-1 bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
            <input autoFocus value={groupName} onChange={e => setGroupName(e.target.value)}
              onFocus={e => e.target.select()}
              className="w-full text-sm font-medium text-slate-800 outline-none border-b border-slate-100 pb-2" />
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg">Crear</button>
              <button type="button" onClick={() => setShowNewGroup(false)} className="text-slate-400 text-xs px-3 py-2">Cancelar</button>
            </div>
          </form>
        )}
      </div>

      {/* Sheet: Agregar listas al grupo */}
      {showAddListsSheet && pendingGroup && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowAddListsSheet(false); setPendingGroup(null) }} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col">
            {/* Header 3 botones */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
              <button onClick={() => { setShowAddListsSheet(false); setPendingGroup(null); setSelectedFolderIds([]) }}
                className="text-blue-600 text-sm font-medium px-1">Cancelar</button>
              <span className="font-bold text-slate-800 text-base">Agregar listas...</span>
              <button onClick={() => assignFoldersToGroup(pendingGroup.id, selectedFolderIds)}
                className="text-blue-600 text-sm font-semibold px-1">Agregar</button>
            </div>

            {/* Lista de carpetas */}
            <div className="overflow-y-auto flex-1">
              {folders.filter(f => !f.group_id).map(f => {
                const selected = selectedFolderIds.includes(f.id)
                const count = tasks.filter(t => t.folder_id === f.id && !t.completed).length
                return (
                  <button key={f.id}
                    onClick={() => setSelectedFolderIds(prev => selected ? prev.filter(id => id !== f.id) : [...prev, f.id])}
                    className="flex items-center gap-4 w-full px-5 py-4 text-left border-b border-slate-100 last:border-0 active:bg-slate-50">
                    <List size={20} className="text-blue-500 flex-shrink-0" />
                    <span className="text-sm text-slate-800 flex-1">{f.name}</span>
                    {count > 0 && <span className="text-sm text-slate-400 mr-2">{count}</span>}
                    {selected
                      ? <Check size={20} className="text-blue-500 flex-shrink-0" />
                      : <Plus size={20} className="text-blue-500 flex-shrink-0" />}
                  </button>
                )
              })}
              {folders.filter(f => !f.group_id).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-10">No hay listas disponibles</p>
              )}
            </div>

            {/* Drop zone hint */}
            <div className="flex-shrink-0 border-t border-slate-100 px-5 py-4">
              <p className="text-xs text-slate-400 text-center">Pulsa para agregar listas al grupo</p>
            </div>
          </div>
        </div>
      )}

      {/* ── MENÚ OPCIONES DE GRUPO (home view) ── */}
      {showGroupOptions && activeGroupId && (() => {
        const activeGroup = groups.find(g => g.id === activeGroupId)
        if (!activeGroup) return null
        return (
          <>
            {!groupOptionsSheet && (
              <BottomSheet title="Opciones de grupo" onClose={() => setShowGroupOptions(false)} onConfirm={() => setShowGroupOptions(false)} confirmLabel="Listo">
                <div className="py-2">
                  <button onClick={() => { setRenameGroupName(activeGroup.name); setGroupOptionsSheet('rename') }}
                    className="flex items-center gap-4 px-5 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100">
                    <Pencil size={20} className="text-slate-500 flex-shrink-0" />
                    <span className="text-sm text-slate-800">Cambiar el nombre del grupo</span>
                  </button>
                  <button onClick={() => {
                    setPendingGroup(activeGroup)
                    setSelectedFolderIds(folders.filter(f => f.group_id === activeGroupId).map(f => f.id))
                    setGroupOptionsSheet(null)
                    setShowGroupOptions(false)
                    setShowAddListsSheet(true)
                  }} className="flex items-center gap-4 px-5 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100">
                    <List size={20} className="text-slate-500 flex-shrink-0" />
                    <span className="text-sm text-slate-800">Agregar listas al grupo</span>
                  </button>
                  <button onClick={() => deleteGroup(activeGroupId)}
                    className="flex items-center gap-4 px-5 py-4 w-full text-left active:bg-red-50">
                    <Trash2 size={20} className="text-red-500 flex-shrink-0" />
                    <span className="text-sm text-red-500 font-medium">Eliminar grupo</span>
                  </button>
                </div>
              </BottomSheet>
            )}
            {groupOptionsSheet === 'rename' && (
              <BottomSheet title="Cambiar nombre" onClose={() => setGroupOptionsSheet(null)} onConfirm={handleRenameGroup} confirmLabel="Guardar">
                <div className="px-5 py-4">
                  <input autoFocus value={renameGroupName} onChange={e => setRenameGroupName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRenameGroup()}
                    className="w-full text-lg font-semibold text-slate-800 outline-none border-b-2 border-blue-500 pb-2 bg-transparent" />
                </div>
              </BottomSheet>
            )}
          </>
        )
      })()}
    </div>
  )

  const listBg = viewColor?.light || 'bg-slate-100'

  return (
    <div className={`fixed inset-0 lg:left-60 z-0 flex flex-col ${listBg}`}>
      {/* Header */}
      <div className={`flex-shrink-0 ${listBg} pt-14 pb-2 px-4 lg:pt-4`}>
        {editMode ? (
          <div className="flex items-center py-2">
            <div className="w-20" />
            <h1 className="flex-1 text-center text-xl font-black" style={{ color: viewColor?.hex || '#1e293b' }}>{viewTitle}</h1>
            <button onClick={exitEditMode} className="w-20 text-right text-blue-600 font-semibold text-sm pr-1">Cancelar</button>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-2">
            <button onClick={() => setView('home')} className="text-slate-400 hover:text-slate-600 p-1"><ChevronLeft size={22} /></button>
            {viewColor && <List size={22} className={`${viewColor.text} flex-shrink-0`} />}
            {smartList && <smartList.icon size={20} className={smartList.color} />}
            <h1 className="text-xl font-black text-slate-800 flex-1">{viewTitle}</h1>
            <span className="text-sm text-slate-400">{viewTasks.length}</span>
            {currentFolder && (
              <button onClick={() => setShowFolderOptions(true)} className="p-1 text-slate-400 active:text-slate-700">
                <MoreHorizontal size={20} />
              </button>
            )}
          </div>
        )}
      </div>
      {/* Tareas */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveTaskDragId(active.id)}
        onDragOver={({ over }) => setTaskDragOver(over?.id?.toString() || null)}
        onDragEnd={handleTaskDragEnd}
        onDragCancel={() => { setActiveTaskDragId(null); setTaskDragOver(null) }}
      >
      <div className={`flex-1 min-h-0 overflow-y-auto mx-4 mt-2 space-y-2 ${editMode ? 'pb-24' : 'pb-1'}`}>
        {viewTasks.length === 0 && !editMode && (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle2 size={36} className="mx-auto mb-2 text-slate-200" />
            <p className="text-sm">Sin tareas pendientes</p>
          </div>
        )}
        <SortableContext items={viewTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        {viewTasks.map(t => <TaskRow key={t.id} task={t} />)}
        </SortableContext>
        {/* En modo edición mostrar también las completadas */}
        {editMode && viewCompleted.length > 0 && (
          <>
            <p className="text-xs font-semibold text-slate-400 px-2 pt-2">Completadas</p>
            {viewCompleted.map(t => <TaskRow key={t.id} task={t} />)}
          </>
        )}
        {!editMode && viewCompleted.length > 0 && (
          <>
            <button onClick={() => setShowCompleted(v => !v)} className="flex items-center gap-2 px-2 py-2 text-xs font-semibold text-slate-400 w-full">
              <CheckCircle2 size={14} />Completadas ({viewCompleted.length})
            </button>
            {showCompleted && viewCompleted.map(t => <TaskRow key={t.id} task={t} />)}
          </>
        )}
      </div>

<DragOverlay>
        {activeTaskDragId && (() => {
          const t = tasks.find(t => t.id === activeTaskDragId)
          if (!t) return null
          return (
            <div className="bg-white rounded-2xl shadow-2xl px-4 py-4 border border-slate-200 flex items-center gap-3">
              <Circle size={24} className="text-slate-300 flex-shrink-0" />
              <p className="text-[15px] text-slate-800 font-medium">{t.title}</p>
            </div>
          )
        })()}
      </DragOverlay>
      </DndContext>

      {/* Barra inferior modo edición */}
      {editMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 pb-6">
          <p className="text-center text-sm text-slate-500 pt-3 pb-2">
            {selectedTaskIds.size === 0 ? 'Selecciona tareas' : `${selectedTaskIds.size} tarea${selectedTaskIds.size > 1 ? 's' : ''} seleccionada${selectedTaskIds.size > 1 ? 's' : ''}`}
          </p>
          <div className="flex items-start justify-around px-2">
            {[
              { icon: ListChecks, label: 'Seleccionar\ntodos', color: 'text-blue-600', action: () => selectAll([...viewTasks, ...viewCompleted]) },
              { icon: FolderInput, label: 'Mover', color: selectedTaskIds.size > 0 ? 'text-blue-600' : 'text-slate-300', action: () => selectedTaskIds.size > 0 && setMoveSelectedMode(true) },
              { icon: Copy, label: 'Copiar\ntarea', color: selectedTaskIds.size > 0 ? 'text-blue-600' : 'text-slate-300', action: () => selectedTaskIds.size > 0 && setCopyToFolderMode(true) },
              { icon: CalendarClock, label: 'Fecha de\nvencimiento', color: selectedTaskIds.size > 0 ? 'text-blue-600' : 'text-slate-300', action: () => selectedTaskIds.size > 0 && setShowBulkDate(true) },
              { icon: Trash2, label: 'Eliminar', color: selectedTaskIds.size > 0 ? 'text-red-500' : 'text-slate-300', action: () => selectedTaskIds.size > 0 && deleteSelectedTasks() },
            ].map(({ icon: Icon, label, color, action }) => (
              <button key={label} onClick={action} className={`flex flex-col items-center gap-1 w-16 ${color}`}>
                <Icon size={24} />
                <span className="text-[10px] text-center leading-tight whitespace-pre-line">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {/* Sheet fecha masiva */}
      {showBulkDate && (
        <DueDateSheet
          current={null} currentTime={null}
          onSave={(date, time) => applyBulkDate(date, time)}
          onClose={() => setShowBulkDate(false)}
        />
      )}
      {/* Sheet copiar seleccionadas */}
      {copyToFolderMode && (
        <BottomSheet title="Copiar a lista" onClose={() => setCopyToFolderMode(false)} onConfirm={() => setCopyToFolderMode(false)} confirmLabel="Cancelar">
          <div className="py-2">
            {folders.map(f => {
              const c = getColor(f.color)
              return (
                <button key={f.id} onClick={() => copySelectedTasks(f.id)}
                  className="flex items-center gap-3 px-5 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100 last:border-0">
                  <List size={18} className={`${c.text} flex-shrink-0`} />
                  <span className="text-sm font-medium text-slate-700">{f.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{tasks.filter(t => t.folder_id === f.id && !t.completed).length} tareas</span>
                </button>
              )
            })}
          </div>
        </BottomSheet>
      )}
      {/* Sheet mover seleccionadas */}
      {moveSelectedMode && (
        <BottomSheet title="Mover a lista" onClose={() => setMoveSelectedMode(false)} onConfirm={() => setMoveSelectedMode(false)} confirmLabel="Cancelar">
          <div className="py-2">
            {folders.map(f => {
              const c = getColor(f.color)
              return (
                <button key={f.id} onClick={() => moveSelectedToFolder(f.id)}
                  className="flex items-center gap-3 px-5 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100 last:border-0">
                  <List size={18} className={`${c.text} flex-shrink-0`} />
                  <span className="text-sm font-medium text-slate-700">{f.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{tasks.filter(t => t.folder_id === f.id && !t.completed).length} tareas</span>
                </button>
              )
            })}
          </div>
        </BottomSheet>
      )}
      {/* Sheet mover tarea */}
      {moveTask && (
        <BottomSheet title="Mover a lista" onClose={() => setMoveTask(null)} onConfirm={() => setMoveTask(null)} confirmLabel="Cancelar">
          <div className="py-2">
            {folders.filter(f => f.id !== moveTask.folder_id).map(f => {
              const c = getColor(f.color)
              return (
                <button key={f.id} onClick={() => moveTaskToFolder(moveTask.id, f.id)}
                  className="flex items-center gap-3 px-5 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100 last:border-0">
                  <List size={18} className={`${c.text} flex-shrink-0`} />
                  <span className="text-sm font-medium text-slate-700">{f.name}</span>
                  <span className="text-xs text-slate-400 ml-auto">{tasks.filter(t => t.folder_id === f.id && !t.completed).length} tareas</span>
                </button>
              )
            })}
            {folders.filter(f => f.id !== moveTask.folder_id).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No hay otras listas</p>
            )}
          </div>
        </BottomSheet>
      )}

      {/* ── MENÚ OPCIONES DE LISTA ── */}
      {showFolderOptions && currentFolder && !folderOptionsSheet && (
        <BottomSheet title="Opciones de lista" onClose={() => setShowFolderOptions(false)} onConfirm={() => setShowFolderOptions(false)} confirmLabel="Listo">
          <div className="py-2">
            {[
              { icon: Pencil,        label: 'Cambiar el nombre de la lista', action: () => { setRenameName(currentFolder.name); setFolderOptionsSheet('rename') } },
              { icon: FolderInput,   label: 'Mover la lista a...',           action: () => setFolderOptionsSheet('move'),  arrow: true },
              { icon: ArrowUpDown,   label: 'Ordenar',                        action: () => setFolderOptionsSheet('sort'),  arrow: true },
              { icon: Palette,       label: 'Cambiar color',                  action: () => setFolderOptionsSheet('color'), arrow: true },
              { icon: Check,         label: 'Editar tareas',                  action: () => { setEditMode(true); setShowFolderOptions(false) } },
            ].map(({ icon: Icon, label, action, arrow }) => (
              <button key={label} onClick={action} className="flex items-center gap-4 px-5 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100 last:border-0">
                <Icon size={20} className="text-slate-500 flex-shrink-0" />
                <span className="text-sm text-slate-800 flex-1">{label}</span>
                {arrow && <ChevronRight size={16} className="text-slate-300" />}
              </button>
            ))}
            <button onClick={() => { deleteFolder(currentFolder.id); setShowFolderOptions(false) }}
              className="flex items-center gap-4 px-5 py-4 w-full text-left active:bg-red-50">
              <Trash2 size={20} className="text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-500 font-medium">Eliminar lista</span>
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Renombrar */}
      {folderOptionsSheet === 'rename' && (
        <BottomSheet title="Cambiar nombre" onClose={() => setFolderOptionsSheet(null)} onConfirm={handleRenameFolder} confirmLabel="Guardar">
          <div className="px-5 py-4">
            <input autoFocus value={renameName} onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRenameFolder()}
              className="w-full text-lg font-semibold text-slate-800 outline-none border-b-2 border-blue-500 pb-2 bg-transparent" />
          </div>
        </BottomSheet>
      )}

      {/* Mover lista a grupo */}
      {folderOptionsSheet === 'move' && (
        <BottomSheet title="Mover la lista a..." onClose={() => setFolderOptionsSheet(null)} onConfirm={() => setFolderOptionsSheet(null)} confirmLabel="Cancelar">
          <div className="py-2">
            <button onClick={() => handleMoveFolderToGroup(null)}
              className={`flex items-center gap-4 px-5 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100 ${!currentFolder.group_id ? 'text-blue-600' : 'text-slate-800'}`}>
              <Inbox size={18} className="text-slate-400 flex-shrink-0" />
              <span className="text-sm flex-1">Sin grupo</span>
              {!currentFolder.group_id && <Check size={16} className="text-blue-500" />}
            </button>
            {groups.map(g => (
              <button key={g.id} onClick={() => handleMoveFolderToGroup(g.id)}
                className={`flex items-center gap-4 px-5 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100 last:border-0`}>
                <Layers size={18} className="text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-800 flex-1">{g.name}</span>
                {currentFolder.group_id === g.id && <Check size={16} className="text-blue-500" />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Ordenar */}
      {folderOptionsSheet === 'sort' && (
        <BottomSheet title="Ordenar" onClose={() => setFolderOptionsSheet(null)} onConfirm={() => setFolderOptionsSheet(null)} confirmLabel="Listo">
          <div className="py-2">
            {[
              { id: 'custom',      label: 'Sin ordenar' },
              { id: 'alpha',       label: 'Alfabético' },
              { id: 'importance',  label: 'Importancia' },
              { id: 'duedate',     label: 'Fecha de vencimiento' },
              { id: 'created',     label: 'Fecha de creación' },
            ].map(o => (
              <button key={o.id} onClick={() => setSortOrder(o.id)}
                className="flex items-center gap-4 px-5 py-4 w-full text-left active:bg-slate-50 border-b border-slate-100 last:border-0">
                <span className={`text-sm flex-1 ${sortOrder === o.id ? 'text-blue-600 font-semibold' : 'text-slate-800'}`}>{o.label}</span>
                {sortOrder === o.id && <Check size={16} className="text-blue-500" />}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Cambiar color */}
      {folderOptionsSheet === 'color' && (
        <BottomSheet title="Cambiar color" onClose={() => setFolderOptionsSheet(null)} onConfirm={() => setFolderOptionsSheet(null)} confirmLabel="Listo">
          <div className="grid grid-cols-4 gap-5 px-6 py-6">
            {COLOR_OPTIONS.map(c => (
              <button key={c.id} onClick={() => handleChangeColor(c.id)}
                className={`w-14 h-14 rounded-full ${c.bg} mx-auto transition-transform ${currentFolder.color === c.id ? 'scale-110 ring-4 ring-offset-2 ring-slate-300' : 'active:scale-110'}`} />
            ))}
          </div>
        </BottomSheet>
      )}

      {/* Sheets para nueva tarea */}
      {newTaskSheet === 'reminder' && (
        <ReminderSheet current={newReminder}
          onSave={v => { setNewReminder(v); setNewTaskSheet(null) }}
          onClose={() => setNewTaskSheet(null)} />
      )}
      {newTaskSheet === 'duedate' && (
        <DueDateSheet current={newDueDate} currentTime={newDueTime}
          onSave={(d, t) => { setNewDueDate(d); setNewDueTime(t); setNewTaskSheet(null) }}
          onClose={() => setNewTaskSheet(null)} />
      )}

      {/* Marco 2: input añadir tarea estilo Microsoft To Do */}
      <div className="flex-shrink-0 mx-4 my-3 rounded-2xl bg-white overflow-hidden shadow-sm">
        <form onSubmit={addTask}>
          <div className="flex items-center gap-3 px-4 pt-3 pb-2">
            <div className="w-5 h-5 rounded-full border-2 flex-shrink-0"
              style={{ borderColor: viewColor?.hex || '#cbd5e1' }} />
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onFocus={() => setNewTaskFocused(true)}
              placeholder="Agregar una tarea"
              style={{ fontSize: '16px' }}
              className="flex-1 text-slate-800 placeholder-slate-400 outline-none bg-transparent" />
            <MicButton onText={t => { setNewTaskFocused(true); setNewTitle(v => (v ? v + ' ' : '') + t) }} />
            {newTitle && (
              <button type="submit" className="text-sm font-semibold"
                style={{ color: viewColor?.hex || '#3b82f6' }}>
                Hecho
              </button>
            )}
          </div>
          {newTaskFocused && (
            <div className="flex items-center gap-5 px-4 pb-3 pt-1 border-t border-slate-100">
              <button type="button" onClick={() => setNewMyDay(v => !v)}
                style={{ color: newMyDay ? '#f97316' : '#94a3b8' }}>
                <Sun size={20} />
              </button>
              <button type="button" onClick={() => setNewTaskSheet('reminder')}
                style={{ color: newReminder ? '#3b82f6' : '#94a3b8' }}>
                <Bell size={20} />
              </button>
              <button type="button" onClick={() => setNewTaskSheet('duedate')}
                style={{ color: newDueDate ? '#3b82f6' : '#94a3b8' }}>
                <Calendar size={20} />
              </button>
              {(newMyDay || newReminder || newDueDate) && (
                <div className="flex-1 flex gap-2 flex-wrap">
                  {newMyDay && <span className="text-xs text-orange-400 font-medium">Mi día</span>}
                  {newDueDate && <span className="text-xs font-medium" style={{ color: viewColor?.hex || '#3b82f6' }}>{formatDate(newDueDate)}</span>}
                  {newReminder && <span className="text-xs text-blue-400 font-medium">{formatDateTime(newReminder)}</span>}
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
