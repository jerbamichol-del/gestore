import React from 'react';
import ReactDOM from 'react-dom/client';
import AuthGate from './AuthGate';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(<AuthGate />);

/**
 * Prompt di aggiornamento PWA
 * - Non sposta la registrazione del SW (se lo registri in index.html va bene).
 * - Qui ci agganciamo alla registration esistente e mostriamo un banner solo quando c’è una nuova versione (worker in "waiting").
 * - Stile Tailwind coerente con l’app (slate/indigo).
 */
(function setupPwaUpdatePrompt() {
  if (!('serviceWorker' in navigator)) return;

  // Scope della Pages app (prima tentiamo /gestore/, poi fallback globale)
  const scopeGuess = '/gestore/';

  const createBanner = (onAccept: () => void, onDismiss: () => void) => {
    const wrapper = document.createElement('div');
    wrapper.id = 'pwa-update-banner';
    wrapper.className =
      'fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-md ' +
      'rounded-xl border border-slate-200 bg-white shadow-xl ' +
      'p-4 flex items-start gap-3 animate-fade-in-up';

    wrapper.innerHTML = `
      <div class="flex-1">
        <h3 class="text-slate-900 font-semibold">Aggiornamento disponibile</h3>
        <p class="text-slate-600 text-sm mt-1">
          È pronta una nuova versione dell’app.
        </p>
      </div>
      <div class="flex gap-2">
        <button id="pwa-update-later"
          class="px-3 py-2 text-sm rounded-lg bg-slate-200 text-slate-800 hover:bg-slate-300 transition">
          Più tardi
        </button>
        <button id="pwa-update-now"
          class="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition">
          Aggiorna
        </button>
      </div>
    `;

    document.body.appendChild(wrapper);

    const btnLater = document.getElementById('pwa-update-later') as HTMLButtonElement | null;
    const btnNow = document.getElementById('pwa-update-now') as HTMLButtonElement | null;

    const cleanup = () => {
      wrapper.remove();
    };

    btnLater?.addEventListener('click', () => {
      cleanup();
      onDismiss();
    });

    btnNow?.addEventListener('click', () => {
      cleanup();
      onAccept();
    });
  };

  // Ricarica una sola volta quando il nuovo SW prende il controllo
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const wireRegistration = (reg: ServiceWorkerRegistration | undefined | null) => {
    if (!reg) return;

    const showIfWaiting = () => {
      if (reg.waiting && navigator.serviceWorker.controller) {
        createBanner(
          () => reg.waiting?.postMessage({ type: 'SKIP_WAITING' }),
          () => { /* niente, resta la vecchia versione */ }
        );
      }
    };

    // Caso A: apri e c’è già un worker waiting
    showIfWaiting();

    // Caso B: durante l’uso arriva una nuova versione
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showIfWaiting();
        }
      });
    });

    // Check di update a ogni focus/apertura
    const check = () => reg.update().catch(() => {});
    window.addEventListener('focus', check);
    check();
  };

  // Recupera la registration creata (di solito in index.html) e aggancia gli handler
  window.addEventListener('load', async () => {
    try {
      let reg = await navigator.serviceWorker.getRegistration(scopeGuess);
      if (!reg) reg = await navigator.serviceWorker.getRegistration(); // fallback
      wireRegistration(reg);
    } catch {
      // ignora
    }
  });
})();
