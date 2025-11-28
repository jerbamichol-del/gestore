import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const geminiKey = env.VITE_GEMINI_API_KEY;

  if (!geminiKey) {
    console.warn('[vite] VITE_GEMINI_API_KEY mancante.');
  }

  return {
    base: '/gestore/', // Fondamentale per GitHub Pages
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    define: {
      'process.env.API_KEY': JSON.stringify(geminiKey),
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        strategies: 'injectManifest', // Usa il nostro SW custom
        srcDir: 'src',                // Cerca il SW in src/
        filename: 'sw.js',            // Nome del file sorgente
        
        includeAssets: ['icon-192.svg', 'icon-512.svg'],
        
        manifest: {
          name: 'Gestore Spese Intuitivo',
          short_name: 'Gestore Spese',
          description: 'Gestisci le tue spese in modo smart',
          theme_color: '#4f46e5',
          background_color: '#f1f5f9',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/gestore/',
          scope: '/gestore/',
          icons: [
            {
              src: 'icon-192.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: 'icon-512.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
            }
          ],
          // --- CONFIGURAZIONE SHARE TARGET CRUCIALE ---
          share_target: {
            action: '/gestore/', // Deve coincidere con il base URL
            method: 'POST',
            enctype: 'multipart/form-data',
            params: {
              files: [
                {
                  name: 'screenshot',
                  accept: ['image/*']
                }
              ]
            }
          }
        },
        devOptions: {
          enabled: true // Abilita PWA anche in dev (npm run dev)
        }
      })
    ],
  };
});
