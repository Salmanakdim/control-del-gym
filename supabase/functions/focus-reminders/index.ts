// Supabase Edge Function "focus-reminders": manda los recordatorios de concentración.
//
// - Cada minuto la llama pg_cron (con la cabecera x-cron-secret). Para cada usuario
//   con recordatorios activos mira si le toca un aviso según su hora local y lo envía.
// - La app la llama con { test: true } (con la sesión del usuario) para un aviso de prueba.
//
// Secretos que necesita (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// CRON_SECRET y opcionalmente VAPID_SUBJECT. SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
// ya los pone Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2.108.2'
import webpush from 'npm:web-push@3.6.7'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') || 'mailto:soporte@flowlyday.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const PHRASES = [
  'Concéntrate 🎯',
  'Un paso más 💪',
  'Enfócate en lo que toca 🧠',
  'Menos móvil, más camino 📵',
  'Tu yo del futuro te lo agradecerá ✨',
  'Sigue, vas bien 🌱',
  'Ahora es el momento ⏳',
]
const LATE_MIN = 5   // un aviso solo sale en sus 5 primeros minutos (si no, al activar saldría uno a deshora)

type Stop = { id: string, icon?: string, label: string, kind: string, days?: number[] | null }
type Row = {
  user_id: string, enabled: boolean, every_min: number, start_min: number, end_min: number,
  days: number[], tz: string, last_slot: string | null,
  path: { dayStart?: number, stops?: Stop[], skipped?: { date: string, ids: string[] } } | null,
}

// Fecha, minuto del día y día de la semana (0 = lunes) en la zona horaria del usuario
function localParts(tz: string, at: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
  }).formatToParts(at).map(x => [x.type, x.value]))
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday)
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), weekday }
}

// Cómo va el camino de hoy: hechas, total y la siguiente parada
async function progress(row: Row, now: Date) {
  const stops0 = row.path?.stops || []
  if (!stops0.length) return null
  const dayStart = row.path?.dayStart ?? 0
  const app = localParts(row.tz, new Date(now.getTime() - dayStart * 3600000))   // "hoy" según la hora de inicio del día
  const skipped = row.path?.skipped?.date === app.date ? row.path.skipped.ids : []
  const stops = stops0.filter(s => (!s.days?.length || s.days.includes(app.weekday)) && !skipped.includes(s.id))
  if (!stops.length) return null

  const habitIds = stops.filter(s => s.kind === 'habit').map(s => s.id)
  const otherIds = stops.filter(s => s.kind !== 'habit').map(s => s.id)
  const [hl, pl] = await Promise.all([
    habitIds.length ? db.from('habit_logs').select('habit_id').eq('user_id', row.user_id).eq('date', app.date).in('habit_id', habitIds) : { data: [] },
    otherIds.length ? db.from('path_logs').select('stop_id').eq('user_id', row.user_id).eq('date', app.date).in('stop_id', otherIds) : { data: [] },
  ])
  const done = new Set([...(hl.data || []).map((r: { habit_id: string }) => r.habit_id), ...(pl.data || []).map((r: { stop_id: string }) => r.stop_id)])
  const next = stops.find(s => !done.has(s.id)) || null
  const n = stops.filter(s => done.has(s.id)).length
  return { done: n, total: stops.length, next }
}

async function buildMessage(row: Row, now: Date, seed: number) {
  const title = PHRASES[Math.abs(seed) % PHRASES.length]
  const p = await progress(row, now)
  if (p && !p.next) return null   // camino completado: no hace falta insistir
  const body = p
    ? `Vas por ${p.done} de ${p.total} (${Math.round(p.done / p.total * 100)} %). Siguiente: ${p.next!.icon || '⭐'} ${p.next!.label}`
    : 'Abre Flowlyday y sigue con tu camino'
  return { title, body, url: '/?focus=1', tag: 'flowly-focus' }
}

// Envía a todos los dispositivos del usuario; borra los que ya no existen
async function sendTo(userId: string, msg: object) {
  const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', userId)
  let sent = 0
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 900, urgency: 'high' })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      else console.error('push error', code, (e as Error).message)
    }
  }
  return sent
}

const json = (body: object, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({})
  const body = await req.json().catch(() => ({}))
  const now = new Date()

  // Aviso de prueba desde la app
  if (body.test) {
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: { user } } = await db.auth.getUser(token)
    if (!user) return json({ error: 'sin sesión' }, 401)
    const { data: row } = await db.from('focus_reminders').select('*').eq('user_id', user.id).maybeSingle()
    const msg = (row && await buildMessage(row as Row, now, now.getMinutes()))
      || { title: 'Concéntrate 🎯', body: 'Así te llegarán los recordatorios de Flowlyday', url: '/?focus=1', tag: 'flowly-focus' }
    return json({ sent: await sendTo(user.id, msg) })
  }

  // Llamada de cada minuto (pg_cron)
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return json({ error: 'no autorizado' }, 401)
  const { data: rows, error } = await db.from('focus_reminders').select('*').eq('enabled', true)
  if (error) return json({ error: error.message }, 500)

  let sent = 0
  for (const row of (rows || []) as Row[]) {
    const t = localParts(row.tz || 'Europe/Madrid', now)
    if (!(row.days || []).includes(t.weekday)) continue
    if (t.minutes < row.start_min || t.minutes > row.end_min) continue
    const every = Math.max(15, row.every_min)
    const slot = Math.floor((t.minutes - row.start_min) / every)
    if (t.minutes - row.start_min - slot * every >= LATE_MIN) continue
    const key = `${t.date}#${slot}`
    if (row.last_slot === key) continue
    // Se apunta antes de enviar: si la función se llamara dos veces, no sale repetido
    await db.from('focus_reminders').update({ last_slot: key }).eq('user_id', row.user_id)
    const msg = await buildMessage(row, now, slot)
    if (msg) sent += await sendTo(row.user_id, msg)
  }
  return json({ sent })
})
