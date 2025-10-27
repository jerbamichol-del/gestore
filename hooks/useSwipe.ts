// useSwipe.ts / useSwipe.js
import * as React from "react";

type SwipeOpts = {
  enabled?: boolean;
  slop?: number;        // px per "armare" il gesto (default 12)
  threshold?: number;   // px per confermare la nav (default 56)
  angle?: number;       // tolleranza orizzontale (± gradi, default 30)
  enableLeftAtRightEdge?: boolean;  // default true
  enableRightAtLeftEdge?: boolean;  // default false
  ignoreSelector?: string; // New option to ignore swipes on certain elements
  disableDrag?: (intent: "left" | "right") => boolean;
};

function isHorizScrollable(el: HTMLElement | null) {
  if (!el) return false;
  const s = getComputedStyle(el);
  if (!(s.overflowX === "auto" || s.overflowX === "scroll")) return false;
  return el.scrollWidth > el.clientWidth + 1;
}

function nearestHorizScroller(from: EventTarget | null): HTMLElement | null {
  let el = from as HTMLElement | null;
  while (el) {
    if (isHorizScrollable(el)) return el;
    el = el.parentElement;
  }
  return null;
}

function atStart(sc: HTMLElement) {
  // LTR: 0; usiamo una tolleranza di 1px
  return sc.scrollLeft <= 1;
}
function atEnd(sc: HTMLElement) {
  const max = sc.scrollWidth - sc.clientWidth;
  return sc.scrollLeft >= max - 1;
}

export function useSwipe(
  ref: React.RefObject<HTMLElement>,
  handlers: { onSwipeLeft?: () => void; onSwipeRight?: () => void },
  opts: SwipeOpts = {}
) {
  const {
    enabled = true,
    slop = 12,
    threshold = 56,
    angle = 30,
    enableLeftAtRightEdge = true,
    enableRightAtLeftEdge = false,
    ignoreSelector,
    disableDrag,
  } = opts;

  const st = React.useRef({
    tracking: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    armed: false,
    intent: null as null | "left" | "right",
    scroller: null as HTMLElement | null,
    mode: null as null | "scroll" | "page",
    handoffX: null as number | null, // X al momento del passaggio "scroll → page"
  });

  const [progress, setProgress] = React.useState(0);
  const [isSwiping, setIsSwiping] = React.useState(false);
  const TAN = Math.tan((angle * Math.PI) / 180);
  
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  React.useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;

    const onDown = (e: PointerEvent) => {
      // Check if the event target or its parent matches the ignore selector.
      if (ignoreSelector && (e.target as HTMLElement).closest(ignoreSelector)) {
        return; // Do not start tracking the swipe.
      }

      st.current.tracking = true;
      st.current.startX = e.clientX;
      st.current.startY = e.clientY;
      st.current.dx = 0;
      st.current.dy = 0;
      st.current.armed = false;
      st.current.intent = null;
      st.current.mode = null;
      st.current.handoffX = null;
      st.current.scroller = nearestHorizScroller(e.target);

      setIsSwiping(false);
      setProgress(0);
      // 🔸 non catturiamo subito il pointer: lasciamo scorrere la card liberamente
    };

    const onMove = (e: PointerEvent) => {
      if (!st.current.tracking) return;

      const dx = e.clientX - st.current.startX;
      const dy = e.clientY - st.current.startY;
      st.current.dx = dx;
      st.current.dy = dy;

      const mostlyHorizontal = Math.abs(dx) > Math.abs(dy) * TAN;

      // 1) Lock della direzione quando superiamo lo slop in orizzontale
      if (!st.current.armed && mostlyHorizontal && Math.abs(dx) >= slop) {
        st.current.armed = true;
        st.current.intent = dx < 0 ? "left" : "right";

        const hasHandler =
          (st.current.intent === 'left' && handlersRef.current.onSwipeLeft) ||
          (st.current.intent === 'right' && handlersRef.current.onSwipeRight);

        const sc = st.current.scroller;
        if (sc) {
          // Politica: nav solo Left@RightEdge (storico); Right@LeftEdge opzionale (default off)
          if (st.current.intent === "left") {
            st.current.mode = enableLeftAtRightEdge && atEnd(sc) && hasHandler ? "page" : "scroll";
            if (st.current.mode === "page") {
              st.current.handoffX = e.clientX;
              try { root.setPointerCapture?.((e as any).pointerId ?? 1); } catch {}
            }
          } else { // intent === 'right'
            st.current.mode = enableRightAtLeftEdge && atStart(sc) && hasHandler ? "page" : "scroll";
            if (st.current.mode === "page") {
              st.current.handoffX = e.clientX;
              try { root.setPointerCapture?.((e as any).pointerId ?? 1); } catch {}
            }
          }
        } else {
          // nessuno scroller: è swipe di pagina, only if handler exists
          if (hasHandler) {
             st.current.mode = "page";
             st.current.handoffX = e.clientX;
             try { root.setPointerCapture?.((e as any).pointerId ?? 1); } catch {}
          } else {
             // No handler, no scroller. This swipe does nothing.
             st.current.armed = false;
             st.current.intent = null;
          }
        }
      }

      if (!st.current.armed || !mostlyHorizontal) return;

      // 2) Se siamo in modalità "scroll", controlla se raggiungiamo il bordo giusto DURANTE lo stesso gesto
      if (st.current.mode === "scroll" && st.current.scroller) {
        const sc = st.current.scroller;
        const hasHandler =
          (st.current.intent === 'left' && handlersRef.current.onSwipeLeft) ||
          (st.current.intent === 'right' && handlersRef.current.onSwipeRight);

        if (
          hasHandler && // Check handler before handoff
          st.current.intent === "left" &&
          enableLeftAtRightEdge &&
          atEnd(sc)
        ) {
          // **Edge handoff**: la card è ora tutta a destra e continui verso sinistra → passa a pagina
          st.current.mode = "page";
          st.current.handoffX = e.clientX; // zero locale per progress
          try { root.setPointerCapture?.((e as any).pointerId ?? 1); } catch {}
        } else if (
          hasHandler && // Check handler before handoff
          st.current.intent === "right" &&
          enableRightAtLeftEdge &&
          atStart(sc)
        ) {
          st.current.mode = "page";
          st.current.handoffX = e.clientX;
          try { root.setPointerCapture?.((e as any).pointerId ?? 1); } catch {}
        } else {
          // resta scroll: non interferire
          setIsSwiping(false);
          setProgress(0);
          return;
        }
      }

      // 3) Modalità pagina: gestiamo il gesto rispetto al punto di handoff
      if (st.current.mode === "page") {
        if (e.cancelable) e.preventDefault();
        setIsSwiping(true);

        const baseX = st.current.handoffX ?? st.current.startX;
        const dxFromHandoff = e.clientX - baseX; // negativo = left, positivo = right

        // progress normalizzato (clamp −1..1)
        const screenWidth = root.offsetWidth;
        if (screenWidth > 0) {
            const p = Math.max(-1, Math.min(1, dxFromHandoff / screenWidth));
            if (st.current.intent && disableDrag?.(st.current.intent)) {
              setProgress(0);
            } else {
              setProgress(p);
            }
        }
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!st.current.tracking) return;

      const { armed, intent, mode, handoffX } = st.current;
      
      try { root.releasePointerCapture?.((e as any).pointerId ?? 1); } catch {}

      st.current.tracking = false;
      setIsSwiping(false);
      setProgress(0);

      if (!armed || mode !== "page" || !intent) return;

      const baseX = handoffX ?? st.current.startX;
      const dxFromHandoff = e.clientX - baseX;

      if (Math.abs(dxFromHandoff) >= threshold) {
          if (intent === "left" && handlersRef.current.onSwipeLeft) {
            handlersRef.current.onSwipeLeft();
          } else if (intent === "right" && handlersRef.current.onSwipeRight) {
            handlersRef.current.onSwipeRight();
          }
      }
      // altrimenti: gesto non confermato → nessuna nav
    };

    const onCancel = (e: PointerEvent) => {
      try { root.releasePointerCapture?.((e as any).pointerId ?? 1); } catch {}
      st.current.tracking = false;
      setIsSwiping(false);
      setProgress(0);
    };

    root.addEventListener("pointerdown", onDown, { passive: true });
    root.addEventListener("pointermove", onMove, { passive: false }); // serve per preventDefault
    root.addEventListener("pointerup", onUp, { passive: true });
    root.addEventListener("pointercancel", onCancel);

    return () => {
      root.removeEventListener("pointerdown", onDown as any);
      root.removeEventListener("pointermove", onMove as any);
      root.removeEventListener("pointerup", onUp as any);
      root.removeEventListener("pointercancel", onCancel as any);
    };
  }, [
    ref,
    enabled,
    slop,
    threshold,
    angle,
    enableLeftAtRightEdge,
    enableRightAtLeftEdge,
    ignoreSelector,
    disableDrag,
  ]);

  return { progress, isSwiping };
}