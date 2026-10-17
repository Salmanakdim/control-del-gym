// Camino al éxito estilo Duolingo: un botón por hábito/foco, de arriba (inicio) a abajo (trofeo)

const LEVELS = [
  { min: 0,   emoji: '😴', label: 'Sin empezar', color: '#94a3b8' },
  { min: 1,   emoji: '😐', label: 'Regular',     color: '#fbbf24' },
  { min: 40,  emoji: '🙂', label: 'Bien',        color: '#a3e635' },
  { min: 70,  emoji: '💪', label: 'Muy bien',    color: '#58cc02' },
  { min: 100, emoji: '🏆', label: '¡ÉXITO!',     color: '#facc15' },
]
function levelFor(pct) { return [...LEVELS].reverse().find(l => pct >= l.min) }

// Zigzag horizontal de cada nodo (px desde el centro), como el camino de Duolingo
const OFFSETS = [0, 44, 66, 44, 0, -44, -66, -44]
const ROW = 92

function Mascot({ win }) {
  return (
    <svg width="44" height="60" viewBox="-22 -46 44 52" className={win ? 'duo-cheer' : 'duo-idle'}>
      <g stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <circle cx="0" cy="-34" r="8" fill="#131f24" />
        <line x1="0" y1="-26" x2="0" y2="-10" />
        {win ? (
          <><line x1="0" y1="-22" x2="-10" y2="-36" /><line x1="0" y1="-22" x2="10" y2="-36" /></>
        ) : (
          <><line x1="0" y1="-21" x2="-9" y2="-14" /><line x1="0" y1="-21" x2="9" y2="-14" /></>
        )}
        <line x1="0" y1="-10" x2="-7" y2="2" />
        <line x1="0" y1="-10" x2="7" y2="2" />
      </g>
      <circle cx="-3" cy="-35" r="1.4" fill="white" />
      <circle cx="3" cy="-35" r="1.4" fill="white" />
    </svg>
  )
}

function Node({ item, state, onTap }) {
  // state: done | current | locked
  const styles = {
    done:    { bg: '#58cc02', shadow: '#46a302' },
    current: { bg: '#58cc02', shadow: '#46a302' },
    locked:  { bg: '#37464f', shadow: '#2a363d' },
  }[state]
  return (
    <button onClick={onTap} aria-label={item.label}
      className={`relative w-16 h-16 rounded-full flex items-center justify-center text-2xl transition-transform active:translate-y-1.5 ${state === 'done' ? 'duo-pop' : ''}`}
      style={{ background: styles.bg, boxShadow: `0 7px 0 ${styles.shadow}` }}>
      <span style={state === 'locked' ? { filter: 'grayscale(1)', opacity: 0.45 } : undefined}>{item.icon}</span>
      {state === 'done' && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-[#58cc02] text-[11px] font-black flex items-center justify-center shadow">✓</span>
      )}
    </button>
  )
}

export default function SuccessPath({ items, onToggle }) {
  const total = items.length
  // Primero lo hecho (sube por el camino), luego lo pendiente
  const ordered  = [...items.filter(i => i.done), ...items.filter(i => !i.done)]
  const done     = items.filter(i => i.done).length
  const pct      = total > 0 ? Math.round((done / total) * 100) : 0
  const level    = levelFor(pct)
  const win      = total > 0 && done === total
  const curIdx   = win ? -1 : done

  return (
    <div className="rounded-3xl overflow-hidden shadow-lg px-4 pt-4 pb-6" style={{ background: '#131f24' }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Camino al éxito</p>
        <div className="flex items-center gap-1.5">
          <span>{level.emoji}</span>
          <span className="text-xs font-black" style={{ color: level.color }}>{level.label}</span>
          <span className="text-xs font-black text-slate-500 tabular-nums ml-1">{done}/{total}</span>
        </div>
      </div>
      <div className="h-2 bg-[#37464f] rounded-full overflow-hidden mt-3">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: level.color }} />
      </div>

      {total === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">Añade hábitos o tu foco del día para empezar el camino</p>
      ) : (
        <div className="flex flex-col items-center mt-6">
          {ordered.map((item, i) => {
            const x     = OFFSETS[i % OFFSETS.length]
            const state = item.done ? 'done' : i === curIdx ? 'current' : 'locked'
            return (
              <div key={item.id} className="relative flex justify-center items-start"
                style={{ height: state === 'current' ? ROW + 34 : ROW, marginTop: state === 'current' ? 14 : 0, transform: `translateX(${x}px)` }}>
                <div className="relative">
                  {state === 'current' && (
                    <div className="absolute -inset-2.5 rounded-full border-[6px] border-[#37464f]" />
                  )}
                  <Node key={`${item.id}-${item.done}`} item={item} state={state} onTap={() => onToggle(item.id)} />
                  {state === 'current' && (
                    <div className="absolute top-0" style={x > 0 ? { right: '100%', marginRight: 22 } : { left: '100%', marginLeft: 22 }}>
                      <Mascot />
                    </div>
                  )}
                </div>
                {state === 'current' ? (
                  <div className="absolute top-[86px] left-1/2 duo-bounce z-10">
                    <div className="relative px-3 py-1.5 rounded-xl border-2 border-[#37464f] bg-[#131f24] text-center whitespace-nowrap">
                      <div className="absolute left-1/2 -top-[7px] -translate-x-1/2 w-3 h-3 rotate-45 bg-[#131f24] border-l-2 border-t-2 border-[#37464f]" />
                      <p className="text-[#58cc02] text-xs font-black">{done === 0 ? 'EMPEZAR' : 'SIGUIENTE'}</p>
                      <p className="text-[10px] font-bold text-slate-300 max-w-[120px] truncate">{item.label}</p>
                    </div>
                  </div>
                ) : (
                  <p className="absolute top-[74px] text-[10px] font-bold text-slate-400 max-w-[90px] truncate text-center">{item.label}</p>
                )}
              </div>
            )
          })}

          {/* Trofeo final */}
          <div className="relative flex flex-col items-center mt-2">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl ${win ? 'duo-glow' : ''}`}
              style={{ background: win ? '#facc15' : '#37464f', boxShadow: `0 7px 0 ${win ? '#ca8a04' : '#2a363d'}` }}>
              <span style={win ? undefined : { filter: 'grayscale(1)', opacity: 0.45 }}>🏆</span>
            </div>
            <p className={`mt-3 text-lg font-black tracking-wide ${win ? 'text-yellow-300 duo-bounce' : 'text-slate-600'}`}>ÉXITO</p>
            {win && (
              <div className="absolute top-0" style={{ left: '100%', marginLeft: 18 }}>
                <Mascot win />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
