import { defineConfig } from 'vite'
import process from 'node:process'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  cacheDir: './.vite',
  server: { port: 5173, proxy: { '/api': process.env.API_PROXY_TARGET || 'http://localhost:5000' } }
})
