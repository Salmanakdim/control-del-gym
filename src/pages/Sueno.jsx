import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Moon, Sun, Mic, MicOff, Star } from 'lucide-react'

// Screen Wake Lock API (web + Android Chrome/WebView)
// Cuando integremos Capacitor: instalar @capacitor-community/keep-awake y reemplazar esto
async function requestWakeLock(ref) {
  try {
    const wl = await navigator.wakeLock.request('screen')
    ref.current = wl
  } catch { ref.current = null }
}

function releaseWakeLock(ref) {
  try { ref.current?.release() } catch (_) {}
  ref.current = null
}

const SENSITIVITY = {
  alta:  { label: 'Alta',  desc: 'Detecta sonidos suaves',  threshold: 18 },
  media: { label: 'Media', desc: 'Ronquidos y movimientos', threshold: 35 },
  baja:  { label: 'Baja',  desc: 'Solo sonidos fuertes',    threshold: 60 },
}

const QUALITY_LABELS = ['', '😫 Muy mal', '😕 Mal', '😐 Regular', '😊 Bien', '😄 Excelente']

function fmtElapsed(ms) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}
function fmtDuration(mins) {
  if (!mins) return '—'
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h ${m > 0 ? m+'m' : ''}`.trim() : `${m}m`
}
function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' })
}
function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' })
}

function buildTimeline(bedTime, wakeTime, events) {
  const start   = new Date(bedTime).getTime()
  const end     = new Date(wakeTime || Date.now()).getTime()
  const blockMs = 30 * 60 * 1000
  const n       = Math.max(1, Math.ceil((end - start) / blockMs))
  return Array.from({ length: n }, (_, i) => {
    const bs = start + i * blockMs, be = bs + blockMs
    return (events || []).filter(e => {
      const t = new Date(e.time).getTime()
      return t >= bs && t < be
    }).length
  })
}

export default function Sueno() {
  const { user } = useAuth()
  const [tab, setTab] = useState('sleep')

  // ── Session state ────────────────────────────────────────────
  const [phase, setPhase]           = useState('idle') // idle | monitoring | rating
  const [sessionId, setSessionId]   = useState(null)
  const [startTime, setStartTime]   = useState(null)
  const [elapsed, setElapsed]       = useState(0)
  const [soundEvents, setSoundEvents] = useState([])
  const [currentLevel, setCurrentLevel] = useState(0)
  const [hasMic, setHasMic]         = useState(true)
  const [sensitivity, setSensitivity] = useState('media')

  // ── Rating state ─────────────────────────────────────────────
  const [quality, setQuality] = useState(0)
  const [notes, setNotes]     = useState('')

  // ── History ──────────────────────────────────────────────────
  const [history, setHistory] = useState([])

  // ── Refs ─────────────────────────────────────────────────────
  const streamRef      = useRef(null)
  const analyserRef    = useRef(null)
  const audioCtxRef    = useRef(null)
  const wakeLockRef    = useRef(null)
  const monitorRef     = useRef(null)  // setInterval for audio check
  const elapsedRef     = useRef(null)  // setInterval for timer
  const soundEventsRef = useRef([])
  const lastEventRef   = useRef(0)
  const sessionIdRef   = useRef(null)
  const startTimeRef   = useRef(null)

  useEffect(() => {
    supabase.from('sleep_logs').select('*')
      .eq('user_id', user.id).not('wake_time', 'is', null)
      .order('bed_time', { ascending: false }).limit(10)
      .then(({ data }) => setHistory(data || []))
  }, [])

  // ── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(monitorRef.current)
      clearInterval(elapsedRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      releaseWakeLock(wakeLockRef)
      try { audioCtxRef.current?.close() } catch (_) {}
    }
  }, [])

  // ── Start session ────────────────────────────────────────────
  async function startSession() {
    // Request microphone
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const ctx      = new (window.AudioContext || window.webkitAudioContext)()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser
      setHasMic(true)
    } catch {
      setHasMic(false)
      // Continue without mic
    }

    // Wake lock
    await requestWakeLock(wakeLockRef)

    // Save to Supabase
    const now = new Date().toISOString()
    const { data: log } = await supabase.from('sleep_logs').insert({
      user_id: user.id, bed_time: now, sound_events: []
    }).select().single()

    if (log) { setSessionId(log.id); sessionIdRef.current = log.id }
    setStartTime(now); startTimeRef.current = now
    soundEventsRef.current = []
    setSoundEvents([])
    setElapsed(0)
    setPhase('monitoring')

    // Timer interval
    elapsedRef.current = setInterval(() => {
      setElapsed(Date.now() - new Date(startTimeRef.current).getTime())
    }, 1000)

    // Audio monitor interval
    const threshold = SENSITIVITY[sensitivity].threshold
    const dataArray = new Uint8Array(analyserRef.current?.frequencyBinCount || 0)
    monitorRef.current = setInterval(() => {
      if (!analyserRef.current) return
      analyserRef.current.getByteFrequencyData(dataArray)
      const avg = dataArray.length > 0
        ? dataArray.reduce((a, b) => a + b) / dataArray.length
        : 0
      const pct = Math.min(100, Math.round((avg / 255) * 100 * 3))
      setCurrentLevel(pct)

      const now = Date.now()
      if (avg > threshold && now - lastEventRef.current > 30000) {
        lastEventRef.current = now
        const ev = { time: new Date().toISOString(), level: pct }
        soundEventsRef.current = [...soundEventsRef.current, ev]
        setSoundEvents([...soundEventsRef.current])
        // Auto-save events to DB every new event
        if (sessionIdRef.current) {
          supabase.from('sleep_logs').update({ sound_events: soundEventsRef.current })
            .eq('id', sessionIdRef.current)
        }
      }
    }, 500)
  }

  // ── Stop session → show rating ───────────────────────────────
  function stopSession() {
    clearInterval(monitorRef.current)
    clearInterval(elapsedRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    releaseWakeLock(wakeLockRef)
    try { audioCtxRef.current?.close() } catch (_) {}
    audioCtxRef.current = null; analyserRef.current = null
    setPhase('rating')
    setQuality(0); setNotes('')
  }

  // ── Save rating ──────────────────────────────────────────────
  async function saveRating() {
    const wakeTime = new Date().toISOString()
    const durMin   = Math.round((new Date(wakeTime) - new Date(startTimeRef.current)) / 60000)
    const payload  = {
      wake_time: wakeTime, duration_min: durMin,
      quality, notes, sound_events: soundEventsRef.current
    }
    if (sessionIdRef.current) {
      const { data: updated } = await supabase.from('sleep_logs').update(payload)
        .eq('id', sessionIdRef.current).select().single()
      if (updated) setHistory(h => [updated, ...h].slice(0, 10))
    }
    setPhase('idle')
    setTab('history')
  }

  // ── Weekly stats ─────────────────────────────────────────────
  const weekAvgMin = history.length > 0
    ? Math.round(history.filter(h => h.duration_min).reduce((s, h) => s + h.duration_min, 0) / history.filter(h=>h.duration_min).length)
    : 0
  const weekAvgQuality = history.length > 0
    ? (history.filter(h => h.quality).reduce((s, h) => s + h.quality, 0) / history.filter(h=>h.quality).length).toFixed(1)
    : 0

  const levelColor = currentLevel < 20 ? '#22c55e' : currentLevel < 50 ? '#f59e0b' : '#ef4444'

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-sm mx-auto space-y-5 pb-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Sueño</h1>
          <p className="text-sm text-slate-500 mt-0.5">Seguimiento y monitor de sonidos</p>
        </div>
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
          <Moon size={20} className="text-indigo-600"/>
        </div>
      </div>

      {/* ── IDLE ─────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <>
          {/* Tabs */}
          <div className="bg-white rounded-2xl p-1.5 flex gap-1 shadow-sm">
            <button onClick={() => setTab('sleep')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab==='sleep'?'bg-indigo-600 text-white shadow':'text-slate-500'}`}>
              🌙 Dormir
            </button>
            <button onClick={() => setTab('history')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab==='history'?'bg-indigo-600 text-white shadow':'text-slate-500'}`}>
              📊 Historial
            </button>
          </div>

          {tab === 'sleep' && (
            <>
              {/* Sensitivity */}
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Sensibilidad del micrófono</p>
                <div className="flex gap-2">
                  {Object.entries(SENSITIVITY).map(([key, s]) => (
                    <button key={key} onClick={() => setSensitivity(key)}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all
                        ${sensitivity===key?'bg-indigo-600 text-white shadow':'bg-slate-50 text-slate-600'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">{SENSITIVITY[sensitivity].desc}</p>
              </div>

              {/* Info banner */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 space-y-1">
                <p className="text-xs font-bold text-indigo-700">ℹ️ Cómo funciona</p>
                <p className="text-xs text-indigo-600">El micrófono detecta y registra cuándo hay sonidos mientras duermes (ronquidos, movimientos). Los sonidos no se graban, solo se anotan el momento y la intensidad.</p>
                <p className="text-xs text-indigo-500 mt-1 font-semibold">📱 En el navegador: mantén la pantalla encendida. En la app Android: funciona con la pantalla apagada.</p>
              </div>

              {/* Start button */}
              <button onClick={startSession}
                className="w-full py-5 bg-indigo-600 text-white font-black text-lg rounded-3xl shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-3">
                <Moon size={22}/> Iniciar sesión de sueño
              </button>
            </>
          )}

          {tab === 'history' && (
            <>
              {/* Weekly stats */}
              {history.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-4">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Promedio esta semana</p>
                  <div className="flex gap-4">
                    <div className="flex-1 text-center bg-indigo-50 rounded-xl py-3">
                      <p className="text-2xl font-black text-indigo-700">{fmtDuration(weekAvgMin)}</p>
                      <p className="text-[10px] text-indigo-400 font-semibold mt-0.5">Duración media</p>
                    </div>
                    <div className="flex-1 text-center bg-amber-50 rounded-xl py-3">
                      <p className="text-2xl font-black text-amber-600">{weekAvgQuality > 0 ? weekAvgQuality : '—'}</p>
                      <p className="text-[10px] text-amber-400 font-semibold mt-0.5">Calidad media</p>
                    </div>
                  </div>
                </div>
              )}

              {/* History list */}
              {history.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-10">Aún no tienes noches registradas</p>
              ) : history.map(log => {
                const timeline = buildTimeline(log.bed_time, log.wake_time, log.sound_events || [])
                const maxBlk   = Math.max(1, ...timeline)
                return (
                  <div key={log.id} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-800 text-sm capitalize">{fmtDate(log.bed_time)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {fmtTime(log.bed_time)} → {fmtTime(log.wake_time)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-indigo-700 text-lg">{fmtDuration(log.duration_min)}</p>
                        {log.quality > 0 && (
                          <div className="flex gap-0.5 justify-end mt-0.5">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} size={10} fill={s<=log.quality?'#f59e0b':'none'}
                                className={s<=log.quality?'text-amber-400':'text-slate-200'}/>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sound timeline */}
                    {timeline.length > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold mb-1">
                          {(log.sound_events||[]).length} eventos de sonido
                        </p>
                        <div className="flex gap-0.5 items-end h-8">
                          {timeline.map((count, i) => (
                            <div key={i} className="flex-1 rounded-sm transition-all"
                              style={{
                                height: count > 0 ? `${Math.max(20, (count/maxBlk)*100)}%` : '8%',
                                background: count > 0 ? `rgba(99,102,241,${0.3 + (count/maxBlk)*0.7})` : '#f1f5f9'
                              }}/>
                          ))}
                        </div>
                        <div className="flex justify-between mt-1">
                          <p className="text-[9px] text-slate-300">{fmtTime(log.bed_time)}</p>
                          <p className="text-[9px] text-slate-300">{fmtTime(log.wake_time)}</p>
                        </div>
                      </div>
                    )}

                    {log.notes && (
                      <p className="text-xs text-slate-500 mt-2 italic">"{log.notes}"</p>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </>
      )}

      {/* ── MONITORING ───────────────────────────────────────── */}
      {phase === 'monitoring' && (
        <>
          {/* Live status card */}
          <div className="bg-indigo-600 rounded-3xl shadow-lg p-6 flex flex-col items-center text-white">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <p className="text-xs font-bold uppercase tracking-widest opacity-80">Monitoreando</p>
            </div>
            <p className="text-5xl font-black tabular-nums mt-3 mb-1">{fmtElapsed(elapsed)}</p>
            <p className="text-sm opacity-60">desde {fmtTime(startTime)}</p>

            {/* Live level bar */}
            <div className="w-full mt-6 mb-1">
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div className="h-3 rounded-full transition-all duration-300"
                  style={{ width: `${currentLevel}%`, background: levelColor }}/>
              </div>
              <div className="flex justify-between mt-1">
                <p className="text-[10px] opacity-60">Nivel de sonido</p>
                <p className="text-[10px] font-bold" style={{ color: currentLevel > 20 ? '#fbbf24' : '#86efac' }}>
                  {currentLevel < 10 ? 'Silencio' : currentLevel < 30 ? 'Suave' : currentLevel < 60 ? 'Moderado' : 'Alto'}
                </p>
              </div>
            </div>

            {!hasMic && (
              <div className="flex items-center gap-2 mt-3 bg-white/10 rounded-xl px-3 py-2">
                <MicOff size={14} className="opacity-60"/>
                <p className="text-xs opacity-80">Sin micrófono — solo registra tiempo</p>
              </div>
            )}
          </div>

          {/* Events count */}
          <div className="bg-white rounded-2xl shadow-sm px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Mic size={18} className="text-indigo-600"/>
              </div>
              <div>
                <p className="font-black text-2xl text-slate-800">{soundEvents.length}</p>
                <p className="text-xs text-slate-400">eventos de sonido</p>
              </div>
            </div>
            {soundEvents.length > 0 && (
              <p className="text-xs text-slate-400">
                Último: {fmtTime(soundEvents[soundEvents.length-1].time)}
              </p>
            )}
          </div>

          {/* Wake up button */}
          <button onClick={stopSession}
            className="w-full py-4 bg-white border-2 border-amber-400 text-amber-600 font-black text-base rounded-2xl shadow-sm active:scale-95 transition-transform flex items-center justify-center gap-2">
            <Sun size={20}/> ¡Me despierto!
          </button>

          <p className="text-center text-xs text-slate-400">
            {wakeLockRef.current ? '🔒 Pantalla activa automáticamente' : '⚠️ Mantén la pantalla encendida'}
          </p>
        </>
      )}

      {/* ── RATING ───────────────────────────────────────────── */}
      {phase === 'rating' && (
        <div className="bg-white rounded-3xl shadow-sm p-6 space-y-5">
          <div className="text-center">
            <p className="text-3xl mb-2">🌅</p>
            <h2 className="text-lg font-black text-slate-800">¿Cómo dormiste?</h2>
            <p className="text-sm text-slate-400 mt-1">
              Duración: <span className="font-bold text-slate-600">
                {fmtDuration(Math.round((Date.now() - new Date(startTime).getTime()) / 60000))}
              </span>
              {' · '}{soundEvents.length} eventos de sonido
            </p>
          </div>

          {/* Star rating */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 text-center">Calidad del sueño</p>
            <div className="flex justify-center gap-3">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setQuality(s)}
                  className="active:scale-90 transition-transform">
                  <Star size={36} fill={s<=quality?'#f59e0b':'none'}
                    className={s<=quality?'text-amber-400':'text-slate-200'}/>
                </button>
              ))}
            </div>
            {quality > 0 && (
              <p className="text-center text-sm font-semibold mt-2" style={{ color: ['','#ef4444','#f97316','#eab308','#22c55e','#16a34a'][quality] }}>
                {QUALITY_LABELS[quality]}
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Notas (opcional)</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="¿Algo que destacar? Pesadillas, despertares, temperatura..."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              rows={3}/>
          </div>

          <button onClick={saveRating} disabled={quality === 0}
            className={`w-full py-4 font-bold text-white rounded-2xl text-sm transition-all
              ${quality > 0 ? 'bg-indigo-600 shadow-lg active:scale-95' : 'bg-slate-200 text-slate-400'}`}>
            Guardar noche
          </button>
        </div>
      )}
    </div>
  )
}
