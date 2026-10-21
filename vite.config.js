import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(() => {
  return {
    plugins: [react()],
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
