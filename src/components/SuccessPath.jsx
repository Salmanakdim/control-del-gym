import { useEffect, useRef, useState } from 'react'
import { Settings, Check, Play, Pencil, GripVertical, X, Plus, RotateCcw, SlidersHorizontal, BarChart3 } from 'lucide-react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Flowy from './Flowy'
import { STOP_COLORS } from '../lib/pathConfig'
import { visionForToday } from '../lib/vision'

// Camino al éxito estilo Duolingo: se empieza abajo y se sube hasta el trofeo.
// Toque: marca/desmarca. Mantener pulsado: menú de opciones. ✏️ Editar: ordenar, colores y cofres.

const LEVELS = [
  { min: 0,   emoji: '😴', label: 'Sin empezar', color: '#94a3b8' },
  { min: 1,   emoji: '😐', label: 'Regular',     color: '#f59e0b' },
  { min: 40,  emoji: '🙂', label: 'Bien',        color: '#84cc16' },
  { min: 70,  emoji: '💪', label: 'Muy bien',    color: '#58cc02' },
  { min: 100, emoji: '🏆', label: '¡ÉXITO!',     color: '#eab308' },
]
function levelFor(pct) { return [...LEVELS].reverse().find(l => pct >= l.min) }

const GREY = { bg: '#e2e8f0', shadow: '#cbd5e1' }
const GOLD = { bg: '#ffc800', shadow: '#e0a800' }

// Zigzag horizontal (px desde el centro)
const OFFSETS = [0, 44, 66, 44, 0, -44, -66, -44]
const ROW = 96

function Round({ colors, label, dim, pop, children, size = 64, rounded = 'rounded-full', ...handlers }) {
  return (
    <button aria-label={label} {...handlers}
      onContextMenu={e => e.preventDefault()}
      className={`relative ${rounded} flex items-center justify-center text-2xl transition-transform active:translate-y-1.5 select-none ${pop ? 'duo-pop' : ''}`}
      style={{ width: size, height: size, background: colors.bg, boxShadow: `0 7px 0 ${colors.shadow}`, WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}>
      <span style={dim ? { filter: 'grayscale(1)', opacity: 0.45 } : undefined}>{children}</span>
    </button>
  )
}

function Bubble({ title, subtitle, color = '#58cc02', children }) {
  return (
    <div className={`absolute top-[86px] left-1/2 -translate-x-1/2 z-10 ${children ? '' : 'duo-bounce'}`}>
      <div className="relative px-3 pt-1.5 pb-2 rounded-2xl border-2 border-slate-200 bg-white shadow-sm text-center whitespace-nowrap">
        <div className="absolute left-1/2 -top-[7px] -translate-x-1/2 w-3 h-3 rotate-45 bg-white border-l-2 border-t-2 border-slate-200" />
        <p className="text-xs font-black" style={{ color }}>{title}</p>
        {subtitle && <p className="text-[10px] font-bold text-slate-500 max-w-[160px] truncate mx-auto">{subtitle}</p>}
        {children}
      </div>
    </div>
  )
}

// ── Fondo: cielo según la hora, sendero entre paradas y flores al completar ──

function skyPhase(hour) {
  if (hour >= 5 && hour < 8)   return 'dawn'
  if (hour >= 8 && hour < 17)  return 'day'
  if (hour >= 17 && hour < 20) return 'sunset'
  return 'night'
}

// Cuadros del vision board en el lado libre de algunas filas (el contrario al
// desvío de la curva), así nunca tapan una parada.
// La fila solo mide lo que su parada y está desplazada x px. Desde su centro
// (50 %) se resta medio ancho del camino (50cqw, el contenedor) para llegar al borde.
const atEdge = (side, x, margin) => side === 'left'
  ? { left: `calc(50% - 50cqw + ${margin - x}px)` }
  : { right: `calc(50% - 50cqw + ${margin + x}px)` }

function VisionFrame({ src, x, side, tilt, onOpen }) {
  return (
    <button onClick={onOpen} aria-label="Ver imagen del vision board"
      className="absolute -top-6 p-1.5 pb-4 bg-white rounded-md shadow-lg active:scale-95 transition-transform"
      style={{ ...atEdge(side, x, 12), transform: `rotate(${tilt}deg)` }}>
      <img src={src} alt="" draggable={false} decoding="async" className="block w-[104px] h-[128px] object-cover rounded-sm select-none" />
    </button>
  )
}

// Tramo de sendero desde esta parada hasta la de abajo: punteado gris por
// recorrer, verde lo ya andado. Se pinta antes que la parada para quedar detrás.
function Trail({ dx, dy, walked }) {
  const pad = 8
  const minX = Math.min(0, dx) - pad
  const w = Math.abs(dx) + pad * 2
  return (
    <svg aria-hidden className="absolute pointer-events-none overflow-visible"
      style={{ left: `calc(50% + ${minX}px)`, top: 32, width: w, height: dy }}>
      <line x1={-minX} y1={0} x2={dx - minX} y2={dy}
        stroke={walked ? '#58cc02' : 'rgba(71,85,105,.22)'}
        strokeWidth={7} strokeLinecap="round" strokeDasharray="0.1 15" />
    </svg>
  )
}

// Al completar una parada brota algo en su hueco (estrellas de noche)
// Florecitas salpicadas por todo el camino: en el lado de la curva, una o dos
// según el sitio que quede hasta el borde; en el lado libre, dos si no hay un
// cuadro cerca ni está Flowy. Posiciones fijas según la fila, para que no
// "salten" al volver a pintar.
const SMALL_FLOWERS = ['🌸', '🌼', '🌷', '🌺', '💮', '🌻', '🌼']
function Meadow({ pos, x, side, freeBusy }) {
  const other = side === 'left' ? 'right' : 'left'
  const items = [{ s: other, gap: 46 + (pos * 11) % 22, top: 30 + (pos * 7) % 30 }]
  if (Math.abs(x) <= 44) items.push({ s: other, gap: 84 + (pos * 7) % 24, top: 2 + (pos * 13) % 22 })
  if (!freeBusy) {
    items.push({ s: side, gap: 74 + (pos * 13) % 30, top: 4 + (pos * 5) % 20 })
    items.push({ s: side, gap: 110 + (pos * 17) % 26, top: 44 + (pos * 3) % 24 })
  }
  return items.map((f, k) => (
    <span key={k} aria-hidden className="absolute text-[15px] leading-none pointer-events-none select-none"
      style={{ top: f.top, ...(f.s === 'left' ? { right: `calc(50% + ${f.gap}px)` } : { left: `calc(50% + ${f.gap}px)` }) }}>
      {SMALL_FLOWERS[(pos * 3 + k) % SMALL_FLOWERS.length]}
    </span>
  ))
}

const BLOOMS = { day: ['🌸', '🌼', '🌷', '🌻'], night: ['⭐', '✨', '🌟'] }
function Bloom({ side, night, seed }) {
  const list = night ? BLOOMS.night : BLOOMS.day
  const gap = 40 + (seed * 5) % 10
  return (
    <span aria-hidden className="absolute top-5 text-xl duo-pop pointer-events-none select-none"
      style={side === 'left' ? { right: `calc(50% + ${gap}px)` } : { left: `calc(50% + ${gap}px)` }}>
      {list[seed % list.length]}
    </span>
  )
}

// Celebración al completar todo el camino: rayos girando detrás del trofeo,
// confeti cayendo sin parar y destellos que saltan alrededor.
const CONFETTI_COLORS = ['#ffc800', '#58cc02', '#1cb0f6', '#ff4b4b', '#ce82ff', '#ff9600']
const CONFETTI = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 41 + 9) % 100,           // % del ancho de la zona
  delay: ((i * 37) % 30) / 10,        // 0–3 s
  dur: 2.4 + ((i * 13) % 12) / 10,    // 2.4–3.5 s
  w: 6 + (i % 3) * 2,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  round: i % 4 === 0,
}))
const SPARKS = [[-70, -30, 0], [78, -10, 0.5], [-58, 62, 1], [66, 70, 1.4], [0, -78, 0.8], [-90, 20, 1.8], [92, 34, 1.1]]

function WinBurst() {
  return (
    <div aria-hidden className="absolute left-1/2 top-1/2 pointer-events-none">
      {/* Rayos de sol girando */}
      <div className="absolute w-64 h-64 -left-32 -top-32 rounded-full win-rays"
        style={{ background: 'repeating-conic-gradient(#ffd90055 0deg 12deg, transparent 12deg 30deg)', maskImage: 'radial-gradient(circle, #000 35%, transparent 70%)', WebkitMaskImage: 'radial-gradient(circle, #000 35%, transparent 70%)' }} />
      {/* Onda dorada que sale del trofeo */}
      <div className="absolute w-24 h-24 -left-12 -top-12 rounded-full border-[6px] border-yellow-300 duo-signal" />
      <div className="absolute w-24 h-24 -left-12 -top-12 rounded-full border-[6px] border-yellow-300 duo-signal" style={{ animationDelay: '1s' }} />
      {/* Confeti */}
      <div className="absolute w-80 h-60 -left-40 -top-24 overflow-hidden">
        {CONFETTI.map((c, i) => (
          <span key={i} className="absolute top-0 win-confetti"
            style={{ left: `${c.left}%`, width: c.w, height: c.round ? c.w : c.w * 1.8, background: c.color,
              borderRadius: c.round ? '50%' : 2, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s` }} />
        ))}
      </div>
      {/* Destellos */}
      {SPARKS.map(([x, y, d], i) => (
        <span key={i} className="absolute text-xl win-spark" style={{ left: x - 10, top: y - 12, animationDelay: `${d}s` }}>✨</span>
      ))}
    </div>
  )
}

// Detecta "mantener pulsado" sin interferir con el scroll
function useLongPress(onLong, onTap) {
  const timer = useRef(null)
  const start = useRef(null)
  const fired = useRef(false)
  const clear = () => clearTimeout(timer.current)
  return {
    onPointerDown: e => {
      fired.current = false
      start.current = { x: e.clientX, y: e.clientY }
      clear()
      timer.current = setTimeout(() => { fired.current = true; navigator.vibrate?.(25); onLong() }, 450)
    },
    onPointerMove: e => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 8) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => { if (fired.current) { fired.current = false; return } onTap() },
  }
}

// Fila del camino; en modo editar se arrastra desde el asa ⠿
function Row({ id, x, height, marginTop, edit, z, children }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !edit })
  return (
    <div ref={setNodeRef} {...(edit ? attributes : {})}
      className={`relative flex justify-center items-start ${isDragging ? 'z-40' : z}`}
      style={{
        height, marginTop, transition,
        transform: `${CSS.Translate.toString(transform) || ''} translateX(${x}px) ${isDragging ? 'scale(1.08)' : ''}`,
      }}>
      {edit && (
        <button ref={setActivatorNodeRef} {...listeners} aria-label="Arrastrar"
          className="absolute top-4 w-8 h-9 rounded-lg bg-white border-2 border-slate-200 text-slate-400 flex items-center justify-center cursor-grab"
          style={{ touchAction: 'none', ...(x > 0 ? { right: 'calc(50% + 44px)' } : { left: 'calc(50% + 44px)' }) }}>
          <GripVertical size={16} />
        </button>
      )}
      {children}
    </div>
  )
}

function StopNode({ item, colors, isCurrent, x, mood, edit, menuOpen, done, nodeRef, onTap, onLong, onCloseMenu, onSetDone, onDo, onMore, onColor }) {
  const press  = useLongPress(onLong, onTap)
  const inner  = x > 0 ? 'left' : 'right'
  const filled = item.done || isCurrent
  return (
    <>
      <div className="relative" ref={nodeRef}>
        {isCurrent && !edit && (
          <>
            <div className="absolute -inset-2.5 rounded-full border-[6px] border-slate-200" />
            {/* Ondas que salen del anillo, como una señal: "¡aquí toca ahora!" */}
            <div className="absolute -inset-2.5 rounded-full border-4 duo-signal pointer-events-none" style={{ borderColor: colors.bg }} />
            <div className="absolute -inset-2.5 rounded-full border-4 duo-signal pointer-events-none" style={{ borderColor: colors.bg, animationDelay: '1s' }} />
          </>
        )}
        <Round key={`${item.id}-${item.done}`} colors={filled || edit ? colors : GREY} dim={!filled && !edit}
          pop={item.done} label={item.label} {...(edit ? { onClick: onTap } : press)}>
          {item.icon}
        </Round>
        {item.done && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-[11px] font-black flex items-center justify-center shadow"
            style={{ color: colors.bg }}>✓</span>
        )}
        {isCurrent && !edit && (
          <div className="absolute -top-2" style={inner === 'left' ? { right: '100%', marginRight: 16 } : { left: '100%', marginLeft: 16 }}>
            <Flowy mood={mood} size={60} />
          </div>
        )}
      </div>

      {/* Menú al mantener pulsado (o paleta de colores en modo editar) */}
      {menuOpen ? (
        <div className="absolute top-[82px] left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 w-52 sheet-up">
          <p className="text-xs font-black text-slate-700 px-2 pt-1 pb-2 truncate">{item.icon} {item.label}</p>
          {edit ? (
            <div className="grid grid-cols-4 gap-2 p-1">
              {Object.entries(STOP_COLORS).map(([k, c]) => (
                <button key={k} onClick={() => onColor(k)} aria-label={`Color ${k}`}
                  className="aspect-square rounded-full"
                  style={{ background: c.bg, boxShadow: `0 3px 0 ${c.shadow}`, outline: c.bg === colors.bg ? '3px solid #0f172a' : 'none', outlineOffset: 2 }} />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {item.canCheck !== false ? (
                <button onClick={onSetDone} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-700 active:bg-slate-50">
                  {item.done
                    ? <><RotateCcw size={15} className="text-slate-400" /> Marcar pendiente</>
                    : <><Check size={16} strokeWidth={3} className="text-[#58cc02]" /> Hecho</>}
                </button>
              ) : (
                <button onClick={onMore} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-700 active:bg-slate-50">
                  <Pencil size={15} className="text-amber-500" /> Escribir
                </button>
              )}
              {item.canDo && (
                <button onClick={onDo} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-700 active:bg-slate-50">
                  <Play size={14} fill="#1cb0f6" className="text-[#1cb0f6]" /> Hacer en la app
                </button>
              )}
              <button onClick={onMore} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 active:bg-slate-50">
                <SlidersHorizontal size={15} /> Más opciones
              </button>
            </div>
          )}
          <button onClick={onCloseMenu} className="w-full mt-1 py-2 text-xs font-bold text-slate-400">Cerrar</button>
        </div>
      ) : isCurrent && !edit ? (
        <Bubble title={done === 0 ? 'EMPEZAR' : 'SIGUIENTE'} subtitle={item.label} />
      ) : (
        <p className="absolute top-[74px] px-1.5 py-0.5 rounded-md bg-white/80 text-[10px] font-bold text-slate-500 max-w-[90px] truncate text-center">{item.label}</p>
      )}
    </>
  )
}

export default function SuccessPath({
  sequence, colorsOf, openedChests,
  onToggle, onOpenStop, onDo, onOpenChest, onOpenSettings, onOpenStats,
  edit, onStartEdit, onSaveEdit, onCancelEdit,
  onReorder, onSetColor, onAddChest, onDeleteChest,
}) {
  const currentRef = useRef(null)
  const [menu, setMenu] = useState(null)   // id de la parada con el menú abierto
  const [viewImg, setViewImg] = useState(null) // imagen del vision board abierta en grande

  const stops = sequence.filter(n => n.type === 'stop')
  const total = stops.length
  const done  = stops.filter(s => s.done).length
  const curId = stops.find(s => !s.done)?.id
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const level = levelFor(pct)
  const win   = total > 0 && done === total

  // Ánimo de Flowy: salta al completar una parada; si pasa un rato sin avanzar, "¡vamos!"
  const [mood, setMood] = useState('idle')
  const prevDone = useRef(done)
  useEffect(() => {
    const timers = []
    if (done > prevDone.current) {
      timers.push(setTimeout(() => setMood('hop'), 0))
      timers.push(setTimeout(() => setMood('idle'), 1200))
    }
    prevDone.current = done
    timers.push(setTimeout(() => setMood('push'), 90 * 1000))
    return () => timers.forEach(clearTimeout)
  }, [done])

  // Al abrir, centrar la pantalla en la parada actual
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  // Se pinta de arriba (última) a abajo (primera): el orden visual es el inverso
  const visualIds = [...sequence].reverse().map(n => n.id)
  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    onReorder(arrayMove(visualIds, visualIds.indexOf(active.id), visualIds.indexOf(over.id)).reverse())
  }

  // Paradas que hay antes de cada cofre (se abre cuando llevas ese número hechas)
  const chestNeed = {}
  let stopsSoFar = 0
  sequence.forEach(n => { if (n.type === 'stop') stopsSoFar++; else chestNeed[n.id] = stopsSoFar })

  // Cielo según la hora; se revisa cada 5 minutos
  const [phase, setPhase] = useState(() => skyPhase(new Date().getHours()))
  useEffect(() => {
    const t = setInterval(() => setPhase(skyPhase(new Date().getHours())), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])
  const night = phase === 'night'

  // Medidas de cada fila, para trazar el sendero hasta la parada de abajo
  const layout = sequence.map((n, pos) => {
    const isCur = n.type === 'stop' && !win && n.id === curId
    const chestReady = n.type === 'chest' && done >= chestNeed[n.id] && !openedChests.has(n.id)
    return {
      x: OFFSETS[pos % OFFSETS.length],
      height: n.type === 'chest' ? (chestReady && !edit ? ROW + 30 : ROW) : (isCur && !edit ? ROW + 40 : ROW),
      marginTop: isCur && !edit ? 14 : 0,
      reached: n.type === 'stop' ? n.done || isCur : done >= chestNeed[n.id],
    }
  })
  // Tramo entre esta parada y la de abajo (la anterior del camino)
  const trailBelow = (pos) => {
    if (edit || pos === 0) return null
    const cur = layout[pos], below = layout[pos - 1]
    return <Trail dx={below.x - cur.x} dy={cur.height + below.marginTop} walked={cur.reached && below.reached} />
  }
  const freeSide = (pos, x) => x > 0 ? 'left' : x < 0 ? 'right' : pos % OFFSETS.length === 0 ? 'left' : 'right'
  // Un cuadro del vision board en una de cada dos filas (saltando la actual,
  // donde está Flowy) hasta usar todas las imágenes.
  // Un cuadro del vision board en una de cada dos filas (saltando la actual,
  // donde está Flowy) hasta usar todas las imágenes.
  const vision = visionForToday()
  const decor = {}
  let nextImg = 0
  sequence.forEach((n, pos) => {
    const isCur = n.type === 'stop' && !win && n.id === curId
    if (pos % 2 === 0 && !isCur && nextImg < vision.length) {
      decor[pos] = { img: vision[nextImg], tilt: nextImg % 2 ? 4 : -4 }
      nextImg++
    }
  })
  const sideAt = (pos) => freeSide(pos, OFFSETS[pos % OFFSETS.length])
  const hasFrame = (pos) => !!decor[pos]
  // Un cuadro en esta fila o en la de al lado por el mismo lado ocupa el hueco
  const frameNear = (pos) => [pos - 1, pos, pos + 1].some(q => decor[q] && sideAt(q) === sideAt(pos))
  const scenery = (pos, x) => {
    const d = decor[pos]
    return d ? <VisionFrame src={d.img} x={x} side={sideAt(pos)} tilt={d.tilt} onOpen={() => setViewImg(d.img)} /> : null
  }

  return (
    <div>
      {menu && <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />}
      {viewImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setViewImg(null)}>
          <img src={viewImg} alt="" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl reward-pop" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Camino al éxito</p>
        <div className="flex items-center gap-1.5">
          <span>{level.emoji}</span>
          <span className="text-xs font-black" style={{ color: level.color }}>{level.label}</span>
          <span className="text-xs font-black text-slate-400 tabular-nums ml-1">{done}/{total}</span>
          <button onClick={onOpenStats} aria-label="Estadísticas del camino"
            className="ml-1 w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-500 active:bg-slate-50">
            <BarChart3 size={15} />
          </button>
          <button onClick={() => { if (!edit) onStartEdit(); setMenu(null) }} aria-label="Editar camino"
            className={`w-8 h-8 rounded-xl shadow-sm flex items-center justify-center ${edit ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}>
            <Pencil size={14} />
          </button>
          <button onClick={onOpenSettings} aria-label="Personalizar camino"
            className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-500 active:bg-slate-50">
            <Settings size={15} />
          </button>
        </div>
      </div>
      <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden mt-3">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: level.color }} />
      </div>

      {edit && (
        <div className="sticky top-2 z-20 mt-4 bg-blue-50 border border-blue-100 rounded-2xl px-3 py-3 flex items-center gap-2 shadow-sm">
          <p className="flex-1 text-xs text-blue-800 font-semibold leading-snug">
            Arrastra desde <GripVertical size={12} className="inline -mt-0.5" /> para ordenar y toca una parada para su color. Nada cambia hasta que pulses Guardar.
          </p>
          <button onClick={onAddChest} aria-label="Añadir cofre"
            className="flex items-center gap-0.5 px-2.5 py-2 rounded-xl text-xs font-black text-amber-900"
            style={{ background: GOLD.bg, boxShadow: `0 3px 0 ${GOLD.shadow}` }}>
            <Plus size={13} strokeWidth={3} />🎁
          </button>
          <button onClick={() => { setMenu(null); onCancelEdit() }} className="px-2.5 py-2 rounded-xl text-xs font-black bg-white text-slate-500 border border-slate-200">Cancelar</button>
          <button onClick={() => { setMenu(null); onSaveEdit() }} className="px-3 py-2 rounded-xl text-xs font-black bg-blue-600 text-white">Guardar</button>
        </div>
      )}

      <div className="relative mt-6 overflow-x-clip" style={{ containerType: 'inline-size' }}>
      <div className="relative flex flex-col items-center pt-6 pb-4">
        {/* Trofeo (arriba del todo) */}
        <div className="relative flex flex-col items-center mb-8">
          <p className={`mb-3 text-lg font-black tracking-wide ${win ? 'text-yellow-400 text-2xl win-title' : 'text-slate-300'}`}>
            {win ? '¡ÉXITO!' : 'ÉXITO'}
          </p>
          <div className="relative">
            {win && <WinBurst />}
            <div className={win ? 'duo-glow win-trophy rounded-full relative' : ''} ref={win ? currentRef : undefined}>
              <Round colors={win ? GOLD : GREY} dim={!win} size={80} label="Éxito">🏆</Round>
            </div>
          </div>
          {win && (
            <div className="absolute bottom-0" style={{ left: '100%', marginLeft: 10 }}>
              <Flowy mood="win" size={64} />
            </div>
          )}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}
          autoScroll={{ threshold: { x: 0, y: 0.12 }, acceleration: 4 }}>
          <SortableContext items={visualIds} strategy={verticalListSortingStrategy}>
            {[...sequence].reverse().map(node => {
              const pos = sequence.indexOf(node)
              const x   = OFFSETS[pos % OFFSETS.length]

              if (node.type === 'chest') {
                const opened = openedChests.has(node.id)
                const ready  = done >= chestNeed[node.id] && !opened
                return (
                  <Row key={node.id} id={node.id} x={x} edit={edit} z="z-0" height={ready && !edit ? ROW + 30 : ROW}>
                    {!edit && scenery(pos, x)}
                    {!edit && <Meadow pos={pos} x={x} side={freeSide(pos, x)} freeBusy={frameNear(pos)} />}
                    {trailBelow(pos)}
                    <div className={`relative ${ready && !edit ? 'duo-wiggle' : ''}`}>
                      <Round colors={ready || edit ? GOLD : opened ? { bg: '#fef3c7', shadow: '#fde68a' } : GREY}
                        dim={!ready && !opened && !edit} rounded="rounded-2xl" label="Cofre"
                        onClick={() => !edit && onOpenChest(node.id, ready || opened)}>
                        {opened ? '✨' : '🎁'}
                      </Round>
                      {edit && (
                        <button onClick={() => onDeleteChest(node.id)} aria-label="Borrar cofre"
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow">
                          <X size={13} strokeWidth={3} />
                        </button>
                      )}
                    </div>
                    {ready && !edit ? <Bubble title="¡ABRIR!" color="#d97706" /> : (
                      <p className="absolute top-[74px] px-1.5 py-0.5 rounded-md bg-white/80 text-[10px] font-bold text-slate-400">{opened ? 'Recompensa' : 'Cofre'}</p>
                    )}
                  </Row>
                )
              }

              const isCurrent = !win && node.id === curId
              const menuOpen  = menu === node.id
              return (
                <Row key={node.id} id={node.id} x={x} edit={edit} z={menuOpen ? 'z-40' : 'z-0'}
                  height={isCurrent && !edit ? ROW + 40 : ROW} marginTop={isCurrent && !edit ? 14 : 0}>
                  {!edit && !isCurrent && !menuOpen && scenery(pos, x)}
                  {!edit && !menuOpen && <Meadow pos={pos} x={x} side={freeSide(pos, x)} freeBusy={frameNear(pos) || isCurrent} />}
                  {trailBelow(pos)}
                  {node.done && !edit && !menuOpen && !hasFrame(pos) && <Bloom side={freeSide(pos, x)} night={night} seed={pos} />}
                  <StopNode item={node} colors={colorsOf(node.id)} isCurrent={isCurrent} x={x} mood={mood} edit={edit}
                    menuOpen={menuOpen} done={done} nodeRef={isCurrent ? currentRef : undefined}
                    onTap={() => edit ? setMenu(menuOpen ? null : node.id) : node.canCheck === false ? onOpenStop(node.id) : onToggle(node.id)}
                    onLong={() => setMenu(node.id)}
                    onCloseMenu={() => setMenu(null)}
                    onSetDone={() => { setMenu(null); onToggle(node.id) }}
                    onDo={() => { setMenu(null); onDo(node.id) }}
                    onMore={() => { setMenu(null); onOpenStop(node.id) }}
                    onColor={k => { onSetColor(node.id, k); setMenu(null) }} />
                </Row>
              )
            })}
          </SortableContext>
        </DndContext>

        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 text-slate-300`}>Inicio</p>
      </div>
      </div>
    </div>
  )
}
