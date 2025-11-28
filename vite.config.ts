import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Carica le variabili che iniziano con VITE_
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  
  // Recupera l'URL dal file .env o dai Secrets di GitHub
  const appScriptUrl = env.VITE_APPS_SCRIPT_URL;

  // Log di sicurezza (mostra solo se manca)
  if (!appScriptUrl) {
    console.warn('⚠️ ATTENZIONE: VITE_APPS_SCRIPT_URL non trovata. L\'AI non funzionerà.');
  }

  return {
    // FONDAMENTALE per GitHub Pages (la tua sottocartella)
    base: '/gestore/',
    
    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    plugins: [react()],

    // Qui "iniettiamo" l'URL dentro il codice React
    define: {
      'process.env.APPS_SCRIPT_URL': JSON.stringify(appScriptUrl),
    },
    
    // Configurazione Build standard
    build: {
      outDir: 'dist',
    }
  };
});
