import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    base: './',
    server: {
      host: true,
      port: 5174,
      proxy: {
        '/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: path => path.replace(/^\/anthropic/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('x-api-key', env.VITE_ANTHROPIC_KEY)
              proxyReq.setHeader('anthropic-version', '2023-06-01')
              proxyReq.removeHeader('anthropic-dangerous-allow-browser')
            })
          },
        },
      },
    },
    preview: {
      host: true,
      port: 5174,
    },
  }
})
