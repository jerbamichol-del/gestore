import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <AuthGate />
  </React.StrictMode>
);

// --- REGISTRAZIONE SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Usiamo './service-worker.js'.
    // Poiché hai spostato il file in 'public/', Vite lo copierà nella stessa cartella dell'index.html finale.
    // Il browser lo troverà a: https://jerbamichol-del.github.io/gestore/service-worker.js
    navigator.serviceWorker.register('./service-worker.js')
      .then((registration) => {
        console.log('✅ SW Registrato con successo:', registration.scope);
        
        // Se c'è un aggiornamento in attesa (nuova versione), forza l'aggiornamento
        if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      })
      .catch((error) => {
        console.error('❌ Registrazione SW fallita:', error);
      });

    // Ricarica la pagina automaticamente quando il nuovo SW prende il controllo
    navigator.serviceWorker.addEventListener('controllerchange', () => {
       console.log("🔄 Nuova versione rilevata, ricarico l'app...");
       window.location.reload();
    });
  });
}
