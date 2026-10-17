import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

function toNotifId(taskId) {
  let hash = 0
  for (let i = 0; i < taskId.length; i++) {
    hash = Math.imul(31, hash) + taskId.charCodeAt(i) | 0
  }
  return Math.abs(hash) % 2_000_000_000
}

export async function requestNotificationPermission() {
  if (Capacitor.isNativePlatform()) {
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted'
  }
  if ('Notification' in window) {
    const result = await Notification.requestPermission()
    return result === 'granted'
  }
  return false
}

export async function createNotificationChannel() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.createChannel({
      id: 'reminders',
      name: 'Recordatorios',
      description: 'Avisos de tareas',
      importance: 5,
      vibration: true,
    })
  } catch (e) { console.warn('channel error', e) }
}

export async function scheduleReminder(task) {
  if (!task.reminder) return
  const at = new Date(task.reminder)
  if (at <= new Date()) return

  console.log('[notif] scheduling for', at.toISOString(), 'task:', task.title)

  if (Capacitor.isNativePlatform()) {
    try {
      const result = await LocalNotifications.schedule({
        notifications: [{
          id: toNotifId(task.id),
          title: 'Flowlyday',
          body: task.title,
          schedule: { at },
          channelId: 'reminders',
        }],
      })
      console.log('[notif] scheduled ok', result)
    } catch (e) {
      console.error('[notif] schedule error', e)
    }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    const delay = at - new Date()
    console.log('[notif] web setTimeout delay ms:', delay)
    setTimeout(() => {
      new Notification('Flowlyday', { body: task.title, icon: '/favicon.svg' })
    }, delay)
  }
}

export async function cancelReminder(taskId) {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: toNotifId(taskId) }] })
  } catch {}
}

export async function scheduleAllReminders(tasks) {
  const now = new Date()
  const pending = tasks.filter(t => t.reminder && new Date(t.reminder) > now)
  for (const task of pending) await scheduleReminder(task)
}

// ── Notificaciones diarias ────────────────────────────────────────────────────

export const DAILY_NOTIF_IDS = {
  metas:                1001,
  habitos:              1002,
  afirmaciones_morning: 1003,
  afirmaciones_evening: 1004,
}

export const DEFAULT_DAILY_PREFS = {
  metas:                { enabled: true, hour: 8,  minute: 0 },
  habitos:              { enabled: true, hour: 9,  minute: 0 },
  afirmaciones_morning: { enabled: true, hour: 7,  minute: 0 },
  afirmaciones_evening: { enabled: true, hour: 21, minute: 0 },
}

export function getDailyNotifPrefs() {
  try {
    const stored = localStorage.getItem('daily_notif_prefs')
    return stored ? { ...DEFAULT_DAILY_PREFS, ...JSON.parse(stored) } : DEFAULT_DAILY_PREFS
  } catch {
    return DEFAULT_DAILY_PREFS
  }
}

export function saveDailyNotifPrefs(prefs) {
  localStorage.setItem('daily_notif_prefs', JSON.stringify(prefs))
}

export async function scheduleDailyNotifications() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.cancel({
      notifications: Object.values(DAILY_NOTIF_IDS).map(id => ({ id })),
    })

    const prefs = getDailyNotifPrefs()
    const notifications = []

    if (prefs.metas.enabled) {
      notifications.push({
        id: DAILY_NOTIF_IDS.metas,
        title: '🎯 Mis Metas',
        body: 'Escribe tus metas de hoy',
        channelId: 'reminders',
        schedule: {
          on: { hour: prefs.metas.hour, minute: prefs.metas.minute },
          repeats: true,
          allowWhileIdle: true,
        },
      })
    }

    if (prefs.habitos.enabled) {
      notifications.push({
        id: DAILY_NOTIF_IDS.habitos,
        title: '🔥 Hábitos',
        body: '¿Has completado tus hábitos de hoy?',
        channelId: 'reminders',
        schedule: {
          on: { hour: prefs.habitos.hour, minute: prefs.habitos.minute },
          repeats: true,
          allowWhileIdle: true,
        },
      })
    }

    if (prefs.afirmaciones_morning.enabled) {
      notifications.push({
        id: DAILY_NOTIF_IDS.afirmaciones_morning,
        title: '✨ Afirmaciones',
        body: 'Empieza el día con tu sesión de mañana',
        channelId: 'reminders',
        schedule: {
          on: { hour: prefs.afirmaciones_morning.hour, minute: prefs.afirmaciones_morning.minute },
          repeats: true,
          allowWhileIdle: true,
        },
      })
    }

    if (prefs.afirmaciones_evening.enabled) {
      notifications.push({
        id: DAILY_NOTIF_IDS.afirmaciones_evening,
        title: '🌙 Afirmaciones',
        body: 'Tu sesión de noche te espera',
        channelId: 'reminders',
        schedule: {
          on: { hour: prefs.afirmaciones_evening.hour, minute: prefs.afirmaciones_evening.minute },
          repeats: true,
          allowWhileIdle: true,
        },
      })
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications })
    }
  } catch (e) {
    console.warn('[daily notif] error:', e)
  }
}

export async function cancelDailyNotifications() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.cancel({
      notifications: Object.values(DAILY_NOTIF_IDS).map(id => ({ id })),
    })
  } catch {}
}

// Dispara una notificación de prueba inmediata
export async function testNotificationNow() {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [{
          id: 999999,
          title: 'Flowlyday',
          body: '¡Las notificaciones funcionan! ✓',
          schedule: { at: new Date(Date.now() + 3000) },
          channelId: 'reminders',
        }],
      })
      console.log('[notif] test scheduled for 3 seconds from now')
    } catch (e) { console.error('[notif] test error', e) }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    setTimeout(() => {
      new Notification('Flowlyday', { body: '¡Las notificaciones funcionan! ✓', icon: '/favicon.svg' })
    }, 3000)
  }
}
