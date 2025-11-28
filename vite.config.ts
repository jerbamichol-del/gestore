import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carica le variabili d'ambiente
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const geminiKey = env.VITE_GEMINI_API_KEY;

  if (!geminiKey) {
    console.warn('[vite] VITE_GEMINI_API_KEY mancante.');
  }

  return {
    // Fondamentale per GitHub Pages: dice a Vite che l'app è in /gestore/
    base: '/gestore/', 
    
    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    plugins: [
      react() // Solo il plugin React, NIENTE PWA plugin
    ],

    define: {
      'process.env.API_KEY': JSON.stringify(geminiKey),
    },

    // Assicura che i file nella cartella 'public' vengano copiati alla root
    publicDir: 'public',
    
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    }
  };
});
