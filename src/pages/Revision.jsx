import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import MicButton from '../components/MicButton'
import { Flame, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Plus, X, Lightbulb } from 'lucide-react'

// Fecha local (no UTC) para que el día cambie a medianoche de verdad
function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayStr() { return dateStr(new Date()) }
function shiftStr(iso, days) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return dateStr(d)
}
function fmtDate(iso) {
  if (iso === todayStr()) return 'Hoy'
  if (iso === shiftStr(todayStr(), -1)) return 'Ayer'
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}
// Los puntos se guardan como { text, at }; los antiguos eran texto plano
function itemText(it) { return typeof it === 'string' ? it : it.text }
function fmtStamp(at) {
  if (!at) return ''
  const d = new Date(at)
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}
function monthDays(year, month) {
  const first = new Date(year, month, 1)
  const pad   = (first.getDay() + 6) % 7 // lunes = 0
  const total = new Date(year, month + 1, 0).getDate()
  return [...Array(pad).fill(null), ...Array.from({ length: total }, (_, i) => dateStr(new Date(year, month, i + 1)))]
}
function hasContent(r) {
  return r && (r.rating > 0 || r.good?.length || r.bad?.length || r.improve?.length)
}
function calcStreak(reviews) {
  const dates = new Set(reviews.filter(hasContent).map(r => r.date))
  let d = todayStr()
  if (!dates.has(d)) d = shiftStr(d, -1)
  let streak = 0
  while (dates.has(d)) { streak++; d = shiftStr(d, -1) }
  return streak
}

const RATINGS = [
  { v: 1, emoji: '😫', label: 'Muy mal', color: 'bg-red-500 text-white' },
  { v: 2, emoji: '😕', label: 'Mal',     color: 'bg-orange-400 text-white' },
  { v: 3, emoji: '😐', label: 'Regular', color: 'bg-yellow-300 text-yellow-900' },
  { v: 4, emoji: '😊', label: 'Bien',    color: 'bg-lime-400 text-lime-900' },
  { v: 5, emoji: '😄', label: 'Genial',  color: 'bg-green-500 text-white' },
]
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function dayColor(r) {
  if (!hasContent(r)) return 'bg-slate-50 text-slate-400'
  return RATINGS.find(x => x.v === r.rating)?.color || 'bg-blue-200 text-blue-800'
}

function MonthCalendar({ reviews, date, onSelect, view, setView }) {
  const byDate = Object.fromEntries(reviews.map(r => [r.date, r]))
  const today  = todayStr()
  const days   = monthDays(view.y, view.m)
  const raw    = new Date(view.y, view.m, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  const title  = raw.charAt(0).toUpperCase() + raw.slice(1)
  const isCurrentMonth = view.y === new Date().getFullYear() && view.m === new Date().getMonth()

  function move(delta) {
    const d = new Date(view.y, view.m + delta, 1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-3">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => move(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 active:bg-slate-100">
          <ChevronLeft size={18}/>
        </button>
        <p className="text-sm font-black text-slate-700">{title}</p>
        <button onClick={() => move(1)} disabled={isCurrentMonth}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 active:bg-slate-100 disabled:opacity-20">
          <ChevronRight size={18}/>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map(w => (
          <p key={w} className="text-center text-[10px] font-black text-slate-400 py-1">{w}</p>
        ))}
        {days.map((d, i) => d === null ? <div key={i}/> : (
          <button key={d} onClick={() => onSelect(d)} disabled={d > today}
            className={`aspect-square rounded-lg text-xs font-bold flex items-center justify-center transition-all disabled:opacity-30
              ${dayColor(byDate[d])}
              ${d === date ? 'ring-2 ring-blue-600 ring-offset-1' : ''}
              ${d === today && d !== date ? 'ring-1 ring-slate-400' : ''}`}>
            {Number(d.slice(8))}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3">
        {RATINGS.map(r => (
          <span key={r.v} className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
            <span className={`w-2.5 h-2.5 rounded-sm ${r.color.split(' ')[0]}`}/>{r.label}
          </span>
        ))}
      </div>
    </div>
  )
}

const SECTIONS = [
  { key: 'good',    title: 'Lo que hice bien',      emoji: '✅', bg: 'bg-green-50',  text: 'text-green-700', btn: 'bg-green-600 active:bg-green-700', ring: 'focus:ring-green-500', placeholder: 'Ej: Fui al gym aunque no tenía ganas' },
  { key: 'bad',     title: 'Lo que hice mal',       emoji: '❌', bg: 'bg-red-50',    text: 'text-red-700',   btn: 'bg-red-500 active:bg-red-600',     ring: 'focus:ring-red-400',   placeholder: 'Ej: Perdí 2 horas en el móvil' },
  { key: 'improve', title: 'Qué haré mejor mañana', emoji: '💡', bg: 'bg-amber-50',  text: 'text-amber-700', btn: 'bg-amber-500 active:bg-amber-600', ring: 'focus:ring-amber-400', placeholder: 'Ej: Dejar el móvil fuera del cuarto' },
]

const EMPTY = { rating: 0, good: [], bad: [], improve: [] }

function Section({ cfg, items, onAdd, onRemove }) {
  const [text, setText] = useState('')

  function submit() {
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setText('')
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className={`px-4 py-3 flex items-center justify-between ${cfg.bg}`}>
        <p className={`text-sm font-black ${cfg.text}`}>{cfg.emoji} {cfg.title}</p>
        {items.length > 0 && <span className={`text-xs font-black ${cfg.text}`}>{items.length}</span>}
      </div>

      {items.length > 0 && (
        <ul className="px-4 pt-3 space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 group">
              <span className="text-slate-300 text-sm mt-0.5">•</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{itemText(it)}</p>
                {typeof it === 'object' && it.at && <p className="text-[10px] text-slate-400 font-semibold">{fmtStamp(it.at)}</p>}
              </div>
              <button onClick={() => onRemove(i)}
                className="w-6 h-6 flex-shrink-0 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 active:bg-slate-100">
                <X size={14}/>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="p-3 flex items-center gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={cfg.placeholder}
          className={`flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 ${cfg.ring} placeholder:text-slate-300`}
        />
        <MicButton onText={t => setText(v => (v ? v + ' ' : '') + t)} />
        <button onClick={submit} disabled={!text.trim()}
          className={`w-9 h-9 flex-shrink-0 rounded-xl flex items-center justify-center text-white disabled:opacity-30 ${cfg.btn}`}>
          <Plus size={18}/>
        </button>
      </div>
    </div>
  )
}

export default function Revision() {
  const { user } = useAuth()
  const [reviews,     setReviews]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [date,        setDate]        = useState(todayStr())
  const [showHistory, setShowHistory] = useState(false)
  const [view,        setView]        = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }))

  function selectDate(d) {
    setDate(d)
    setView({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) - 1 })
  }

  useEffect(() => {
    supabase.from('daily_reviews').select('*').eq('user_id', user.id)
      .order('date', { ascending: false })
      .then(({ data }) => { setReviews(data || []); setLoading(false) })
  }, [])

  const current   = reviews.find(r => r.date === date) || { ...EMPTY, date }
  const yesterday = reviews.find(r => r.date === shiftStr(date, -1))
  const streak    = calcStreak(reviews)
  const history   = reviews.filter(r => r.date !== date && hasContent(r))
  const isToday   = date === todayStr()

  async function save(changes) {
    const next = { ...EMPTY, ...current, ...changes, date }
    setReviews(prev => {
      const others = prev.filter(r => r.date !== date)
      return [next, ...others].sort((a, b) => b.date.localeCompare(a.date))
    })
    const { data } = await supabase.from('daily_reviews').upsert({
      user_id: user.id, date,
      rating: next.rating, good: next.good, bad: next.bad, improve: next.improve,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' }).select().single()
    if (data) setReviews(prev => prev.map(r => r.date === date ? data : r))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="space-y-4 max-w-lg pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Revisión del día</h1>
          <p className="text-slate-500 text-sm mt-1">Lo bueno, lo malo y lo que mejorarás</p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50">
            <Flame size={16} className="text-orange-500"/>
            <span className="font-black text-sm text-orange-600">{streak}</span>
          </div>
        )}
      </div>

      {/* Calendario */}
      <MonthCalendar reviews={reviews} date={date} onSelect={selectDate} view={view} setView={setView}/>

      <p className="text-lg font-black text-slate-800 capitalize px-1">{fmtDate(date)}</p>

      {/* Lo que te propusiste ayer */}
      {yesterday?.improve?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={15} className="text-amber-600"/>
            <p className="text-xs font-black text-amber-700 uppercase tracking-widest">
              {isToday ? 'Ayer te propusiste' : 'El día anterior te propusiste'}
            </p>
          </div>
          <ul className="space-y-1">
            {yesterday.improve.map((it, i) => (
              <li key={i} className="text-sm text-amber-800 font-medium">• {itemText(it)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Rating */}
      <div className="bg-white rounded-2xl shadow-sm px-4 py-4">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">¿Cómo fue tu día?</p>
        <div className="flex justify-between">
          {RATINGS.map(r => (
            <button key={r.v} onClick={() => save({ rating: current.rating === r.v ? 0 : r.v })}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all
                ${current.rating === r.v ? 'bg-blue-50 scale-110' : 'opacity-50 active:opacity-100'}`}>
              <span className="text-2xl">{r.emoji}</span>
              <span className={`text-[10px] font-bold ${current.rating === r.v ? 'text-blue-600' : 'text-slate-400'}`}>{r.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sections */}
      {SECTIONS.map(cfg => (
        <Section key={cfg.key} cfg={cfg}
          items={current[cfg.key] || []}
          onAdd={t => save({ [cfg.key]: [...(current[cfg.key] || []), { text: t, at: new Date().toISOString() }] })}
          onRemove={i => save({ [cfg.key]: (current[cfg.key] || []).filter((_, j) => j !== i) })}
        />
      ))}

      {/* History */}
      {history.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(h => !h)}
            className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest w-full py-1">
            <span>Historial ({history.length})</span>
            {showHistory ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
          </button>
          {showHistory && (
            <div className="space-y-2 mt-3">
              {history.map(r => (
                <button key={r.date} onClick={() => { selectDate(r.date); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="w-full bg-white rounded-2xl shadow-sm px-4 py-3 flex items-center gap-3 text-left active:bg-slate-50">
                  <span className="text-2xl">{RATINGS.find(x => x.v === r.rating)?.emoji || '📝'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-700 capitalize">{fmtDate(r.date)}</p>
                    <p className="text-xs text-slate-400 font-medium">
                      ✅ {r.good?.length || 0} · ❌ {r.bad?.length || 0} · 💡 {r.improve?.length || 0}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300"/>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
