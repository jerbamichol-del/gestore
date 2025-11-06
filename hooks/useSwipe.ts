import { RefObject, useEffect, useRef, useState } from 'react';

type Handlers = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  // opzionale: blur immediato tastiera o altre azioni
  onSwipeStart?: () => void;
  onSwipeMove?: (progress: number) => void;
};

type Options = {
  enabled: boolean;
  threshold?: number;   // px necessari per confermare lo swipe
  slop?: number;        // px per dichiarare che è un drag orizzontale
  cancelClickOnSwipe?: boolean; // sopprimi il click solo se c'è stato swipe
};

type SwipeState = {
  progress: number;   // -1..1
  isSwiping: boolean;
};

export function useSwipe(
  containerRef: RefObject<HTMLElement>,
  handlers: Handlers,
  opts: Options
): SwipeState {
  const {
    enabled,
    threshold = 48,
    slop = 6,
    cancelClickOnSwipe = true,
  } = opts;

  const [progress, setProgress] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const draggingRef = useRef(false);
  const swipedRef = useRef(false);
  const widthRef = useRef(1);
  const pointerIdRef = useRef<number | null>(null);

  // sopprime UN solo click subito dopo uno swipe reale
  const clickSuppressTimer = useRef<number | null>(null);
  const suppressNextClick = (root: HTMLElement) => {
    const handler = (e: MouseEvent) => {
      root.removeEventListener('click', handler, true);
      if (clickSuppressTimer.current) {
        window.clearTimeout(clickSuppressTimer.current);
        clickSuppressTimer.current = null;
      }
      e.stopPropagation();
      e.preventDefault();
    };
    root.addEventListener('click', handler, true);
    clickSuppressTimer.current = window.setTimeout(() => {
      root.removeEventListener('click', handler, true);
      clickSuppressTimer.current = null;
    }, 250);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const onPointerDown = (e: PointerEvent) => {
      // Non blocchiamo mai il tap qui: niente preventDefault.
      pointerIdRef.current = e.pointerId ?? null;
      widthRef.current = el.clientWidth || 1;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      draggingRef.current = false;
      swipedRef.current = false;

      // cattura per ricevere move/up anche se esci dal box
      try { (el as any).setPointerCapture?.(e.pointerId); } catch {}
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerIdRef.current === null) return;

      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      // decidi se è un drag orizzontale
      if (!draggingRef.current) {
        if (adx > slop && adx > ady) {
          draggingRef.current = true;
          setIsSwiping(true);
          handlers.onSwipeStart?.();

          // da ora in poi vogliamo evitare lo scroll orizzontale di default
          // evitando anche selezioni/gesture “click and hold”
          e.preventDefault();
        } else {
          // non ancora drag: lascia fare (scroll/tap normali)
          return;
        }
      } else {
        // è drag in corso
        e.preventDefault();
      }

      const p = Math.max(-1, Math.min(1, dx / widthRef.current));
      setProgress(p);
      handlers.onSwipeMove?.(p);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (pointerIdRef.current === null) return;

      const dx = e.clientX - startXRef.current;
      const adx = Math.abs(dx);

      if (draggingRef.current) {
        // c'è stato un drag reale: valuta outcome
        if (adx >= threshold) {
          if (dx < 0) handlers.onSwipeLeft?.();
          else handlers.onSwipeRight?.();
          swipedRef.current = true;
        }
      }

      // reset stato
      draggingRef.current = false;
      pointerIdRef.current = null;
      setProgress(0);
      setIsSwiping(false);

      // sopprimi un click sintetico solo se c'è stato swipe
      if (swipedRef.current && cancelClickOnSwipe) {
        suppressNextClick(el);
      }
      swipedRef.current = false;

      try { (el as any).releasePointerCapture?.((e as any).pointerId); } catch {}
    };

    const onPointerCancel = () => {
      draggingRef.current = false;
      pointerIdRef.current = null;
      setProgress(0);
      setIsSwiping(false);
    };

    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointermove', onPointerMove, { passive: false }); // possiamo chiamare preventDefault quando serve
    el.addEventListener('pointerup', onPointerUp, { passive: true });
    el.addEventListener('pointercancel', onPointerCancel, { passive: true });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown as any);
      el.removeEventListener('pointermove', onPointerMove as any);
      el.removeEventListener('pointerup', onPointerUp as any);
      el.removeEventListener('pointercancel', onPointerCancel as any);
      if (clickSuppressTimer.current) {
        window.clearTimeout(clickSuppressTimer.current);
        clickSuppressTimer.current = null;
      }
    };
  }, [containerRef, enabled, threshold, slop, cancelClickOnSwipe, handlers]);

  return { progress, isSwiping };
}
