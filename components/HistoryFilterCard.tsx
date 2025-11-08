import React, { useState, useRef, useEffect } from 'react';
import { DateRangePickerModal } from './DateRangePickerModal';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { useSwipe } from '../hooks/useSwipe';

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
  // Period filter props
  onSelectPeriodType: (type: PeriodType) => void;
  onSetPeriodDate: (date: Date) => void;
  periodType: PeriodType;
  periodDate: Date;
  onActivatePeriodFilter: () => void;
  isPeriodFilterActive: boolean;
}

type SwipeStateRef = React.RefObject<{ armed: boolean }>;

/* ==== Tap senza “swipe”: esegue l’azione SOLO se non c’è stato swipe ====
   Non cambia la logica: sostituisce gli onClick per evitare il “primo tap a vuoto”. */
function useTapNoSwipe(
  swipeStateRef: SwipeStateRef,
  onTap: () => void,
  slop = 10
) {
  const start = useRef<{ id: number | null; x: number; y: number } | null>(null);

  const onPointerDown: React.PointerEventHandler = (e) => {
    start.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
  };

  const onPointerUp: React.PointerEventHandler = (e) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;

    const dx = Math.abs(e.clientX - s.x);
    const dy = Math.abs(e.clientY - s.y);
    const wasSwipe = dx > slop || dy > slop || !!swipeStateRef.current?.armed;

    if (!wasSwipe) {
      e.preventDefault();
      e.stopPropagation();
      onTap();
    }
  };

  const onPointerMove: React.PointerEventHandler = () => { /* no-op */ };

  const onClick: React.MouseEventHandler = (e) => {
    // Previene il click sintetico dopo pointerup
    e.preventDefault();
    e.stopPropagation();
  };

  return { onPointerDown, onPointerMove, onPointerUp, onClick };
}

const QuickFilterControl: React.FC<{
  onSelect: (value: DateFilter) => void;
  currentValue: DateFilter;
  isActive: boolean;
  swipeStateRef: SwipeStateRef;
}> = ({ onSelect, currentValue, isActive, swipeStateRef }) => {
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
        const tap = useTapNoSwipe(swipeStateRef, () => {
          onSelect(currentValue === filter.value ? 'all' : filter.value);
        });

        return (
          <button
            key={filter.value}
            type="button"
            {...tap}
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

const formatDateForButton = (dateString: string): string => {
  const parts = dateString.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: '2-digit' }).format(date).replace('.', '');
};

const CustomDateRangeInputs: React.FC<{
  onClick: () => void;
  range: { start: string | null; end: string | null };
  isActive: boolean;
  swipeStateRef: SwipeStateRef;
}> = ({ onClick, range, isActive, swipeStateRef }) => {
  const hasRange = range.start && range.end;
  const buttonText = hasRange
    ? `${formatDateForButton(range.start!)} - ${formatDateForButton(range.end!)}`
    : "Imposta periodo";
  const ariaLabelText = hasRange ? `Attualmente: ${buttonText}` : 'Nessun intervallo impostato';

  const tap = useTapNoSwipe(swipeStateRef, onClick);

  return (
    <div className={`border h-10 transition-colors rounded-lg ${isActive ? 'border-indigo-600' : 'border-slate-400'}`}>
      <button
        type="button"
        {...tap}
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

const PeriodNavigator: React.FC<{
  periodType: PeriodType;
  periodDate: Date;
  onTypeChange: (type: PeriodType) => void;
  onDateChange: (date: Date) => void;
  isActive: boolean;
  onActivate: () => void;
  isMenuOpen: boolean;
  onMenuToggle: (isOpen: boolean) => void;
  swipeStateRef: SwipeStateRef;
}> = ({ periodType, periodDate, onTypeChange, onDateChange, isActive, onActivate, isMenuOpen, onMenuToggle, swipeStateRef }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        onMenuToggle(false);
      }
    };
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, onMenuToggle]);

  const handlePrev = useTapNoSwipe(swipeStateRef, () => {
    onActivate();
    const d = new Date(periodDate);
    if (periodType === 'day') d.setDate(d.getDate() - 1);
    else if (periodType === 'week') d.setDate(d.getDate() - 7);
    else if (periodType === 'month') d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    onDateChange(d);
  });

  const handleNext = useTapNoSwipe(swipeStateRef, () => {
    onActivate();
    const d = new Date(periodDate);
    if (periodType === 'day') d.setDate(d.getDate() + 1);
    else if (periodType === 'week') d.setDate(d.getDate() + 7);
    else if (periodType === 'month') d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    onDateChange(d);
  });

  const toggleMenu = useTapNoSwipe(swipeStateRef, () => {
    if (!isActive) onActivate();
    onMenuToggle(!isMenuOpen);
  });

  const selectType = (type: PeriodType) => useTapNoSwipe(swipeStateRef, () => {
    onActivate();
    onTypeChange(type);
    onMenuToggle(false);
  });

  const getLabel = () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const d0 = new Date(periodDate); d0.setHours(0,0,0,0);

    if (periodType === 'day') {
      const y = new Date(today); y.setDate(today.getDate() - 1);
      if (d0.getTime() === today.getTime()) return 'Oggi';
      if (d0.getTime() === y.getTime()) return 'Ieri';
      return periodDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
    }
    if (periodType === 'week') {
      const sow = new Date(periodDate);
      const day = sow.getDay();
      const diff = sow.getDate() - day + (day === 0 ? -6 : 1);
      sow.setDate(diff); sow.setHours(0,0,0,0);
      const eow = new Date(sow); eow.setDate(sow.getDate() + 6);

      const tSow = new Date(today);
      const tDay = tSow.getDay();
      const tDiff = tSow.getDate() - tDay + (tDay === 0 ? -6 : 1);
      tSow.setDate(tDiff); tSow.setHours(0,0,0,0);

      if (sow.getTime() === tSow.getTime()) return 'Questa Settimana';
      const last = new Date(tSow); last.setDate(tSow.getDate() - 7);
      if (sow.getTime() === last.getTime()) return 'Settimana Scorsa';
      return `${sow.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${eow.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    if (periodType === 'month') {
      const cm = today.getMonth(), cy = today.getFullYear();
      if (periodDate.getMonth() === cm && periodDate.getFullYear() === cy) return 'Questo Mese';
      const lm = cm === 0 ? 11 : cm - 1;
      const ly = cm === 0 ? cy - 1 : cy;
      if (periodDate.getMonth() === lm && periodDate.getFullYear() === ly) return 'Mese Scorso';
      return periodDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    }
    if (periodType === 'year') {
      if (periodDate.getFullYear() === today.getFullYear()) return "Quest'Anno";
      if (periodDate.getFullYear() === today.getFullYear() - 1) return 'Anno Scorso';
      return String(periodDate.getFullYear());
    }
    return '';
  };

  const periodTypes: {value: PeriodType, label: string}[] = [
    { value: 'day', label: 'Giorno' },
    { value: 'week', label: 'Settimana' },
    { value: 'month', label: 'Mese' },
    { value: 'year', label: 'Anno' },
  ];

  return (
    <div
      ref={wrapperRef}
      className={`w-full h-10 flex items-center justify-between border rounded-lg relative transition-colors bg-white ${isActive ? 'border-indigo-600' : 'border-slate-400'}`}
    >
      <button
        type="button"
        {...handlePrev}
        style={{ touchAction: 'manipulation' }}
        className="h-full px-4 flex items-center justify-center bg-white hover:bg-slate-100 active:scale-95 transition-transform focus:outline-none rounded-l-lg [-webkit-tap-highlight-color:transparent]"
        aria-label="Periodo precedente"
      >
        <ChevronLeftIcon className="w-5 h-5 text-slate-700" />
      </button>

      <div className={`flex-1 text-center relative h-full ${isActive ? 'bg-indigo-100' : 'bg-slate-100'}`}>
        <button
          type="button"
          {...toggleMenu}
          style={{ touchAction: 'manipulation' }}
          className={`w-full h-full flex items-center justify-center text-sm font-semibold transition-colors ${isActive ? 'text-indigo-700' : 'text-slate-700'} hover:bg-slate-200`}
        >
          {getLabel()}
        </button>
        {isMenuOpen && (
          <div className="absolute bottom-full mb-2 left-0 right-0 mx-auto w-40 bg-white border border-slate-200 shadow-lg rounded-lg z-20 p-2 space-y-1 animate-fade-in-down">
            {periodTypes.map(p => {
              const tap = selectType(p.value);
              return (
                <button
                  key={p.value}
                  type="button"
                  {...tap}
                  style={{ touchAction: 'manipulation' }}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${periodType === p.value ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-50 text-slate-800 hover:bg-slate-200'}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="button"
        {...handleNext}
        style={{ touchAction: 'manipulation' }}
        className="h-full px-4 flex items-center justify-center bg-white hover:bg-slate-100 active:scale-95 transition-transform focus:outline-none rounded-r-lg [-webkit-tap-highlight-color:transparent]"
        aria-label="Periodo successivo"
      >
        <ChevronRightIcon className="w-5 h-5 text-slate-700" />
      </button>
    </div>
  );
};

const HistoryFilterCardInner: React.FC<HistoryFilterCardProps> = ({
  onSelectQuickFilter, currentQuickFilter, onCustomRangeChange, currentCustomRange, isCustomRangeActive, onDateModalStateChange, isActive,
  periodType, periodDate, onSelectPeriodType, onSetPeriodDate, isPeriodFilterActive, onActivatePeriodFilter
}) => {
  const [activeViewIndex, setActiveViewIndex] = useState(0); // 0: Rapidi, 1: Periodo, 2: Date
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const swipeWrapperRef = useRef<HTMLDivElement>(null);

  const handleViewChange = (newIndex: number) => {
    setActiveViewIndex(newIndex);
    if (newIndex === 0) {
      onSelectQuickFilter(currentQuickFilter);
    } else if (newIndex === 1) {
      onActivatePeriodFilter();
    } else if (newIndex === 2) {
      onCustomRangeChange(currentCustomRange);
    }
  };

  const { progress, isSwiping, stateRef: swipeStateRef } = useSwipe(
    swipeWrapperRef,
    {
      onSwipeLeft: () => handleViewChange(Math.min(2, activeViewIndex + 1)),
      onSwipeRight: () => handleViewChange(Math.max(0, activeViewIndex - 1)),
    },
    {
      enabled: isActive && !isPeriodMenuOpen,
      slop: 25,
    }
  );

  useEffect(() => {
    onDateModalStateChange(isDateModalOpen);
  }, [isDateModalOpen, onDateModalStateChange]);

  const translateX = -activeViewIndex * (100 / 3) + progress * (100 / 3);
  const finalTransform = isPeriodMenuOpen ? `translateX(-${100/3}%)` : `translateX(${translateX}%)`;
  const isQuickFilterActive = !isPeriodFilterActive && !isCustomRangeActive;

  const dotTap = (i: number) => useTapNoSwipe(swipeStateRef, () => handleViewChange(i));

  return (
    <>
      <div data-no-page-swipe="true" className="flex-shrink-0 z-30">
        <div className="bg-white/95 backdrop-blur-sm shadow-[0_-8px_20px_-5px_rgba(0,0,0,0.08)]">
          <div className="pt-2 rounded-t-2xl">
            <div
              ref={swipeWrapperRef}
              className={`relative ${isPeriodMenuOpen ? 'overflow-visible z-10' : 'overflow-x-hidden'}`}
              style={{ touchAction: 'pan-y', overscrollBehaviorX: 'contain' }}
            >
              <div
                className="w-[300%] flex"
                style={{
                  transform: finalTransform,
                  transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.22, 0.61, 0.36, 1)',
                  willChange: 'transform',
                }}
              >
                <div className="w-1/3 px-4 py-1">
                  <QuickFilterControl
                    onSelect={onSelectQuickFilter}
                    currentValue={currentQuickFilter}
                    isActive={isQuickFilterActive}
                    swipeStateRef={swipeStateRef}
                  />
                </div>
                <div className="w-1/3 px-4 py-1">
                  <PeriodNavigator
                    periodType={periodType}
                    periodDate={periodDate}
                    onTypeChange={onSelectPeriodType}
                    onDateChange={onSetPeriodDate}
                    isActive={isPeriodFilterActive}
                    onActivate={onActivatePeriodFilter}
                    isMenuOpen={isPeriodMenuOpen}
                    onMenuToggle={setIsPeriodMenuOpen}
                    swipeStateRef={swipeStateRef}
                  />
                </div>
                <div className="w-1/3 px-4 py-1">
                  <CustomDateRangeInputs
                    onClick={() => {
                      if (!isCustomRangeActive) onCustomRangeChange({ start: null, end: null });
                      setIsDateModalOpen(true);
                    }}
                    range={currentCustomRange}
                    isActive={isCustomRangeActive}
                    swipeStateRef={swipeStateRef}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-center items-center pt-1 pb-2 gap-2">
              {[0, 1, 2].map(i => (
                <button
                  key={i}
                  type="button"
                  {...dotTap(i)}
                  style={{ touchAction: 'manipulation' }}
                  className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${activeViewIndex === i ? 'bg-indigo-600' : 'bg-slate-300 hover:bg-slate-400'}`}
                  aria-label={`Vai al filtro ${i === 0 ? 'Rapidi' : i === 1 ? 'Periodo' : 'Date'}`}
                />
              ))}
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

export const HistoryFilterCard = HistoryFilterCardInner;
export default HistoryFilterCardInner;
