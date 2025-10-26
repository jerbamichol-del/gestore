import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
  // URL base per Pages: https://<user>.github.io/gestore/
  base: '/gestore/',

  server: { port: 3000, host: '0.0.0.0' },
  plugins: [react()],

  // Evita alias ambigui, ma tieni @ se ti serve
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },

  build: { outDir: 'dist' },

  // (facoltativo) shim per evitare "process is not defined" se qualche lib lo tocca
  define: {
    'process.env': {}, // <-- NON mettere chiavi qui; usa import.meta.env.* nel codice
  },
}));
