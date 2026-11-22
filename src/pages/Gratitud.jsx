import { useState, useEffect, useRef, useMemo } from 'react'
import { Camera, Plus, X, Shuffle, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { appToday } from '../lib/pathConfig'
import { uploadVisionImage, deleteVisionImage } from '../lib/vision'
import { LEVELS, promptOf, useGratitudPhotos, loadEntries, saveEntry, daysAgo } from '../lib/gratitud'

// 🤲 Gratitud: tres niveles, cada uno con tus fotos de fondo y lo que escribes hoy.
// Con los tres escritos, un momento para sentirlo (respirar + Alhamdulillah).
export default function Gratitud({ onDone }) {
  const { user } = useAuth()
  const [photos, savePhotos] = useGratitudPhotos()
  const [entries, setEntries] = useState(null)        // días anteriores (y hoy)
  const [today, setToday] = useState({ salud: '', familia: '', logros: '' })
  const [error, setError] = useState('')
  const [moment, setMoment] = useState(false)
  const [managing, setManaging] = useState(null)     // nivel cuyas fotos se editan

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

  const written = LEVELS.filter(l => today[l.id].trim()).length
  const allPhotos = LEVELS.flatMap(l => photos[l.id] || [])

  if (managing) {
    const level = LEVELS.find(l => l.id === managing)
    return <ManagePhotos level={level} list={photos[level.id] || []} userId={user.id}
      onChange={list => savePhotos({ ...photos, [level.id]: list })} onClose={() => setManaging(null)} />
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">🤲 Gratitud de hoy</p>
        <p className="text-xs font-black text-slate-500">{written} de 3</p>
      </div>
      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

      {LEVELS.map((l, i) => (
        <LevelCard key={l.id} level={l} offset={i} photos={photos[l.id] || []} value={today[l.id]}
          onWrite={t => write(l.id, t)} onPhotos={() => setManaging(l.id)} />
      ))}

      <button onClick={() => setMoment(true)} disabled={written < 3}
        className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black text-sm shadow disabled:opacity-35">
        {written < 3 ? `Escribe los tres niveles (${written}/3)` : '🤲 Sentirlo un momento'}
      </button>

      {entries && <Memory entries={entries} />}

      {moment && <Moment photos={allPhotos} today={today}
        onFinish={() => { setMoment(false); onDone?.() }} onClose={() => setMoment(false)} />}
    </div>
  )
}

// Fotos que se van cambiando solas con un fundido
function Slideshow({ photos, offset = 0, every = 4500 }) {
  const [i, setI] = useState(offset)
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

function LevelCard({ level, offset, photos, value, onWrite, onPhotos }) {
  const done = value.trim()
  return (
    <div className="rounded-3xl overflow-hidden shadow-sm bg-white">
      <div className={`relative h-56 bg-gradient-to-br ${level.color}`}>
        <Slideshow photos={photos} offset={offset} every={4500 + offset * 700} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" />
        {!photos.length && <p className="absolute inset-0 flex items-center justify-center text-7xl opacity-40 pointer-events-none">{level.emoji}</p>}
        <div className="absolute bottom-0 inset-x-0 p-4 text-white pointer-events-none">
          <p className="text-lg font-black flex items-center gap-2">
            {level.emoji} {level.title}
            {done && <span className="w-5 h-5 rounded-full bg-white text-emerald-600 flex items-center justify-center"><Check size={13} strokeWidth={4} /></span>}
          </p>
          <p className="text-sm font-semibold text-white/85 leading-snug">{promptOf(level)}</p>
        </div>
        {/* El botón va el último y por encima: nada de la tarjeta le quita el toque */}
        <button onClick={onPhotos} aria-label="Fotos de este nivel"
          className="absolute z-10 top-3 right-3 h-9 px-3 rounded-full bg-black/45 backdrop-blur text-white text-xs font-black flex items-center gap-1.5 active:bg-black/65">
          <Camera size={15} /> {photos.length || 'Añadir fotos'}
        </button>
      </div>
      <textarea value={value} onChange={e => onWrite(e.target.value)} rows={2}
        placeholder="Doy gracias por…"
        className="w-full px-4 py-3 text-[15px] text-slate-800 placeholder:text-slate-400 resize-none outline-none" />
    </div>
  )
}

function ManagePhotos({ level, list, userId, onChange, onClose }) {
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
    onChange(list.filter(u => u !== url))
    deleteVisionImage(url)
  }
  return (
    <div className="max-w-xl mx-auto space-y-3">
      <p className="text-lg font-black text-slate-800">{level.emoji} Fotos · {level.title}</p>
      <p className="text-xs text-slate-500">
        {level.id === 'salud' && 'Tú entrenando, en la naturaleza, sano y con energía.'}
        {level.id === 'familia' && 'Fotos reales de tu familia: las que más te emocionan.'}
        {level.id === 'logros' && 'Lo que has conseguido: tu negocio, tu casa, tu coche, un viaje, un título…'}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {list.map(url => (
          <div key={url} className="relative aspect-[4/5] rounded-xl overflow-hidden bg-slate-200">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button onClick={() => remove(url)} aria-label="Quitar foto"
              className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center">
              <X size={14} strokeWidth={3} />
            </button>
          </div>
        ))}
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="aspect-[4/5] rounded-xl border-2 border-dashed border-slate-300 text-slate-400 flex flex-col items-center justify-center gap-1 active:bg-slate-50 disabled:opacity-50">
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
  const breathing = step < 3
  return (
    <div className="fixed inset-0 z-[60] bg-black text-white overflow-hidden">
      <div className="absolute inset-0 scale-110"><Slideshow photos={photos} every={5000} /></div>
      <div className="absolute inset-0 bg-black/55" />
      <button onClick={onClose} aria-label="Cerrar"
        className="absolute right-4 w-10 h-10 rounded-full bg-white/15 flex items-center justify-center z-10"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}><X size={18} /></button>
      <div className="relative h-full flex flex-col items-center justify-center px-6 text-center">
        {breathing ? (
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
