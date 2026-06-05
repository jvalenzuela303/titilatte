import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    hmr: {
      // En Docker el browser llega por nginx (puerto 8000), pero HMR WebSocket
      // debe conectarse directamente al puerto 5173 de Vite (expuesto al host).
      // Sin esto, el browser intenta ws://localhost:8000 → nginx no hace upgrade → error.
      host: process.env.VITE_HMR_HOST ?? 'localhost',
      port: Number(process.env.VITE_HMR_PORT ?? 5173),
      protocol: 'ws',
    },
    proxy: {
      '/api': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
    },
  },
})
