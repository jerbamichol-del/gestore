// --- CONFIGURAZIONE ---
const CACHE_NAME = 'expense-manager-v48-final-fix'; // Versione incrementata
const DB_NAME = 'expense-manager-db';
const STORE_NAME = 'offline-images';
const DB_VERSION = 1;

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  // RIMOSSO Tailwind per evitare il blocco CORS che impedisce l'aggiornamento
  'https://esm.sh/react@18.3.1',
  'https://esm.sh/react-dom@18.3.1',
  'https://esm.sh/react-dom@18.3.1/client',
  'https://aistudiocdn.com/@google/genai@^1.21.0',
  'https://esm.sh/recharts@2.12.7',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs'
];

// --- INSTALLAZIONE ---
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Usiamo Promise.allSettled per non bloccare tutto se un file fallisce
      return Promise.allSettled(urlsToCache.map(url => 
        cache.add(url).catch(err => console.warn('Skipping cache for:', url))
      ));
    })
  );
});

// --- ATTIVAZIONE ---
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
    )).then(() => self.clients.claim())
  );
});

// --- HELPER DB ---
function saveToIndexedDB(data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      // Changed to put to prevent key collision errors
      tx.objectStore(STORE_NAME).put(data);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

// --- FETCH ---
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. SHARE TARGET (POST) - Solo per richieste interne (es. dalla galleria)
  if (event.request.method === 'POST' && url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('screenshot');
          if (file) {
            const buffer = await file.arrayBuffer();
            let binary = '';
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64Image = btoa(binary);

            await saveToIndexedDB({
              id: crypto.randomUUID(),
              base64Image,
              mimeType: file.type || 'image/png',
              timestamp: Date.now()
            });
          }
          return Response.redirect('./?shared=true', 303);
        } catch (e) {
          return Response.redirect('./', 303);
        }
      })()
    );
    return;
  }

  // 2. CACHE STANDARD
  if (event.request.method === 'GET') {
      event.respondWith(
        caches.match(event.request).then(response => {
          return response || fetch(event.request).then(netResponse => {
            // Cachiamo solo se è HTTP/HTTPS e NON è Tailwind (che blocca)
            if(netResponse && netResponse.status === 200 && 
               event.request.url.startsWith('http') && 
               !url.href.includes('cdn.tailwindcss.com')) { 
               
               const clone = netResponse.clone();
               caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return netResponse;
          });
        })
      );
  }
});