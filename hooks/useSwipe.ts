import { RefObject, useEffect, useRef, useState } from 'react';

type Handlers = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeStart?: () => void;                 // es. per blur tastiera
  onSwipeMove?: (progress: number) => void;  // opzionale
};

type Options = {
  enabled: boolean;
  threshold?: number;      // px necessari per confermare lo swipe
  slop?: number;           // px per riconoscere il drag orizzontale
  cancelClickOnSwipe?: boolean; // sopprimi il click solo se c'è stato swipe reale
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
    slop = 10,
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

  // Sopprimi UN click sintetico subito dopo uno swipe reale
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
      pointerIdRef.current = e.pointerId ?? null;
      widthRef.current = el.clientWidth || 1;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      draggingRef.current = false;
      swipedRef.current = false;
      // NIENTE setPointerCapture qui: la faremo solo quando riconosciamo il drag
    };

    const onPointerMove = (e: PointerEvent) => {
      if (pointerIdRef.current === null) return;

      const dx = e.clientX - startXRef.current;
      const dy = e.clientY - startYRef.current;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (!draggingRef.current) {
        // inizia a considerare swipe solo se orizzontale netto
        if (adx > slop && adx > ady) {
          draggingRef.current = true;
          setIsSwiping(true);
          handlers.onSwipeStart?.();
          try { (el as any).setPointerCapture?.((e as any).pointerId); } catch {}
          // adesso sì, preveniamo default per evitare selezioni/scroll orizzontale
          e.preventDefault();
        } else {
          // ancora nessun drag: lascia passare TAP e scroll verticali
          return;
        }
      } else {
        // drag in corso
        e.preventDefault();
      }

      const p = Math.max(-1, Math.min(1, dx / widthRef.current));
      setProgress(p);
      handlers.onSwipeMove?.(p);
    };

    const endDrag = (e: PointerEvent) => {
      if (pointerIdRef.current === null) return;

      const dx = e.clientX - startXRef.current;
      const adx = Math.abs(dx);

      if (draggingRef.current) {
        if (adx >= threshold) {
          if (dx < 0) handlers.onSwipeLeft?.();
          else handlers.onSwipeRight?.();
          swipedRef.current = true;
        }
      }

      draggingRef.current = false;
      pointerIdRef.current = null;
      setProgress(0);
      setIsSwiping(false);

      if (swipedRef.current && cancelClickOnSwipe) {
        suppressNextClick(el);
      }
      swipedRef.current = false;

      try { (el as any).releasePointerCapture?.((e as any).pointerId); } catch {}
    };

    const onPointerUp = (e: PointerEvent) => endDrag(e);
    const onPointerCancel = (e: PointerEvent) => endDrag(e);

    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('pointermove', onPointerMove, { passive: false });
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
