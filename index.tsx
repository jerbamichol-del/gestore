import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <AuthGate />
);

// 🔥 REGISTRAZIONE SERVICE WORKER (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // se il sito è servito dalla root del dominio:
    const swUrl = '/service-worker.js';
    // se invece sei sotto un path tipo /gestore/, diventerebbe:
    // const swUrl = '/gestore/service-worker.js';

    navigator.serviceWorker
      .register(swUrl)
      .then(reg => {
        console.log('[SW] Registrato con successo:', reg.scope);
      })
      .catch(err => {
        console.error('[SW] Registrazione fallita:', err);
      });
  });
}
