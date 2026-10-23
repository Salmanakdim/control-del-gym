import { useId } from 'react'

// Flowy, la mascota de Flowlyday (gotita azul).
// mood: 'idle' (parpadea y se balancea) | 'hop' (salta al completar) | 'push' (¡vamos!) | 'win' (celebra)
// level: accesorios según la racha de días perfectos
//   1 (3+ días) cinta · 2 (7+) gafas de sol · 3 (14+) corona plateada · 4 (30+) corona dorada y brillo
export default function Flowy({ mood = 'idle', size = 56, level = 0 }) {
  const grad = useId()
  const win  = mood === 'win'
  const push = mood === 'push'
  const anim = { idle: 'flowy-sway', hop: 'flowy-hop', push: 'flowy-hop', win: 'flowy-party' }[mood]

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={{ overflow: 'visible' }} aria-label="Flowy">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      {win && [[14, 20, '#f59e0b'], [100, 16, '#22c55e'], [8, 52, '#ec4899'], [108, 48, '#3b82f6'], [30, 6, '#a855f7'], [88, 4, '#f43f5e']].map(([x, y, c], i) => (
        <rect key={i} className="flowy-conf" x={x} y={y} width="7" height="11" rx="2" fill={c} style={{ animationDelay: `${i * 0.15}s` }} />
      ))}

      {level >= 4 && <circle cx="60" cy="72" r="54" fill="#fde047" opacity=".35" className="flowy-aura" />}

      <g className={anim}>
        {/* Brazos */}
        {win ? (
          <path d="M24 78 q-12 -10 -8 -26 M96 78 q12 -10 8 -26" stroke="#2563eb" strokeWidth="7" fill="none" strokeLinecap="round" />
        ) : push ? (
          <>
            <path d="M24 86 q-12 4 -12 -6 M96 86 q10 -6 8 -20" stroke="#2563eb" strokeWidth="7" fill="none" strokeLinecap="round" />
            <circle cx="104" cy="64" r="6" fill="#2563eb" />
          </>
        ) : (
          <path d="M24 86 q-12 4 -12 -6 M96 86 q12 4 12 -6" stroke="#2563eb" strokeWidth="7" fill="none" strokeLinecap="round" />
        )}

        {/* Pies + cuerpo */}
        <ellipse cx="48" cy="114" rx="9" ry="4" fill="#1d4ed8" />
        <ellipse cx="72" cy="114" rx="9" ry="4" fill="#1d4ed8" />
        <path d="M60 10 C60 10 22 54 22 78 a38 36 0 0 0 76 0 C98 54 60 10 60 10 Z" fill={`url(#${grad})`} />
        <ellipse cx="42" cy="62" rx="6" ry="11" fill="#fff" opacity=".35" transform="rotate(25 42 62)" />
        <ellipse cx="38" cy="88" rx="6" ry="3.5" fill="#fb7185" opacity=".45" />
        <ellipse cx="82" cy="88" rx="6" ry="3.5" fill="#fb7185" opacity=".45" />

        {/* Cara */}
        {win ? (
          <>
            <path d="M41 76 q6 -8 12 0 M67 76 q6 -8 12 0" stroke="#0f172a" strokeWidth="4" fill="none" strokeLinecap="round" />
            <path d="M49 88 q11 16 22 0 z" fill="#0f172a" />
            <path d="M54 95 q6 4 12 0" fill="#fb7185" />
          </>
        ) : (
          <>
            {push && <path d="M39 59 l13 4 M81 59 l-13 4" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />}
            <g className="flowy-blink">
              <ellipse cx="47" cy="74" rx="8" ry="9.5" fill="#fff" />
              <ellipse cx="73" cy="74" rx="8" ry="9.5" fill="#fff" />
              <circle cx="48.5" cy="75.5" r="5" fill="#0f172a" />
              <circle cx="74.5" cy="75.5" r="5" fill="#0f172a" />
              <circle cx="50" cy="73.5" r="1.8" fill="#fff" />
              <circle cx="76" cy="73.5" r="1.8" fill="#fff" />
            </g>
            {push
              ? <path d="M53 91 h14" stroke="#0f172a" strokeWidth="3.5" strokeLinecap="round" />
              : <path d="M52 90 q8 8 16 0" stroke="#0f172a" strokeWidth="3.5" fill="none" strokeLinecap="round" />}
          </>
        )}
        {/* Accesorios de racha */}
        {level >= 1 && level < 3 && (
          <>
            <path d="M38 50 Q60 42 82 50 L84 57 Q60 49 36 57 Z" fill="#ef4444" />
            <path d="M84 52 l10 -4 M84 55 l9 3" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
          </>
        )}
        {level >= 2 && (
          <g>
            <rect x="35" y="66" width="22" height="15" rx="6" fill="#0f172a" />
            <rect x="63" y="66" width="22" height="15" rx="6" fill="#0f172a" />
            <path d="M57 71 h6" stroke="#0f172a" strokeWidth="3" />
            <path d="M39 70 l6 -2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
            <path d="M67 70 l6 -2" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7" />
          </g>
        )}
        {level >= 3 && (
          <g transform="translate(60 18)">
            <path d="M-16 6 L-18 -12 L-8 -3 L0 -16 L8 -3 L18 -12 L16 6 Z" fill={level >= 4 ? '#facc15' : '#cbd5e1'} stroke={level >= 4 ? '#ca8a04' : '#94a3b8'} strokeWidth="2" strokeLinejoin="round" />
            <circle cx="0" cy="-2" r="2.5" fill={level >= 4 ? '#ef4444' : '#60a5fa'} />
          </g>
        )}
      </g>
    </svg>
  )
}
