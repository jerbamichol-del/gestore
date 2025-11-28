// Importa la libreria idb per gestire il database
importScripts('https://unpkg.com/idb@7.1.1/build/iife/index-min.js');

// Aggiorna questo nome quando fai modifiche per forzare l'aggiornamento sui telefoni
const CACHE_NAME = 'expense-manager-public-v42';

// Lista dei file da salvare per l'offline.
// NOTA: Usiamo './' (punto slash) per supportare la sottocartella di GitHub Pages.
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  // Dipendenze esterne (CDN)
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@18.3.1',
  'https://esm.sh/react-dom@18.3.1',
  'https://esm.sh/react-dom@18.3.1/client',
  'https://aistudiocdn.com/@google/genai@^1.21.0',
  'https://esm.sh/recharts@2.12.7',
  'https://cdn.jsdelivr.net/npm/idb@8/+esm',
  'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs'
];

// --- Configurazione Database (lo stesso usato nell'app) ---
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

// Funzione helper per convertire il file in stringa salvabile
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

// --- INSTALLAZIONE ---
self.addEventListener('install', event => {
  self.skipWaiting(); // Forza l'attivazione immediata del nuovo SW
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Caching files...');
        // Usiamo Promise.allSettled: se un file manca (es. un'icona), 
        // non blocca l'installazione del resto.
        return Promise.allSettled(
          urlsToCache.map(url => cache.add(url).catch(err => console.warn('Cache fallita per:', url, err)))
        );
      })
  );
});

// --- ATTIVAZIONE ---
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Cancellazione vecchia cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Prende subito il controllo della pagina
  );
});

// --- GESTIONE RICHIESTE (FETCH) ---
self.addEventListener('fetch', event => {
  
  // 1. GESTIONE SHARE TARGET (POST)
  // Intercettiamo QUALSIASI richiesta POST. Su GitHub Pages statico, 
  // una POST è sicuramente un tentativo di condivisione o un errore.
  if (event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        try {
          const formData = await event.request.formData();
          const file = formData.get('screenshot'); // Deve combaciare con "name" nel manifest

          if (file) {
             const base64Image = await fileToBase64(file);
             const db = await getDb();
             await db.add(STORE_NAME, {
                id: crypto.randomUUID(), // Genera ID unico
                base64Image,
                mimeType: file.type || 'image/png',
                timestamp: Date.now()
             });
             console.log('SW: Screenshot salvato nel DB locale!');
          }
          
          // FONDAMENTALE PER IL FIX 405:
          // Invece di far proseguire la richiesta verso il server (che darebbe errore),
          // rispondiamo noi con un Redirect (303) verso la home page.
          // Usiamo './' per restare nella sottocartella corrente (/gestore/).
          return Response.redirect('./?shared=true', 303);
          
        } catch (e) {
          console.error('SW: Errore salvataggio share:', e);
          // In caso di errore, redirigi comunque alla home per non bloccare l'utente
          return Response.redirect('./', 303);
        }
      })()
    );
    return; // Blocca la richiesta di rete originale
  }

  // 2. GESTIONE NORMALE (GET) - Cache First con Network Fallback
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
        // Se c'è in cache, restituiscilo. Altrimenti scaricalo.
        return cachedResponse || fetch(event.request).then(networkResponse => {
            // Se la risposta è valida e siamo su http/https, la salviamo in cache per la prossima volta
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
