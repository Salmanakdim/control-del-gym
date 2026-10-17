import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Flame, ChevronDown, ChevronUp, Pencil, Check } from 'lucide-react'

function todayStr() { return new Date().toISOString().split('T')[0] }
function offsetStr(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
function fmtDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  if (iso === offsetStr(-1)) return 'Ayer'
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}
function calcStreak(entries) {
  if (!entries.length) return 0
  const dates = new Set(entries.map(e => e.date))
  let streak = 0
  const d = new Date()
  if (!dates.has(todayStr())) d.setDate(d.getDate() - 1)
  while (true) {
    const str = d.toISOString().split('T')[0]
    if (!dates.has(str)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

export default function Metas() {
  const { user } = useAuth()
  const [entries,        setEntries]        = useState([])
  const [settings,       setSettings]       = useState({ freeze_count: 0, total_writes: 0 })
  const [loading,        setLoading]        = useState(true)
  const [text,           setText]           = useState('')
  const [editing,        setEditing]        = useState(false)
  const [showHistory,    setShowHistory]    = useState(false)
  const [freezeJustUsed, setFreezeJustUsed] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const [{ data: ents }, { data: sett }] = await Promise.all([
      supabase.from('goal_entries').select('*').eq('user_id', user.id)
        .order('date', { ascending: false }).limit(60),
      supabase.from('user_goal_settings').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    let allEntries = ents || []
    let s = sett || { freeze_count: 0, total_writes: 0 }

    // Auto-consume freeze if exactly 1 day was missed
    const yesterday = offsetStr(-1)
    const dayBefore  = offsetStr(-2)
    const hasYesterday = allEntries.some(e => e.date === yesterday)
    const hasDayBefore = allEntries.some(e => e.date === dayBefore)

    if (!hasYesterday && hasDayBefore && s.freeze_count > 0) {
      const { data: fe } = await supabase.from('goal_entries')
        .insert({ user_id: user.id, date: yesterday, content: '', is_freeze: true })
        .select().single()
      const newFreeze = s.freeze_count - 1
      await supabase.from('user_goal_settings').upsert(
        { user_id: user.id, freeze_count: newFreeze, total_writes: s.total_writes },
        { onConflict: 'user_id' }
      )
      if (fe) allEntries = [fe, ...allEntries]
      s = { ...s, freeze_count: newFreeze }
      setFreezeJustUsed(true)
    }

    setEntries(allEntries.sort((a, b) => b.date.localeCompare(a.date)))
    setSettings(s)
    setLoading(false)
  }

  const todayEntry = entries.find(e => e.date === todayStr())
  const history    = entries.filter(e => e.date !== todayStr() && !e.is_freeze)
  const streak     = calcStreak(entries)
  const isFrozen   = freezeJustUsed || entries.some(e => e.date === offsetStr(-1) && e.is_freeze)

  async function save() {
    const content = text.trim()
    if (!content) return

    if (todayEntry) {
      await supabase.from('goal_entries').update({ content }).eq('id', todayEntry.id)
      setEntries(prev => prev.map(e => e.date === todayStr() ? { ...e, content } : e))
    } else {
      const { data } = await supabase.from('goal_entries')
        .insert({ user_id: user.id, date: todayStr(), content, is_freeze: false })
        .select().single()
      if (data) setEntries(prev => [data, ...prev])

      const newTotal  = settings.total_writes + 1
      let newFreeze   = settings.freeze_count
      if (newTotal % 3 === 0 && newFreeze < 2) newFreeze++

      await supabase.from('user_goal_settings').upsert(
        { user_id: user.id, freeze_count: newFreeze, total_writes: newTotal },
        { onConflict: 'user_id' }
      )
      setSettings({ freeze_count: newFreeze, total_writes: newTotal })
    }
    setEditing(false)
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
          <h1 className="text-2xl font-black text-slate-800">Mis Metas</h1>
          <p className="text-slate-500 text-sm mt-1">Escríbelas cada día</p>
        </div>
        <div className="flex items-center gap-2">
          {settings.freeze_count > 0 && (
            <div className="flex items-center gap-1 bg-blue-50 px-2.5 py-1.5 rounded-xl">
              <span className="text-sm">🛡️</span>
              {settings.freeze_count > 1 && (
                <span className="text-xs font-black text-blue-600">{settings.freeze_count}</span>
              )}
            </div>
          )}
          {streak > 0 && (
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-colors
              ${isFrozen ? 'bg-blue-50' : 'bg-orange-50'}`}>
              <Flame size={16} className={isFrozen ? 'text-blue-400' : 'text-orange-500'}/>
              <span className={`font-black text-sm ${isFrozen ? 'text-blue-500' : 'text-orange-600'}`}>
                {streak}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Freeze used notification */}
      {freezeJustUsed && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">🛡️</span>
          <div>
            <p className="text-sm font-black text-blue-700">Freeze activado</p>
            <p className="text-xs text-blue-500">Tu racha se ha salvado automáticamente</p>
          </div>
        </div>
      )}

      {/* Today card */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Hoy</p>
          {todayEntry && !editing && (
            <button onClick={() => { setText(todayEntry.content); setEditing(true) }}
              className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center active:bg-slate-200">
              <Pencil size={13} className="text-slate-500"/>
            </button>
          )}
        </div>

        {editing || !todayEntry ? (
          <div className="px-4 pb-4 space-y-3">
            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={"Escribe tus metas…\n\nEj:\nSacar el carnet de conducir\nAprobar la uni\nEmpezar mi negocio"}
              rows={6}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300 leading-relaxed"
            />
            <div className="flex gap-2">
              {editing && (
                <button onClick={() => setEditing(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 font-semibold rounded-xl text-sm">
                  Cancelar
                </button>
              )}
              <button onClick={save} disabled={!text.trim()}
                className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl text-sm disabled:opacity-40 active:bg-blue-700">
                Guardar
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Check size={11} className="text-white" strokeWidth={3}/>
              </div>
              <p className="text-xs font-semibold text-green-600">Escrito hoy</p>
            </div>
            <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap leading-relaxed">
              {todayEntry.content}
            </p>
          </div>
        )}
      </div>

      {/* Freeze status bar */}
      {streak > 0 && (
        <div className="bg-slate-50 rounded-2xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-black text-slate-600">Protecciones</p>
            <p className="text-[11px] text-slate-400">Cada 3 días escribiendo ganas 1 (máx. 2)</p>
          </div>
          <div className="flex gap-1.5">
            {[0, 1].map(i => (
              <div key={i}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all
                  ${i < settings.freeze_count ? 'bg-blue-100' : 'bg-slate-200'}`}>
                {i < settings.freeze_count ? '🛡️' : ''}
              </div>
            ))}
          </div>
        </div>
      )}

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
              {history.map(e => (
                <div key={e.id} className="bg-white rounded-2xl shadow-sm px-4 py-3">
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 capitalize">
                    {fmtDate(e.date)}
                  </p>
                  <p className="text-sm text-slate-600 font-medium whitespace-pre-wrap leading-relaxed">
                    {e.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
