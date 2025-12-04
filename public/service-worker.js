// --- CONFIGURAZIONE ---
// Incrementiamo la versione per forzare l'aggiornamento e invalidare la vecchia cache corrotta
const CACHE_NAME = 'expense-manager-v50-fix-404'; 
const DB_NAME = 'expense-manager-db';
const STORE_NAME = 'offline-images';
const DB_VERSION = 1;

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Librerie esterne (ESM)
  'https://esm.sh/react@18.3.1',
  'https://esm.sh/react-dom@18.3.1',
  'https://esm.sh/react-dom@18.3.1/client',
  'https://aistudiocdn.com/@google/genai@^1.21.0',
  'https://esm.sh/recharts@2.12.7',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs',
  'https://esm.sh/react-qr-code@2.0.15',
  // Tailwind CDN (fondamentale se usi il CDN in index.html)
  //'https://cdn.tailwindcss.com'
];

// --- INSTALLAZIONE ---
self.addEventListener('install', event => {
  // Forza il nuovo SW a diventare attivo immediatamente
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Usa Promise.allSettled per evitare che un singolo fallimento blocchi tutto
      return Promise.allSettled(urlsToCache.map(url => 
        cache.add(url).catch(err => console.warn('Failed to cache:', url, err))
      ));
    })
  );
});

// --- ATTIVAZIONE ---
self.addEventListener('activate', event => {
  // Prendi il controllo di tutti i client aperti immediatamente
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        // CANCELLA tutte le cache vecchie che non corrispondono al nome attuale
        if (key !== CACHE_NAME) {
          console.log('Deleting old cache:', key);
          return caches.delete(key);
        }
      })
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

  // 1. SHARE TARGET (POST)
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

  // 2. CACHE STRATEGY: Stale-While-Revalidate per file statici, Network First per API
  if (event.request.method === 'GET') {
      // Ignora schemi non supportati
      if (!url.protocol.startsWith('http')) return;

      event.respondWith(
        caches.match(event.request).then(cachedResponse => {
          // Se c'è in cache, restituiscilo, ma aggiornalo in background
          const fetchPromise = fetch(event.request).then(netResponse => {
            if(netResponse && netResponse.status === 200 && event.request.url.startsWith('http')) {
               const clone = netResponse.clone();
               caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return netResponse;
          }).catch(() => {
             // Se offline e fetch fallisce, non fare nulla (abbiamo già cachedResponse se esiste)
          });

          return cachedResponse || fetchPromise;
        })
      );
  }
});
