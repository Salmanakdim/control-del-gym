// Vision board: imágenes de metas que se ven en cuadros a lo largo del Camino al éxito
export const VISION_IMAGES = [
  '/vision/1.webp',
  '/vision/2.webp',
  '/vision/kaaba.webp',
  '/vision/5.webp',
  '/vision/6.webp',
  '/vision/7.webp',
  '/vision/8.webp',
  '/vision/9.webp',
  '/vision/familia.webp',
  '/vision/rs6.webp',
]

// En el camino caben menos cuadros que imágenes: cada día se empieza por una
// distinta, así en unos días salen todas.
export function visionForToday(date = new Date()) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
  const start = day % VISION_IMAGES.length
  return [...VISION_IMAGES.slice(start), ...VISION_IMAGES.slice(0, start)]
}
