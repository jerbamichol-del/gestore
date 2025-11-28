importScripts('https://cdn.jsdelivr.net/npm/idb@8/build/iife/index-min.js');

const CACHE_NAME = 'expense-manager-cache-v35'; // Ho alzato la versione
const urlsToCache = [
  '/',
  '/index.html',
  // '/index.tsx', // RIMOSSO: I browser non leggono TSX, leggono il JS compilato (es. main.js o assets/...)
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  // RIMOSSO '/share-target/' -> CAUSAVA L'ERRORE DI INSTALLAZIONE!
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@18.3.1',
  'https://esm.sh/react-dom@18.3.1',
  'https://esm.sh/react-dom@18.3.1/client',
  'https://aistudiocdn.com/@google/genai@^1.21.0',
  'https://esm.sh/recharts@2.12.7',
  'https://cdn.jsdelivr.net/npm/idb@8/+esm',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs'
];

// ... (Il resto del codice DB_NAME, getDb, fileToBase64 rimane identico a prima) ...
// Copia qui le funzioni helper DB_NAME, STORE_NAME, getDb, fileToBase64 che ti ho dato prima

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
        console.log('Opened cache');
        // Usiamo Promise.allSettled o catch per evitare che un solo file mancante rompa tutto il SW
        return cache.addAll(urlsToCache).catch(err => {
            console.error("Errore caching file:", err);
        });
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
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// --- Fetch ---
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Intercettiamo la POST di condivisione
  if (event.request.method === 'POST' && url.pathname.includes('/share-target/')) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('screenshot'); // Deve combaciare col name nel manifest

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
          // Redirect 303 fondamentale
          return Response.redirect('/?shared=true', 303);
        } catch (e) {
          console.error(e);
          return Response.redirect('/', 303);
        }
      })()
    );
    return;
  }

  // 2. Gestione normale Cache
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
        return cachedResponse || fetch(event.request).then(networkResponse => {
            return caches.open(CACHE_NAME).then(cache => {
                // Cache solo richieste valide http/https (no chrome-extension)
                if(url.protocol.startsWith('http')) {
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            });
        });
    })
  );
});
