// Camino al éxito: cada cosa cumplida hoy (hábitos + foco) sube al muñeco un escalón

const LEVELS = [
  { min: 0,   emoji: '😴', label: 'Sin empezar', color: '#94a3b8' },
  { min: 1,   emoji: '😐', label: 'Regular',     color: '#fbbf24' },
  { min: 40,  emoji: '🙂', label: 'Bien',        color: '#a3e635' },
  { min: 70,  emoji: '💪', label: 'Muy bien',    color: '#4ade80' },
  { min: 100, emoji: '🏆', label: '¡ÉXITO!',     color: '#facc15' },
]

function levelFor(pct) {
  return [...LEVELS].reverse().find(l => pct >= l.min)
}

// Geometría del dibujo (viewBox 320 x 200)
const X0 = 24, Y0 = 178, TOP_X = 250, TOP_Y = 70

function StickFigure({ win }) {
  return (
    <g stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <circle cx="0" cy="-30" r="6" />
      <line x1="0" y1="-24" x2="0" y2="-11" />
      {win ? (
        <>
          <line x1="0" y1="-21" x2="-8" y2="-32" />
          <line x1="0" y1="-21" x2="8" y2="-32" />
        </>
      ) : (
        <>
          <line x1="0" y1="-20" x2="-6" y2="-14" />
          <line x1="0" y1="-20" x2="8" y2="-18" />
        </>
      )}
      <line x1="0" y1="-11" x2="-6" y2="0" />
      <line x1="0" y1="-11" x2="6" y2="-4" />
      <line x1="6" y1="-4" x2="8" y2="0" />
    </g>
  )
}

export default function SuccessStairs({ done, total }) {
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0
  const level = levelFor(pct)
  const win   = total > 0 && done >= total
  const n     = Math.max(total, 1)
  // Peldaños como máximo de 40x22: con pocos, la escalera es más corta y termina igualmente arriba
  const w     = Math.min((TOP_X - X0) / n, 40)
  const h     = Math.min((Y0 - TOP_Y) / n, 22)
  const sx    = TOP_X - n * w
  const sy    = TOP_Y + n * h

  // Escalera: suelo inicial + n peldaños
  let d = `M ${sx - 16} ${sy} L ${sx} ${sy}`
  for (let i = 0; i < n; i++) {
    d += ` L ${sx + i * w} ${sy - (i + 1) * h} L ${sx + (i + 1) * w} ${sy - (i + 1) * h}`
  }

  // Posición del muñeco: centro del peldaño alcanzado (0 = suelo)
  const fx = done === 0 ? sx - 6 : sx + (done - 1) * w + w / 2
  const fy = sy - done * h

  return (
    <div className="rounded-3xl overflow-hidden shadow-lg bg-slate-950 px-4 pt-4 pb-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Camino al éxito</p>
        <p className="text-xs font-black text-slate-300 tabular-nums">{done}/{total}</p>
      </div>

      {total === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">
          Añade hábitos o tu foco del día para empezar a subir
        </p>
      ) : (
        <svg viewBox="0 0 320 200" className="w-full mt-1" style={{ overflow: 'visible' }}>
          <defs>
            <filter id="exito-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={win ? 4 : 2} result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Escalera */}
          <path d={d} fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {/* Peldaños ya subidos */}
          {Array.from({ length: done }, (_, i) => (
            <line key={i}
              x1={sx + i * w} y1={sy - (i + 1) * h} x2={sx + (i + 1) * w} y2={sy - (i + 1) * h}
              stroke={level.color} strokeWidth="3.5" strokeLinecap="round" />
          ))}

          {/* Flecha final */}
          <line x1={TOP_X} y1={TOP_Y} x2={TOP_X + 34} y2={TOP_Y - 34}
            stroke={win ? '#facc15' : 'white'} strokeWidth="3" strokeLinecap="round" />
          <path d={`M ${TOP_X + 40} ${TOP_Y - 40} l -16 3 l 13 13 z`} fill={win ? '#facc15' : 'white'} />

          {/* ÉXITO */}
          <text x={TOP_X - 10} y="26" textAnchor="middle" fontSize="22" fontWeight="900"
            fill={win ? '#fde047' : '#a16207'} filter="url(#exito-glow)"
            className={win ? 'exito-pulse' : ''}>
            ÉXITO
          </text>
          {win && [[-58, 14], [40, 10], [-48, 40], [52, 36]].map(([dx, dy], i) => (
            <text key={i} x={TOP_X - 10 + dx} y={dy} fontSize="12" className="exito-spark"
              style={{ animationDelay: `${i * 0.25}s` }}>✨</text>
          ))}

          {/* Muñeco (se desliza al nuevo peldaño y da un saltito) */}
          <g style={{ transform: `translate(${fx}px, ${fy}px)`, transition: 'transform 0.7s cubic-bezier(.34,1.3,.64,1)' }}>
            <g key={done} className="stairs-hop">
              <StickFigure win={win} />
            </g>
          </g>
        </svg>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">{level.emoji}</span>
            <span className="font-black text-sm" style={{ color: level.color }}>{level.label}</span>
          </div>
          <div className="flex-1 max-w-[45%] h-1.5 bg-slate-800 rounded-full overflow-hidden ml-3">
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: level.color }} />
          </div>
        </div>
      )}
    </div>
  )
}
