// useSwipe.ts
import * as React from "react";

type SwipeOpts = {
  enabled?: boolean;
  slop?: number;
  threshold?: number;
  ignoreSelector?: string;
  disableDrag?: (intent: "left" | "right") => boolean;
};

export function useSwipe(
  ref: React.RefObject<HTMLElement>,
  handlers: { onSwipeLeft?: () => void; onSwipeRight?: () => void },
  opts: SwipeOpts = {}
) {
  const {
    enabled = true,
    slop = 10,
    threshold = 32,
    ignoreSelector,
    disableDrag,
  } = opts;

  const state = React.useRef({
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
    dx: 0,
    armed: false,
    intent: null as null | "left" | "right",
  });
  
  const [progress, setProgress] = React.useState(0);
  const [isSwiping, setIsSwiping] = React.useState(false);
  
  const handlersRef = React.useRef(handlers);
  handlersRef.current = handlers;

  const resetState = React.useCallback(() => {
    state.current.pointerId = null;
    state.current.armed = false;
    state.current.intent = null;
    state.current.dx = 0;
    setIsSwiping(false);
    setProgress(0);
  }, []);

  React.useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;

    const onDown = (e: PointerEvent) => {
      if (state.current.pointerId !== null || (ignoreSelector && (e.target as HTMLElement).closest(ignoreSelector))) {
        return;
      }
      
      state.current.pointerId = e.pointerId;
      state.current.startX = e.clientX;
      state.current.startY = e.clientY;
      state.current.dx = 0;
      state.current.armed = false;
      state.current.intent = null;
    };

    const onMove = (e: PointerEvent) => {
      const st = state.current;
      if (st.pointerId !== e.pointerId) return;

      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      st.dx = dx;

      if (!st.armed) {
        if (Math.abs(dx) > slop && Math.abs(dx) > Math.abs(dy) * 2) {
          st.armed = true;
          setIsSwiping(true);
          st.intent = dx < 0 ? 'left' : 'right';
          try {
            root.setPointerCapture(e.pointerId);
          } catch {}
        } else if (Math.abs(dy) > slop) {
          st.pointerId = null;
        }
        if (!st.armed) return;
      }
      
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
      const st = state.current;
      if (st.pointerId !== e.pointerId) return;

      const wasArmed = st.armed;
      
      if (wasArmed) {
        try { 
          root.releasePointerCapture(e.pointerId);
        } catch {}

        if (Math.abs(st.dx) >= threshold) {
            if (st.intent === "left" && handlersRef.current.onSwipeLeft) {
              handlersRef.current.onSwipeLeft();
            } else if (st.intent === "right" && handlersRef.current.onSwipeRight) {
              handlersRef.current.onSwipeRight();
            }
        }
      }
      
      resetState();
    };
    
    const onCancel = (e: PointerEvent) => {
        if (state.current.pointerId !== e.pointerId) return;
        
        if(state.current.armed) {
            try { 
              root.releasePointerCapture(e.pointerId);
            } catch {}
        }
        
        resetState();
    };

    root.addEventListener("pointerdown", onDown, { passive: true });
    root.addEventListener("pointermove", onMove, { passive: true });
    root.addEventListener("pointerup", onUp, { passive: true });
    root.addEventListener("pointercancel", onCancel, { passive: true });

    return () => {
      root.removeEventListener("pointerdown", onDown as any);
      root.removeEventListener("pointermove", onMove as any);
      root.removeEventListener("pointerup", onUp as any);
      root.removeEventListener("pointercancel", onCancel as any);
    };
  }, [
    ref, enabled, slop, threshold, ignoreSelector, disableDrag, resetState
  ]);

  return { progress, isSwiping, stateRef: state };
}
