import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';

interface DateRangePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (range: { start: string, end: string }) => void;
  initialRange: { start: string | null, end: string | null };
}

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Lunedì

const parseLocalYYYYMMDD = (dateString: string | null): Date | null => {
  if (!dateString) return null;
  const parts = dateString.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]); // locale 00:00
};

const CalendarView = React.memo(({
  viewDate,
  today,
  startDate,
  endDate,
  hoverDate,
  onDateClick,
  onHoverDate,
  isHoverDisabled
}: {
  viewDate: Date;
  today: Date;
  startDate: Date | null;
  endDate: Date | null;
  hoverDate: Date | null;
  onDateClick: (day: number) => void;
  onHoverDate: (date: Date | null) => void;
  isHoverDisabled: boolean;
}) => {
  const calendarGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const grid: (number | null)[] = Array(firstDay).fill(null);
    for (let i = 1; i <= daysInMonth; i++) grid.push(i);
    return grid;
  }, [viewDate]);

  const renderDay = (day: number | null, index: number) => {
    if (!day) return <div key={index} />;

    const date = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const isToday = date.getTime() === today.getTime();
    const isFuture = date > today;
    const isSelectedStart = !!(startDate && date.getTime() === startDate.getTime());
    const isSelectedEnd = !!(endDate && date.getTime() === endDate.getTime());

    let inRange = false;
    let inHoverRange = false;

    if (startDate && endDate) {
      inRange = date > startDate && date < endDate;
    } else if (!isHoverDisabled && startDate && hoverDate) {
      if (hoverDate > startDate) inHoverRange = date > startDate && date < hoverDate;
      else if (hoverDate < startDate) inHoverRange = date < startDate && date > hoverDate;
    }

    const baseClasses = "w-10 h-10 flex items-center justify-center text-sm transition-colors duration-150 rounded-full select-none";
    let dayClasses = "font-bold text-slate-800 hover:bg-slate-200";
    if (isToday) dayClasses += " text-indigo-600";
    if (inRange || inHoverRange) dayClasses = "font-bold bg-indigo-100 text-indigo-800 rounded-none";
    if (isSelectedStart || isSelectedEnd) dayClasses = "bg-indigo-600 text-white font-bold";
    if (isSelectedStart) dayClasses += " rounded-r-none";
    if (isSelectedEnd) dayClasses += " rounded-l-none";
    if (isFuture) dayClasses = "text-slate-400 cursor-not-allowed font-normal";

    return (
      <div
        key={index}
        className={`flex justify-center items-center ${(inRange || inHoverRange) ? 'bg-indigo-100' : ''} ${isSelectedStart ? 'rounded-l-full bg-indigo-100' : ''} ${isSelectedEnd ? 'rounded-r-full bg-indigo-100' : ''}`}
        onMouseEnter={() => !isFuture && !isHoverDisabled && onHoverDate(date)}
      >
        <button onClick={() => !isFuture && onDateClick(day)} className={`${baseClasses} ${dayClasses}`} disabled={isFuture}>
          {day}
        </button>
      </div>
    );
  };

  return (
    <div
      className="border border-slate-300 rounded-lg p-2 bg-white shadow-sm"
      onMouseLeave={() => !isHoverDisabled && onHoverDate(null)}
    >
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs font-semibold text-slate-500 mb-2">
        <div>L</div><div>M</div><div>M</div><div>G</div><div>V</div><div>S</div><div>D</div>
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {calendarGrid.map(renderDay)}
      </div>
    </div>
  );
});

export const DateRangePickerModal: React.FC<DateRangePickerModalProps> = ({ isOpen, onClose, onApply, initialRange }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [pickerView, setPickerView] = useState<'days' | 'months'>('days');

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const initialDate = parseLocalYYYYMMDD(initialRange.start) || today;

  const [displayDate, setDisplayDate] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [transition, setTransition] = useState<{ direction: 'left' | 'right' } | null>(null);

  const [startDate, setStartDate] = useState<Date | null>(parseLocalYYYYMMDD(initialRange.start));
  const [endDate, setEndDate] = useState<Date | null>(parseLocalYYYYMMDD(initialRange.end));
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const swipeContainerRef = useRef<HTMLDivElement>(null);
  const swipeState = useRef({ isDragging: false, startX: 0, startY: 0, isLocked: false });
  const ignoreClickRef = useRef<boolean>(false);

  const { isNextMonthDisabled, isNextYearDisabled, prevMonthDate, nextMonthDate } = useMemo(() => {
    const d = displayDate;
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const nextYear = new Date(d.getFullYear() + 1, 0, 1);
    return {
      isNextMonthDisabled: nextMonth > today,
      isNextYearDisabled: nextYear > today,
      prevMonthDate: new Date(d.getFullYear(), d.getMonth() - 1, 1),
      nextMonthDate: nextMonth,
    };
  }, [displayDate, today]);

  useEffect(() => {
    if (isOpen) {
      setPickerView('days');
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  const triggerTransition = (direction: 'left' | 'right') => {
    if (transition) return;
    if (direction === 'left' && isNextMonthDisabled) return;
    setTransition({ direction });
  };

  const handleAnimationEnd = () => {
    if (transition) {
      if (transition.direction === 'left') {
        setDisplayDate(nextMonthDate);
      } else {
        setDisplayDate(prevMonthDate);
      }
      setTransition(null);
    }
  };

  const changeYear = (delta: number) => {
    if (delta > 0 && isNextYearDisabled) return;
    setHoverDate(null);
    setDisplayDate(current => new Date(current.getFullYear() + delta, current.getMonth(), 1));
  };

  const handleDateClick = (day: number) => {
    if (ignoreClickRef.current) return;
    const clickedDate = new Date(displayDate.getFullYear(), displayDate.getMonth(), day);
    setHoverDate(null);
    if (!startDate || (startDate && endDate)) {
      setStartDate(clickedDate);
      setEndDate(null);
    } else if (clickedDate < startDate) {
      setEndDate(startDate);
      setStartDate(clickedDate);
    } else {
      setEndDate(clickedDate);
    }
  };

  const handleApply = () => {
    if (startDate && endDate) {
      const toYYYYMMDD = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
      onApply({ start: toYYYYMMDD(startDate), end: toYYYYMMDD(endDate) });
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (pickerView !== 'days' || transition) return;
    swipeState.current = { startX: e.clientX, startY: e.clientY, isDragging: true, isLocked: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!swipeState.current.isDragging) return;
    const dx = e.clientX - swipeState.current.startX;
    const dy = e.clientY - swipeState.current.startY;
    if (!swipeState.current.isLocked) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        if (Math.abs(dx) > Math.abs(dy)) {
          swipeState.current.isLocked = true;
        } else {
          swipeState.current.isDragging = false; // Vertical scroll, cancel swipe
        }
      }
    }
     if (swipeState.current.isLocked) {
       e.preventDefault();
       e.stopPropagation();
    }
  };

  const handlePointerEnd = (e: React.PointerEvent) => {
    if (!swipeState.current.isDragging) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    
    if (swipeState.current.isLocked) {
      const dx = e.clientX - swipeState.current.startX;
      const SWIPE_THRESHOLD = 50;

      if (dx < -SWIPE_THRESHOLD) {
        triggerTransition('left');
      } else if (dx > SWIPE_THRESHOLD) {
        triggerTransition('right');
      }
      
      if (Math.abs(dx) > 10) {
        ignoreClickRef.current = true;
        setTimeout(() => { ignoreClickRef.current = false; }, 0);
      }
    }
    swipeState.current = { isDragging: false, startX: 0, startY: 0, isLocked: false };
  };

  if (!isOpen) return null;

  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(0, i).toLocaleString('it-IT', { month: 'long' })
  );

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-slate-900/60 backdrop-blur-sm`}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full max-w-sm transform transition-all duration-300 ease-in-out ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">Seleziona Intervallo</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-200">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-4 overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => pickerView === 'days' ? triggerTransition('right') : changeYear(-1)} className="p-2 rounded-full hover:bg-slate-200" aria-label={`${pickerView === 'days' ? "Mese precedente" : "Anno precedente"}`}>
              <ChevronLeftIcon className="w-5 h-5 text-slate-600" />
            </button>
            <button
              onClick={() => setPickerView(pickerView === 'days' ? 'months' : 'days')}
              className="font-semibold text-slate-700 capitalize p-1 rounded-md hover:bg-slate-200 flex items-center gap-1"
              aria-live="polite"
              aria-expanded={pickerView === 'months'}
            >
              <span>
                {pickerView === 'days'
                  ? displayDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })
                  : displayDate.getFullYear()}
              </span>
              <ChevronDownIcon className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${pickerView === 'months' ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={() => pickerView === 'days' ? triggerTransition('left') : changeYear(1)}
              disabled={pickerView === 'days' ? isNextMonthDisabled : isNextYearDisabled}
              className="p-2 rounded-full hover:bg-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              aria-label={`${pickerView === 'days' ? "Mese successivo" : "Anno successivo"}`}
            >
              <ChevronRightIcon className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div
            ref={swipeContainerRef}
            className="relative h-[284px] overflow-hidden"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            style={{ touchAction: 'pan-y' }}
          >
            {pickerView === 'days' && (
               <>
                <div
                  key={displayDate.getTime()}
                  onAnimationEnd={handleAnimationEnd}
                  className={
                    `w-full h-full px-1 ` +
                    (transition?.direction === 'left' ? 'animate-slide-out-left' : 
                     transition?.direction === 'right' ? 'animate-slide-out-right' : '')
                  }
                >
                  <CalendarView
                    viewDate={displayDate}
                    today={today}
                    startDate={startDate}
                    endDate={endDate}
                    hoverDate={hoverDate}
                    onDateClick={handleDateClick}
                    onHoverDate={setHoverDate}
                    isHoverDisabled={!!transition || swipeState.current.isLocked}
                  />
                </div>
                {transition && (
                  <div
                    key={transition.direction === 'left' ? nextMonthDate.getTime() : prevMonthDate.getTime()}
                    className={
                      `absolute top-0 left-0 w-full h-full px-1 ` +
                      (transition.direction === 'left' ? 'animate-slide-in-from-right' : 'animate-slide-in-from-left')
                    }
                  >
                    <CalendarView
                      viewDate={transition.direction === 'left' ? nextMonthDate : prevMonthDate}
                      today={today}
                      startDate={startDate}
                      endDate={endDate}
                      hoverDate={null}
                      onDateClick={() => {}}
                      onHoverDate={() => {}}
                      isHoverDisabled={true}
                    />
                  </div>
                )}
              </>
            )}

            {pickerView === 'months' && (
              <div className="grid grid-cols-3 gap-2">
                {months.map((month, index) => {
                  const isFutureMonth =
                    displayDate.getFullYear() > today.getFullYear() ||
                    (displayDate.getFullYear() === today.getFullYear() && index > today.getMonth());
                  return (
                    <button
                      key={month}
                      onClick={() => {
                        setDisplayDate(new Date(displayDate.getFullYear(), index, 1));
                        setPickerView('days');
                      }}
                      disabled={isFutureMonth}
                      className="p-3 text-sm font-semibold rounded-lg text-slate-700 hover:bg-indigo-100 hover:text-indigo-700 transition-colors capitalize disabled:text-slate-400 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    >
                      {month}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <footer className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!startDate || !endDate}
            className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
          >
            Applica
          </button>
        </footer>
      </div>
    </div>
  );
};