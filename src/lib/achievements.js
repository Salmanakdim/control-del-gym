// Logros y medallas del Camino al éxito. Cada uno se comprueba con unas estadísticas
// calculadas del historial; una vez conseguido se guarda (config.achievements) y no se pierde.

export const ACHIEVEMENTS = [
  { id: 'first_stop',  emoji: '👣', title: 'Primer paso',     desc: 'Completa tu primera parada',            test: s => s.totalDone >= 1 },
  { id: 'first_day',   emoji: '🏆', title: 'Día perfecto',    desc: 'Completa el camino entero un día',      test: s => s.bestPerfect >= 1 },
  { id: 'perfect_3',   emoji: '🔥', title: 'En racha',        desc: '3 días perfectos seguidos',             test: s => s.bestPerfect >= 3 },
  { id: 'perfect_7',   emoji: '😎', title: 'Semana perfecta', desc: '7 días perfectos seguidos',             test: s => s.bestPerfect >= 7 },
  { id: 'perfect_30',  emoji: '👑', title: 'Mes perfecto',    desc: '30 días perfectos seguidos',            test: s => s.bestPerfect >= 30 },
  { id: 'stop_7',      emoji: '⭐', title: 'Constante',       desc: 'Una parada 7 días seguidos',            test: s => s.bestStop >= 7 },
  { id: 'stop_30',     emoji: '💎', title: 'Imparable',       desc: 'Una parada 30 días seguidos',           test: s => s.bestStop >= 30 },
  { id: 'fajr_7',      emoji: '🌅', title: 'Madrugador',      desc: 'Fajr 7 días seguidos',                  test: s => s.fajrStreak >= 7 },
  { id: 'stops_100',   emoji: '💯', title: 'Cien paradas',    desc: 'Completa 100 paradas en total',         test: s => s.totalDone >= 100 },
  { id: 'chests_10',   emoji: '🎁', title: 'Cazatesoros',     desc: 'Abre 10 cofres',                        test: s => s.chests >= 10 },
]

// Cofres abiertos en total (se guardan por día en el móvil: fwd_chests_AAAA-MM-DD)
export function countOpenedChests() {
  let n = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith('fwd_chests_')) n += (JSON.parse(localStorage.getItem(k)) || []).length
    }
  } catch { /* sin almacenamiento */ }
  return n
}
