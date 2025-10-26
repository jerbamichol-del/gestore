// Importa la libreria idb per un accesso più semplice a IndexedDB
importScripts('https://cdn.jsdelivr.net/npm/idb@8/build/iife/index-min.js');

const CACHE_NAME = 'expense-manager-cache-v31';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/share-target/',
  'https://cdn.tailwindcss.com',
  'https://esm.sh/react@18.3.1',
  'https://esm.sh/react-dom@18.3.1/client',
  'https://aistudiocdn.com/@google/genai@^1.21.0',
  'https://esm.sh/recharts@2.12.7',
  'https://cdn.jsdelivr.net/npm/idb@8/+esm'
];

// --- Helper IndexedDB (come prima) ---
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

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = (error) => reject(error);
});

// Calcola il path di scope (es. "/gestore/")
const SCOPE_PATH = new URL(self.registration.scope).pathname;

// INSTALL: niente skipWaiting automatico → chiederemo noi all’utente
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      // NON: 
  );
});

// ACTIVATE: prendi controllo subito delle pagine esistenti
self.addEventListener('activate', (event) => {
  const whitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => (whitelist.includes(n) ? undefined : caches.delete(n))))
    ).then(() => self.clients.claim())
  );
});

// MESSAGGI dalla pagina: attiva subito il nuovo worker (update su richiesta)
self.addEventListener('message', (event) => {
  if (event.data && (event.data === 'SKIP_WAITING' || event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // --- Gestione Share Target (supporta sia "/share-target/" che "/gestore/share-target/")
  const shareTargetA = '/share-target/';
  const shareTargetB = SCOPE_PATH.replace(/\/?$/, '/') + 'share-target/';

  if (event.request.method === 'POST' && (url.pathname === shareTargetA || url.pathname === shareTargetB)) {
    // Redirect immediato alla home nello scope corretto
    const home = SCOPE_PATH || '/';
    event.respondWith(Response.redirect(home));

    event.waitUntil((async function () {
      try {
        const formData = await event.request.formData();
        const file = formData.get('screenshot');

        if (!file || !file.type?.startsWith('image/')) {
          console.warn('Share target: no valid image file.');
          return;
        }

        const base64Image = await fileToBase64(file);
        const db = await getDb();
        await db.add(STORE_NAME, { id: crypto.randomUUID(), base64Image, mimeType: file.type });

        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (clients.length > 0) {
          await clients[0].focus();
        } else {
          self.clients.openWindow(home);
        }
      } catch (err) {
        console.error('Error handling share target:', err);
      }
    })());
    return;
  }

  if (event.request.method !== 'GET') return;

  // Navigations: network first con fallback a cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Assets: cache first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      });
    })
  );
});
