import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  
  // FIX DEFINITIVO: URL Hardcoded. 
  // Così funziona al 100% indipendentemente dai Segreti di GitHub.
  const appScriptUrl = 'https://script.google.com/macros/s/AKfycbyZpH2rET4JNs35Ye_tewdpszsHLLRfLr6C-7qFKH_Xe1zg_vhHB8kaRyWQjAqG7-frVg/exec';

  return {
    base: '/gestore/',
    
    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    plugins: [react()],

    define: {
      // Passiamo la stringa direttamente all'app
      'process.env.APPS_SCRIPT_URL': JSON.stringify(appScriptUrl),
    },
    
    build: {
      outDir: 'dist',
    }
  };
});
