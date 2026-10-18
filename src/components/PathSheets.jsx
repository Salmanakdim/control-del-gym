import { useState, useEffect, useRef } from 'react'
import { X, Play, Check, RotateCcw, Plus, Minus, ArrowLeft, Shuffle, Eye, EyeOff, Trash2, GripVertical } from 'lucide-react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PATH_LINKS, newId } from '../lib/pathConfig'
import Metas from '../pages/Metas'
import Afirmaciones from '../pages/Afirmaciones'
import Respiracion from '../pages/Respiracion'
import Sueno from '../pages/Sueno'
import Notes from '../pages/Notes'
import Pomodoro from '../pages/Pomodoro'
import Revision from '../pages/Revision'
import Cuerpo from '../pages/Cuerpo'

const INLINE_PAGES = { metas: Metas, afirmaciones: Afirmaciones, respiracion: Respiracion, sueno: Sueno, notes: Notes, pomodoro: Pomodoro, revision: Revision, cuerpo: Cuerpo }

// ── Panel que sube desde abajo ─────────────────────────────────────
function Sheet({ onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl shadow-2xl px-5 pt-3 pb-8 max-h-[88vh] overflow-y-auto sheet-up"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}>
        <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />
        <button onClick={onClose} aria-label="Cerrar"
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  )
}

function BigButton({ onClick, color = 'green', disabled, children }) {
  const c = {
    green: { bg: '#58cc02', sh: '#46a302', fg: 'white' },
    blue:  { bg: '#1cb0f6', sh: '#1899d6', fg: 'white' },
    gold:  { bg: '#ffc800', sh: '#e0a800', fg: '#7c4a03' },
    grey:  { bg: '#f1f5f9', sh: '#e2e8f0', fg: '#64748b' },
  }[color]
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wide flex items-center justify-center gap-2 active:translate-y-1 transition-transform disabled:opacity-40"
      style={{ background: c.bg, color: c.fg, boxShadow: `0 5px 0 ${c.sh}` }}>
      {children}
    </button>
  )
}

// ── Parada (hábito o foco) ─────────────────────────────────────────
export function StopSheet({ item, link, onLinkChange, onDo, onToggle, onClose, focusText, onSaveFocus }) {
  const isFocus = item.id === '__focus'
  const [focusInput, setFocusInput] = useState(focusText || '')
  const target = PATH_LINKS[link] || PATH_LINKS.none

  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
          style={{ background: item.done ? '#58cc02' : '#e2e8f0', boxShadow: `0 6px 0 ${item.done ? '#46a302' : '#cbd5e1'}` }}>
          {item.icon}
        </div>
        <h2 className="mt-5 text-xl font-black text-slate-800">{item.label}</h2>
        <p className="text-sm font-semibold mt-1" style={{ color: item.done ? '#58cc02' : '#94a3b8' }}>
          {item.done ? '✓ Hecho hoy' : 'Pendiente'}
        </p>
      </div>

      {isFocus ? (
        <div className="mt-5 space-y-3">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tu foco de hoy</p>
          <textarea value={focusInput} onChange={e => setFocusInput(e.target.value)} rows={2}
            placeholder="¿Cuál es tu intención para hoy?"
            className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-base font-semibold text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-slate-300" />
          {focusInput.trim() !== (focusText || '') && (
            <BigButton color="blue" disabled={!focusInput.trim()} onClick={() => onSaveFocus(focusInput.trim())}>
              Guardar foco
            </BigButton>
          )}
        </div>
      ) : (
        <div className="mt-5">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Se hace en</p>
          <select value={link} onChange={e => onLinkChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Object.entries(PATH_LINKS).map(([id, l]) => (
              <option key={id} value={id}>{l.emoji} {l.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {!isFocus && link !== 'none' && (
          <BigButton color="blue" onClick={onDo}>
            <Play size={16} fill="white" /> Hacer ahora · {target.label}
          </BigButton>
        )}
        {item.done ? (
          <BigButton color="grey" onClick={onToggle}><RotateCcw size={15} /> Marcar como pendiente</BigButton>
        ) : (
          <BigButton onClick={onToggle} disabled={isFocus && !focusText}>
            <Check size={17} strokeWidth={3} /> Hecho, siguiente
          </BigButton>
        )}
        {isFocus && !focusText && <p className="text-xs text-slate-400 text-center">Escribe y guarda tu foco antes de completarlo</p>}
      </div>
    </Sheet>
  )
}

// ── Sección de la app abierta encima del camino ────────────────────
export function InlinePage({ link, item, onDone, onClose }) {
  const Page = INLINE_PAGES[link]
  return (
    <div className="fixed inset-0 z-50 bg-slate-100 overflow-y-auto">
      <div className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur flex items-center gap-3 px-4 py-3 border-b border-slate-200">
        <button onClick={onClose} aria-label="Volver al camino"
          className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-600">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Camino al éxito</p>
          <p className="text-sm font-black text-slate-800 truncate">{item.icon} {item.label}</p>
        </div>
      </div>
      <div className="px-4 pt-4 pb-36 max-w-5xl mx-auto">
        {Page && <Page />}
      </div>
      <div className="fixed bottom-0 inset-x-0 px-4 pt-3 bg-gradient-to-t from-slate-100 via-slate-100 to-transparent"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="max-w-lg mx-auto">
          {item.done
            ? <BigButton color="grey" onClick={onClose}>Volver al camino</BigButton>
            : <BigButton onClick={onDone}><Check size={17} strokeWidth={3} /> Hecho, siguiente</BigButton>}
        </div>
      </div>
    </div>
  )
}

// ── Cofre de recompensa + descanso ─────────────────────────────────
const BREAK_KEY = 'fwd_break_end'
function fmt(sec) { return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}` }

export function ChestSheet({ rewards, breakMin, alreadyOpen, onOpened, onClose }) {
  const pick = () => rewards.length ? rewards[Math.floor(Math.random() * rewards.length)] : '😌 Descansar un poco'
  const [opened, setOpened] = useState(alreadyOpen)
  const [opening, setOpening] = useState(false)
  const [reward, setReward] = useState(pick)
  const [endAt, setEndAt] = useState(() => {
    try { const v = Number(localStorage.getItem(BREAK_KEY)); return v > Date.now() ? v : null } catch { return null }
  })
  const [now, setNow] = useState(() => Date.now())
  const finished = useRef(false)

  useEffect(() => {
    if (!endAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [endAt])

  const left = endAt ? Math.max(0, Math.ceil((endAt - now) / 1000)) : null
  useEffect(() => {
    if (left === 0 && !finished.current) {
      finished.current = true
      navigator.vibrate?.([200, 100, 200])
      try { localStorage.removeItem(BREAK_KEY) } catch { /* sin almacenamiento */ }
    }
  }, [left])

  function open() {
    setOpening(true)
    setTimeout(() => { setOpening(false); setOpened(true); onOpened() }, 900)
  }
  function startBreak() {
    const end = Date.now() + breakMin * 60000
    finished.current = false
    setEndAt(end); setNow(Date.now())
    try { localStorage.setItem(BREAK_KEY, String(end)) } catch { /* sin almacenamiento */ }
  }
  function stopBreak() {
    setEndAt(null)
    try { localStorage.removeItem(BREAK_KEY) } catch { /* sin almacenamiento */ }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col items-center text-center">
        {!opened ? (
          <>
            <div className={`text-7xl ${opening ? 'chest-open' : 'duo-wiggle'}`}>🎁</div>
            <h2 className="mt-5 text-xl font-black text-slate-800">¡Has llegado a un cofre!</h2>
            <p className="text-sm text-slate-500 mt-1">Te lo has ganado. Ábrelo para ver tu recompensa.</p>
            <div className="w-full mt-6">
              <BigButton color="gold" onClick={open} disabled={opening}>Abrir cofre</BigButton>
            </div>
          </>
        ) : left !== null && left > 0 ? (
          <>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Descanso</p>
            <p className="text-6xl font-black text-slate-800 tabular-nums mt-3">{fmt(left)}</p>
            <p className="mt-3 text-base font-bold text-slate-600">{reward}</p>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden mt-5">
              <div className="h-full bg-[#ffc800] transition-all duration-1000"
                style={{ width: `${100 - (left / (breakMin * 60)) * 100}%` }} />
            </div>
            <div className="w-full mt-6">
              <BigButton color="grey" onClick={stopBreak}>Terminar descanso</BigButton>
            </div>
          </>
        ) : (
          <>
            <div className="text-6xl reward-pop">🎉</div>
            <p className="mt-3 text-[11px] font-black text-slate-400 uppercase tracking-widest">
              {left === 0 ? 'Descanso terminado' : 'Tu recompensa'}
            </p>
            {left === 0 ? (
              <h2 className="mt-2 text-xl font-black text-slate-800">¡A por la siguiente parada! 💪</h2>
            ) : (
              <>
                <h2 className="mt-2 text-2xl font-black text-slate-800">{reward}</h2>
                <button onClick={() => setReward(pick())}
                  className="mt-3 flex items-center gap-1.5 text-xs font-bold text-slate-400 active:text-slate-600">
                  <Shuffle size={13} /> Otra recompensa
                </button>
              </>
            )}
            <div className="w-full mt-6 space-y-4">
              {left !== 0 && <BigButton color="gold" onClick={startBreak}>Empezar descanso · {breakMin} min</BigButton>}
              <BigButton color="grey" onClick={onClose}>Volver al camino</BigButton>
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}

// ── Personalizar camino ────────────────────────────────────────────
// Fila de la lista "Orden y lugar": se arrastra desde el asa ⠿
function OrderRow({ node, setLink }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: node.id })
  return (
    <div ref={setNodeRef} {...attributes}
      className={`flex items-center gap-2 rounded-xl py-1 ${isDragging ? 'relative z-10 bg-white shadow-lg' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}>
      <button ref={setActivatorNodeRef} {...listeners} aria-label="Arrastrar"
        className="w-8 h-9 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center flex-shrink-0"
        style={{ touchAction: 'none' }}>
        <GripVertical size={15} />
      </button>
      <span className="text-xl w-7 text-center">{node.type === 'chest' ? '🎁' : node.icon}</span>
      <p className="flex-1 min-w-0 text-sm font-semibold text-slate-700 truncate">
        {node.type === 'chest' ? 'Cofre' : node.kind === 'focus' ? 'Foco del día' : node.label}
      </p>
      {node.type === 'stop' && node.kind !== 'focus' && (
        <select value={node.link} onChange={e => setLink(node.id, e.target.value)}
          className="w-36 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-600">
          {Object.entries(PATH_LINKS).map(([id, l]) => <option key={id} value={id}>{l.emoji} {l.label}</option>)}
        </select>
      )}
    </div>
  )
}

export function PathSettingsSheet({ config, save, stops, sequence, setLink, onSaveOrder, onAddChest, onAddPrayers, hasPrayers, onClose }) {
  // Orden en borrador: se ve como en el camino (arriba = final del camino)
  const savedIds = [...sequence].reverse().map(n => n.id)
  const [orderDraft, setOrderDraft] = useState(null)
  // Lo añadido mientras hay un borrador aparece arriba (final del camino)
  const listIds  = orderDraft ? [...savedIds.filter(id => !orderDraft.includes(id)), ...orderDraft] : savedIds
  const byId     = Object.fromEntries(sequence.map(n => [n.id, n]))
  const sensors  = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    setOrderDraft(arrayMove(listIds, listIds.indexOf(active.id), listIds.indexOf(over.id)))
  }
  const [newReward, setNewReward] = useState('')
  const [stopIcon, setStopIcon]   = useState('⭐')
  const [stopName, setStopName]   = useState('')
  const [stopLink, setStopLink]   = useState('none')
  const hidden = config.hidden || []
  const custom = config.custom || []

  function addReward() {
    const r = newReward.trim()
    if (!r) return
    save({ rewards: [...config.rewards, r] })
    setNewReward('')
  }
  function toggleHidden(id) {
    save({ hidden: hidden.includes(id) ? hidden.filter(x => x !== id) : [...hidden, id] })
  }
  function addStop() {
    const label = stopName.trim()
    if (!label) return
    const id = newId('c_')
    save({ custom: [...custom, { id, icon: stopIcon.trim() || '⭐', label, link: stopLink }] })
    setStopName(''); setStopIcon('⭐'); setStopLink('none')
  }
  function deleteStop(id) {
    save({
      custom: custom.filter(x => x.id !== id),
      hidden: hidden.filter(x => x !== id),
      customDone: { ...config.customDone, ids: (config.customDone?.ids || []).filter(x => x !== id) },
    })
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className="text-xl font-black text-slate-800">Personalizar camino</h2>

      {/* Paradas */}
      <p className="mt-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">🛤️ Paradas</p>
      <p className="text-xs text-slate-500 mt-1 mb-3">Oculta las que no quieras en el camino (las tuyas se añaden más abajo)</p>
      <div className="space-y-2">
        {stops.map(st => (
          <div key={st.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${st.hidden ? 'bg-slate-50 opacity-50' : 'bg-slate-50'}`}>
            <span className="text-xl w-8 text-center">{st.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-700 truncate">{st.kind === 'focus' ? 'Foco del día' : st.label}</p>
              <p className="text-[10px] font-bold text-slate-400">
                {st.kind === 'focus' ? 'Foco' : st.kind === 'habit' ? 'Hábito' : 'Parada propia'}
              </p>
            </div>
            <button onClick={() => toggleHidden(st.id)} aria-label={st.hidden ? 'Mostrar' : 'Ocultar'}
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${st.hidden ? 'bg-slate-200 text-slate-400' : 'bg-green-100 text-green-600'}`}>
              {st.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            {st.kind === 'custom' && (
              <button onClick={() => deleteStop(st.id)} aria-label="Borrar parada"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-500 active:bg-red-50">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
      {!hasPrayers && (
        <button onClick={onAddPrayers}
          className="mt-3 w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-black text-white active:translate-y-0.5"
          style={{ background: '#00cd9c', boxShadow: '0 4px 0 #00a881' }}>
          🕌 Añadir las 5 oraciones
        </button>
      )}

      {/* Cofres */}
      <p className="mt-7 text-[11px] font-black text-slate-400 uppercase tracking-widest">🎁 Cofres</p>
      <p className="text-xs text-slate-500 mt-1">
        Añádelos, bórralos y muévelos con el botón ✏️ Editar del camino.
      </p>

      {/* Descanso */}
      <p className="mt-7 text-[11px] font-black text-slate-400 uppercase tracking-widest">⏱️ Minutos de descanso</p>
      <div className="flex items-center gap-3 mt-3">
        <button onClick={() => save({ breakMin: Math.max(1, config.breakMin - 1) })}
          className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600"><Minus size={18} /></button>
        <p className="flex-1 text-center text-3xl font-black text-slate-800 tabular-nums">{config.breakMin}<span className="text-base text-slate-400"> min</span></p>
        <button onClick={() => save({ breakMin: Math.min(180, config.breakMin + 1) })}
          className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600"><Plus size={18} /></button>
      </div>
      <div className="flex gap-2 mt-3">
        {[5, 10, 15, 20, 30].map(m => (
          <button key={m} onClick={() => save({ breakMin: m })}
            className={`flex-1 py-2 rounded-xl text-xs font-black ${config.breakMin === m ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {m}
          </button>
        ))}
      </div>

      {/* Recompensas */}
      <p className="mt-7 text-[11px] font-black text-slate-400 uppercase tracking-widest">🎉 Mis recompensas</p>
      <div className="mt-3 space-y-2">
        {config.rewards.map((r, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5">
            <p className="flex-1 text-sm font-semibold text-slate-700">{r}</p>
            <button onClick={() => save({ rewards: config.rewards.filter((_, j) => j !== i) })}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500"><X size={15} /></button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input value={newReward} onChange={e => setNewReward(e.target.value)} onKeyDown={e => e.key === 'Enter' && addReward()}
          placeholder="Ej: 🍫 Comer algo rico"
          className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={addReward} disabled={!newReward.trim()}
          className="w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center disabled:opacity-30"><Plus size={18} /></button>
      </div>

      {/* Orden y lugar de cada parada */}
      <p className="mt-7 text-[11px] font-black text-slate-400 uppercase tracking-widest">📍 Orden y lugar de cada parada</p>
      <p className="text-xs text-slate-500 mt-1 mb-2">Arriba = final del camino (junto al 🏆). Arrastra desde ⠿ para ordenar.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={listIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {listIds.filter(id => byId[id]).map(id => (
              <OrderRow key={id} node={byId[id]} setLink={setLink} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <div className="mt-3 bg-blue-50 rounded-2xl p-3 space-y-2">
        <p className="text-xs font-black text-blue-700">＋ Añadir parada</p>
        <div className="flex gap-2">
          <input value={stopIcon} onChange={e => setStopIcon(e.target.value)} maxLength={4} aria-label="Emoji"
            className="w-12 text-center border border-slate-200 rounded-xl py-2.5 text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input value={stopName} onChange={e => setStopName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addStop()}
            placeholder="Ej: Leer 10 páginas"
            className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex gap-2">
          <select value={stopLink} onChange={e => setStopLink(e.target.value)}
            className="flex-1 min-w-0 bg-white border border-slate-200 rounded-xl px-2 py-2.5 text-xs font-bold text-slate-600">
            {Object.entries(PATH_LINKS).map(([id, l]) => <option key={id} value={id}>{l.emoji} {l.label}</option>)}
          </select>
          <button onClick={addStop} disabled={!stopName.trim()}
            className="px-4 rounded-xl bg-blue-600 text-white text-sm font-black disabled:opacity-30">Añadir</button>
        </div>
        <button onClick={onAddChest}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-black text-amber-900"
          style={{ background: '#ffc800', boxShadow: '0 3px 0 #e0a800' }}>
          ＋ 🎁 Añadir cofre
        </button>
      </div>
      {orderDraft && (
        <div className="sticky bottom-0 mt-3 -mx-1 flex gap-2 bg-white/95 backdrop-blur py-2">
          <button onClick={() => setOrderDraft(null)}
            className="flex-1 py-3 rounded-2xl text-sm font-black bg-slate-100 text-slate-500">Cancelar</button>
          <button onClick={() => { onSaveOrder([...listIds].reverse()); setOrderDraft(null) }}
            className="flex-1 py-3 rounded-2xl text-sm font-black text-white bg-blue-600 shadow-[0_4px_0_#1d4ed8]">Guardar orden</button>
        </div>
      )}
    </Sheet>
  )
}
