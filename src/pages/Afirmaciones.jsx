import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, X, Pencil, Trash2, Sun, Moon, Check, Settings2, ClipboardList } from 'lucide-react'

function todayStr() { return new Date().toISOString().split('T')[0] }

const MORNING_THEMES = [
  { id: 'orange',  gradient: 'linear-gradient(135deg, #f97316, #fbbf24)' },
  { id: 'pink',    gradient: 'linear-gradient(135deg, #ec4899, #f97316)' },
  { id: 'teal',    gradient: 'linear-gradient(135deg, #0ea5e9, #06b6d4)' },
  { id: 'green',   gradient: 'linear-gradient(135deg, #10b981, #84cc16)' },
]
const EVENING_THEMES = [
  { id: 'purple',  gradient: 'linear-gradient(135deg, #4338ca, #7c3aed)' },
  { id: 'rose',    gradient: 'linear-gradient(135deg, #be123c, #7c3aed)' },
  { id: 'navy',    gradient: 'linear-gradient(135deg, #1e3a8a, #0ea5e9)' },
  { id: 'dark',    gradient: 'linear-gradient(135deg, #111827, #374151)' },
]
const FONT_SIZES = [
  { id: 'sm', label: 'S',  base: [16, 20, 24] },
  { id: 'md', label: 'M',  base: [18, 22, 26] },
  { id: 'lg', label: 'L',  base: [22, 28, 34] },
  { id: 'xl', label: 'XL', base: [26, 32, 40] },
]
const FONT_STYLES = [
  { id: 'normal', label: 'Normal',  style: { fontWeight: 700 } },
  { id: 'italic', label: 'Cursiva', style: { fontWeight: 700, fontStyle: 'italic' } },
  { id: 'serif',  label: 'Serif',   style: { fontWeight: 700, fontFamily: 'Georgia, serif' } },
  { id: 'light',  label: 'Fino',    style: { fontWeight: 300 } },
]
const AUTO_ADVANCE = [
  { id: 0,  label: 'No' },
  { id: 3,  label: '3s' },
  { id: 5,  label: '5s' },
  { id: 10, label: '10s' },
]

const DEFAULT_AFF_SETTINGS = {
  morningTheme: 'orange',
  eveningTheme: 'purple',
  fontSize: 'md',
  fontStyle: 'normal',
  autoAdvance: 0,
}

function loadAffSettings() {
  try { return { ...DEFAULT_AFF_SETTINGS, ...JSON.parse(localStorage.getItem('aff_settings') || '{}') } }
  catch { return DEFAULT_AFF_SETTINGS }
}
function saveAffSettings(s) { localStorage.setItem('aff_settings', JSON.stringify(s)) }

const SESSION_LABEL = { morning: 'Mañana', evening: 'Noche' }

// ── Settings panel ─────────────────────────────────────────────────────────────
function AffSettingsPanel({ settings, onChange, onClose }) {
  function set(key, val) { const s = { ...settings, [key]: val }; onChange(s); saveAffSettings(s) }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-white rounded-t-3xl shadow-2xl p-6 space-y-6 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-800">Ajustes de sesión</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
            <X size={16} className="text-slate-500"/>
          </button>
        </div>

        {/* Tamaño de texto */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Tamaño de texto</p>
          <div className="grid grid-cols-4 gap-2">
            {FONT_SIZES.map(f => (
              <button key={f.id} onClick={() => set('fontSize', f.id)}
                className={`py-3 rounded-2xl font-black text-sm transition-all ${settings.fontSize === f.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Estilo de fuente */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Estilo de fuente</p>
          <div className="grid grid-cols-4 gap-2">
            {FONT_STYLES.map(f => (
              <button key={f.id} onClick={() => set('fontStyle', f.id)}
                className={`py-3 rounded-2xl text-sm transition-all ${settings.fontStyle === f.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}
                style={f.style}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-avanzar */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Auto-avanzar</p>
          <div className="grid grid-cols-4 gap-2">
            {AUTO_ADVANCE.map(a => (
              <button key={a.id} onClick={() => set('autoAdvance', a.id)}
                className={`py-3 rounded-2xl font-black text-sm transition-all ${settings.autoAdvance === a.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tema mañana */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Tema mañana</p>
          <div className="flex gap-3">
            {MORNING_THEMES.map(t => (
              <button key={t.id} onClick={() => set('morningTheme', t.id)}
                className={`w-12 h-12 rounded-2xl flex-1 transition-all ${settings.morningTheme === t.id ? 'ring-3 ring-offset-2 ring-blue-500 scale-110' : ''}`}
                style={{ background: t.gradient }}/>
            ))}
          </div>
        </div>

        {/* Tema noche */}
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Tema noche</p>
          <div className="flex gap-3">
            {EVENING_THEMES.map(t => (
              <button key={t.id} onClick={() => set('eveningTheme', t.id)}
                className={`w-12 h-12 rounded-2xl flex-1 transition-all ${settings.eveningTheme === t.id ? 'ring-3 ring-offset-2 ring-blue-500 scale-110' : ''}`}
                style={{ background: t.gradient }}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modo sesión ────────────────────────────────────────────────────────────────
function SessionMode({ affirmations, session, onComplete, onClose, settings }) {
  const [index,    setIndex]    = useState(0)
  const [finished, setFinished] = useState(false)
  const timerRef = useRef(null)
  const total   = affirmations.length
  const current = affirmations[index]
  const progress = ((index + 1) / total) * 100

  const gradient = session === 'morning'
    ? (MORNING_THEMES.find(t => t.id === settings.morningTheme) || MORNING_THEMES[0]).gradient
    : (EVENING_THEMES.find(t => t.id === settings.eveningTheme) || EVENING_THEMES[0]).gradient

  const fontSizeConfig = FONT_SIZES.find(f => f.id === settings.fontSize) || FONT_SIZES[1]
  const fontStyleConfig = FONT_STYLES.find(f => f.id === settings.fontStyle) || FONT_STYLES[0]

  function getFontSize(text) {
    const [s, m, l] = fontSizeConfig.base
    return text.length > 80 ? s : text.length > 50 ? m : text.length > 30 ? m : l
  }

  function next() {
    if (index < total - 1) setIndex(i => i + 1)
    else setFinished(true)
  }
  function prev(e) {
    e.stopPropagation()
    if (index > 0) setIndex(i => i - 1)
  }

  useEffect(() => {
    if (settings.autoAdvance > 0 && !finished) {
      timerRef.current = setTimeout(next, settings.autoAdvance * 1000)
    }
    return () => clearTimeout(timerRef.current)
  }, [index, settings.autoAdvance, finished])

  if (finished) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center text-white px-8"
      style={{ background: gradient, zIndex: 9999 }}>
      <div className="text-7xl mb-6">✨</div>
      <h2 className="text-2xl font-black mb-2 text-center">¡Sesión completada!</h2>
      <p className="text-white/70 text-sm mb-10 text-center">Has repasado todas tus afirmaciones</p>
      <button onClick={onComplete}
        className="w-full max-w-xs bg-white font-black py-4 rounded-2xl text-lg"
        style={{ color: session === 'morning' ? '#ea580c' : '#4338ca' }}>
        Marcar {SESSION_LABEL[session]} como hecha ✓
      </button>
      <button onClick={onClose} className="mt-4 text-white/50 text-sm py-2">
        Cerrar sin guardar
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 flex flex-col select-none"
      style={{ background: gradient, zIndex: 9999 }}
      onClick={next}>

      {/* Decorative blobs */}
      <div className="absolute top-[-80px] right-[-60px] w-64 h-64 rounded-full opacity-20"
        style={{ background: 'rgba(255,255,255,0.3)', filter: 'blur(40px)' }}/>
      <div className="absolute bottom-[-60px] left-[-40px] w-48 h-48 rounded-full opacity-20"
        style={{ background: 'rgba(255,255,255,0.3)', filter: 'blur(40px)' }}/>

      {/* Top bar */}
      <div className="flex-shrink-0 px-5 z-10" style={{ paddingTop: 'max(48px, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={e => { e.stopPropagation(); onClose() }}
            className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
            <X size={16} className="text-white"/>
          </button>
          <span className="text-white/70 text-xs font-bold tracking-widest uppercase">
            {SESSION_LABEL[session]}
          </span>
          <span className="text-white/70 text-xs font-bold w-9 text-right">
            {index + 1}/{total}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1 w-full bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}/>
        </div>
      </div>

      {/* Affirmation card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 z-10">
        <div className="w-full rounded-3xl px-7 py-8 text-center"
          style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.25)' }}>
          <div className="text-white/40 text-7xl leading-none mb-2" style={{ fontFamily: 'Georgia, serif' }}>"</div>
          <p className="text-white leading-snug"
            style={{ fontSize: getFontSize(current.text), ...fontStyleConfig.style }}>
            {current.text}
          </p>
          <div className="text-white/40 text-7xl leading-none mt-2 rotate-180 inline-block" style={{ fontFamily: 'Georgia, serif' }}>"</div>
        </div>
        {settings.autoAdvance > 0 && (
          <p className="text-white/50 text-xs mt-4">Avanzando en {settings.autoAdvance}s</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 pb-10 z-10">
        <button onClick={prev}
          className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center transition-opacity"
          style={{ opacity: index === 0 ? 0 : 1 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <p className="text-white/50 text-xs">{settings.autoAdvance > 0 ? '' : 'Toca para continuar'}</p>
        <button onClick={e => { e.stopPropagation(); next() }}
          className="w-12 h-12 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function Afirmaciones() {
  const { user } = useAuth()
  const [affirmations, setAffirmations] = useState([])
  const [doneLogs,     setDoneLogs]     = useState(new Set())
  const [loading,      setLoading]      = useState(true)
  const [session,      setSession]      = useState(null)
  const [showAdd,      setShowAdd]      = useState(false)
  const [newText,      setNewText]      = useState('')
  const [showPaste,    setShowPaste]    = useState(false)
  const [pasteText,    setPasteText]    = useState('')
  const [editId,       setEditId]       = useState(null)
  const [editText,     setEditText]     = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [affSettings,  setAffSettings]  = useState(loadAffSettings)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [{ data: aff }, { data: logs }] = await Promise.all([
      supabase.from('affirmations').select('*').eq('user_id', user.id)
        .eq('active', true).order('position').order('created_at'),
      supabase.from('affirmation_logs').select('session').eq('user_id', user.id).eq('date', todayStr()),
    ])
    setAffirmations(aff || [])
    setDoneLogs(new Set((logs || []).map(l => l.session)))
    setLoading(false)
  }

  async function addAffirmation() {
    const text = newText.trim()
    if (!text) return
    const pos = affirmations.length
    const { data } = await supabase.from('affirmations')
      .insert({ user_id: user.id, text, position: pos }).select().single()
    if (data) setAffirmations(prev => [...prev, data])
    setNewText('')
    setShowAdd(false)
  }

  // Una por línea; se quitan viñetas ("- ", "•") y marcas invisibles de dirección
  // que vienen al copiar, y se saltan las que ya están en la lista.
  async function importList() {
    const have = new Set(affirmations.map(a => a.text.trim()))
    const texts = [...new Set(pasteText.split(/\r?\n/)
      .map(l => l.replace(/[‎‏‪-‮]/g, '').replace(/^\s*[-•*–]\s*/, '').trim())
      .filter(t => t && !have.has(t)))]
    if (!texts.length) { setShowPaste(false); setPasteText(''); return }
    const rows = texts.map((text, i) => ({ user_id: user.id, text, position: affirmations.length + i }))
    const { data } = await supabase.from('affirmations').insert(rows).select()
    if (data) setAffirmations(prev => [...prev, ...data.sort((a, b) => a.position - b.position)])
    setPasteText('')
    setShowPaste(false)
  }

  async function deleteAffirmation(id) {
    await supabase.from('affirmations').delete().eq('id', id)
    setAffirmations(prev => prev.filter(a => a.id !== id))
  }

  async function saveEdit() {
    const text = editText.trim()
    if (!text) return
    await supabase.from('affirmations').update({ text }).eq('id', editId)
    setAffirmations(prev => prev.map(a => a.id === editId ? { ...a, text } : a))
    setEditId(null)
  }

  async function completeSession(s) {
    await supabase.from('affirmation_logs')
      .upsert({ user_id: user.id, date: todayStr(), session: s }, { onConflict: 'user_id,date,session' })
    setDoneLogs(prev => new Set([...prev, s]))
    setSession(null)
  }

  const activeAff = affirmations.filter(a => a.active)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  return (
    <>
      {showSettings && (
        <AffSettingsPanel settings={affSettings} onChange={setAffSettings} onClose={() => setShowSettings(false)}/>
      )}
      {session && activeAff.length > 0 && (
        <SessionMode
          affirmations={activeAff}
          session={session}
          settings={affSettings}
          onComplete={() => completeSession(session)}
          onClose={() => setSession(null)}
        />
      )}

      <div className="space-y-5 max-w-lg pb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Afirmaciones</h1>
            <p className="text-slate-500 text-sm mt-1">Reprograma tu mente cada día</p>
          </div>
          <button onClick={() => setShowSettings(true)}
            className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center active:bg-slate-200 mt-1">
            <Settings2 size={17} className="text-slate-500"/>
          </button>
        </div>

        {/* Sesiones */}
        <div className="grid grid-cols-2 gap-3">
          {(['morning', 'evening']).map(s => {
            const done = doneLogs.has(s)
            const Icon = s === 'morning' ? Sun : Moon
            return (
              <button key={s} onClick={() => !done && activeAff.length > 0 && setSession(s)}
                className="rounded-2xl p-4 text-left transition-all active:scale-95 relative overflow-hidden"
                style={{ background: done ? '#f0fdf4' : s === 'morning'
                  ? (MORNING_THEMES.find(t => t.id === affSettings.morningTheme) || MORNING_THEMES[0]).gradient
                  : (EVENING_THEMES.find(t => t.id === affSettings.eveningTheme) || EVENING_THEMES[0]).gradient }}>
                {done ? (
                  <>
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                      <Check size={20} className="text-green-600"/>
                    </div>
                    <p className="font-black text-green-800 text-sm">{SESSION_LABEL[s]}</p>
                    <p className="text-green-600 text-xs mt-0.5">Completada ✓</p>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                      <Icon size={20} className="text-white"/>
                    </div>
                    <p className="font-black text-white text-sm">{SESSION_LABEL[s]}</p>
                    <p className="text-white/70 text-xs mt-0.5">
                      {activeAff.length > 0 ? `${activeAff.length} afirmaciones` : 'Sin afirmaciones'}
                    </p>
                  </>
                )}
              </button>
            )
          })}
        </div>

        {activeAff.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700 font-medium">
            Añade al menos una afirmación para empezar las sesiones.
          </div>
        )}

        {/* Lista de afirmaciones */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
              Mis afirmaciones ({affirmations.length})
            </p>
            <div className="flex gap-1.5">
              <button onClick={() => { setShowPaste(true); setShowAdd(false) }}
                className="flex items-center gap-1 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-bold active:bg-slate-200">
                <ClipboardList size={12}/> Pegar lista
              </button>
              <button onClick={() => { setShowAdd(true); setShowPaste(false) }}
                className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold active:bg-blue-700">
                <Plus size={12}/> Añadir
              </button>
            </div>
          </div>

          {/* Pegar varias de una vez */}
          {showPaste && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-3 space-y-3">
              <p className="text-xs text-slate-500 font-medium">Pega tu lista: cada línea es una afirmación. Las que ya tienes no se repiten.</p>
              <textarea
                autoFocus
                dir="auto"
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={'- Soy fuerte y capaz\n- La constancia es el secreto del éxito'}
                rows={8}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-medium resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300"
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowPaste(false); setPasteText('') }}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl text-sm">
                  Cancelar
                </button>
                <button onClick={importList} disabled={!pasteText.trim()}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm disabled:opacity-40 active:bg-blue-700">
                  Añadir todas
                </button>
              </div>
            </div>
          )}

          {/* Add form */}
          {showAdd && (
            <div className="bg-white rounded-2xl shadow-sm p-4 mb-3 space-y-3">
              <textarea
                autoFocus
                value={newText}
                onChange={e => setNewText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addAffirmation() } }}
                placeholder="Escribe tu afirmación… ej: Soy fuerte y capaz"
                rows={2}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-medium resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-300"
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowAdd(false); setNewText('') }}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-semibold rounded-xl text-sm">
                  Cancelar
                </button>
                <button onClick={addAffirmation} disabled={!newText.trim()}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl text-sm disabled:opacity-40 active:bg-blue-700">
                  Guardar
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {affirmations.length === 0 && !showAdd && (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-slate-400 text-sm">
                Aún no tienes afirmaciones
              </div>
            )}
            {affirmations.map((a, i) => (
              <div key={a.id} className="bg-white rounded-2xl shadow-sm px-4 py-3.5">
                {editId === a.id ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={2}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 font-medium resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => setEditId(null)}
                        className="flex-1 py-2 bg-slate-100 text-slate-600 font-semibold rounded-xl text-xs">
                        Cancelar
                      </button>
                      <button onClick={saveEdit}
                        className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs active:bg-blue-700">
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5 flex-shrink-0">💬</span>
                    <p dir="auto" className="flex-1 text-sm font-semibold text-slate-700 leading-snug text-start">{a.text}</p>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setEditId(a.id); setEditText(a.text) }}
                        className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center active:bg-slate-200">
                        <Pencil size={13} className="text-slate-500"/>
                      </button>
                      <button onClick={() => deleteAffirmation(a.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center active:bg-red-100">
                        <Trash2 size={13} className="text-red-500"/>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
