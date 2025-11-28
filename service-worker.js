importScripts('https://cdn.jsdelivr.net/npm/idb@8/build/iife/index-min.js');

// CAMBIA QUESTO NUMERO per forzare l'aggiornamento immediato
const CACHE_NAME = 'expense-manager-github-v41';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
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
  self.skipWaiting(); // Forza l'attivazione immediata
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Usiamo Promise.allSettled: se un'icona manca, non rompe tutto il worker
        return Promise.allSettled(
            urlsToCache.map(url => cache.add(url).catch(e => console.warn(e)))
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
    }).then(() => self.clients.claim()) // Prende controllo immediato della pagina
  );
});

// --- FETCH: LA SOLUZIONE DEFINITIVA ---
self.addEventListener('fetch', event => {
  
  // 1. Intercetta TUTTE le POST. 
  // Su GitHub Pages statico, le POST sono solo errori (405) o Share Target.
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
             console.log('SW: Immagine salvata correttamente');
          }
          
          // Redirect alla home con parametro
          // NOTA: Usiamo Response.redirect che è supportato dai browser moderni
          return Response.redirect('./?shared=true', 303);
          
        } catch (e) {
          console.error('SW Error:', e);
          // In caso di errore, torna alla home pulita
          return Response.redirect('./', 303);
        }
      })()
    );
    return;
  }

  // 2. Gestione Cache standard per le GET
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
        // Strategia: Stale-while-revalidate (mostra cache, aggiorna in background)
        // O Cache-First classica (qui uso Cache-first + Network fallback)
        return cachedResponse || fetch(event.request).then(networkResponse => {
            // Cache solo se successo e http/https
            if(networkResponse && networkResponse.status === 200 && event.request.url.startsWith('http')) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
            }
            return networkResponse;
        });
    })
  );
});
