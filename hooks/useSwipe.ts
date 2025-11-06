// useSwipe.ts / useSwipe.js
import * as React from "react";

type SwipeOpts = {
  enabled?: boolean;
  slop?: number;        // px per "armare" il gesto
  threshold?: number;   // px per confermare la nav
  angle?: number;       // tolleranza orizzontale (± gradi)
  enableLeftAtRightEdge?: boolean;
  enableRightAtLeftEdge?: boolean;
  ignoreSelector?: string;
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
    slop = 10,
    threshold = 32,
    angle = 30,
    enableLeftAtRightEdge = true,
    enableRightAtLeftEdge = false,
    ignoreSelector,
    disableDrag,
  } = opts;

  const st = React.useRef({
    tracking: false,
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    armed: false, // Becomes true only after slop is exceeded
    intent: null as null | "left" | "right",
  }).current;

  const [progress, setProgress] = React.useState(0);
  const [isSwiping, setIsSwiping] = React.useState(false);
  const TAN = Math.tan((angle * Math.PI) / 180);
  
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  React.useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;

    const onDown = (e: PointerEvent) => {
      if (ignoreSelector && (e.target as HTMLElement).closest(ignoreSelector)) {
        return;
      }
      if (st.tracking) return;

      st.tracking = true;
      st.pointerId = e.pointerId;
      st.startX = e.clientX;
      st.startY = e.clientY;
      st.dx = 0;
      st.dy = 0;
      st.armed = false;
      st.intent = null;
      
      setIsSwiping(false);
      setProgress(0);
    };

    const onMove = (e: PointerEvent) => {
      if (!st.tracking || e.pointerId !== st.pointerId) return;

      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      st.dx = dx;
      st.dy = dy;

      if (!st.armed) {
        if (Math.abs(dx) > slop || Math.abs(dy) > slop) {
           if (Math.abs(dx) > Math.abs(dy) * TAN) {
              // Horizontal gesture detected, arm the swipe and capture pointer
              st.armed = true;
              setIsSwiping(true);
              st.intent = dx < 0 ? "left" : "right";
              try { 
                (e.target as HTMLElement).setPointerCapture(e.pointerId); 
                if (e.cancelable) e.preventDefault(); // Prevent scroll only when swipe is confirmed
              } catch {}
           } else {
              // Vertical gesture, just stop tracking this gesture
              st.tracking = false;
           }
        }
        // Don't proceed if not armed yet
        if (!st.armed) return;
      }
      
      // If we are here, we are armed and swiping horizontally
      
      const hasHandler =
        (st.intent === 'left' && handlersRef.current.onSwipeLeft) ||
        (st.intent === 'right' && handlersRef.current.onSwipeRight);
      
      if (!hasHandler) return;

      const screenWidth = root.offsetWidth;
      if (screenWidth > 0) {
          const p = Math.max(-1, Math.min(1, dx / screenWidth));
          if (st.intent && disableDrag?.(st.intent)) {
            setProgress(0);
          } else {
            setProgress(p);
          }
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!st.tracking || e.pointerId !== st.pointerId) return;

      const wasArmed = st.armed;
      
      if (wasArmed && st.pointerId !== null) {
        try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
      }

      // Reset state
      st.tracking = false;
      st.pointerId = null;
      st.armed = false;
      setIsSwiping(false);
      setProgress(0);

      if (wasArmed) {
        if (e.cancelable) e.preventDefault(); // Prevent click if it was a swipe
        
        if (Math.abs(st.dx) >= threshold) {
            if (st.intent === "left" && handlersRef.current.onSwipeLeft) {
              handlersRef.current.onSwipeLeft();
            } else if (st.intent === "right" && handlersRef.current.onSwipeRight) {
              handlersRef.current.onSwipeRight();
            }
        }
      }
    };
    
    const onCancel = (e: PointerEvent) => {
        if (!st.tracking || e.pointerId !== st.pointerId) return;
        
        if(st.armed && st.pointerId !== null) {
            try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
        }
        
        st.tracking = false;
        st.pointerId = null;
        st.armed = false;
        setIsSwiping(false);
        setProgress(0);
    };

    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerup", onUp);
    root.addEventListener("pointercancel", onCancel);

    return () => {
      root.removeEventListener("pointerdown", onDown as any);
      root.removeEventListener("pointermove", onMove as any);
      root.removeEventListener("pointerup", onUp as any);
      root.removeEventListener("pointercancel", onCancel as any);
    };
  }, [
    ref, enabled, slop, threshold, angle, ignoreSelector, disableDrag, TAN, st
  ]);

  return { progress, isSwiping };
}