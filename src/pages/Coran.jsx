import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Play, Pause, Check } from 'lucide-react'
import { useQuranSettings, loadPage, audioUrl, arabicNumber, pagesToday, withPageRead, TOTAL_PAGES, RECITERS } from '../lib/quran'

// 📖 Corán por páginas del mushaf: marcador, objetivo de páginas al día y audio
// aleya por aleya. Traducción y recitador se eligen en Ajustes.
export default function Coran() {
  const [q, saveQ] = useQuranSettings()
  const [page, setPage]   = useState(q.page || 1)
  const [state, setState] = useState({ key: null, ayahs: [], error: false })
  const [playing, setPlaying] = useState(null)   // índice de la aleya que suena
  const [isPaused, setPaused] = useState(false)
  const audio  = useRef(null)
  const rows   = useRef([])
  const key    = `${page}|${q.translation}`
  const loading = state.key !== key

  useEffect(() => {
    let alive = true
    loadPage(page, q.translation)
      .then(ayahs => alive && setState({ key, ayahs, error: false }))
      .catch(() => alive && setState({ key, ayahs: [], error: true }))
    if (page < TOTAL_PAGES) loadPage(page + 1, q.translation).catch(() => {})   // la siguiente, ya preparada
    return () => { alive = false }
  }, [key])

  // Al salir, que no siga sonando
  useEffect(() => () => audio.current?.pause(), [])

  function stop() {
    audio.current?.pause()
    setPlaying(null)
    setPaused(false)
  }
  function goTo(p) {
    const n = Math.min(TOTAL_PAGES, Math.max(1, p))
    if (n === page) return
    stop()
    setPage(n)
    saveQ({ page: n })   // marcador
    window.scrollTo?.({ top: 0 })
  }
  function readAndNext() {
    saveQ({ log: withPageRead(q, page), page: Math.min(TOTAL_PAGES, page + 1) })
    stop()
    if (page < TOTAL_PAGES) { setPage(page + 1); window.scrollTo?.({ top: 0 }) }
  }

  // Audio: una aleya detrás de otra hasta el final de la página
  function play(i) {
    const list = state.ayahs
    if (i >= list.length) { setPlaying(null); return }
    if (!audio.current) audio.current = new Audio()
    const a = audio.current
    a.onended = () => play(i + 1)
    a.onerror = () => setPlaying(null)
    a.src = audioUrl(q.reciter, list[i].n)
    a.play().catch(() => setPlaying(null))
    setPlaying(i)
    setPaused(false)
    rows.current[i]?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
  function togglePlay() {
    if (playing !== null && !isPaused) { audio.current?.pause(); setPaused(true); return }
    if (playing !== null && isPaused) { audio.current?.play().catch(() => {}); setPaused(false); return }
    play(0)
  }

  const read   = pagesToday(q)
  const goal   = q.goal || 1
  const reached = read.length >= goal
  const first  = state.ayahs[0]
  const surahs = [...new Map(state.ayahs.map(a => [a.s, a.surahEs])).values()]
  const reciter = RECITERS.find(r => r.id === q.reciter)?.label || ''

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Cabecera: página, sura, objetivo y audio */}
      <div className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">📖 Corán</p>
            <p className="text-lg font-black text-slate-800 truncate">{surahs.join(' · ') || '…'}</p>
            <p className="text-xs font-bold text-slate-400">Página {page} de {TOTAL_PAGES}{first ? ` · Juz ${first.juz}` : ''}</p>
          </div>
          <button onClick={togglePlay} disabled={loading || state.error} aria-label={playing !== null && !isPaused ? 'Pausar' : 'Escuchar'}
            className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow disabled:opacity-40">
            {playing !== null && !isPaused ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
          </button>
        </div>
        {playing !== null && <p className="mt-2 text-[11px] font-bold text-emerald-700">🔊 {reciter} · aleya {state.ayahs[playing]?.k}</p>}

        <div className="mt-3">
          <div className="flex items-center justify-between text-xs font-black">
            <span className={reached ? 'text-emerald-600' : 'text-slate-500'}>{reached ? '¡Objetivo de hoy cumplido! 🎉' : 'Objetivo de hoy'}</span>
            <span className="text-slate-400 tabular-nums">{read.length} / {goal} páginas</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1.5">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (read.length / goal) * 100)}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button onClick={() => goTo(page - 1)} disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 text-xs font-black text-slate-600 disabled:opacity-30">
            <ChevronLeft size={15} /> Anterior
          </button>
          <input type="number" inputMode="numeric" min={1} max={TOTAL_PAGES} key={page} defaultValue={page}
            onKeyDown={e => e.key === 'Enter' && goTo(Number(e.target.value) || page)}
            onBlur={e => goTo(Number(e.target.value) || page)}
            className="flex-1 min-w-0 text-center border border-slate-200 rounded-xl py-2 text-sm font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <button onClick={() => goTo(page + 1)} disabled={page >= TOTAL_PAGES}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 text-xs font-black text-slate-600 disabled:opacity-30">
            Siguiente <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Texto */}
      <div className="bg-[#fffdf7] rounded-2xl shadow-sm border border-amber-100 px-4 py-5">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : state.error ? (
          <div className="text-center py-12">
            <p className="text-sm font-bold text-slate-500">No se pudo cargar la página. Revisa tu conexión.</p>
            <button onClick={() => setState({ key: null, ayahs: [], error: false })}
              className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black">Reintentar</button>
          </div>
        ) : (
          <div className="space-y-4">
            {state.ayahs.map((a, i) => (
              <div key={a.n} ref={el => { rows.current[i] = el }}>
                {a.k === 1 && (
                  <div className="text-center my-3 py-3 rounded-xl border-2 border-amber-200 bg-amber-50">
                    <p dir="rtl" className="quran-text text-2xl text-amber-900">{a.surah}</p>
                    <p className="text-[11px] font-bold text-amber-700">{a.surahEs}</p>
                    {a.bism && <p dir="rtl" className="quran-text text-xl text-slate-800 mt-2">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>}
                  </div>
                )}
                <button onClick={() => play(i)} className={`w-full text-right rounded-xl px-2 py-1.5 transition-colors ${playing === i ? 'bg-emerald-50 ring-2 ring-emerald-300' : 'active:bg-amber-50'}`}>
                  <p dir="rtl" className="quran-text text-[26px] leading-[2.1] text-slate-900">
                    {a.text} <span className="text-emerald-700">﴿{arabicNumber(a.k)}﴾</span>
                  </p>
                </button>
                {a.tr && <p className="px-2 mt-1 text-[13px] leading-relaxed text-slate-500"><span className="font-black text-slate-400">{a.k}.</span> {a.tr}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && !state.error && (
        <button onClick={readAndNext}
          className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center gap-2 shadow-sm active:bg-emerald-700">
          <Check size={17} strokeWidth={3} />
          {read.includes(page) ? 'Página ya leída hoy' : 'Página leída'}{page < TOTAL_PAGES ? ' · siguiente' : ''}
        </button>
      )}
      <p className="text-center text-[11px] text-slate-400">Toca una aleya para escucharla desde ahí. Traducción y recitador, en Ajustes.</p>
    </div>
  )
}
