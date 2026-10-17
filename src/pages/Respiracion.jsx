import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const PATTERNS = [
  { id:'box',       name:'Cuadrada',   desc:'Foco y estrés',      emoji:'🔷', color:'#2563eb',
    phases:[{l:'Inhala',d:4,s:1.35,a:true},{l:'Aguanta',d:4,s:1.35,a:false},{l:'Exhala',d:4,s:0.65,a:true},{l:'Aguanta',d:4,s:0.65,a:false}] },
  { id:'478',       name:'4-7-8',      desc:'Calma y sueño',      emoji:'🌙', color:'#7c3aed',
    phases:[{l:'Inhala',d:4,s:1.35,a:true},{l:'Aguanta',d:7,s:1.35,a:false},{l:'Exhala',d:8,s:0.65,a:true}] },
  { id:'coherence', name:'Coherencia', desc:'Equilibrio cardíaco', emoji:'💚', color:'#16a34a',
    phases:[{l:'Inhala',d:5,s:1.35,a:true},{l:'Exhala',d:5,s:0.65,a:true}] },
  { id:'energy',    name:'Energía',    desc:'Activa y despierta',  emoji:'⚡', color:'#ea580c',
    phases:[{l:'Inhala',d:4,s:1.35,a:true},{l:'Exhala',d:2,s:0.65,a:true}] },
]

const MED_DURATIONS = [5, 10, 15, 20]

// ── Audio generators ───────────────────────────────────────────────
function getCtx(ref) {
  if (!ref.current) ref.current = new (window.AudioContext || window.webkitAudioContext)()
  if (ref.current.state === 'suspended') ref.current.resume()
  return ref.current
}

function makeNoise(ctx, type) {
  const bufSize = ctx.sampleRate * 3
  const buffer  = ctx.createBuffer(1, bufSize, ctx.sampleRate)
  const data    = buffer.getChannelData(0)
  if (type === 'white') {
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
  } else if (type === 'brown') {
    let last = 0
    for (let i = 0; i < bufSize; i++) {
      const w = Math.random() * 2 - 1
      data[i] = (last + 0.02 * w) / 1.02
      last = data[i]
      data[i] *= 3.5
    }
  } else if (type === 'rain') {
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer; src.loop = true
  return src
}

function startWhite(ctx) {
  const src  = makeNoise(ctx, 'white')
  const gain = ctx.createGain(); gain.gain.value = 0.4
  src.connect(gain); gain.connect(ctx.destination); src.start()
  return { stop() { try { src.stop() } catch(_){} } }
}

function startBrown(ctx) {
  const src    = makeNoise(ctx, 'brown')
  const lp     = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500
  const gain   = ctx.createGain(); gain.gain.value = 0.5
  src.connect(lp); lp.connect(gain); gain.connect(ctx.destination); src.start()
  return { stop() { try { src.stop() } catch(_){} } }
}

function startRain(ctx) {
  const src  = makeNoise(ctx, 'rain')
  const bp   = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.4
  const lp   = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value  = 2000
  const gain = ctx.createGain(); gain.gain.value = 0.9
  src.connect(bp); bp.connect(lp); lp.connect(gain); gain.connect(ctx.destination); src.start()
  return { stop() { try { src.stop() } catch(_){} } }
}

function startBinaural(ctx, base, beat) {
  const merger = ctx.createChannelMerger(2)
  const oscL   = ctx.createOscillator(); oscL.type = 'sine'; oscL.frequency.value = base
  const oscR   = ctx.createOscillator(); oscR.type = 'sine'; oscR.frequency.value = base + beat
  const gL     = ctx.createGain(); gL.gain.value = 0.22
  const gR     = ctx.createGain(); gR.gain.value = 0.22
  oscL.connect(gL); oscR.connect(gR)
  gL.connect(merger, 0, 0); gR.connect(merger, 0, 1)
  merger.connect(ctx.destination)
  oscL.start(); oscR.start()
  return { stop() { try { oscL.stop(); oscR.stop() } catch(_){} } }
}

function startTone(ctx, freq) {
  const osc  = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq
  const gain = ctx.createGain(); gain.gain.value = 0.18
  osc.connect(gain); gain.connect(ctx.destination); osc.start()
  return { stop() { try { osc.stop() } catch(_){} } }
}

const SOUNDS = [
  { id:'rain',   name:'Lluvia',          emoji:'🌧️', desc:'Relajación profunda',      color:'#0ea5e9', create: c => startRain(c) },
  { id:'white',  name:'Ruido blanco',    emoji:'🔲', desc:'Bloquea distracciones',    color:'#64748b', create: c => startWhite(c) },
  { id:'brown',  name:'Ruido marrón',    emoji:'🟫', desc:'Profundo y calmante',      color:'#92400e', create: c => startBrown(c) },
  { id:'alpha',  name:'Alpha · Foco',    emoji:'🧠', desc:'10 Hz · Concentración',   color:'#2563eb', headphones:true, create: c => startBinaural(c, 200, 10) },
  { id:'theta',  name:'Theta · Calma',   emoji:'🌀', desc:'6 Hz · Meditación',       color:'#7c3aed', headphones:true, create: c => startBinaural(c, 200, 6) },
  { id:'delta',  name:'Delta · Sueño',   emoji:'😴', desc:'2 Hz · Sueño profundo',   color:'#1e3a5f', headphones:true, create: c => startBinaural(c, 150, 2) },
  { id:'s432',   name:'432 Hz',          emoji:'✨', desc:'Armonía y equilibrio',     color:'#d97706', create: c => startTone(c, 432) },
  { id:'s528',   name:'528 Hz',          emoji:'💚', desc:'Amor y sanación',          color:'#16a34a', create: c => startTone(c, 528) },
]

// ── Helpers ────────────────────────────────────────────────────────
function playBell(freq = 528) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator(); const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination); osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 1.5)
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 2.5)
  } catch (_) {}
}

function Ring({ progress, color, size = 200 }) {
  const R = (size / 2) - 12; const C = 2 * Math.PI * R
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="#f1f5f9" strokeWidth={10}/>
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={C} strokeDashoffset={C * (1 - Math.max(0, Math.min(1, progress)))}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }}/>
    </svg>
  )
}

function fmtSecs(s) {
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
}
function fmtDate(iso) {
  const d = new Date(iso), now = new Date()
  const diff = Math.floor((now - d) / 3600000)
  if (diff < 1)  return 'Hace menos de 1h'
  if (diff < 24) return `Hace ${diff}h`
  if (diff < 48) return 'Ayer'
  return d.toLocaleDateString('es-ES', { day:'numeric', month:'short' })
}

// ── Component ──────────────────────────────────────────────────────
export default function Respiracion() {
  const { user } = useAuth()
  const [tab, setTab] = useState('breath')

  // ── Breathing ────────────────────────────────────────────────
  const [patternId, setPatternId] = useState('box')
  const [breathing, setBreathing] = useState(false)
  const [phaseIdx, setPhaseIdx]   = useState(0)
  const [timeLeft, setTimeLeft]   = useState(0)
  const [cycles, setCycles]       = useState(0)
  const [showFases, setShowFases] = useState(true)
  const breathRef   = useRef(null)
  const breathState = useRef({})

  const pattern = PATTERNS.find(p => p.id === patternId)
  const phase   = pattern.phases[phaseIdx] ?? pattern.phases[0]

  function startBreathing() {
    const p0 = pattern.phases[0]
    breathState.current = { phaseIdx:0, timeLeft:p0.d, cycles:0 }
    setPhaseIdx(0); setTimeLeft(p0.d); setCycles(0); setShowFases(true)
    setBreathing(true)
  }
  function stopBreathing() {
    clearInterval(breathRef.current)
    setBreathing(false); setPhaseIdx(0); setTimeLeft(0); setCycles(0); setShowFases(true)
  }

  useEffect(() => {
    if (!breathing) { clearInterval(breathRef.current); return }
    breathRef.current = setInterval(() => {
      const s = breathState.current
      const newT = s.timeLeft - 1
      if (newT <= 0) {
        const nextIdx = (s.phaseIdx + 1) % pattern.phases.length
        const newCyc  = nextIdx === 0 ? s.cycles + 1 : s.cycles
        const nextD   = pattern.phases[nextIdx].d
        breathState.current = { phaseIdx:nextIdx, timeLeft:nextD, cycles:newCyc }
        setPhaseIdx(nextIdx); setTimeLeft(nextD); setCycles(newCyc)
      } else {
        breathState.current = { ...s, timeLeft:newT }
        setTimeLeft(newT)
      }
    }, 1000)
    return () => clearInterval(breathRef.current)
  }, [breathing]) // eslint-disable-line

  const circleScale = breathing ? phase.s : 1.0
  const circleDur   = breathing && phase.a ? phase.d : 0.3

  // ── Meditation ───────────────────────────────────────────────
  const [medDuration, setMedDuration] = useState(10)
  const [meditating, setMeditating]   = useState(false)
  const [medLeft, setMedLeft]         = useState(0)
  const [history, setHistory]         = useState([])
  const medRef    = useRef(null)
  const medState  = useRef(0)
  const medDurRef = useRef(medDuration)
  useEffect(() => { medDurRef.current = medDuration }, [medDuration])

  useEffect(() => {
    supabase.from('meditation_logs').select('*')
      .eq('user_id', user.id).order('created_at', { ascending:false }).limit(7)
      .then(({ data }) => setHistory(data || []))
  }, [])

  function startMeditation() {
    const secs = medDuration * 60
    medState.current = secs; setMedLeft(secs); setMeditating(true); playBell(528)
  }
  function stopMeditation() {
    clearInterval(medRef.current); setMeditating(false); setMedLeft(0)
  }

  useEffect(() => {
    if (!meditating) { clearInterval(medRef.current); return }
    medRef.current = setInterval(() => {
      medState.current -= 1; setMedLeft(medState.current)
      if (medState.current <= 0) {
        clearInterval(medRef.current); setMeditating(false); playBell(528)
        supabase.from('meditation_logs')
          .insert({ user_id:user.id, duration_min:medDurRef.current, completed:true })
          .select().single()
          .then(({ data }) => { if (data) setHistory(h => [data, ...h].slice(0, 7)) })
      }
    }, 1000)
    return () => clearInterval(medRef.current)
  }, [meditating]) // eslint-disable-line

  const totalMedSecs   = medDuration * 60
  const totalThisWeek  = history.reduce((s, h) => s + h.duration_min, 0)

  // ── Sounds ───────────────────────────────────────────────────
  const [activeSounds, setActiveSounds] = useState(new Set())
  const soundNodes  = useRef({})
  const audioCtxRef = useRef(null)

  useEffect(() => {
    return () => {
      Object.values(soundNodes.current).forEach(n => { try { n.stop() } catch(_){} })
      try { audioCtxRef.current?.close() } catch(_) {}
    }
  }, [])

  function toggleSound(sound) {
    if (activeSounds.has(sound.id)) {
      soundNodes.current[sound.id]?.stop()
      delete soundNodes.current[sound.id]
      setActiveSounds(prev => { const n = new Set(prev); n.delete(sound.id); return n })
    } else {
      const ctx  = getCtx(audioCtxRef)
      soundNodes.current[sound.id] = sound.create(ctx)
      setActiveSounds(prev => new Set([...prev, sound.id]))
    }
  }

  function stopAllSounds() {
    Object.values(soundNodes.current).forEach(n => { try { n.stop() } catch(_){} })
    soundNodes.current = {}
    setActiveSounds(new Set())
  }

  const hasBinauralActive = [...activeSounds].some(id => ['alpha','theta','delta'].includes(id))

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-sm mx-auto space-y-5 pb-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-800">Bienestar</h1>
        <p className="text-sm text-slate-500 mt-0.5">Respiración, meditación y sonidos</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl p-1.5 flex gap-1 shadow-sm">
        {[['breath','🌬️ Respiración','bg-blue-600'],['meditate','🧘 Meditación','bg-violet-600'],['sounds','🎵 Sonidos','bg-teal-600']].map(([id,label,bg])=>(
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all ${tab===id?`${bg} text-white shadow`:'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Breathing tab ──────────────────────────────────── */}
      {tab === 'breath' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth:'none' }}>
            {PATTERNS.map(p => (
              <button key={p.id} onClick={() => { if (!breathing) setPatternId(p.id) }}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-2xl border-2 transition-all
                  ${patternId===p.id?'border-transparent text-white shadow-md':'border-slate-100 bg-white text-slate-600'}`}
                style={patternId===p.id?{background:p.color}:{}}>
                <span className="text-xl">{p.emoji}</span>
                <p className="text-xs font-bold whitespace-nowrap">{p.name}</p>
                <p className="text-[10px] opacity-80 whitespace-nowrap">{p.desc}</p>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-3xl shadow-sm flex flex-col items-center py-10">
            <div className="relative flex items-center justify-center mb-8" style={{ width:220, height:220 }}>
              <div className="absolute rounded-full"
                style={{ width:200, height:200, background:pattern.color, opacity:0.12,
                  transform:`scale(${circleScale})`, transition:`transform ${circleDur}s ease-in-out` }}/>
              <div className="absolute rounded-full"
                style={{ width:160, height:160,
                  background:`linear-gradient(135deg,${pattern.color}25,${pattern.color}50)`,
                  border:`2px solid ${pattern.color}60`,
                  transform:`scale(${circleScale})`, transition:`transform ${circleDur}s ease-in-out` }}/>
              <div className="relative z-10 text-center">
                {breathing ? (
                  <>
                    <p className="text-5xl font-black tabular-nums" style={{ color:pattern.color }}>{timeLeft}</p>
                    <p className="text-sm font-bold mt-1" style={{ color:pattern.color }}>{phase.l}</p>
                  </>
                ) : (
                  <>
                    <p className="text-5xl">{pattern.emoji}</p>
                    <p className="text-xs text-slate-400 mt-2 font-medium">{pattern.desc}</p>
                  </>
                )}
              </div>
            </div>

            {!breathing && (
              <div className="flex gap-3 mb-6">
                {pattern.phases.map((ph,i) => (
                  <div key={i} className="text-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1"
                      style={{ background:pattern.color+'18' }}>
                      <span className="text-sm font-black" style={{ color:pattern.color }}>{ph.d}s</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">{ph.l}</p>
                  </div>
                ))}
              </div>
            )}

            {breathing && <p className="text-sm text-slate-500 font-semibold mb-5">Ciclo {cycles+1}</p>}

            <button onClick={breathing ? stopBreathing : startBreathing}
              className="px-8 py-3.5 rounded-2xl font-bold text-white text-sm shadow-lg active:scale-95 transition-transform"
              style={{ background:pattern.color }}>
              {breathing ? '⏹ Parar' : '▶ Empezar'}
            </button>
          </div>

          {breathing && showFases && (
            <div className="bg-white rounded-2xl shadow-sm px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Fases</p>
                <button onClick={() => setShowFases(false)}
                  className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xs font-bold">×</button>
              </div>
              <div className="flex gap-2">
                {pattern.phases.map((ph,i) => (
                  <div key={i} className={`flex-1 py-2 rounded-xl text-center text-xs font-bold transition-all
                    ${i===phaseIdx?'text-white shadow':'text-slate-300 bg-slate-50'}`}
                    style={i===phaseIdx?{background:pattern.color}:{}}>
                    {ph.l}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Meditation tab ─────────────────────────────────── */}
      {tab === 'meditate' && (
        <>
          {!meditating && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Duración</p>
              <div className="grid grid-cols-4 gap-2">
                {MED_DURATIONS.map(d => (
                  <button key={d} onClick={() => setMedDuration(d)}
                    className={`py-3 rounded-xl text-sm font-bold transition-all
                      ${medDuration===d?'bg-violet-600 text-white shadow':'bg-slate-50 text-slate-600'}`}>
                    {d}m
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl shadow-sm flex flex-col items-center py-8">
            <div className="relative flex items-center justify-center">
              <Ring progress={meditating ? medLeft/totalMedSecs : 1} color="#7c3aed"/>
              <div className="absolute text-center">
                <p className="text-4xl font-black text-slate-800 tabular-nums">
                  {meditating ? fmtSecs(medLeft) : `${medDuration}m`}
                </p>
                <p className="text-sm font-semibold mt-1 text-violet-500">
                  {meditating ? 'Meditando…' : 'Preparado'}
                </p>
              </div>
            </div>
            <button onClick={meditating ? stopMeditation : startMeditation}
              className={`mt-6 px-8 py-3.5 rounded-2xl font-bold text-white text-sm shadow-lg active:scale-95 transition-all
                ${meditating?'bg-red-500':'bg-violet-600'}`}>
              {meditating ? '⏹ Detener' : '▶ Comenzar'}
            </button>
            {!meditating && <p className="text-xs text-slate-400 mt-3">🔔 Campana al inicio y al final</p>}
          </div>

          {history.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Últimas sesiones</p>
                <p className="text-sm font-bold text-violet-600">{totalThisWeek} min esta semana</p>
              </div>
              <div className="space-y-2.5">
                {history.map(h => (
                  <div key={h.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                        <span className="text-sm">🧘</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{h.duration_min} minutos</p>
                        <p className="text-xs text-slate-400">{fmtDate(h.created_at)}</p>
                      </div>
                    </div>
                    {h.completed && (
                      <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">Completada</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Sounds tab ─────────────────────────────────────── */}
      {tab === 'sounds' && (
        <>
          {/* Active count + stop all */}
          {activeSounds.size > 0 && (
            <div className="bg-teal-50 border border-teal-200 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"/>
                <p className="text-sm font-bold text-teal-700">
                  {activeSounds.size} sonido{activeSounds.size>1?'s':''} activo{activeSounds.size>1?'s':''}
                </p>
              </div>
              <button onClick={stopAllSounds}
                className="text-xs font-bold text-teal-600 bg-teal-100 px-3 py-1.5 rounded-lg active:bg-teal-200">
                Parar todo
              </button>
            </div>
          )}

          {/* Sound grid */}
          <div className="grid grid-cols-2 gap-3">
            {SOUNDS.map(sound => {
              const active = activeSounds.has(sound.id)
              return (
                <button key={sound.id} onClick={() => toggleSound(sound)}
                  className={`flex flex-col items-start gap-2 p-4 rounded-2xl border-2 text-left transition-all active:scale-95
                    ${active ? 'border-transparent text-white shadow-lg' : 'border-slate-100 bg-white'}`}
                  style={active ? { background: sound.color } : {}}>
                  <div className="flex items-center justify-between w-full">
                    <span className="text-2xl">{sound.emoji}</span>
                    <div className="flex items-center gap-1">
                      {sound.headphones && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md
                          ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          🎧
                        </span>
                      )}
                      {active && (
                        <div className="flex gap-0.5 items-end h-4">
                          {[3,5,4,6,3].map((h,i) => (
                            <div key={i} className="w-0.5 bg-white/70 rounded-full animate-pulse"
                              style={{ height:`${h*2}px`, animationDelay:`${i*0.1}s` }}/>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className={`text-sm font-bold leading-tight ${active?'text-white':'text-slate-700'}`}>
                      {sound.name}
                    </p>
                    <p className={`text-[11px] mt-0.5 ${active?'text-white/80':'text-slate-400'}`}>
                      {sound.desc}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {hasBinauralActive && (
            <p className="text-xs text-center text-slate-400 bg-white rounded-xl px-4 py-3 shadow-sm">
              🎧 Los tonos binaurales requieren auriculares para funcionar correctamente
            </p>
          )}

          {activeSounds.size === 0 && (
            <p className="text-center text-slate-400 text-sm pt-2">
              Toca un sonido para activarlo. Puedes combinar varios a la vez.
            </p>
          )}
        </>
      )}
    </div>
  )
}
