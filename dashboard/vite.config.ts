import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envPrefix: ['NEXT_PUBLIC_', 'VITE_'],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  server: {
    proxy: {
      '/api/uniswap': {
        target: 'https://trade-api.gateway.uniswap.org/v1',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api\/uniswap/, ''),
      },
    },
  },
});
