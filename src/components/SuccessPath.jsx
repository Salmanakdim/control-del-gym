import { useEffect, useRef, useState } from 'react'
import Flowy from './Flowy'
import { Settings } from 'lucide-react'
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Camino al éxito estilo Duolingo: se empieza abajo y se sube hasta el trofeo.
// Paradas = hábitos + foco; entre ellas, cofres de recompensa donde el usuario elija.

const LEVELS = [
  { min: 0,   emoji: '😴', label: 'Sin empezar', color: '#94a3b8' },
  { min: 1,   emoji: '😐', label: 'Regular',     color: '#f59e0b' },
  { min: 40,  emoji: '🙂', label: 'Bien',        color: '#84cc16' },
  { min: 70,  emoji: '💪', label: 'Muy bien',    color: '#58cc02' },
  { min: 100, emoji: '🏆', label: '¡ÉXITO!',     color: '#eab308' },
]
function levelFor(pct) { return [...LEVELS].reverse().find(l => pct >= l.min) }

// Zigzag horizontal (px desde el centro)
const OFFSETS = [0, 44, 66, 44, 0, -44, -66, -44]
const ROW = 96

const GREEN  = { bg: '#58cc02', shadow: '#46a302' }
const GREY   = { bg: '#e2e8f0', shadow: '#cbd5e1' }
const GOLD   = { bg: '#ffc800', shadow: '#e0a800' }

function Bubble({ title, subtitle, color = '#58cc02' }) {
  return (
    <div className="absolute top-[86px] left-1/2 duo-bounce z-10">
      <div className="relative px-3 py-1.5 rounded-xl border-2 border-slate-200 bg-white shadow-sm text-center whitespace-nowrap">
        <div className="absolute left-1/2 -top-[7px] -translate-x-1/2 w-3 h-3 rotate-45 bg-white border-l-2 border-t-2 border-slate-200" />
        <p className="text-xs font-black" style={{ color }}>{title}</p>
        {subtitle && <p className="text-[10px] font-bold text-slate-500 max-w-[130px] truncate">{subtitle}</p>}
      </div>
    </div>
  )
}

function Round({ colors, onClick, label, dim, pop, children, size = 64, rounded = 'rounded-full' }) {
  return (
    <button onClick={onClick} aria-label={label}
      className={`relative ${rounded} flex items-center justify-center text-2xl transition-transform active:translate-y-1.5 ${pop ? 'duo-pop' : ''}`}
      style={{ width: size, height: size, background: colors.bg, boxShadow: `0 7px 0 ${colors.shadow}` }}>
      <span style={dim ? { filter: 'grayscale(1)', opacity: 0.45 } : undefined}>{children}</span>
    </button>
  )
}

// Fila de parada arrastrable: mantener pulsado y mover arriba/abajo
function SortableRow({ id, x, height, marginTop, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners}
      onContextMenu={e => e.preventDefault()}
      className={`relative flex justify-center items-start select-none ${isDragging ? 'z-30 opacity-90' : ''}`}
      style={{
        height, marginTop, WebkitTouchCallout: 'none', transition,
        transform: `${CSS.Translate.toString(transform) || ''} translateX(${x}px) ${isDragging ? 'scale(1.1)' : ''}`,
      }}>
      {children}
    </div>
  )
}

export default function SuccessPath({ items, chests, openedChests, onOpenStop, onOpenChest, onOpenSettings, onReorder }) {
  const currentRef = useRef(null)
  const total   = items.length
  const ordered = items   // el orden lo elige el usuario
  const done    = ordered.filter(i => i.done).length
  const curIdx  = ordered.findIndex(i => !i.done)   // primera parada pendiente

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
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
  )

  // El camino se pinta de arriba (última) a abajo (primera): el orden visual es el inverso
  const visualIds = [...ordered].reverse().map(i => i.id)
  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const moved = arrayMove(visualIds, visualIds.indexOf(active.id), visualIds.indexOf(over.id))
    onReorder(moved.reverse())
  }
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0
  const level   = levelFor(pct)
  const win     = total > 0 && done === total

  // Al abrir, centrar la pantalla en la parada actual
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  // Secuencia de abajo a arriba: parada, (cofre), parada, ...
  const seq = []
  ordered.forEach((item, i) => {
    seq.push({ type: 'stop', item, index: i })
    if (chests.includes(i + 1)) seq.push({ type: 'chest', k: i + 1 })
  })

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Camino al éxito</p>
        <div className="flex items-center gap-1.5">
          <span>{level.emoji}</span>
          <span className="text-xs font-black" style={{ color: level.color }}>{level.label}</span>
          <span className="text-xs font-black text-slate-400 tabular-nums ml-1">{done}/{total}</span>
          <button onClick={onOpenSettings} aria-label="Personalizar camino"
            className="ml-1 w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-500 active:bg-slate-50">
            <Settings size={15} />
          </button>
        </div>
      </div>
      <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden mt-3">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: level.color }} />
      </div>

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
        {[...seq].reverse().map(node => {
          const pos = seq.indexOf(node)
          const x   = OFFSETS[pos % OFFSETS.length]

          if (node.type === 'chest') {
            const opened = openedChests.has(node.k)
            const ready  = done >= node.k && !opened
            return (
              <div key={`chest-${node.k}`} className="relative flex justify-center items-start"
                style={{ height: ready ? ROW + 30 : ROW, transform: `translateX(${x}px)` }}>
                <div className={ready ? 'duo-wiggle' : ''}>
                  <Round colors={ready ? GOLD : opened ? { bg: '#fef3c7', shadow: '#fde68a' } : GREY}
                    dim={!ready && !opened} rounded="rounded-2xl" label="Cofre"
                    onClick={() => onOpenChest(node.k, ready || opened)}>
                    {opened ? '✨' : '🎁'}
                  </Round>
                </div>
                {ready ? <Bubble title="¡ABRIR!" color="#d97706" /> : (
                  <p className="absolute top-[74px] text-[10px] font-bold text-slate-400">
                    {opened ? 'Recompensa' : 'Cofre'}
                  </p>
                )}
              </div>
            )
          }

          const { item, index } = node
          const isCurrent = !win && index === curIdx
          const colors = item.done || isCurrent ? GREEN : GREY
          return (
            <SortableRow key={item.id} id={item.id} x={x} height={isCurrent ? ROW + 34 : ROW} marginTop={isCurrent ? 14 : 0}>
              <div className="relative" ref={isCurrent ? currentRef : undefined}>
                {isCurrent && <div className="absolute -inset-2.5 rounded-full border-[6px] border-slate-200" />}
                <Round key={`${item.id}-${item.done}`} colors={colors} dim={!item.done && !isCurrent}
                  pop={item.done} label={item.label} onClick={() => onOpenStop(item)}>
                  {item.icon}
                </Round>
                {item.done && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-[#58cc02] text-[11px] font-black flex items-center justify-center shadow">✓</span>
                )}
                {isCurrent && (
                  <div className="absolute -top-2" style={x > 0 ? { right: '100%', marginRight: 16 } : { left: '100%', marginLeft: 16 }}>
                    <Flowy mood={mood} size={60} />
                  </div>
                )}
              </div>
              {isCurrent
                ? <Bubble title={done === 0 ? 'EMPEZAR' : 'SIGUIENTE'} subtitle={item.label} />
                : <p className="absolute top-[74px] text-[10px] font-bold text-slate-500 max-w-[90px] truncate text-center">{item.label}</p>}
            </SortableRow>
          )
        })}
        </SortableContext>
        </DndContext>

        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Inicio</p>
      </div>
    </div>
  )
}
