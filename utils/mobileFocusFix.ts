// utils/mobileFocusFix.ts

function isFocusableLike(el: HTMLElement): boolean {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable) return true;
  const role = el.getAttribute('role');
  if (role === 'button') return true;
  const tabIndexAttr = el.getAttribute('tabindex');
  if (tabIndexAttr !== null && parseInt(tabIndexAttr, 10) >= 0) return true;
  return false;
}

/**
 * Fix globale "primo tap a vuoto":
 * prima che il tap arrivi al nuovo target, se il focus è altrove, lo rimuove.
 * Non tocca layout, non blocca eventi, non cambia UX.
 */
export function installGlobalFirstTapFix(root: Document | HTMLElement = document): void {
  const handler = (e: Event) => {
    const ae = document.activeElement as HTMLElement | null;
    const t = e.target as Node | null;
    if (!ae || !t) return;

    // Se stai tappando dentro lo stesso elemento attivo, non blurrare
    if (ae === t || ae.contains(t)) return;

    if (isFocusableLike(ae)) {
      ae.blur(); // toglie focus PRIMA che il tap arrivi al nuovo target
    }
  };

  // Usiamo più ingressi per coprire Safari/Android vari
  root.addEventListener('pointerdown', handler, { capture: true, passive: true });
  root.addEventListener('touchstart', handler, { capture: true, passive: true });
  root.addEventListener('mousedown', handler, { capture: true, passive: true });
}
