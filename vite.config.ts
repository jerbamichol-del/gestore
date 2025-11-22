import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carica tutte le variabili che iniziano per VITE_
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  const geminiKey = env.VITE_GEMINI_API_KEY;

  if (!geminiKey) {
    console.warn(
      '[vite.config] VITE_GEMINI_API_KEY non è definita. ' +
      'Le funzionalità AI (immagini/voce) non funzioneranno.'
    );
  } else {
    // Questo lo vedrai nei log della GitHub Action, NON nel browser
    console.log(
      '[vite.config] VITE_GEMINI_API_KEY prefix:',
      geminiKey.slice(0, 8)
    );
  }

  return {
    // fondamentale per GitHub Pages in /gestore/
    base: '/gestore/',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      // qui iniettiamo la chiave nel bundle come process.env.API_KEY
      'process.env.API_KEY': JSON.stringify(geminiKey),
    },
  };
});
