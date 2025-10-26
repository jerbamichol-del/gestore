import './debug-overlay.js';
import React from 'react';
import { createRoot } from 'react-dom/client';

const el = document.getElementById('root')!;
const root = createRoot(el);

// mostro qualcosa SUBITO
root.render(
  <div style={{padding:16,fontFamily:'system-ui'}}>Caricamento app…</div>
);

// import dinamico dell’app vera
import('./App')
  .then(({ default: App }) => {
    root.render(
      <React.StrictMode>
        <App onLogout={() => { /* TODO */ }} />
      </React.StrictMode>
    );
  })
  .catch((e) => {
    el.innerHTML = `<pre style="white-space:pre-wrap;color:#b91c1c;background:#fee2e2;padding:8px">Boot error: ${String(e)}</pre>`;
    console.error(e);
  });
