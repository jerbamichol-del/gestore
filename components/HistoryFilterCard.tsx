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
                  onClick={() => onSelect(currentValue === filter.value ? 'all' : filter.value)}
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
  return (
    <div className="grid grid-cols-2 border border-slate-400 h-11">
      <button
        onClick={onClick}
        aria-label={`Seleziona intervallo di date. Inizio: ${range.start ? formatDateForButton(range.start) : 'non impostato'}.`}
        className="flex items-center justify-center gap-2 px-2 bg-slate-100 hover:bg-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 border-r border-slate-400"
      >
        <span className="text-sm font-semibold text-slate-700">
          {range.start ? formatDateForButton(range.start) : 'Da...'}
        </span>
      </button>
      <button
        onClick={onClick}
        aria-label={`Seleziona intervallo di date. Fine: ${range.end ? formatDateForButton(range.end) : 'non impostato'}.`}
        className="flex items-center justify-center gap-2 px-2 bg-slate-100 hover:bg-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
      >
        <span className="text-sm font-semibold text-slate-700">
          {range.end ? formatDateForButton(range.end) : '...A'}
        </span>
      </button>
    </div>
  );
};


export const HistoryFilterCard: React.FC<HistoryFilterCardProps> = ({
  onSelectQuickFilter, currentQuickFilter, onCustomRangeChange, currentCustomRange, isCustomRangeActive, onDateModalStateChange
}) => {
  const [activeView, setActiveView] = useState<'quick' | 'custom'>('quick');
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const swipeContainerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    onDateModalStateChange(isDateModalOpen);
  }, [isDateModalOpen, onDateModalStateChange]);

  const [dragPct, setDragPct] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

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

    const basePct = () => (activeView === 'quick' ? 0 : -50);

    const onDown = (e: PointerEvent) => {
      hasDown = true; lock = null;
      sx = e.clientX; sy = e.clientY;
      width = el.getBoundingClientRect().width || 1;
      pid = e.pointerId ?? 1;
      try { el.setPointerCapture?.(pid as any); } catch {}
      e.stopPropagation();
    };

    const onMove = (e: PointerEvent) => {
      if (!hasDown || (pid !== null && e.pointerId !== pid)) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;

      if (!lock) {
        const mostlyH = Math.abs(dx) > Math.abs(dy) * TAN;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > SLOP) lock = mostlyH ? 'h' : 'v';
      }
      if (lock !== 'h') return;

      // Prevent default only on significant movement to avoid killing taps.
      if (Math.abs(dx) > SLOP * 2.5 && e.cancelable) {
        e.preventDefault();
      }
      e.stopPropagation();
      setDragging(true);

      const deltaPct = (dx / width) * 50; 
      let t = basePct() + deltaPct;
      if (t > 0) t = 0;
      if (t < -50) t = -50;
      setDragPct(t);
    };

    const onEnd = (e: PointerEvent) => {
      if (!hasDown || (pid !== null && e.pointerId !== pid)) return;
      const dx = e.clientX - sx;
      const triggerPx = (el.getBoundingClientRect().width || 1) * TRIGGER_RATIO;

      if (lock === 'h') {
        if (activeView === 'quick' && dx <= -triggerPx) setActiveView('custom');
        else if (activeView === 'custom' && dx >= triggerPx) setActiveView('quick');
      }

      setDragging(false);
      setDragPct(null); 
      hasDown = false; pid = null; lock = null;
      e.stopPropagation();
    };

    el.addEventListener('pointerdown', onDown as any, { capture: true, passive: true });
    el.addEventListener('pointermove', onMove as any,  { capture: true, passive: false });
    el.addEventListener('pointerup', onEnd as any,     { capture: true, passive: true });
    el.addEventListener('pointercancel', onEnd as any, { capture: true });

    return () => {
      el.removeEventListener('pointerdown', onDown as any, { capture: true } as any);
      el.removeEventListener('pointermove', onMove as any,  { capture: true } as any);
      el.removeEventListener('pointerup', onEnd as any,     { capture: true } as any);
      el.removeEventListener('pointercancel', onEnd as any, { capture: true } as any);
    };
  }, [activeView]);

  const baseTranslate = activeView === 'quick' ? 0 : -50;
  const translateX = dragPct !== null ? dragPct : baseTranslate;

  return (
    <>
      <div className="flex-shrink-0 z-30">
        <div className="bg-white/95 backdrop-blur-sm shadow-[0_-8px_20px_-5px_rgba(0,0,0,0.08)]">
          <div className="mx-auto pt-3 pb-2 rounded-t-2xl">
            <div
              className="overflow-hidden"
              ref={swipeContainerRef}
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
                onClick={() => setActiveView('quick')}
                aria-label="Vai ai filtri rapidi"
                className={`w-3 h-3 rounded-full transition-colors ${activeView === 'quick' ? 'bg-indigo-600' : 'bg-slate-300 hover:bg-slate-400'}`}
              />
              <button
                onClick={() => setActiveView('custom')}
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