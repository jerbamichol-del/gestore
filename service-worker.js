// Importa la libreria idb
importScripts('https://cdn.jsdelivr.net/npm/idb@8/build/iife/index-min.js');

const CACHE_NAME = 'expense-manager-cache-v41-fix'; // Ho aggiornato la versione
const urlsToCache = [
  './',                // IMPORTANTE: Punto davanti allo slash
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  // Dipendenze esterne rimangono uguali
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@18.3.1',
  'https://esm.sh/react-dom@18.3.1',
  'https://esm.sh/react-dom@18.3.1/client',
  'https://aistudiocdn.com/@google/genai@^1.21.0',
  'https://esm.sh/recharts@2.12.7',
  'https://cdn.jsdelivr.net/npm/idb@8/+esm',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs'
];

// --- Configurazione DB ---
const DB_NAME = 'expense-manager-db';
const STORE_NAME = 'offline-images';
const DB_VERSION = 1;

const getDb = () => {
  return idb.openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
};

const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

// --- Install ---
self.addEventListener('install', event => {
   // Forza attivazione immediata
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Usa map con catch per evitare che un file mancante blocchi tutto
        return Promise.allSettled(
          urlsToCache.map(url => cache.add(url).catch(err => console.warn('Cache error:', url, err)))
        );
      })
  );
});

// --- Activate ---
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- Fetch (Cuore del problema 405) ---
self.addEventListener('fetch', event => {
  
  // 1. Intercetta TUTTE le richieste POST
  if (event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('screenshot');

          if (file) {
             const base64Image = await fileToBase64(file);
             const db = await getDb();
             await db.add(STORE_NAME, {
                id: crypto.randomUUID(),
                base64Image,
                mimeType: file.type || 'image/png',
                timestamp: Date.now()
             });
          }
          
          // CRUCIALE PER GITHUB PAGES:
          // Costruisce l'URL di redirect relativo alla posizione del SW.
          // Invece di '/?shared=true' (che va alla root del dominio),
          // usa la location corrente del SW per restare nella cartella /gestore/
          const targetUrl = new URL('./?shared=true', self.location.href).href;
          
          return Response.redirect(targetUrl, 303);
          
        } catch (e) {
          console.error('SW Post Error:', e);
          // Fallback alla home in caso di errore
          const homeUrl = new URL('./', self.location.href).href;
          return Response.redirect(homeUrl, 303);
        }
      })()
    );
    return;
  }

  // 2. Gestione Cache per le GET
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
        return cachedResponse || fetch(event.request).then(networkResponse => {
            // Cacha solo richieste http(s) valide
            if(networkResponse && networkResponse.status === 200 && event.request.url.startsWith('http')) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
        });
    })
  );
});

self.addEventListener('message', (event) => { if (event.data && (event.data === 'SKIP_WAITING' || event.data.type === 'SKIP_WAITING')) { self.skipWaiting(); } });
