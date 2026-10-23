import { supabase } from './supabase'

// Vision board: imágenes de metas que se ven en cuadros a lo largo del Camino al éxito.
// Estas son las de serie; si el usuario sube o quita fotos, su lista va en config.vision.
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
export function visionForToday(list = VISION_IMAGES, date = new Date()) {
  if (!list.length) return []
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
  const start = day % list.length
  return [...list.slice(start), ...list.slice(0, start)]
}

// Reduce la foto en el móvil (máx. 1400 px, WebP) para que suba rápido y ocupe poco
function shrink(file, max = 1400) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * k)
      canvas.height = Math.round(img.height * k)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(img.src)
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo leer la foto'))), 'image/webp', 0.85)
    }
    img.onerror = () => reject(new Error('No se pudo leer la foto'))
    img.src = URL.createObjectURL(file)
  })
}

// Sube una foto a vision/<id de usuario>/ y devuelve su enlace público
export async function uploadVisionImage(file, userId) {
  const blob = await shrink(file)
  const path = `${userId}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.webp`
  const { error } = await supabase.storage.from('vision').upload(path, blob, { contentType: 'image/webp' })
  if (error) throw error
  return supabase.storage.from('vision').getPublicUrl(path).data.publicUrl
}

// Borra una foto subida (las de serie no se tocan)
export async function deleteVisionImage(url) {
  const marker = '/storage/v1/object/public/vision/'
  const i = url.indexOf(marker)
  if (i === -1) return
  await supabase.storage.from('vision').remove([decodeURIComponent(url.slice(i + marker.length))])
}
