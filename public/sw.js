// Service worker de Flowlyday: solo recibe las notificaciones push
// (recordatorios de concentración). No guarda nada en caché.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', e => {
  let d
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data ? e.data.text() : '' } }
  // iPhone exige mostrar una notificación por cada push recibido
  e.waitUntil(self.registration.showNotification(d.title || 'Concéntrate 🎯', {
    body: d.body || 'Abre Flowlyday y sigue con tu camino',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || 'flowly-focus',
    renotify: true,
    data: { url: d.url || '/?focus=1' },
  }))
})

// Al tocarla: si la app ya está abierta, se trae delante y abre la pantalla de
// concentración; si no, se abre en ella.
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/?focus=1'
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of wins) {
      if ('focus' in w) {
        w.postMessage({ type: 'focus' })
        return w.focus()
      }
    }
    return self.clients.openWindow(url)
  })())
})
