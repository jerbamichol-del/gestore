(function () {
  function show(msg) {
    let box = document.getElementById('__debug_overlay__');
    if (!box) {
      box = document.createElement('pre');
      box.id = '__debug_overlay__';
      box.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;max-height:50vh;overflow:auto;background:#111;color:#0f0;padding:8px;font:12px/1.4 monospace;z-index:99999;opacity:.95;border:1px solid #0f0';
      document.body.appendChild(box);
    }
    box.textContent += msg + '\n';
  }
  window.addEventListener('error', e => show(`Error: ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}`));
  window.addEventListener('unhandledrejection', e => show(`UnhandledRejection: ${e.reason && e.reason.message ? e.reason.message : e.reason}`));
  show('✅ debug-overlay attivo');
})();
