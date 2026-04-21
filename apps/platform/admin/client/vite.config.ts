import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://localhost:3008',
      '/ws': {
        target: 'ws://localhost:3008',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
