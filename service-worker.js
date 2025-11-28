importScripts('https://cdn.jsdelivr.net/npm/idb@8/build/iife/index-min.js');

// Aumenta questo numero ogni volta che modifichi il SW per forzare l'aggiornamento
const CACHE_NAME = 'expense-manager-v36-github-fix';

const urlsToCache = [
  './',                // Usa ./ invece di / per compatibilità con sottocartelle GitHub
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  // RIMOSSO '/share-target/' -> Non esiste su GitHub Pages!
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
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching files');
        // Usiamo map per cachare i file singolarmente. Se uno fallisce, gli altri continuano.
        return Promise.allSettled(
            urlsToCache.map(url => cache.add(url).catch(err => console.warn(`Failed to cache ${url}:`, err)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// --- Activate ---
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- Fetch (Il cuore del problema) ---
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. GESTIONE CONDIVISIONE (POST)
  // Intercetta QUALSIASI richiesta POST che contiene "share-target"
  if (event.request.method === 'POST' && url.href.includes('share-target')) {
    
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
             console.log('Immagine salvata dal SW!');
          }
          
          // IMPORTANTE: Rispondi con un Redirect 303 alla Home
          // Questo blocca la richiesta verso GitHub Pages
          return Response.redirect('./?shared=true', 303);
          
        } catch (e) {
          console.error('Errore nel salvataggio screenshot:', e);
          // Anche in caso di errore, redirigi alla home per non mostrare errori all'utente
          return Response.redirect('./', 303);
        }
      })()
    );
    return; // Stop qui, non andare in rete
  }

  // 2. GESTIONE CACHE NORMALE (GET)
  if (event.request.method === 'GET') {
      event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse || fetch(event.request).then(networkResponse => {
                // Cache dinamica solo per richieste http valide
                if(networkResponse && networkResponse.status === 200 && url.protocol.startsWith('http')) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Fallback offline (opzionale, se vuoi mostrare index.html quando sei offline su altre pagine)
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
      );
  }
});
