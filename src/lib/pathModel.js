import { guessLink, STOP_COLORS, marksFor } from './pathConfig'

// Construye el camino (paradas + cofres, de abajo a arriba) a partir de una configuración.
// Es una función pura: se usa para el camino guardado y para el borrador de Personalizar.
export function buildPath({ config, habits, todayLogs, focusText, focusDone, today }) {
  const hidden     = config.hidden || []
  const custom     = config.custom || []
  const customDone = config.customDone?.date === today ? config.customDone.ids : []
  const marks      = marksFor(config, today)   // ❌ no lo hice / ⏭️ saltar hoy

  // Dónde se hace cada parada (hábito: elegido o adivinado por el nombre; propia: la suya)
  function linkOf(id) {
    const c = custom.find(x => x.id === id)
    if (c) return c.link || 'none'
    const h = habits.find(x => x.id === id)
    return h ? ((config.links || {})[id] || guessLink(h.name)) : 'none'
  }

  // Todas las paradas posibles; el camino muestra las no ocultas
  const allStops = [
    { id: '__focus', icon: '🎯', label: focusText ? `Foco: ${focusText}` : 'Foco del día', done: !!focusText && focusDone, kind: 'focus' },
    ...habits.map(h => ({ id: h.id, icon: h.icon || '⭐', label: h.name, done: todayLogs.has(h.id), kind: 'habit' })),
    ...custom.map(c => ({ id: c.id, icon: c.icon || '⭐', label: c.label, done: customDone.includes(c.id), kind: 'custom' })),
  ]
  const stops = allStops.filter(s => !hidden.includes(s.id)).map(s => ({
    ...s,
    type: 'stop',
    // Si está hecha, manda "hecho"; si no, lo que se haya marcado hoy
    missed:  !s.done && marks[s.id]?.s === 'missed',
    skipped: !s.done && marks[s.id]?.s === 'skipped',
    why:     !s.done ? marks[s.id]?.why || '' : '',
    canDo: s.kind !== 'focus' && linkOf(s.id) !== 'none',   // se hace dentro de la app → ▶
    canCheck: s.kind !== 'focus' || !!focusText,           // el foco necesita estar escrito
  }))

  // Cofres: lista propia; los antiguos (por número de parada) se convierten la primera vez
  const legacyChests = !config.chestList
  const chestList    = config.chestList || (config.chests || []).map(k => `chest_${k}`)

  // Secuencia de abajo a arriba según el orden guardado; lo nuevo va al final (arriba)
  const order = config.order || []
  const sortedStops = [...stops].sort((a, b) => {
    const ra = order.indexOf(a.id), rb = order.indexOf(b.id)
    return (ra === -1 ? 1e6 + allStops.indexOf(a) : ra) - (rb === -1 ? 1e6 + allStops.indexOf(b) : rb)
  })
  const sequence = [...sortedStops]
  chestList.forEach(id => {
    const r = order.indexOf(id)
    let at
    if (r !== -1) {
      at = sequence.findIndex(n => { const rn = order.indexOf(n.id); return rn !== -1 && rn > r })
    } else if (legacyChests) {
      const k = Number(id.split('_')[1]) || 0   // después de la parada nº k
      let seen = 0
      at = sequence.findIndex(n => n.type === 'stop' && ++seen > k)
    } else at = -1
    sequence.splice(at === -1 ? sequence.length : at, 0, { type: 'chest', id })
  })

  const colorsOf = id => STOP_COLORS[config.colors?.[id]] || STOP_COLORS.green

  return { hidden, custom, customDone, marks, linkOf, allStops, stops: sortedStops, chestList, legacyChests, sequence, colorsOf }
}
