import { useState, useEffect, useRef } from 'react'
import { X, Play, Check, RotateCcw, Plus, Minus, ArrowLeft, Shuffle, Eye, EyeOff, Trash2, GripVertical, Pencil } from 'lucide-react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { PATH_LINKS, newId, localDate } from '../lib/pathConfig'
import { supabase } from '../lib/supabase'
import Flowy from './Flowy'
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

export function ChestSheet({ rewards, assigned, breakMin, alreadyOpen, onOpened, onClose }) {
  const pick = () => rewards.length ? rewards[Math.floor(Math.random() * rewards.length)] : '😌 Descansar un poco'
  const [opened, setOpened] = useState(alreadyOpen)
  const [opening, setOpening] = useState(false)
  // Empieza por la recompensa asignada al cofre (si la hay); "Otra recompensa" sigue funcionando
  const [reward, setReward] = useState(() => assigned || pick())
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
                <button onClick={() => setReward(cur => {
                  const others = rewards.filter(r => r !== cur)   // siempre una distinta
                  return others.length ? others[Math.floor(Math.random() * others.length)] : cur
                })}
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
// Fila de la lista "Orden y lugar": se arrastra desde el asa ⠿; el lápiz abre el editor
function OrderRow({ node, setLink, onEdit, onHide, onDelete, rewards, chestReward, onChestReward }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: node.id })
  const [open, setOpen]       = useState(false)
  const [icon, setIcon]       = useState(node.icon || '⭐')
  const [label, setLabel]     = useState(node.label || '')
  const [confirm, setConfirm] = useState(false)
  const isChest = node.type === 'chest'
  const isFocus = node.kind === 'focus'
  const isHabit = node.kind === 'habit'

  return (
    <div ref={setNodeRef} {...attributes}
      className={`rounded-xl ${isDragging ? 'relative z-10 bg-white shadow-lg' : ''} ${open ? 'bg-slate-50 p-2 my-1' : 'py-1'}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}>
      <div className="flex items-center gap-2">
        <button ref={setActivatorNodeRef} {...listeners} aria-label="Arrastrar"
          className="w-8 h-9 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 flex items-center justify-center flex-shrink-0"
          style={{ touchAction: 'none' }}>
          <GripVertical size={15} />
        </button>
        <span className="text-xl w-7 text-center">{isChest ? '🎁' : node.icon}</span>
        <p className="flex-1 min-w-0 text-sm font-semibold text-slate-700 truncate">
          {isChest ? 'Cofre' : isFocus ? 'Foco del día' : node.label}
        </p>
        {node.type === 'stop' && !isFocus && (
          <select value={node.link} onChange={e => setLink(node.id, e.target.value)}
            className="w-32 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-600">
            {Object.entries(PATH_LINKS).map(([id, l]) => <option key={id} value={id}>{l.emoji} {l.label}</option>)}
          </select>
        )}
        {isChest && (
          <select value={chestReward || ''} onChange={e => onChestReward(node.id, e.target.value)} aria-label="Recompensa del cofre"
            className="w-32 bg-amber-50 border border-amber-200 rounded-xl px-2 py-2 text-xs font-bold text-amber-800">
            <option value="">🎲 Al azar</option>
            {rewards.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {isChest ? (
          <button onClick={() => onDelete(node.id)} aria-label="Borrar cofre"
            className="w-8 h-9 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 active:bg-red-50">
            <Trash2 size={16} />
          </button>
        ) : (
          <button onClick={() => { setOpen(o => !o); setConfirm(false) }} aria-label="Editar parada"
            className={`w-8 h-9 rounded-lg flex items-center justify-center ${open ? 'bg-blue-600 text-white' : 'text-slate-400 active:bg-slate-100'}`}>
            <Pencil size={15} />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          {!isFocus && (
            <div className="flex gap-2">
              <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={4} aria-label="Emoji de la parada"
                className="w-12 text-center border border-slate-200 rounded-xl py-2 text-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input value={label} onChange={e => setLabel(e.target.value)} aria-label="Nombre de la parada"
                className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => { onEdit(node.id, { icon: icon.trim() || '⭐', label: label.trim() || node.label }); setOpen(false) }}
                disabled={!label.trim()}
                className="px-3 rounded-xl bg-blue-600 text-white text-xs font-black disabled:opacity-30">Guardar</button>
            </div>
          )}
          {confirm ? (
            <div className="bg-red-50 border border-red-100 rounded-xl p-2.5">
              <p className="text-xs font-bold text-red-700">
                {isHabit ? '¿Borrar el hábito? Se borra también su historial y no se puede deshacer.' : '¿Borrar esta parada?'}
              </p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setConfirm(false)} className="flex-1 py-2 rounded-lg bg-white text-xs font-black text-slate-500">No</button>
                <button onClick={() => onDelete(node.id)} className="flex-1 py-2 rounded-lg bg-red-500 text-xs font-black text-white">Sí, borrar</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => onHide(node.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-500">
                <EyeOff size={13} /> Ocultar del camino
              </button>
              {!isFocus && (
                <button onClick={() => setConfirm(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border border-red-200 text-xs font-black text-red-500">
                  <Trash2 size={13} /> {isHabit ? 'Borrar hábito' : 'Borrar'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PathSettingsSheet({ config, save, stops, sequence, setLink, onSaveOrder, onAddChest, onEditStop, onDeleteStop, onAddPrayers, hasPrayers, dirty, onSaveAll, onClose }) {
  // Se ve como en el camino (arriba = final del camino)
  const listIds  = [...sequence].reverse().map(n => n.id)
  const [askDiscard, setAskDiscard] = useState(false)
  const byId     = Object.fromEntries(sequence.map(n => [n.id, n]))
  const sensors  = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    onSaveOrder(arrayMove(listIds, listIds.indexOf(active.id), listIds.indexOf(over.id)).reverse())
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

  const tryClose = () => (dirty ? setAskDiscard(true) : onClose())

  return (
    <Sheet onClose={tryClose}>
      <h2 className="text-xl font-black text-slate-800">Personalizar camino</h2>
      <p className="text-xs text-slate-500 mt-1">Nada cambia en el camino hasta que pulses Guardar cambios.</p>

      {/* Hora de inicio del día */}
      <p className="mt-6 text-[11px] font-black text-slate-400 uppercase tracking-widest">🌙 Mi día empieza a las</p>
      <p className="text-xs text-slate-500 mt-1 mb-3">
        Si te acuestas tarde, lo que marques de madrugada sigue contando para el día anterior.
      </p>
      <div className="grid grid-cols-7 gap-1.5">
        {[0, 1, 2, 3, 4, 5, 6].map(h => (
          <button key={h} onClick={() => save({ dayStart: h })}
            className={`py-2 rounded-xl text-xs font-black tabular-nums ${(config.dayStart ?? 0) === h ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {String(h).padStart(2, '0')}:00
          </button>
        ))}
      </div>

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
              <button onClick={() => onDeleteStop(st.id)} aria-label="Borrar parada"
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
              <OrderRow key={id} node={byId[id]} setLink={setLink}
                onEdit={onEditStop} onHide={toggleHidden} onDelete={onDeleteStop}
                rewards={config.rewards} chestReward={config.rewards.includes(config.chestRewards?.[id]) ? config.chestRewards[id] : ''}
                onChestReward={(cid, r) => save({ chestRewards: { ...(config.chestRewards || {}), [cid]: r || undefined } })} />
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
      {/* Guardar / descartar todos los cambios */}
      <div className="sticky -mx-5 mt-6 px-5 pt-3 bg-white border-t border-slate-100"
        style={{ bottom: 'calc(-2rem - env(safe-area-inset-bottom))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        {askDiscard ? (
          <div>
            <p className="text-xs font-bold text-slate-600 text-center mb-2">Tienes cambios sin guardar. ¿Descartarlos?</p>
            <div className="flex gap-2">
              <button onClick={() => setAskDiscard(false)}
                className="flex-1 py-3 rounded-2xl text-sm font-black bg-slate-100 text-slate-600">Seguir editando</button>
              <button onClick={onClose}
                className="flex-1 py-3 rounded-2xl text-sm font-black text-white bg-red-500">Descartar</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-2xl text-sm font-black bg-slate-100 text-slate-500">Cancelar</button>
            <button onClick={onSaveAll} disabled={!dirty}
              className="flex-1 py-3 rounded-2xl text-sm font-black text-white bg-blue-600 shadow-[0_4px_0_#1d4ed8] disabled:opacity-40 disabled:shadow-none">
              Guardar cambios
            </button>
          </div>
        )}
      </div>
    </Sheet>
  )
}

// ── Estadísticas: % de días que se hizo cada parada en la última semana / mes ──

// Día en que empezó a existir la parada (para no contar días en que no estaba)
function stopSince(stop, habits) {
  if (stop.kind === 'habit') {
    const h = habits.find(x => x.id === stop.id)
    return h?.created_at ? localDate(new Date(h.created_at)) : null
  }
  if (stop.kind === 'custom') {
    // newId: prefijo + Date.now() en base 36 + 4 letras al azar
    const ms = parseInt(stop.id.replace(/^c_(pray_)?/, '').slice(0, -4), 36)
    return ms > 1.5e12 && ms < 4e12 ? localDate(new Date(ms)) : null
  }
  return null
}

function pctColor(p) {
  if (p >= 80) return '#58cc02'
  if (p >= 50) return '#ff9600'
  return '#ff4b4b'
}

export function StatsSheet({ userId, stops, habits, today, onClose }) {
  const [days, setDays] = useState(7)
  const [loaded, setLoaded] = useState(null)   // { key, habitLogs: Set, pathLogs: Set | null, pathFrom }
  const key  = `${days}|${today}`
  const data = loaded?.key === key ? loaded : null   // al cambiar de periodo se ve cargando

  useEffect(() => {
    const since = new Date(); since.setDate(since.getDate() - (days - 1))
    const from = localDate(since)
    Promise.all([
      supabase.from('habit_logs').select('habit_id, date').eq('user_id', userId).gte('date', from),
      supabase.from('path_logs').select('stop_id, date').eq('user_id', userId).gte('date', from),
    ]).then(([hl, pl]) => {
      setLoaded({
        key: `${days}|${today}`,
        habitLogs: new Set((hl.data || []).map(r => `${r.habit_id}|${r.date}`)),
        pathLogs:  pl.error ? null : new Set((pl.data || []).map(r => `${r.stop_id}|${r.date}`)),
        pathFrom:  pl.error ? null : (pl.data || []).reduce((m, r) => (!m || r.date < m ? r.date : m), null),
      })
    })
  }, [days, userId, today])

  // Días del periodo (de más antiguo a hoy)
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i)); return localDate(d)
  })

  const rows = !data ? [] : stops.map(st => {
    const isHabit = st.kind === 'habit'
    const logs = isHabit ? data.habitLogs : data.pathLogs
    if (!logs) return { ...st, noData: true }
    // Las paradas propias y el foco solo tienen historial desde que se empezó a guardar
    const starts = [stopSince(st, habits), isHabit ? null : data.pathFrom].filter(Boolean)
    const start  = starts.length ? starts.sort().at(-1) : dates[0]
    let done = 0, total = 0
    for (const d of dates) {
      if (d < start) continue
      const did = logs.has(`${st.id}|${d}`) || (d === today && st.done)
      if (d === today && !did) continue   // hoy aún no ha terminado: solo cuenta si ya está hecho
      total++
      if (did) done++
    }
    if (!total) return { ...st, noData: true }
    return { ...st, done, total, pct: Math.round(done / total * 100) }
  })

  const ranked = rows.filter(r => !r.noData).sort((a, b) => a.pct - b.pct || a.done - b.done)
  const empty  = rows.filter(r => r.noData)
  const worst  = ranked[0]
  const avg    = ranked.length ? Math.round(ranked.reduce((s, r) => s + r.pct, 0) / ranked.length) : 0

  return (
    <Sheet onClose={onClose}>
      <h2 className="text-xl font-black text-slate-800">Tu progreso</h2>
      <div className="flex gap-2 mt-3 p-1 bg-slate-100 rounded-2xl">
        {[[7, 'Semana'], [30, 'Mes']].map(([n, l]) => (
          <button key={n} onClick={() => setDays(n)}
            className={`flex-1 py-2 rounded-xl text-sm font-black transition-colors ${days === n ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'}`}>
            {l} <span className="font-bold text-xs opacity-60">({n} días)</span>
          </button>
        ))}
      </div>

      {!data ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {worst && (
            <div className="mt-4 rounded-2xl border-2 p-4 flex items-center gap-3"
              style={{ borderColor: worst.pct >= 80 ? '#58cc02' : '#ff9600', background: worst.pct >= 80 ? '#f0fdf4' : '#fff7ed' }}>
              <Flowy mood={worst.pct >= 80 ? 'win' : 'push'} size={52} />
              <div className="min-w-0">
                {worst.pct >= 80 ? (
                  <>
                    <p className="text-sm font-black text-slate-800">¡Vas genial en todo!</p>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">Todas tus paradas están por encima del 80 %. Media: {avg} %.</p>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] font-black text-orange-500 uppercase tracking-wide">Lo que más tienes que mejorar</p>
                    <p className="text-base font-black text-slate-800 truncate">{worst.icon} {worst.label}</p>
                    <p className="text-xs font-bold text-slate-500 mt-0.5">
                      Solo {worst.done} de {worst.total} días ({worst.pct} %). Media de todo: {avg} %.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {ranked.map(r => (
              <div key={r.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-700 truncate">{r.icon} {r.label}</p>
                  <p className="text-sm font-black tabular-nums flex-shrink-0" style={{ color: pctColor(r.pct) }}>
                    {r.pct} % <span className="text-[11px] font-bold text-slate-400">{r.done}/{r.total}</span>
                  </p>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div className="h-full rounded-full transition-all" style={{ width: `${r.pct}%`, background: pctColor(r.pct) }} />
                </div>
              </div>
            ))}
          </div>

          {empty.length > 0 && (
            <p className="text-xs text-slate-400 mt-4">
              Aún sin historial: {empty.map(r => `${r.icon} ${r.label}`).join(', ')}.
              {!data.pathLogs && ' (Falta crear la tabla path_logs en Supabase.)'}
            </p>
          )}
          <p className="text-[11px] text-slate-400 mt-3">
            Hoy solo cuenta si ya lo has hecho, porque el día aún no ha terminado.
          </p>
        </>
      )}
    </Sheet>
  )
}
