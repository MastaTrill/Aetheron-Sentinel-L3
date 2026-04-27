import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9999,
    host: '192.168.5.170',
    strictPort: true,
    hmr: {
      host: '192.168.5.170'
    }
  }
})
