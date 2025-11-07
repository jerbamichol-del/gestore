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
        return (
          <button
            key={filter.value}
            onPointerUp={(e) => {
                e.preventDefault();
                if (swipeStateRef.current.armed) return;
                onSelect(currentValue === filter.value ? 'all' : filter.value);
            }}
            onClick={(e) => e.preventDefault()}
            style={{ touchAction: 'manipulation' }}
            className={`flex-1 flex items-center justify-center px-2 text-center font-semibold text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500
              ${index > 0 ? 'border-l' : ''}
              ${isButtonActive ? 'bg-indigo-600 text-white border-indigo-600'
                               : `bg-slate-100 text-slate-700 hover:bg-slate-200 ${isActive ? 'border-indigo-600' : 'border-slate-400'}`
              }`}
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

  return (
    <div className={`border h-10 transition-colors rounded-lg ${isActive ? 'border-indigo-600' : 'border-slate-400'}`}>
      <button
        onPointerUp={(e) => { e.preventDefault(); if (swipeStateRef.current.armed) return; onClick(); }}
        onClick={(e) => e.preventDefault()}
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
  
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
  
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen, onMenuToggle]);
  
  const handlePrev = () => { if (swipeStateRef.current.armed) return; onActivate(); const newDate = new Date(periodDate); switch (periodType) { case 'day': newDate.setDate(newDate.getDate() - 1); break; case 'week': newDate.setDate(newDate.getDate() - 7); break; case 'month': newDate.setMonth(newDate.getMonth() - 1); break; case 'year': newDate.setFullYear(newDate.getFullYear() - 1); break; } onDateChange(newDate); };
  const handleNext = () => { if (swipeStateRef.current.armed) return; onActivate(); const newDate = new Date(periodDate); switch (periodType) { case 'day': newDate.setDate(newDate.getDate() + 1); break; case 'week': newDate.setDate(newDate.getDate() + 7); break; case 'month': newDate.setMonth(newDate.getMonth() + 1); break; case 'year': newDate.setFullYear(newDate.getFullYear() + 1); break; } onDateChange(newDate); };
  const handleTypeSelect = (type: PeriodType) => { if (swipeStateRef.current.armed) return; onActivate(); onTypeChange(type); onMenuToggle(false); };
  const toggleMenu = () => { if (swipeStateRef.current.armed) return; if (!isActive) { onActivate(); } onMenuToggle(!isMenuOpen); };

  const getLabel = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const periodDateStart = new Date(periodDate); periodDateStart.setHours(0, 0, 0, 0);

    switch (periodType) {
      case 'day':
        if (periodDateStart.getTime() === today.getTime()) return 'Oggi';
        const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
        if (periodDateStart.getTime() === yesterday.getTime()) return 'Ieri';
        return periodDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
      case 'week':
        const startOfWeek = new Date(periodDate); const day = startOfWeek.getDay(); const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); startOfWeek.setDate(diff); startOfWeek.setHours(0,0,0,0);
        const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
        const todayStartOfWeek = new Date(today); const todayDay = todayStartOfWeek.getDay(); const todayDiff = todayStartOfWeek.getDate() - todayDay + (todayDay === 0 ? -6:1); todayStartOfWeek.setDate(todayDiff); todayStartOfWeek.setHours(0,0,0,0);
        if(startOfWeek.getTime() === todayStartOfWeek.getTime()) return 'Questa Settimana';
        const lastWeekStart = new Date(todayStartOfWeek); lastWeekStart.setDate(todayStartOfWeek.getDate() - 7);
        if(startOfWeek.getTime() === lastWeekStart.getTime()) return 'Settimana Scorsa';
        return `${startOfWeek.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${endOfWeek.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      case 'month':
        const currentMonth = today.getMonth(); const currentYear = today.getFullYear();
        if (periodDate.getMonth() === currentMonth && periodDate.getFullYear() === currentYear) return 'Questo Mese';
        if (periodDate.getMonth() === (currentMonth === 0 ? 11 : currentMonth - 1) && periodDate.getFullYear() === (currentMonth === 0 ? currentYear - 1 : currentYear)) return 'Mese Scorso';
        return periodDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
      case 'year':
        if (periodDate.getFullYear() === today.getFullYear()) return 'Quest\'Anno';
        if (periodDate.getFullYear() === today.getFullYear() - 1) return 'Anno Scorso';
        return periodDate.getFullYear().toString();
    }
  };
  
  const periodTypes: {value: PeriodType, label: string}[] = [ { value: 'day', label: 'Giorno' }, { value: 'week', label: 'Settimana' }, { value: 'month', label: 'Mese' }, { value: 'year', label: 'Anno' }, ];

  return (
    <div ref={wrapperRef} className={`w-full h-10 flex items-center justify-between border rounded-lg relative transition-colors bg-white ${isActive ? 'border-indigo-600' : 'border-slate-400'}`}>
      <button onPointerUp={(e) => { e.preventDefault(); handlePrev(); }} onClick={e => e.preventDefault()} style={{ touchAction: 'manipulation' }} className="h-full px-4 flex items-center justify-center bg-white hover:bg-slate-100 active:scale-95 transition-transform focus:outline-none rounded-l-lg [-webkit-tap-highlight-color:transparent]" aria-label="Periodo precedente"> <ChevronLeftIcon className="w-5 h-5 text-slate-700" /> </button>
      <div className={`flex-1 text-center relative h-full ${isActive ? 'bg-indigo-100' : 'bg-slate-100'}`}>
        <button onPointerUp={(e) => { e.preventDefault(); toggleMenu(); }} onClick={e => e.preventDefault()} style={{ touchAction: 'manipulation' }} className={`w-full h-full flex items-center justify-center text-sm font-semibold transition-colors ${isActive ? 'text-indigo-700' : 'text-slate-700'} hover:bg-slate-200`}> {getLabel()} </button>
        {isMenuOpen && ( <div className="absolute bottom-full mb-2 left-0 right-0 mx-auto w-40 bg-white border border-slate-200 shadow-lg rounded-lg z-20 p-2 space-y-1 animate-fade-in-down"> {periodTypes.map(p => ( <button key={p.value} onPointerUp={(e) => {e.preventDefault(); handleTypeSelect(p.value)}} onClick={e => e.preventDefault()} style={{ touchAction: 'manipulation' }} className={`w-full text-left px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${periodType === p.value ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-50 text-slate-800 hover:bg-slate-200'}`}> {p.label} </button> ))} </div> )}
      </div>
      <button onPointerUp={(e) => { e.preventDefault(); handleNext(); }} onClick={e => e.preventDefault()} style={{ touchAction: 'manipulation' }} className="h-full px-4 flex items-center justify-center bg-white hover:bg-slate-100 active:scale-95 transition-transform focus:outline-none rounded-r-lg [-webkit-tap-highlight-color:transparent]" aria-label="Periodo successivo"> <ChevronRightIcon className="w-5 h-5 text-slate-700" /> </button>
    </div>
  );
};

export const HistoryFilterCard: React.FC<HistoryFilterCardProps> = ({
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
      onSelectQuickFilter(currentQuickFilter); // Re-asserts the current quick filter to activate the mode
    } else if (newIndex === 1) {
      onActivatePeriodFilter();
    } else if (newIndex === 2) {
      onCustomRangeChange(currentCustomRange); // Re-asserts the current range to activate the mode
    }
  };

  const { progress, isSwiping, stateRef: swipeStateRef } = useSwipe(swipeWrapperRef, {
      onSwipeLeft: () => handleViewChange(Math.min(2, activeViewIndex + 1)),
      onSwipeRight: () => handleViewChange(Math.max(0, activeViewIndex - 1)),
  }, {
      enabled: isActive && !isPeriodMenuOpen,
      slop: 25,
  });

  useEffect(() => {
    onDateModalStateChange(isDateModalOpen);
  }, [isDateModalOpen, onDateModalStateChange]);

  const translateX = -activeViewIndex * (100 / 3) + progress * (100 / 3);
  const finalTransform = isPeriodMenuOpen ? `translateX(-${100/3}%)` : `translateX(${translateX}%)`;

  const isQuickFilterActive = !isPeriodFilterActive && !isCustomRangeActive;
  
  return (
    <>
      <div 
        data-no-page-swipe="true"
        className="flex-shrink-0 z-30"
      >
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
                            if (swipeStateRef.current.armed) return;
                            if (!isCustomRangeActive) onCustomRangeChange({start: null, end: null});
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
                        onPointerUp={(e) => {
                            e.preventDefault();
                            if (swipeStateRef.current.armed) return;
                            handleViewChange(i);
                        }}
                        onClick={(e) => e.preventDefault()}
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