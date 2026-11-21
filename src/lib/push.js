import { supabase } from './supabase'

// Notificaciones push (recordatorios de concentración). El servidor que las manda
// es la función de Supabase "focus-reminders"; esta es su clave pública.
const VAPID_PUBLIC_KEY = 'BEvmjByMVfYJascLPYkOzDBFZobvI-PlGGcrM2YhgNVmHBFm3DG0Tkc5SYWQ6iyJ1oHypz6eX4Cwl6eQ487xnaA'

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

// Abierta desde el icono de la pantalla de inicio (en iPhone es la única forma de recibir avisos)
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.register('/sw.js').catch(e => console.warn('[push] sw', e))
}

function keyBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

// Pide permiso (tiene que ser al tocar un botón) y guarda este dispositivo en Supabase.
// Devuelve '' si todo fue bien, o el motivo.
export async function enablePush(userId) {
  if (!pushSupported()) return isIOS() && !isStandalone() ? 'ios-browser' : 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) })
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions')
    .upsert({ endpoint: j.endpoint, user_id: userId, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' })
  if (error) return /relation|does not exist|schema cache/i.test(error.message) ? 'no-table' : 'save'
  return ''
}

// Manda ya mismo un aviso de prueba a todos tus dispositivos
export async function sendTestPush() {
  const { data, error } = await supabase.functions.invoke('focus-reminders', { body: { test: true } })
  if (error) return { sent: 0, error: 'no-function' }
  return { sent: data?.sent || 0 }
}
