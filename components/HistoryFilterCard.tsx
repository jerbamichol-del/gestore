// components/HistoryFilterCard.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DateRangePickerModal } from './DateRangePickerModal';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { useSwipe } from '../hooks/useSwipe';
import SmoothPullTab from './SmoothPullTab';
import { useTapBridge } from '../hooks/useTapBridge';

type DateFilter = 'all' | '7d' | '30d' | '6m' | '1y';
type PeriodType = 'day' | 'week' | 'month' | 'year';

interface HistoryFilterCardProps {
  onSelectQuickFilter: (value: DateFilter) => void;
  currentQuickFilter: DateFilter;
  onCustomRangeChange: (range: { start: string | null, end: string | null }) => void;
  currentCustomRange: { start: string | null, end: string | null };
  isCustomRangeActive: boolean;
  onDateModalStateChange: (isOpen: boolean) => void;
  isActive: boolean;
  onSelectPeriodType: (type: PeriodType) => void;
  onSetPeriodDate: (date: Date) => void;
  periodType: PeriodType;
  periodDate: Date;
  onActivatePeriodFilter: () => void;
  isPeriodFilterActive: boolean;
}

/* -------------------- QuickFilterControl -------------------- */
const QuickFilterControl: React.FC<{
  onSelect: (value: DateFilter) => void;
  currentValue: DateFilter;
  isActive: boolean;
}> = ({ onSelect, currentValue, isActive }) => {
  const filters: { value: DateFilter; label: string }[] = [
    { value: '7d', label: '7G' },
    { value: '30d', label: '30G' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1A' },
  ];
  return (
    <div className={`w-full h-10 flex border rounded-lg overflow-hidden transition-colors ${isActive ? 'border-indigo-600' : 'border-slate-400'}`}>
      {filters.map((filter, index) => {
        const isButtonActive = isActive && currentValue === filter.value;
        return (
          <button
            key={filter.value}
            onClick={() => onSelect(filter.value)}
            onPointerDown={(e) => e.stopPropagation()}
            style={{ touchAction: 'manipulation' }}
            className={`flex-1 flex items-center justify-center px-2 text-center font-semibold text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500
              ${index > 0 ? 'border-l' : ''}
              ${isButtonActive ? 'bg-indigo-600 text-white border-indigo-600'
                               : `bg-slate-100 text-slate-700 hover:bg-slate-200 ${isActive ? 'border-indigo-600' : 'border-slate-400'}`}`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
};

/* -------------------- CustomDateRangeInputs -------------------- */
const formatDateForButton = (dateString: string): string => {
  const parts = dateString.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })
    .format(date)
    .replace('.', '');
};

const CustomDateRangeInputs: React.FC<{
  onClick: () => void;
  range: { start: string | null; end: string | null };
  isActive: boolean;
}> = ({ onClick, range, isActive }) => {
  const hasRange = !!(range.start && range.end);
  const buttonText = hasRange
    ? `${formatDateForButton(range.start!)} - ${formatDateForButton(range.end!)}`
    : 'Imposta periodo';
  const ariaLabelText = hasRange ? `Attualmente: ${buttonText}` : 'Nessun intervallo impostato';

  return (
    <div className={`border h-10 transition-colors rounded-lg ${isActive ? 'border-indigo-600' : 'border-slate-400'}`}>
      <button
        onClick={onClick}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ touchAction: 'manipulation' }}
        aria-label={`Seleziona intervallo di date. ${ariaLabelText}`}
        className={`w-full h-full flex items-center justify-center gap-2 px-2 hover:bg-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 rounded-lg ${isActive ? 'bg-indigo-100' : 'bg-slate-100'}`}
      >
        <span className={`text-sm font-semibold ${isActive ? 'text-indigo-700' : 'text-slate-700'}`}>
          {buttonText}
        </span>
      </button>
    </div>
  );
};

/* -------------------- PeriodNavigator -------------------- */
const PeriodNavigator: React.FC<{
  periodType: PeriodType;
  periodDate: Date;
  onTypeChange: (type: PeriodType) => void;
  onDateChange: (date: Date) => void;
  isActive: boolean;
  onActivate: () => void;
  isMenuOpen: boolean;
  onMenuToggle: (isOpen: boolean) => void;
}> = ({ periodType, periodDate, onTypeChange, onDateChange, isActive, onActivate, isMenuOpen, onMenuToggle }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleDownOutside = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        onMenuToggle(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('pointerdown', handleDownOutside, { capture: true });
    }
    return () => {
      document.removeEventListener('pointerdown', handleDownOutside as any, { capture: true } as any);
    };
  }, [isMenuOpen, onMenuToggle]);

  const step = (sign: 1 | -1) => {
    onActivate();
    const d = new Date(periodDate);
    switch (periodType) {
      case 'day': d.setDate(d.getDate() + sign * 1); break;
      case 'week': d.setDate(d.getDate() + sign * 7); break;
      case 'month': d.setMonth(d.getMonth() + sign * 1); break;
      case 'year': d.setFullYear(d.getFullYear() + sign * 1); break;
    }
    onDateChange(d);
  };

  const handlePrev = useCallback(() => step(-1), [periodDate, periodType]);
  const handleNext = useCallback(() => step(+1), [periodDate, periodType]);

  const handleTypeSelect = useCallback((type: PeriodType) => {
    onActivate();
    onTypeChange(type);
    onMenuToggle(false);
  }, [onActivate, onTypeChange, onMenuToggle]);

  const toggleMenu = useCallback(() => {
    if (!isActive) onActivate();
    onMenuToggle(!isMenuOpen);
  }, [isActive, isMenuOpen, onActivate, onMenuToggle]);

  const getLabel = useCallback(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(periodDate); start.setHours(0, 0, 0, 0);

    switch (periodType) {
      case 'day': {
        if (start.getTime() === today.getTime()) return 'Oggi';
        const y = new Date(today); y.setDate(today.getDate() - 1);
        if (start.getTime() === y.getTime()) return 'Ieri';
        return periodDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
      }
      case 'week': {
        const sow = new Date(periodDate);
        const day = sow.getDay();
        const diff = sow.getDate() - day + (day === 0 ? -6 : 1);
        sow.setDate(diff); sow.setHours(0,0,0,0);
        const eow = new Date(sow); eow.setDate(sow.getDate() + 6);

        const tsow = new Date(today);
        const tday = tsow.getDay();
        const tdiff = tsow.getDate() - tday + (tday === 0 ? -6:1);
        tsow.setDate(tdiff); tsow.setHours(0,0,0,0);

        if (sow.getTime() === tsow.getTime()) return 'Questa Settimana';
        const last = new Date(tsow); last.setDate(tsow.getDate() - 7);
        if (sow.getTime() === last.getTime()) return 'Settimana Scorsa';
        return `${sow.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${eow.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }
      case 'month': {
        const cm = today.getMonth(); const cy = today.getFullYear();
        if (periodDate.getMonth() === cm && periodDate.getFullYear() === cy) return 'Questo Mese';
        const pm = cm === 0 ? 11 : cm - 1;
        const py = cm === 0 ? cy - 1 : cy;
        if (periodDate.getMonth() === pm && periodDate.getFullYear() === py) return 'Mese Scorso';
        return periodDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
      }
      case 'year': {
        if (periodDate.getFullYear() === today.getFullYear()) return "Quest'Anno";
        if (periodDate.getFullYear() === today.getFullYear() - 1) return 'Anno Scorso';
        return periodDate.getFullYear().toString();
      }
    }
  }, [periodDate, periodType]);

  return (
    <div
      ref={wrapperRef}
      className={`w-full h-10 flex items-center justify-between border rounded-lg relative transition-colors bg-white ${isActive ? 'border-indigo-600' : 'border-slate-400'}`}
    >
      <button
        onClick={handlePrev}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ touchAction: 'manipulation' }}
        className="h-full px-4 flex items-center justify-center bg-white hover:bg-slate-100 active:scale-95 transition-transform focus:outline-none rounded-l-lg [-webkit-tap-highlight-color:transparent]"
        aria-label="Periodo precedente"
      >
        <ChevronLeftIcon className="w-5 h-5 text-slate-700" />
      </button>

      <div className={`flex-1 text-center relative h-full ${isActive ? 'bg-indigo-100' : 'bg-slate-100'}`}>
        <button
          onClick={toggleMenu}
          onPointerDown={(e) => e.stopPropagation()}
          style={{ touchAction: 'manipulation' }}
          className={`w-full h-full flex items-center justify-center text-sm font-semibold transition-colors ${isActive ? 'text-indigo-700' : 'text-slate-700'} hover:bg-slate-200`}
        >
          {getLabel()}
        </button>

        {isMenuOpen && (
          <div
            className="absolute bottom-full mb-2 left-0 right-0 mx-auto w-40 bg-white border border-slate-200 shadow-lg rounded-lg z-[1000] p-2 space-y-1"
            style={{ pointerEvents: 'auto' }}
          >
            {([
              { value: 'day', label: 'Giorno' },
              { value: 'week', label: 'Settimana' },
              { value: 'month', label: 'Mese' },
              { value: 'year', label: 'Anno' },
            ] as { value: PeriodType; label: string }[]).map(p => (
              <button
                key={p.value}
                onClick={() => handleTypeSelect(p.value)}
                onPointerDown={(e) => e.stopPropagation()}
                style={{ touchAction: 'manipulation' }}
                className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${periodType === p.value ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-50 text-slate-800 hover:bg-slate-200'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleNext}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ touchAction: 'manipulation' }}
        className="h-full px-4 flex items-center justify-center bg-white hover:bg-slate-100 active:scale-95 transition-transform focus:outline-none rounded-r-lg [-webkit-tap-highlight-color:transparent]"
        aria-label="Periodo successivo"
      >
        <ChevronRightIcon className="w-5 h-5 text-slate-700" />
      </button>
    </div>
  );
};

/* -------------------- HistoryFilterCard -------------------- */
export const HistoryFilterCard: React.FC<HistoryFilterCardProps> = (props) => {
  // State base
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const [activeViewIndex, setActiveViewIndex] = useState(0); // unica dichiarazione

  const cardRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const hasLaidOut = useRef(false);
  const [isReady, setIsReady] = useState(false); // evita flash all’ingresso

  const tapBridge = useTapBridge();

  // gesture verticale
  const g = useRef({
    isDragging: false,
    isLocked: false,
    startX: 0,
    startY: 0,
    startT: 0,
    lastY: 0,
    lastT: 0,
    startTranslateY: 0,
    pointerId: null as number | null,
  });

  const OPEN_HEIGHT_VH = 40;
  const [openHeight, setOpenHeight] = useState(0);
  const [peekHeight, setPeekHeight] = useState(0);

  const OPEN_Y = 0;
  const CLOSED_Y = openHeight > peekHeight ? openHeight - peekHeight : 0;

  const [translateY, setTranslateY] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // notifica stato modale
  useEffect(() => {
    props.onDateModalStateChange?.(isDateModalOpen);
  }, [isDateModalOpen, props.onDateModalStateChange]);

  const setCardPosition = useCallback((y: number, animated: boolean) => {
    setIsAnimating(animated);
    setTranslateY(y);
  }, []);

  // Layout: pannello montato SEMPRE quando isActive, ma invisibile finché non pronto
  useEffect(() => {
    const update = () => {
      if (!filterBarRef.current || g.current.isDragging) return;
      const vh = window.innerHeight / 100;
      const baseOpen = OPEN_HEIGHT_VH * vh;
      const barH = filterBarRef.current.offsetHeight || 0;
      const newOpenHeight = Math.max(baseOpen, barH + 24);
      const newPeekHeight = barH;
      const closedY = newOpenHeight - newPeekHeight;

      setOpenHeight(newOpenHeight);
      setPeekHeight(newPeekHeight);

      if (!hasLaidOut.current) {
        setCardPosition(closedY, false); // parte chiuso
        hasLaidOut.current = true;
        setIsReady(true);                 // ora lo possiamo mostrare
      } else {
        setTranslateY(cur => (cur < closedY * 0.9 ? OPEN_Y : closedY));
        setIsAnimating(false);
      }
    };
    if (props.isActive) {
      update();
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
  }, [props.isActive, setCardPosition]);

  // Fail-safe: sblocca se l'up/cancel non arriva al container
  useEffect(() => {
    const unlock = () => {
      if (g.current.isDragging || g.current.isLocked) {
        g.current.isDragging = false;
        g.current.isLocked = false;
        g.current.pointerId = null;
      }
    };
    window.addEventListener('pointerup', unlock, { capture: true });
    window.addEventListener('pointercancel', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerup', unlock as any, { capture: true } as any);
      window.removeEventListener('pointercancel', unlock as any, { capture: true } as any);
    };
  }, []);

  // Flick “snappy” su touch
  const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const SPEED = 0.18; // ≈180 px/s
  const snapTo = (vy: number, y: number) => {
    const mid = CLOSED_Y / 2;
    if (vy <= -SPEED) return OPEN_Y;
    if (vy >=  SPEED) return CLOSED_Y;
    return y < mid ? OPEN_Y : CLOSED_Y;
  };
  const clampSnap = (y: number) => {
    const clamped = Math.max(OPEN_Y, Math.min(CLOSED_Y, y));
    return Math.round(clamped * DPR) / DPR;
  };

  /* --------- TapBridge + Drag su tutta la card (in CAPTURE) --------- */
  const onPointerDownCapture = (e: React.PointerEvent) => {
    tapBridge.onPointerDown(e);
    if (!props.isActive) return;
    if (isAnimating || g.current.pointerId !== null || e.button !== 0) return;
    const now = performance.now();
    g.current.isDragging = true;
    g.current.isLocked = false;
    g.current.startX = e.clientX;
    g.current.startY = e.clientY;
    g.current.startT = now;
    g.current.lastY = e.clientY;
    g.current.lastT = now;
    g.current.startTranslateY = translateY;
    g.current.pointerId = e.pointerId;
  };

  const onPointerMoveCapture = (e: React.PointerEvent) => {
    tapBridge.onPointerMove(e);
    if (!props.isActive) return;
    const s = g.current;
    if (!s.isDragging || s.pointerId !== e.pointerId) return;

    const dy = e.clientY - s.startY;
    const dx = e.clientX - s.startX;

    if (!s.isLocked) {
      const SLOP = 6;
      if (Math.abs(dy) < SLOP && Math.abs(dx) < SLOP) return;

      if (Math.abs(dy) > Math.abs(dx) * 1.3) {
        s.isLocked = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else {
        s.isDragging = false;
        s.pointerId = null;
        return;
      }
    }

    if (!s.isLocked) return;

    if (e.cancelable) e.preventDefault();
    let y = s.startTranslateY + dy;
    if (y < OPEN_Y) y = OPEN_Y - Math.tanh(-y / 200) * 100;
    if (y > CLOSED_Y) y = CLOSED_Y + Math.tanh((y - CLOSED_Y) / 200) * 100;

    setCardPosition(y, false);

    s.lastY = e.clientY;
    s.lastT = performance.now();
  };

  const onPointerUpCapture = (e: React.PointerEvent) => {
    tapBridge.onPointerUp(e);
    if (!props.isActive) return;
    const s = g.current;
    if (!s.isDragging || s.pointerId !== e.pointerId) return;

    if (s.isLocked) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }

    const now = performance.now();
    const dt = Math.max(1, now - s.lastT);
    const vy = (e.clientY - s.lastY) / dt;

    s.isDragging = false;
    s.isLocked = false;
    s.pointerId = null;

    const target = snapTo(vy, translateY);
    setCardPosition(target, true);
  };

  const onPointerCancelCapture = (e: React.PointerEvent) => {
    tapBridge.onPointerCancel?.(e as any);
    if (!props.isActive) return;
    const s = g.current;
    if (!s.isDragging) return;
    s.isDragging = s.isLocked = false;
    s.pointerId = null;
    const target = translateY < CLOSED_Y / 2 ? OPEN_Y : CLOSED_Y;
    setCardPosition(target, true);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    tapBridge.onClickCapture(e as any);
  };

  // Backdrop SOLO quando sovrapposto (no oscuramento all’ingresso)
  const isOverlayOpen = isReady && props.isActive && translateY <= Math.max(0, CLOSED_Y - 1);
  const backdrop = isOverlayOpen ? (
    <div className="fixed inset-0 z-[999] bg-black/40" style={{ pointerEvents: 'auto', touchAction: 'none' }} />
  ) : null;

  /* ---------------- Swipe orizzontale (invariato) ---------------- */
  const swipeWrapperRef = useRef<HTMLDivElement>(null);
  const { progress, isSwiping } = useSwipe(
    swipeWrapperRef,
    {
      onSwipeLeft: () => setActiveViewIndex((i) => Math.min(2, i + 1)),
      onSwipeRight: () => setActiveViewIndex((i) => Math.max(0, i - 1)),
    },
    {
      enabled: props.isActive && !isPeriodMenuOpen && translateY >= (openHeight - peekHeight) - 1 && !g.current.isLocked,
      threshold: 36,
      slop: 10,
    }
  );

  const isQuickFilterActive = !props.isPeriodFilterActive && !props.isCustomRangeActive;
  const translateX = -activeViewIndex * (100 / 3) + progress * (100 / 3);
  const finalTransform = `translateX(${translateX}%)`;

  // Pannello overlay: montato SEMPRE quando isActive; invisibile finché non pronto
  const panel = (
    <div
      ref={cardRef}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={onPointerMoveCapture}
      onPointerUpCapture={onPointerUpCapture}
      onPointerCancelCapture={onPointerCancelCapture}
      onClickCapture={onClickCapture}
      data-no-page-swipe="true"
      className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-8px_20px_-5px_rgba(0,0,0,0.08)] z-[1000]"
      style={{
        height: `${OPEN_HEIGHT_VH}vh`,
        transform: `translate3d(0, ${clampSnap((openHeight - peekHeight) > 0 ? translateY : openHeight)}px, 0)`,
        transition: isAnimating ? 'transform 0.26s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
        touchAction: 'pan-y',
        backfaceVisibility: 'hidden',
        willChange: 'transform',
        opacity: isReady ? 1 : 0,
        pointerEvents: isReady ? 'auto' : 'none',
      }}
      onTransitionEnd={() => setIsAnimating(false)}
    >
      <div ref={filterBarRef}>
        <div className="pt-2 flex justify-center">
          <SmoothPullTab width="32" height="4" fill="rgb(203 213 225)" />
        </div>

        <div
          ref={swipeWrapperRef}
          className={`relative ${isPeriodMenuOpen ? 'overflow-visible' : 'overflow-hidden'}`}
          style={{ touchAction: 'pan-y' }}
        >
          <div
            className="w-[300%] flex"
            style={{
              transform: finalTransform,
              transition: isSwiping ? 'none' : 'transform 0.08s ease-out',
            }}
          >
            <div className="w-1/3 px-4 py-1">
              <QuickFilterControl
                onSelect={props.onSelectQuickFilter}
                currentValue={props.currentQuickFilter}
                isActive={isQuickFilterActive}
              />
            </div>

            <div className="w-1/3 px-4 py-1">
              <PeriodNavigator
                periodType={props.periodType}
                periodDate={props.periodDate}
                onTypeChange={props.onSelectPeriodType}
                onDateChange={props.onSetPeriodDate}
                isActive={props.isPeriodFilterActive}
                onActivate={props.onActivatePeriodFilter}
                isMenuOpen={isPeriodMenuOpen}
                onMenuToggle={setIsPeriodMenuOpen}
              />
            </div>

            <div className="w-1/3 px-4 py-1">
              <CustomDateRangeInputs
                onClick={() => setIsDateModalOpen(true)}
                range={props.currentCustomRange}
                isActive={props.isCustomRangeActive}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-center items-center pt-1 pb-2 gap-2">
          {[0, 1, 2].map(i => (
            <button
              key={i}
              onClick={() => setActiveViewIndex(i)}
              onPointerDown={(e) => e.stopPropagation()}
              style={{ touchAction: 'manipulation' }}
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${activeViewIndex === i ? 'bg-indigo-600' : 'bg-slate-300 hover:bg-slate-400'}`}
              aria-label={`Vai al filtro ${i === 0 ? 'Rapidi' : i === 1 ? 'Periodo' : 'Date'}`}
            />
          ))}
        </div>

        <div style={{ height: `env(safe-area-inset-bottom, 0px)` }} />
      </div>
    </div>
  );

  return (
    <>
      {props.isActive && createPortal(
        <>{isOverlayOpen && backdrop}{panel}</>,
        document.body
      )}

      <DateRangePickerModal
        isOpen={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        initialRange={props.currentCustomRange}
        onApply={(range) => {
          props.onCustomRangeChange(range);
          setIsDateModalOpen(false);
        }}
      />
    </>
  );
};
