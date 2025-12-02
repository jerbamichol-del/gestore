import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate';
// NESSUN import './index.css' qui se usi il CDN in HTML

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
    navigator.serviceWorker.register('./service-worker.js')
      .then((registration) => {
        console.log('✅ SW Registrato con successo:', registration.scope);
        
        // Se c'è un aggiornamento in attesa, forza l'update
        if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      })
      .catch((error) => {
        console.error('❌ Registrazione SW fallita:', error);
      });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
       // Ricarica la pagina quando il nuovo SW prende il controllo
       window.location.reload();
    });
  });
}
