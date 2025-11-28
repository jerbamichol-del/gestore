// Importa la libreria idb per un accesso più semplice a IndexedDB
importScripts('https://cdn.jsdelivr.net/npm/idb@8/build/iife/index-min.js');

const CACHE_NAME = 'expense-manager-cache-v34'; // Incrementato versione per forzare aggiornamento
const urlsToCache = [
  '/',
  '/index.html',
  '/index.tsx',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/share-target/',
  // Key CDN dependencies
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@18.3.1',
  'https://esm.sh/react-dom@18.3.1',
  'https://esm.sh/react-dom@18.3.1/client',
  'https://aistudiocdn.com/@google/genai@^1.21.0',
  'https://esm.sh/recharts@2.12.7',
  'https://cdn.jsdelivr.net/npm/idb@8/+esm',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs'
];

// --- Configurazione IndexedDB ---
const DB_NAME = 'expense-manager-db';
const STORE_NAME = 'offline-images';
const DB_VERSION = 1;

// Helper per aprire il DB
const getDb = () => {
  return idb.openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
};

// Helper per convertire file in Base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

// Install event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache, caching app shell');
        return cache.addAll(urlsToCache);
      })
      
  );
});

// Activate event
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event (Gestione Richieste)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // --- Gestione Share Target (CORRETTA) ---
  // Verifica se è una POST verso lo share-target
  if (event.request.method === 'POST' && url.pathname.includes('/share-target/')) {
    
    // Usiamo respondWith con una funzione async per gestire il salvataggio PRIMA del redirect
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('screenshot');

          if (!file || !file.type.startsWith('image/')) {
             console.warn('Share target: No valid image file received.');
             // Redirect comunque alla home anche se fallisce, per non lasciare l'utente su pagina bianca
             return Response.redirect('/', 303);
          }

          // Converti e Salva nel DB
          const base64Image = await fileToBase64(file);
          const db = await getDb();
          
          // Usa crypto.randomUUID se disponibile, altrimenti fallback su timestamp
          const id = self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : Date.now().toString();

          await db.add(STORE_NAME, {
            id: id,
            base64Image,
            mimeType: file.type,
            timestamp: Date.now() // Utile per ordinare
          });

          console.log('Image from share target saved to IndexedDB successfully.');

          // Notifica ai client aperti (opzionale, ma utile per refresh istantaneo)
          const clients = await self.clients.matchAll({ type: 'window' });
          for (const client of clients) {
            client.postMessage({ type: 'NEW_SCREENSHOT_SHARED' });
          }

          // FONDAMENTALE: Redirect 303 (See Other) alla home page
          // Aggiungiamo un parametro query per dire al frontend che c'è un file condiviso
          return Response.redirect('/?shared=true', 303);

        } catch (error) {
          console.error('Error handling share target:', error);
          // In caso di errore critico, redirect comunque alla home
          return Response.redirect('/', 303);
        }
      })()
    );
    return; // Stop execution here for POST requests
  }
  
  // Ignora altre richieste non-GET (eccetto la POST gestita sopra)
  if (event.request.method !== 'GET') {
    return;
  }

  // Strategy: Network falling back to cache for navigation (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Strategy: Cache first for all other assets (CSS, JS, Images)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        return cachedResponse || fetch(event.request).then(
          networkResponse => {
            // Check for valid response
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
              return networkResponse;
            }
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          }
        );
      })
  );
});

self.addEventListener('message', (event) => { if (event.data && (event.data === 'SKIP_WAITING' || event.data.type === 'SKIP_WAITING')) { self.skipWaiting(); } });
