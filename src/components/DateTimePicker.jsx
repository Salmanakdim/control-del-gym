import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS    = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const WEEK_DAYS = ['lun','mar','mié','jue','vie','sáb','dom']

function today() { return new Date().toISOString().split('T')[0] }

export function BottomSheet({ title, onClose, onConfirm, confirmLabel = 'Listo', onRemove, children }) {
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          {onRemove ? (
            <button onClick={onRemove} className="text-red-500 font-semibold text-sm px-1">Quitar</button>
          ) : (
            <button onClick={onClose} className="p-1 text-slate-400"><ChevronLeft size={20} /></button>
          )}
          <h3 className="font-semibold text-slate-800 text-base">{title}</h3>
          <button onClick={onConfirm || onClose} className="text-blue-600 font-semibold text-sm px-1">{confirmLabel}</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function CalendarPicker({ value, onChange }) {
  const ref = value ? new Date(value + 'T00:00:00') : new Date()
  const [viewYear, setViewYear]   = useState(ref.getFullYear())
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

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const offset      = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate()

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
        <button onClick={prevMonth} className="p-2 rounded-full hover:bg-slate-100 text-slate-600"><ChevronLeft size={18} /></button>
        <span className="font-semibold text-slate-800">{MONTHS[viewMonth]} de {viewYear}</span>
        <button onClick={nextMonth} className="p-2 rounded-full hover:bg-slate-100 text-slate-600"><ChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map(d => <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          const s   = cellStr(c)
          const sel = s === value
          const isT = s === todayStr
          return (
            <button key={i} onClick={() => c.cur && onChange(s)}
              className={`aspect-square flex items-center justify-center text-sm rounded-full mx-auto w-9 h-9 transition-colors
                ${sel ? 'bg-blue-600 text-white font-bold' : ''}
                ${isT && !sel ? 'text-blue-600 font-bold border-2 border-blue-400' : ''}
                ${!c.cur ? 'text-slate-300' : ''}
                ${c.cur && !sel && !isT ? 'text-slate-700 hover:bg-slate-100' : ''}`}>
              {c.d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

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
              <span className="text-2xl font-semibold text-slate-800">{String(v).padStart(2, '0')}</span>
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

export function TimePicker({ hour: initHour, minute: initMin, onChange }) {
  const hours   = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 60 }, (_, i) => i)
  const [selHour, setSelHour] = useState(initHour)
  const [selMin, setSelMin]   = useState(initMin)
  const hourRef    = useRef(null)
  const minRef     = useRef(null)
  const hourTimer  = useRef(null)
  const minTimer   = useRef(null)
  const selHourRef = useRef(initHour)
  const selMinRef  = useRef(initMin)

  useEffect(() => {
    requestAnimationFrame(() => {
      if (hourRef.current) hourRef.current.scrollTop = initHour * TP_ITEM_H
      if (minRef.current)  minRef.current.scrollTop  = initMin  * TP_ITEM_H
    })
  }, [])

  function handleHourScroll() {
    clearTimeout(hourTimer.current)
    hourTimer.current = setTimeout(() => {
      const h = Math.max(0, Math.min(23, Math.round(hourRef.current.scrollTop / TP_ITEM_H)))
      hourRef.current.scrollTo({ top: h * TP_ITEM_H, behavior: 'smooth' })
      selHourRef.current = h; setSelHour(h)
      onChange(h, selMinRef.current)
    }, 120)
  }

  function handleMinScroll() {
    clearTimeout(minTimer.current)
    minTimer.current = setTimeout(() => {
      const m = Math.max(0, Math.min(59, Math.round(minRef.current.scrollTop / TP_ITEM_H)))
      minRef.current.scrollTo({ top: m * TP_ITEM_H, behavior: 'smooth' })
      selMinRef.current = m; setSelMin(m)
      onChange(selHourRef.current, m)
    }, 120)
  }

  return (
    <div className="flex items-center px-8 gap-2 py-4">
      <ScrollCol items={hours}   divRef={hourRef} onScroll={handleHourScroll} />
      <span className="text-2xl font-bold text-slate-400 flex-shrink-0">:</span>
      <ScrollCol items={minutes} divRef={minRef}  onScroll={handleMinScroll} />
    </div>
  )
}
