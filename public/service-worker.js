// --- CONFIGURAZIONE ---
const CACHE_NAME = 'expense-manager-v46-final'; // Nuova versione
const DB_NAME = 'expense-manager-db';
const STORE_NAME = 'offline-images';
const DB_VERSION = 1;

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
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs'
];

// --- INSTALLAZIONE ---
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(urlsToCache.map(url => cache.add(url).catch(console.warn)));
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
      tx.objectStore(STORE_NAME).add(data);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

// --- FETCH (LA CORREZIONE È QUI) ---
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. GESTIONE SHARE TARGET (POST)
  // Intercettiamo SOLO se è una POST E l'URL è interno alla nostra app (stessa origine)
  // Questo esclude le chiamate verso script.google.com!
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
            console.log('SW: Share salvato!');
          }
          return Response.redirect('./?shared=true', 303);
        } catch (e) {
          console.error('SW Share Error:', e);
          return Response.redirect('./', 303);
        }
      })()
    );
    return;
  }

  // 2. GESTIONE CACHE STANDARD
  // Ignoriamo richieste non-GET o verso API esterne dinamiche (come google script)
  if (event.request.method === 'GET') {
      event.respondWith(
        caches.match(event.request).then(response => {
          return response || fetch(event.request).then(netResponse => {
            // Cachiamo solo risorse statiche HTTP/HTTPS, evitiamo chiamate API
            if(netResponse && netResponse.status === 200 && 
               event.request.url.startsWith('http') && 
               !url.href.includes('script.google.com')) { 
               
               const clone = netResponse.clone();
               caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return netResponse;
          });
        })
      );
  }
});
