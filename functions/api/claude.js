// Cloudflare Pages Function: /api/claude
// Llama a la API de Anthropic con la clave guardada en el servidor (nunca en la web).
// Solo responde a usuarios con sesión iniciada en Supabase, para que nadie más gaste la clave.

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024

export async function onRequestPost({ request, env }) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: { message: 'No autorizado' } }, 401)

  const who = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/user`, {
    headers: { authorization: `Bearer ${token}`, apikey: env.VITE_SUPABASE_KEY },
  })
  if (!who.ok) return json({ error: { message: 'Sesión no válida' } }, 401)

  const { system, messages } = await request.json()
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages }),
  })
  return new Response(await res.text(), { status: res.status, headers: { 'content-type': 'application/json' } })
}

function json(data, status) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } })
}
