import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// En local hace lo mismo que functions/api/claude.js en el servidor:
// añade la clave (que nunca va dentro de la web) y llama a la API de Anthropic.
function claudeDevApi(env) {
  return {
    name: 'claude-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/claude', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let raw = ''
        for await (const chunk of req) raw += chunk
        const { system, messages } = JSON.parse(raw || '{}')
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': env.ANTHROPIC_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system, messages }),
        })
        res.statusCode = r.status
        res.setHeader('content-type', 'application/json')
        res.end(await r.text())
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), claudeDevApi(env)],
    base: './',
    server: {
      host: true,
      port: 5174,
    },
    preview: {
      host: true,
      port: 5174,
    },
  }
})
