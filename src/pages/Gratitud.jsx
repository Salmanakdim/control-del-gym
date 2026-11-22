import { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { Camera, Plus, X, Shuffle, Check, ChevronRight, Play } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { appToday } from '../lib/pathConfig'
import { uploadVisionImage, deleteVisionImage } from '../lib/vision'
import { LEVELS, promptOf, useGratitud, buildSlides, loadEntries, saveEntry, daysAgo } from '../lib/gratitud'
import MicButton from '../components/MicButton'

const noScrollbar = { scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }

// 🤲 Gratitud: tres niveles con tus fotos y lo que escribes hoy. El recorrido se
// desliza con el dedo como las historias: portada, fotos y escribir, nivel tras nivel,
// y al final un momento para sentirlo (respirar + Alhamdulillah).
export default function Gratitud({ onDone }) {
  const { user } = useAuth()
  const [g, saveG] = useGratitud()
  const photos = g.photos || {}
  const captions = g.captions || {}
  const [entries, setEntries] = useState(null)
  const [today, setToday] = useState({ salud: '', familia: '', logros: '' })
  const [error, setError] = useState('')
  const [journey, setJourney] = useState(null)   // índice de la pantalla donde empieza
  const [moment, setMoment] = useState(false)
  const [managing, setManaging] = useState(null)

  useEffect(() => {
    if (!user) return
    loadEntries(user.id).then(rows => {
      setEntries(rows)
      const t = rows.find(r => r.date === appToday())
      if (t) setToday({ salud: t.salud, familia: t.familia, logros: t.logros })
    }).catch(err => {
      setEntries([])
      setError(/gratitude_entries|relation|schema cache/i.test(String(err?.message))
        ? 'Falta preparar la tabla: ejecuta supabase_gratitud.sql en Supabase.'
        : 'No se pudo cargar tu gratitud. Revisa la conexión.')
    })
  }, [user])

  // Guardar mientras escribes (un momento después de parar)
  const timers = useRef({})
  function write(level, text) {
    setToday(t => ({ ...t, [level]: text }))
    clearTimeout(timers.current[level])
    timers.current[level] = setTimeout(() => {
      saveEntry(user.id, appToday(), level, text.trim()).catch(() => setError('No se pudo guardar. Revisa la conexión.'))
    }, 800)
  }

  const slides = useMemo(() => buildSlides(g.photos || {}), [g.photos])
  const startAt = (levelId, url) => setJourney(Math.max(0, slides.findIndex(s =>
    s.level.id === levelId && (url ? s.url === url : s.kind === 'title'))))
  const written = LEVELS.filter(l => today[l.id].trim()).length
  const allPhotos = LEVELS.flatMap(l => photos[l.id] || [])

  if (managing) {
    const level = LEVELS.find(l => l.id === managing)
    return <ManagePhotos level={level} list={photos[level.id] || []} captions={captions} userId={user.id}
      onChange={(list, caps = captions) => saveG({ photos: { ...photos, [level.id]: list }, captions: caps })}
      onClose={() => setManaging(null)} />
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">🤲 Gratitud de hoy</p>
        <p className="text-xs font-black text-slate-500">{written} de 3</p>
      </div>
      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

      <button onClick={() => setJourney(0)}
        className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-rose-500 to-amber-500 text-white font-black text-sm shadow flex items-center justify-center gap-2">
        <Play size={16} fill="currentColor" /> Empezar el recorrido
      </button>

      {LEVELS.map(l => (
        <LevelCard key={l.id} level={l} photos={photos[l.id] || []} value={today[l.id]}
          onWrite={t => write(l.id, t)} onPhotos={() => setManaging(l.id)} onOpen={url => startAt(l.id, url)} />
      ))}

      <button onClick={() => setMoment(true)} disabled={written < 3}
        className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-sm shadow disabled:opacity-35">
        {written < 3 ? `Escribe los tres niveles (${written}/3)` : '🤲 Sentirlo un momento'}
      </button>

      {entries && <Memory entries={entries} />}

      {journey !== null && (
        <Journey slides={slides} start={journey} captions={captions} today={today} onWrite={write}
          onFinish={() => { setJourney(null); setMoment(true) }} onClose={() => setJourney(null)} />
      )}
      {moment && <Moment photos={allPhotos} today={today}
        onFinish={() => { setMoment(false); onDone?.() }} onClose={() => setMoment(false)} />}
    </div>
  )
}

// Índice de la pantalla visible en un carrusel horizontal
const pageOf = el => Math.round(el.scrollLeft / el.clientWidth)

function LevelCard({ level, photos, value, onWrite, onPhotos, onOpen }) {
  const [i, setI] = useState(0)
  const done = value.trim()
  return (
    <div className="rounded-3xl overflow-hidden shadow-sm bg-white">
      <div className={`relative h-80 bg-gradient-to-br ${level.color}`}>
        {photos.length ? (
          <div className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory" style={noScrollbar}
            onScroll={e => setI(pageOf(e.currentTarget))}>
            {photos.map(url => (
              <button key={url} onClick={() => onOpen(url)} aria-label="Ver a pantalla completa"
                className="flex-none w-full h-full snap-center">
                <img src={url} alt="" className="w-full h-full object-cover" draggable={false} />
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => onOpen(null)} className="absolute inset-0 flex items-center justify-center text-7xl opacity-40" aria-label="Abrir">
            {level.emoji}
          </button>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
        {photos.length > 1 && (
          <div className="absolute top-4 left-4 flex gap-1.5 pointer-events-none">
            {photos.map((u, k) => <span key={u} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />)}
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 p-4 text-white pointer-events-none">
          <p className="text-lg font-black flex items-center gap-2">
            {level.emoji} {level.title}
            {done && <span className="w-5 h-5 rounded-full bg-white text-emerald-600 flex items-center justify-center"><Check size={13} strokeWidth={4} /></span>}
          </p>
          <p className="text-sm font-semibold text-white/85 leading-snug">{promptOf(level)}</p>
        </div>
        <button onClick={onPhotos} aria-label="Fotos de este nivel"
          className="absolute z-10 top-3 right-3 h-9 px-3 rounded-full bg-black/45 backdrop-blur text-white text-xs font-black flex items-center gap-1.5 active:bg-black/65">
          <Camera size={15} /> {photos.length || 'Añadir fotos'}
        </button>
      </div>
      <div className="flex items-start gap-2 px-4 py-3">
        <textarea value={value} onChange={e => onWrite(e.target.value)} rows={2} placeholder="Doy gracias por…"
          className="flex-1 text-[15px] text-slate-800 placeholder:text-slate-400 resize-none outline-none" />
        <MicButton lang="es-ES" onText={t => onWrite((value ? value.trimEnd() + ' ' : '') + t)} />
      </div>
    </div>
  )
}

// El recorrido a pantalla completa: se desliza con el dedo (o tocando los lados de una foto)
function Journey({ slides, start, captions, today, onWrite, onFinish, onClose }) {
  const ref = useRef(null)
  const [idx, setIdx] = useState(start)
  useLayoutEffect(() => { ref.current.scrollLeft = start * ref.current.clientWidth }, [start])
  const go = i => ref.current.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' })
  const cur = slides[idx] || slides[0]

  function next() {
    if (idx < slides.length - 1) return go(idx + 1)
    const missing = LEVELS.find(l => !today[l.id].trim())
    if (missing) return go(slides.findIndex(s => s.kind === 'write' && s.level.id === missing.id))
    onFinish()
  }

  // Barras de arriba: una por nivel, se llena según por dónde vas dentro de él
  const bars = LEVELS.map(l => {
    const first = slides.findIndex(s => s.level.id === l.id)
    const count = slides.filter(s => s.level.id === l.id).length
    const fill = idx < first ? 0 : idx >= first + count ? 1 : (idx - first + 1) / count
    return { l, fill }
  })

  return (
    <div className="fixed inset-0 z-[60] bg-black text-white">
      <div ref={ref} className="h-full flex overflow-x-auto snap-x snap-mandatory" style={noScrollbar}
        onScroll={e => setIdx(pageOf(e.currentTarget))}>
        {slides.map((s, k) => (
          <div key={k} className="relative flex-none w-full h-full snap-center snap-always overflow-hidden">
            {s.kind === 'photo' && <PhotoSlide s={s} caption={captions[s.url]} onPrev={() => go(k - 1)} onNext={next} />}
            {s.kind === 'title' && <TitleSlide s={s} />}
            {s.kind === 'write' && (
              <WriteSlide s={s} value={today[s.level.id]} onWrite={t => onWrite(s.level.id, t)} onNext={next}
                last={k === slides.length - 1} active={k === idx} />
            )}
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 top-0 px-3 pointer-events-none" style={{ paddingTop: 'calc(0.6rem + env(safe-area-inset-top))' }}>
        <div className="flex gap-1.5">
          {bars.map(({ l, fill }) => (
            <div key={l.id} className="flex-1 h-1 rounded-full bg-white/30 overflow-hidden">
              <div className="h-full bg-white transition-all duration-300" style={{ width: `${fill * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm font-black drop-shadow">{cur.level.emoji} {cur.level.title}</p>
          <button onClick={onClose} aria-label="Cerrar"
            className="pointer-events-auto w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center"><X size={18} /></button>
        </div>
      </div>
    </div>
  )
}

function TitleSlide({ s }) {
  return (
    <div className={`h-full bg-gradient-to-br ${s.level.color} flex flex-col items-center justify-center px-8 text-center`}>
      <p className="text-8xl">{s.level.emoji}</p>
      <p className="mt-6 text-3xl font-black">{s.level.title}</p>
      <p className="mt-3 text-lg font-semibold text-white/90 leading-snug">{promptOf(s.level)}</p>
      <p className="mt-10 text-sm font-black text-white/70 flex items-center gap-1">Desliza <ChevronRight size={16} /></p>
    </div>
  )
}

function PhotoSlide({ s, caption, onPrev, onNext }) {
  return (
    <>
      <img src={s.url} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/40 pointer-events-none" />
      {/* Tocar a la izquierda o a la derecha también pasa de foto */}
      <button onClick={onPrev} aria-label="Anterior" className="absolute left-0 inset-y-0 w-1/4" />
      <button onClick={onNext} aria-label="Siguiente" className="absolute right-0 inset-y-0 w-1/4" />
      {caption && (
        <p className="absolute inset-x-0 px-6 text-center text-xl font-black leading-snug drop-shadow-lg pointer-events-none"
          style={{ bottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}>{caption}</p>
      )}
    </>
  )
}

function WriteSlide({ s, value, onWrite, onNext, last, active }) {
  const ref = useRef(null)
  // Al llegar a esta pantalla, el cursor ya está listo para escribir (si aún está vacía)
  useEffect(() => {
    if (active && !value.trim()) setTimeout(() => ref.current?.focus({ preventScroll: true }), 350)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className={`h-full bg-gradient-to-br ${s.level.color} flex flex-col justify-center px-6`}
      style={{ paddingTop: 'calc(4.5rem + env(safe-area-inset-top))', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      <p className="text-5xl">{s.level.emoji}</p>
      <p className="mt-3 text-2xl font-black leading-snug">{promptOf(s.level)}</p>
      <div className="mt-5 rounded-3xl bg-white/95 text-slate-800 p-4 shadow-lg">
        <textarea ref={ref} value={value} onChange={e => onWrite(e.target.value)} rows={4} placeholder="Doy gracias por…"
          className="w-full bg-transparent text-[17px] placeholder:text-slate-400 resize-none outline-none" />
        <div className="flex justify-end">
          <MicButton lang="es-ES" size={18} className="!w-10 !h-10"
            onText={t => onWrite((value ? value.trimEnd() + ' ' : '') + t)} />
        </div>
      </div>
      <button onClick={() => { ref.current?.blur(); onNext() }}
        className="mt-5 w-full py-4 rounded-2xl bg-white text-slate-900 font-black text-sm shadow-lg flex items-center justify-center gap-1">
        {last ? '🤲 Terminar' : <>Siguiente nivel <ChevronRight size={17} /></>}
      </button>
    </div>
  )
}

function ManagePhotos({ level, list, captions, userId, onChange, onClose }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function pick(e) {
    const files = [...(e.target.files || [])]
    e.target.value = ''
    if (!files.length) return
    setBusy(true); setError('')
    try {
      const urls = []
      for (const f of files) urls.push(await uploadVisionImage(f, userId, 'gratitud'))
      onChange([...list, ...urls])
    } catch (err) {
      setError(/bucket|not found|row-level|policy/i.test(String(err?.message))
        ? 'Falta preparar el almacén de fotos: ejecuta supabase_vision_storage.sql en Supabase.'
        : 'No se pudo subir la foto. Inténtalo otra vez.')
    }
    setBusy(false)
  }
  function remove(url) {
    const caps = { ...captions }
    delete caps[url]
    onChange(list.filter(u => u !== url), caps)
    deleteVisionImage(url)
  }
  function setCaption(url, text) {
    if ((captions[url] || '') === text.trim()) return
    onChange(list, { ...captions, [url]: text.trim() })
  }
  return (
    <div className="max-w-xl mx-auto space-y-3">
      <p className="text-lg font-black text-slate-800">{level.emoji} Fotos · {level.title}</p>
      <p className="text-xs text-slate-500">
        {level.id === 'salud' && 'Tú entrenando, en la naturaleza, sano y con energía.'}
        {level.id === 'familia' && 'Fotos reales de tu familia: las que más te emocionan.'}
        {level.id === 'logros' && 'Lo que has conseguido: tu negocio, tu casa, tu coche, un viaje, un título…'}
        {' '}Debajo de cada una puedes escribir su historia.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {list.map(url => (
          <div key={url} className="rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="relative aspect-[3/4] bg-slate-200">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button onClick={() => remove(url)} aria-label="Quitar foto"
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center">
                <X size={14} strokeWidth={3} />
              </button>
            </div>
            <input defaultValue={captions[url] || ''} onBlur={e => setCaption(url, e.target.value)}
              placeholder="Frase de esta foto…" className="w-full px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none" />
          </div>
        ))}
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 flex flex-col items-center justify-center gap-1 active:bg-slate-50 disabled:opacity-50">
          {busy
            ? <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            : <><Plus size={22} /><span className="text-[11px] font-black">Añadir fotos</span></>}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={pick} />
      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
      <button onClick={onClose} className="w-full py-3 rounded-2xl bg-slate-900 text-white font-black text-sm">Listo</button>
    </div>
  )
}

// Del tarro: algo que agradeciste otro día
function Memory({ entries }) {
  const pool = useMemo(() => entries.filter(e => e.date !== appToday()).flatMap(e =>
    LEVELS.filter(l => e[l.id]?.trim()).map(l => ({ date: e.date, level: l, text: e[l.id] }))), [entries])
  const [k, setK] = useState(() => Math.floor(Math.random() * 1e6))
  if (!pool.length) {
    return <p className="text-center text-xs text-slate-400 px-6">Cada día que escribas se guarda en tu tarro de gratitud. Aquí te iré recordando lo que agradeciste.</p>
  }
  const m = pool[k % pool.length]
  const n = daysAgo(m.date)
  return (
    <div className="rounded-3xl bg-amber-50 border border-amber-200 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest">🫙 De tu tarro de gratitud</p>
        {pool.length > 1 && (
          <button onClick={() => setK(x => x + 1 + Math.floor(Math.random() * (pool.length - 1)))} aria-label="Otro recuerdo"
            className="w-8 h-8 rounded-full bg-white text-amber-700 flex items-center justify-center shadow-sm"><Shuffle size={14} /></button>
        )}
      </div>
      <p className="text-xs font-bold text-amber-700/80 mt-1">{m.level.emoji} Hace {n} {n === 1 ? 'día' : 'días'} agradeciste:</p>
      <p className="text-[15px] font-semibold text-slate-800 mt-1">«{m.text}»</p>
    </div>
  )
}

// Fotos que se van cambiando solas con un fundido (solo de fondo en el momento final)
function Fade({ photos, every = 5000 }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (photos.length < 2) return
    const t = setInterval(() => setI(n => n + 1), every)
    return () => clearInterval(t)
  }, [photos.length, every])
  const cur = photos.length ? i % photos.length : -1
  return photos.map((src, k) => (
    <img key={src} src={src} alt="" className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
      style={{ opacity: k === cur ? 1 : 0 }} />
  ))
}

// El momento de sentirlo: tus fotos de fondo, respirar y Alhamdulillah
function Moment({ photos, today, onFinish, onClose }) {
  const [step, setStep] = useState(0)    // 0..2 respiraciones, 3 = Alhamdulillah
  const [go, setGo] = useState(false)    // el círculo empieza pequeño y crece
  useEffect(() => { const r = requestAnimationFrame(() => setGo(true)); return () => cancelAnimationFrame(r) }, [])
  useEffect(() => {
    if (step >= 3) return
    const t = setTimeout(() => setStep(s => s + 1), 5000)
    return () => clearTimeout(t)
  }, [step])
  const lines = LEVELS.map(l => ({ l, text: today[l.id].trim() }))
  return (
    <div className="fixed inset-0 z-[60] bg-black text-white overflow-hidden">
      <div className="absolute inset-0 scale-110"><Fade photos={photos} /></div>
      <div className="absolute inset-0 bg-black/55" />
      <button onClick={onClose} aria-label="Cerrar"
        className="absolute right-4 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center z-10"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}><X size={18} /></button>
      <div className="relative h-full flex flex-col items-center justify-center px-6 text-center">
        {step < 3 ? (
          <>
            <div className="w-40 h-40 rounded-full border-4 border-white/70 bg-white/10 transition-transform ease-in-out"
              style={{ transform: `scale(${!go || step % 2 ? 0.6 : 1.15})`, transitionDuration: '5000ms' }} />
            <p className="mt-10 text-xl font-black">{step % 2 ? 'Suelta el aire despacio…' : 'Respira hondo…'}</p>
            <p className="mt-6 text-base font-semibold text-white/90 max-w-sm min-h-[3rem]">
              {lines[step].l.emoji} {lines[step].text}
            </p>
          </>
        ) : (
          <>
            <p className="text-5xl font-black quran-text" dir="rtl">الحمد لله</p>
            <p className="mt-3 text-2xl font-black">Alhamdulillah</p>
            <div className="mt-8 space-y-2 max-w-sm">
              {lines.map(({ l, text }) => <p key={l.id} className="text-sm font-semibold text-white/85">{l.emoji} {text}</p>)}
            </div>
            <button onClick={onFinish}
              className="mt-10 px-8 py-4 rounded-2xl bg-white text-slate-900 font-black text-sm shadow-lg">
              Hecho 🤲
            </button>
          </>
        )}
      </div>
    </div>
  )
}
