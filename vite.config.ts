import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9999,
    host: true,
    strictPort: true,
    hmr: {
      host: 'localhost',
    },
  },
});
