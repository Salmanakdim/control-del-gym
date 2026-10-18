import { useEffect, useRef, useState } from 'react'
import { Settings, Check, Play, Pencil, GripVertical, X, Plus, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Flowy from './Flowy'
import { STOP_COLORS } from '../lib/pathConfig'

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
        {isCurrent && !edit && <div className="absolute -inset-2.5 rounded-full border-[6px] border-slate-200" />}
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
        <p className="absolute top-[74px] text-[10px] font-bold text-slate-500 max-w-[90px] truncate text-center">{item.label}</p>
      )}
    </>
  )
}

export default function SuccessPath({
  sequence, colorsOf, openedChests,
  onToggle, onOpenStop, onDo, onOpenChest, onOpenSettings,
  onReorder, onSetColor, onAddChest, onDeleteChest,
}) {
  const currentRef = useRef(null)
  const [edit, setEdit] = useState(false)
  const [menu, setMenu] = useState(null)   // id de la parada con el menú abierto

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

  return (
    <div>
      {menu && <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />}

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Camino al éxito</p>
        <div className="flex items-center gap-1.5">
          <span>{level.emoji}</span>
          <span className="text-xs font-black" style={{ color: level.color }}>{level.label}</span>
          <span className="text-xs font-black text-slate-400 tabular-nums ml-1">{done}/{total}</span>
          <button onClick={() => { setEdit(e => !e); setMenu(null) }} aria-label="Editar camino"
            className={`ml-1 w-8 h-8 rounded-xl shadow-sm flex items-center justify-center ${edit ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}>
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
            Arrastra desde <GripVertical size={12} className="inline -mt-0.5" /> para ordenar. Toca una parada para cambiar su color.
          </p>
          <button onClick={onAddChest} aria-label="Añadir cofre"
            className="flex items-center gap-0.5 px-2.5 py-2 rounded-xl text-xs font-black text-amber-900"
            style={{ background: GOLD.bg, boxShadow: `0 3px 0 ${GOLD.shadow}` }}>
            <Plus size={13} strokeWidth={3} />🎁
          </button>
          <button onClick={() => setEdit(false)} className="px-3 py-2 rounded-xl text-xs font-black bg-blue-600 text-white">Listo</button>
        </div>
      )}

      <div className="flex flex-col items-center mt-6 pb-4">
        {/* Trofeo (arriba del todo) */}
        <div className="relative flex flex-col items-center mb-8">
          <p className={`mb-3 text-lg font-black tracking-wide ${win ? 'text-yellow-500' : 'text-slate-300'}`}>ÉXITO</p>
          <div className={win ? 'duo-glow rounded-full' : ''} ref={win ? currentRef : undefined}>
            <Round colors={win ? GOLD : GREY} dim={!win} size={80} label="Éxito">🏆</Round>
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
                      <p className="absolute top-[74px] text-[10px] font-bold text-slate-400">{opened ? 'Recompensa' : 'Cofre'}</p>
                    )}
                  </Row>
                )
              }

              const isCurrent = !win && node.id === curId
              const menuOpen  = menu === node.id
              return (
                <Row key={node.id} id={node.id} x={x} edit={edit} z={menuOpen ? 'z-40' : 'z-0'}
                  height={isCurrent && !edit ? ROW + 40 : ROW} marginTop={isCurrent && !edit ? 14 : 0}>
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

        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Inicio</p>
      </div>
    </div>
  )
}
