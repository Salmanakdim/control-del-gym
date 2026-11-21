import { useRef, useState } from 'react'
import { Pencil, Play, Plus, Trash2, ChevronUp, ChevronDown, SkipBack, SkipForward, RotateCcw, ArrowLeft, Check } from 'lucide-react'
import { useAdhkar, newList, newItem, readProgress, writeProgress, listForStop, isArabic } from '../lib/adhkar'

// 📿 Adhkar: tus frases con su número de repeticiones. Se toca el botón grande para
// contar; al llegar a 0 pasa sola a la siguiente, y se puede saltar aunque no esté hecha.
// item: la parada que abrió la sección (si su nombre incluye el de una lista, se abre esa).
export default function Adhkar({ item }) {
  const [lists, saveLists] = useAdhkar()
  const [view, setView] = useState(() => {
    const byStop = item && listForStop(lists, item.label)
    if (byStop) return { mode: 'run', id: byStop.id }
    if (lists.length === 1 && lists[0].items.length) return { mode: 'run', id: lists[0].id }
    return { mode: 'pick' }
  })
  const list = lists.find(l => l.id === view.id)

  if (view.mode === 'edit' && list) {
    return <EditList list={list}
      onSave={l => { saveLists(lists.map(x => (x.id === l.id ? l : x))); setView({ mode: 'pick' }) }}
      onDelete={() => { saveLists(lists.filter(x => x.id !== list.id)); setView({ mode: 'pick' }) }}
      onCancel={() => setView({ mode: 'pick' })} />
  }
  if (view.mode === 'run' && list) {
    return <RunList key={list.id} list={list} onBack={() => setView({ mode: 'pick' })} onEdit={() => setView({ mode: 'edit', id: list.id })} />
  }

  // Elegir lista
  return (
    <div className="max-w-xl mx-auto space-y-3">
      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">📿 Adhkar</p>
      {lists.map(l => {
        const n = l.items.filter(i => i.text.trim()).length
        return (
          <div key={l.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-slate-800 truncate">{l.name || 'Sin nombre'}</p>
              <p className="text-xs font-bold text-slate-400">{n} frase{n === 1 ? '' : 's'} · {l.items.reduce((s, i) => s + (i.text.trim() ? i.count : 0), 0)} repeticiones</p>
            </div>
            <button onClick={() => setView({ mode: 'edit', id: l.id })} aria-label="Editar lista"
              className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center"><Pencil size={16} /></button>
            <button onClick={() => setView({ mode: 'run', id: l.id })} disabled={!n}
              className="px-4 h-10 rounded-xl bg-emerald-600 text-white text-sm font-black flex items-center gap-1.5 disabled:opacity-30">
              <Play size={14} fill="currentColor" /> Empezar
            </button>
          </div>
        )
      })}
      <button onClick={() => { const l = newList(); saveLists([...lists, l]); setView({ mode: 'edit', id: l.id }) }}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-black flex items-center justify-center gap-1.5">
        <Plus size={16} /> Nueva lista
      </button>
      <p className="text-[11px] text-slate-400 text-center">Si una parada se llama, por ejemplo, "Adhkar mañana" y tienes una lista "Mañana", se abre esa directamente.</p>
    </div>
  )
}

// ── Repetir ────────────────────────────────────────────────────────
function RunList({ list, onBack, onEdit }) {
  const items = list.items.filter(i => i.text.trim())
  const [prog, setProg] = useState(() => readProgress(list.id))
  const advancing = useRef(null)

  function update(next) {
    setProg(next)
    writeProgress(list.id, next)
  }
  const countOf = it => prog.counts[it.id] || 0
  const finished = prog.idx >= items.length
  const cur = items[prog.idx]

  function goTo(idx) {
    clearTimeout(advancing.current)
    update({ ...prog, idx: Math.max(0, Math.min(items.length, idx)) })
  }
  function tap() {
    if (!cur) return
    const n = countOf(cur)
    if (n >= cur.count) return
    const counts = { ...prog.counts, [cur.id]: n + 1 }
    if (n + 1 >= cur.count) {
      navigator.vibrate?.([60, 40, 140])
      update({ ...prog, counts })
      // Completa: pasa sola a la siguiente
      clearTimeout(advancing.current)
      advancing.current = setTimeout(() => update({ idx: prog.idx + 1, counts }), 500)
    } else {
      navigator.vibrate?.(12)
      update({ ...prog, counts })
    }
  }

  const header = (
    <div className="flex items-center gap-2">
      <button onClick={onBack} aria-label="Mis listas" className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-500"><ArrowLeft size={17} /></button>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">📿 Adhkar</p>
        <p className="text-sm font-black text-slate-800 truncate">{list.name}</p>
      </div>
      <button onClick={onEdit} aria-label="Editar lista" className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-500"><Pencil size={15} /></button>
    </div>
  )

  if (finished) {
    const full = items.filter(it => countOf(it) >= it.count)
    const partial = items.filter(it => countOf(it) < it.count)
    return (
      <div className="max-w-xl mx-auto space-y-4">
        {header}
        <div className="bg-white rounded-3xl shadow-sm p-6 text-center">
          <p className="text-4xl">🤲</p>
          <p className="mt-2 text-xl font-black text-slate-800">{partial.length ? 'Lista terminada' : '¡Completa! Que Allah lo acepte'}</p>
          <p className="mt-1 text-sm font-bold text-slate-500">{full.length} completa{full.length === 1 ? '' : 's'}{partial.length ? ` · ${partial.length} a medias` : ''}</p>
          {partial.length > 0 && (
            <div className="mt-4 space-y-1.5 text-left">
              {partial.map(it => (
                <button key={it.id} onClick={() => goTo(items.indexOf(it))}
                  className="w-full flex items-center justify-between gap-2 bg-amber-50 rounded-xl px-3 py-2">
                  <span dir="auto" className={`truncate text-slate-700 ${isArabic(it.text) ? 'quran-text text-lg' : 'text-sm font-bold'}`}>{it.text}</span>
                  <span className="flex-shrink-0 text-xs font-black text-amber-700 tabular-nums">{countOf(it)}/{it.count}</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-slate-400">Si vienes desde el camino, pulsa "Hecho" abajo para marcar la parada.</p>
        </div>
        <button onClick={() => update({ idx: 0, counts: {} })}
          className="w-full py-3 rounded-2xl bg-white shadow-sm text-sm font-black text-slate-600 flex items-center justify-center gap-1.5">
          <RotateCcw size={15} /> Empezar de nuevo
        </button>
      </div>
    )
  }

  const n = countOf(cur)
  const left = Math.max(0, cur.count - n)
  const R = 92, C = 2 * Math.PI * R
  return (
    <div className="max-w-xl mx-auto space-y-4">
      {header}

      {/* Puntos: una por frase (verde completa, ámbar a medias) */}
      <div className="flex justify-center gap-1.5 flex-wrap">
        {items.map((it, i) => {
          const c = countOf(it)
          return <button key={it.id} onClick={() => goTo(i)} aria-label={`Frase ${i + 1}`}
            className={`h-2.5 rounded-full transition-all ${i === prog.idx ? 'w-6' : 'w-2.5'} ${c >= it.count ? 'bg-emerald-500' : c > 0 ? 'bg-amber-400' : 'bg-slate-300'}`} />
        })}
      </div>
      <p className="text-center text-xs font-black text-slate-400">Frase {prog.idx + 1} de {items.length}</p>

      <div className="bg-[#fffdf7] border border-amber-100 rounded-3xl shadow-sm px-5 py-6 text-center">
        <p dir="auto" className={`text-slate-900 ${isArabic(cur.text) ? 'quran-text text-[32px] leading-[1.9]' : 'text-2xl font-black leading-snug'}`}>{cur.text}</p>
        {cur.note && <p className="mt-2 text-sm font-semibold text-slate-500">{cur.note}</p>}
      </div>

      {/* Botón grande: cada toque cuenta una */}
      <div className="flex justify-center py-2">
        <button onClick={tap} aria-label="Contar"
          className="relative w-56 h-56 rounded-full bg-emerald-600 text-white active:scale-95 transition-transform select-none"
          style={{ boxShadow: '0 8px 0 #047857', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}>
          <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
            <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="8" />
            <circle cx="100" cy="100" r={R} fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - n / cur.count)} style={{ transition: 'stroke-dashoffset .15s' }} />
          </svg>
          <span className="relative block text-6xl font-black tabular-nums">{left || <Check size={64} strokeWidth={3} className="mx-auto" />}</span>
          <span className="relative block text-xs font-black text-white/75 mt-1">{n} de {cur.count}</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => goTo(prog.idx - 1)} disabled={prog.idx === 0}
          className="py-3 rounded-2xl bg-white shadow-sm text-xs font-black text-slate-600 flex flex-col items-center gap-0.5 disabled:opacity-30">
          <SkipBack size={17} /> Anterior
        </button>
        <button onClick={() => update({ ...prog, counts: { ...prog.counts, [cur.id]: 0 } })} disabled={!n}
          className="py-3 rounded-2xl bg-white shadow-sm text-xs font-black text-slate-600 flex flex-col items-center gap-0.5 disabled:opacity-30">
          <RotateCcw size={17} /> Reiniciar
        </button>
        <button onClick={() => goTo(prog.idx + 1)}
          className="py-3 rounded-2xl bg-white shadow-sm text-xs font-black text-slate-600 flex flex-col items-center gap-0.5">
          <SkipForward size={17} /> {prog.idx + 1 < items.length ? 'Siguiente' : 'Terminar'}
        </button>
      </div>
    </div>
  )
}

// ── Editar una lista ───────────────────────────────────────────────
const COUNTS = [1, 3, 7, 10, 33, 100]

function EditList({ list, onSave, onDelete, onCancel }) {
  const [l, setL] = useState(() => ({ ...list, items: list.items.map(i => ({ ...i })) }))
  const [askDelete, setAskDelete] = useState(false)
  const setItem = (id, changes) => setL(x => ({ ...x, items: x.items.map(i => (i.id === id ? { ...i, ...changes } : i)) }))
  function move(i, d) {
    const items = [...l.items]
    const j = i + d
    if (j < 0 || j >= items.length) return
    ;[items[i], items[j]] = [items[j], items[i]]
    setL({ ...l, items })
  }

  return (
    <div className="max-w-xl mx-auto space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onCancel} aria-label="Volver" className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-500"><ArrowLeft size={17} /></button>
        <p className="flex-1 text-sm font-black text-slate-800">Editar lista</p>
        <button onClick={() => onSave({ ...l, name: l.name.trim() || 'Sin nombre' })}
          className="px-4 h-9 rounded-xl bg-blue-600 text-white text-sm font-black">Guardar</button>
      </div>

      <label className="block bg-white rounded-2xl shadow-sm p-4">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wide">Nombre de la lista</span>
        <input value={l.name} onChange={e => setL({ ...l, name: e.target.value })} placeholder="Ej: Mañana"
          className="mt-1.5 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </label>

      {l.items.map((it, i) => (
        <div key={it.id} className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <div className="flex items-center gap-1">
            <span className="flex-1 text-[11px] font-black text-slate-400 uppercase tracking-wide">Frase {i + 1}</span>
            <button onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className="w-8 h-8 rounded-lg text-slate-400 flex items-center justify-center disabled:opacity-20"><ChevronUp size={17} /></button>
            <button onClick={() => move(i, 1)} disabled={i === l.items.length - 1} aria-label="Bajar" className="w-8 h-8 rounded-lg text-slate-400 flex items-center justify-center disabled:opacity-20"><ChevronDown size={17} /></button>
            <button onClick={() => setL({ ...l, items: l.items.filter(x => x.id !== it.id) })} aria-label="Quitar frase" className="w-8 h-8 rounded-lg text-slate-300 hover:text-red-500 flex items-center justify-center"><Trash2 size={15} /></button>
          </div>
          <textarea value={it.text} onChange={e => setItem(it.id, { text: e.target.value })} dir="auto" rows={2} placeholder="Escribe la frase"
            className={`w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isArabic(it.text) ? 'quran-text text-xl' : 'text-sm font-semibold'}`} />
          <input value={it.note} onChange={e => setItem(it.id, { note: e.target.value })} placeholder="Nota o traducción (opcional)"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1">Veces</span>
            <input type="number" inputMode="numeric" min={1} value={it.count}
              onChange={e => setItem(it.id, { count: Math.max(1, Math.min(9999, Number(e.target.value) || 1)) })}
              className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-black text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {COUNTS.map(c => (
              <button key={c} onClick={() => setItem(it.id, { count: c })}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-black ${it.count === c ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{c}</button>
            ))}
          </div>
        </div>
      ))}

      <button onClick={() => setL({ ...l, items: [...l.items, newItem()] })}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 text-sm font-black flex items-center justify-center gap-1.5">
        <Plus size={16} /> Añadir frase
      </button>

      {askDelete ? (
        <div className="flex gap-2">
          <button onClick={onDelete} className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-black">Sí, borrar la lista</button>
          <button onClick={() => setAskDelete(false)} className="flex-1 py-3 rounded-2xl bg-white shadow-sm text-sm font-black text-slate-500">No</button>
        </div>
      ) : (
        <button onClick={() => setAskDelete(true)} className="w-full py-3 text-sm font-black text-red-500">Borrar esta lista</button>
      )}
    </div>
  )
}
