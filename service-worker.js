// --- CONFIGURAZIONE ---
const CACHE_NAME = 'expense-manager-v44-vanilla';
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
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Ignoriamo errori su singoli file per non bloccare tutto
      return Promise.allSettled(urlsToCache.map(url => cache.add(url).catch(e => console.warn(e))));
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

// --- HELPER: Salvataggio DB senza librerie esterne ---
function saveToIndexedDB(data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.add(data);

      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };

    request.onerror = () => reject(request.error);
  });
}

// --- FETCH: GESTIONE SHARE TARGET ---
self.addEventListener('fetch', event => {
  // 1. Intercetta TUTTE le POST (Share Target)
  if (event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('screenshot');

          if (file) {
            // Converti Blob in Base64
            const buffer = await file.arrayBuffer();
            let binary = '';
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64Image = btoa(binary);

            // Salva nel DB usando la funzione manuale
            await saveToIndexedDB({
              id: crypto.randomUUID(),
              base64Image,
              mimeType: file.type || 'image/png',
              timestamp: Date.now()
            });
            console.log('SW: Immagine salvata!');
          }
          return Response.redirect('./?shared=true', 303);
        } catch (e) {
          console.error('SW Error:', e);
          return Response.redirect('./', 303);
        }
      })()
    );
    return;
  }

  // 2. Gestione Cache standard
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(netResponse => {
        if(netResponse && netResponse.status === 200 && event.request.url.startsWith('http')) {
           const clone = netResponse.clone();
           caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return netResponse;
      });
    })
  );
});

self.addEventListener('message', (event) => { if (event.data && (event.data === 'SKIP_WAITING' || event.data.type === 'SKIP_WAITING')) { self.skipWaiting(); } });
