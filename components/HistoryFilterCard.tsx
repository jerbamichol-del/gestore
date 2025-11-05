import React, { useState, useRef, useEffect } from 'react';
import { DateRangePickerModal } from './DateRangePickerModal';

type DateFilter = 'all' | '7d' | '30d' | '6m' | '1y';

interface HistoryFilterCardProps {
  onSelectQuickFilter: (value: DateFilter) => void;
  currentQuickFilter: DateFilter;
  onCustomRangeChange: (range: { start: string | null, end: string | null }) => void;
  currentCustomRange: { start: string | null, end: string | null };
  isCustomRangeActive: boolean;
  onDateModalStateChange: (isOpen: boolean) => void;
  isActive: boolean;
}

const QuickFilterTable: React.FC<{
  onSelect: (value: DateFilter) => void;
  currentValue: DateFilter;
  isCustomActive: boolean;
}> = ({ onSelect, currentValue, isCustomActive }) => {
  const filters: { value: DateFilter; label: string }[] = [
    { value: '7d', label: '7G' },
    { value: '30d', label: '30G' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1A' },
  ];

  return (
    <table className="w-full table-fixed border-collapse border border-slate-400">
      <tbody>
        <tr>
          {filters.map(filter => {
            const isActive = !isCustomActive && currentValue === filter.value;
            return (
              <td key={filter.value} className="border border-slate-400 p-0 h-11">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    onSelect(currentValue === filter.value ? 'all' : filter.value);
                  }}
                  style={{ touchAction: 'manipulation' }}
                  className={`w-full h-full flex items-center justify-center px-2 text-center font-semibold text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                    isActive ? 'bg-indigo-600 text-white'
                             : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {filter.label}
                </button>
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
};

const formatDateForButton = (dateString: string): string => {
    // Correctly parse YYYY-MM-DD as a local date to avoid timezone issues.
    const parts = dateString.split('-').map(Number);
    // Date constructor month is 0-indexed
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: '2-digit' }).format(date).replace('.', '');
};

const CustomDateRangeInputs: React.FC<{
  onClick: () => void;
  range: { start: string | null; end: string | null };
}> = ({ onClick, range }) => {
  const hasRange = range.start && range.end;
  const buttonText = hasRange
    ? `${formatDateForButton(range.start!)} - ${formatDateForButton(range.end!)}`
    : "Imposta periodo";
  const ariaLabelText = hasRange
    ? `Attualmente: ${buttonText}`
    : 'Nessun intervallo impostato';

  return (
    <div className="border border-slate-400 h-11">
      <button
        onClick={(e) => {
          e.stopPropagation(); // Ferma la propagazione ma non previene il default
          onClick();
        }}
        style={{ touchAction: 'manipulation' }}
        aria-label={`Seleziona intervallo di date. ${ariaLabelText}`}
        className="w-full h-full flex items-center justify-center gap-2 px-2 bg-slate-100 hover:bg-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
      >
        <span className="text-sm font-semibold text-slate-700">
          {buttonText}
        </span>
      </button>
    </div>
  );
};


export const HistoryFilterCard: React.FC<HistoryFilterCardProps> = ({
  onSelectQuickFilter, currentQuickFilter, onCustomRangeChange, currentCustomRange, isCustomRangeActive, onDateModalStateChange, isActive
}) => {
  const [activeView, setActiveView] = useState<'quick' | 'custom'>('quick');
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    onDateModalStateChange(isDateModalOpen);
  }, [isDateModalOpen, onDateModalStateChange]);

  const [dragPct, setDragPct] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // ===== First-tap fixer =====
  const needsFirstTapFixRef = useRef(false);
  const firstTapDataRef = useRef({ armed: false, startX: 0, startY: 0, startTime: 0, moved: false });
  const cardRootRef = useRef<HTMLDivElement>(null);
  const TAP_MS = 300;
  const SLOP_PX = 10;

  useEffect(() => {
    if (isActive) {
      needsFirstTapFixRef.current = true;
      firstTapDataRef.current = { armed: false, startX: 0, startY: 0, startTime: 0, moved: false };
    }
  }, [isActive, currentQuickFilter, isCustomRangeActive]);

  const onFirstTapPointerDownCapture: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!needsFirstTapFixRef.current) return;
    firstTapDataRef.current.armed = true;
    firstTapDataRef.current.startX = e.clientX ?? 0;
    firstTapDataRef.current.startY = e.clientY ?? 0;
    firstTapDataRef.current.startTime = performance.now();
    firstTapDataRef.current.moved = false;
  };

  const onFirstTapPointerMoveCapture: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const d = firstTapDataRef.current;
    if (!d.armed || d.moved) return;
    const dx = Math.abs((e.clientX ?? 0) - d.startX);
    const dy = Math.abs((e.clientY ?? 0) - d.startY);
    if (dx > SLOP_PX || dy > SLOP_PX) {
      d.moved = true;
      d.armed = false;
      // Do not disarm needsFirstTapFixRef on swipe
    }
  };

  const onFirstTapPointerUpCapture: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const d = firstTapDataRef.current;
    if (!d.armed) return;

    const dt = performance.now() - d.startTime;
    const isTap = !d.moved && dt < TAP_MS;

    d.armed = false;

    if (!isTap) return; // Not a tap, do nothing, let fixer remain armed

    needsFirstTapFixRef.current = false; // It was a tap, consume the fix

    const raw = e.target as HTMLElement;
    const focusable = (raw.closest('button, [role="button"]') as HTMLElement) || raw;
    try {
      setTimeout(() => focusable.click(), 0);
    } catch {}

    e.preventDefault();
    e.stopPropagation();
  };
  
  const onFirstTapPointerCancelCapture: React.PointerEventHandler<HTMLDivElement> = () => {
    firstTapDataRef.current.armed = false;
  };

  useEffect(() => {
    const el = swipeContainerRef.current;
    if (!el) return;

    const ANG = 30;
    const TAN = Math.tan((ANG * Math.PI) / 180);
    const SLOP = 10;
    const TRIGGER_RATIO = 0.10;

    let hasDown = false;
    let lock: null | 'h' | 'v' = null;
    let sx = 0, sy = 0;
    let width = 1;
    let pid: number | null = null;
    let startTime = 0;

    const basePct = () => (activeView === 'quick' ? 0 : -50);

    const onDown = (e: PointerEvent) => {
        if (e.button !== 0) return;
        hasDown = true;
        lock = null;
        sx = e.clientX;
        sy = e.clientY;
        width = el.getBoundingClientRect().width || 1;
        pid = e.pointerId;
        startTime = performance.now();
    };

    const onMove = (e: PointerEvent) => {
        if (!hasDown || e.pointerId !== pid) return;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;

        if (!lock) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) > SLOP) {
                lock = Math.abs(dx) > Math.abs(dy) * TAN ? 'h' : 'v';
                if (lock === 'h') {
                    try { el.setPointerCapture?.(pid); } catch {}
                }
            }
        }

        if (lock !== 'h') return;
        
        setDragging(true);
        const deltaPct = (dx / width) * 50;
        let t = basePct() + deltaPct;
        if (t > 0) t = 0;
        if (t < -50) t = -50;
        setDragPct(t);
    };

    const onEnd = (e: PointerEvent) => {
        if (!hasDown || e.pointerId !== pid) return;

        const wasLocked = lock === 'h';
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        const distance = Math.hypot(dx, dy);
        const elapsed = performance.now() - startTime;
        const isTapLike = distance < SLOP * 1.5 && elapsed < 300;

        if (wasLocked) {
            try { el.releasePointerCapture?.(pid); } catch {}
            
            const triggerPx = width * TRIGGER_RATIO;
            let swiped = false;
            if (activeView === 'quick' && dx <= -triggerPx) {
                setActiveView('custom');
                swiped = true;
            } else if (activeView === 'custom' && dx >= triggerPx) {
                setActiveView('quick');
                swiped = true;
            }

            // Only consume the event (stop propagation) if it was a clear swipe,
            // not an imprecise tap.
            if (swiped) {
                e.stopPropagation();
            }
        }

        setDragging(false);
        setDragPct(null);
        hasDown = false;
        pid = null;
        lock = null;
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', onEnd);

    return () => {
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onEnd);
        el.removeEventListener('pointercancel', onEnd);
    };
}, [activeView]);


  const baseTranslate = activeView === 'quick' ? 0 : -50;
  const translateX = dragPct !== null ? dragPct : baseTranslate;

  return (
    <>
      <div 
        ref={cardRootRef}
        onPointerDownCapture={onFirstTapPointerDownCapture}
        onPointerMoveCapture={onFirstTapPointerMoveCapture}
        onPointerUpCapture={onFirstTapPointerUpCapture}
        onPointerCancelCapture={onFirstTapPointerCancelCapture}
        className="flex-shrink-0 z-30"
      >
        <div className="bg-white/95 backdrop-blur-sm shadow-[0_-8px_20px_-5px_rgba(0,0,0,0.08)]">
          <div className="mx-auto pt-3 pb-2 rounded-t-2xl">
            <div
              className="overflow-hidden"
              ref={swipeContainerRef}
              data-no-page-swipe="true"
              style={{ touchAction: 'pan-y', overscrollBehaviorX: 'contain' }}
            >
              <div
                className="flex"
                style={{
                  width: '200%',
                  transform: `translateX(${translateX}%)`,
                  transition: dragging ? 'none' : 'transform 0.12s ease-out'
                }}
              >
                <div className="w-1/2 flex-shrink-0 px-4">
                  <QuickFilterTable
                    onSelect={onSelectQuickFilter}
                    currentValue={currentQuickFilter}
                    isCustomActive={isCustomRangeActive}
                  />
                </div>
                <div className="w-1/2 flex-shrink-0 px-4">
                  <CustomDateRangeInputs
                    onClick={() => setIsDateModalOpen(true)}
                    range={currentCustomRange}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-center items-center gap-2.5 pt-2">
              <button
                onPointerUp={() => setActiveView('quick')}
                onClick={(e) => e.preventDefault()}
                style={{ touchAction: 'manipulation' }}
                aria-label="Vai ai filtri rapidi"
                className={`w-3 h-3 rounded-full transition-colors ${activeView === 'quick' ? 'bg-indigo-600' : 'bg-slate-300 hover:bg-slate-400'}`}
              />
              <button
                onPointerUp={() => setActiveView('custom')}
                onClick={(e) => e.preventDefault()}
                style={{ touchAction: 'manipulation' }}
                aria-label="Vai al filtro per data personalizzata"
                className={`w-3 h-3 rounded-full transition-colors ${activeView === 'custom' ? 'bg-indigo-600' : 'bg-slate-300 hover:bg-slate-400'}`}
              />
            </div>
          </div>
          <div style={{ height: `env(safe-area-inset-bottom, 0px)` }} />
        </div>
      </div>
      <DateRangePickerModal
          isOpen={isDateModalOpen}
          onClose={() => setIsDateModalOpen(false)}
          initialRange={currentCustomRange}
          onApply={(range) => {
              onCustomRangeChange(range);
              setIsDateModalOpen(false);
          }}
      />
    </>
  );
};
