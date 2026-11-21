// Service worker de Flowlyday: solo recibe las notificaciones push
// (recordatorios de concentración). No guarda nada en caché.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', e => {
  let d
  try { d = e.data ? e.data.json() : {} } catch { d = { body: e.data ? e.data.text() : '' } }
  // iPhone exige mostrar una notificación por cada push recibido.
  // Cada aviso con su propia etiqueta: si reemplaza a otro con la misma, el iPhone
  // lo muestra sin sonido (Safari ignora `renotify`). Los anteriores se quitan
  // primero para que no se acumulen.
  e.waitUntil((async () => {
    const old = await self.registration.getNotifications()
    old.forEach(n => n.close())
    await self.registration.showNotification(d.title || 'Concéntrate 🎯', {
      body: d.body || 'Abre Flowlyday y sigue con tu camino',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'flowly-' + Date.now(),
      silent: false,            // con el sonido normal de notificaciones del móvil
      vibrate: [200, 100, 200], // Android (el iPhone vibra según sus ajustes)
      data: { url: d.url || '/?focus=1' },
    })
  })())
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
