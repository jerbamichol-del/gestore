import React, { useState, useRef, useEffect } from 'react';

type DateFilter = 'all' | '7d' | '30d' | '6m' | '1y';

interface HistoryFilterCardProps {
  onSelectQuickFilter: (value: DateFilter) => void;
  currentQuickFilter: DateFilter;
  onCustomRangeChange: (range: { start: string, end: string }) => void;
  currentCustomRange: { start: string | null, end: string | null };
  isCustomRangeActive: boolean;
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
              <td key={filter.value} className="border border-slate-400 p-0">
                <button
                  onClick={() => onSelect(currentValue === filter.value ? 'all' : filter.value)}
                  className={`w-full py-3 px-2 text-center font-semibold text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 ${
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

const CustomDateFilter: React.FC<{
  onChange: (range: { start: string, end: string }) => void;
  currentRange: { start: string | null, end: string | null };
}> = ({ onChange, currentRange }) => {
  const today = new Date().toISOString().split('T')[0];

  const handleDateChange = (part: 'start' | 'end', value: string) => {
    const newStart = part === 'start' ? value : currentRange.start || today;
    const newEnd   = part === 'end'   ? value : currentRange.end   || today;

    if (new Date(newStart) > new Date(newEnd)) {
      onChange({ start: value, end: value });
    } else {
      onChange({ start: newStart, end: newEnd });
    }
  };

  return (
    <div className="flex items-center justify-center gap-4 py-3 bg-slate-100 border border-slate-400 h-[51px] box-border">
      <div className="flex items-center gap-2">
        <label htmlFor="start-date" className="text-sm font-semibold text-slate-700">Da:</label>
        <input
          type="date"
          id="start-date"
          value={currentRange.start || ''}
          onChange={e => handleDateChange('start', e.target.value)}
          max={today}
          className="w-36 text-sm rounded-md border border-slate-300 bg-white py-1 px-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <label htmlFor="end-date" className="text-sm font-semibold text-slate-700">A:</label>
        <input
          type="date"
          id="end-date"
          value={currentRange.end || ''}
          onChange={e => handleDateChange('end', e.target.value)}
          max={today}
          min={currentRange.start || undefined}
          className="w-36 text-sm rounded-md border border-slate-300 bg-white py-1 px-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
};

export const HistoryFilterCard: React.FC<HistoryFilterCardProps> = ({
  onSelectQuickFilter, currentQuickFilter, onCustomRangeChange, currentCustomRange, isCustomRangeActive
}) => {
  const [activeView, setActiveView] = useState<'quick' | 'custom'>('quick');
  const swipeContainerRef = useRef<HTMLDivElement>(null);

  // Stato "drag live" in % della larghezza del container:
  // translate finale: base(0 o -50) + dragPct
  const [dragPct, setDragPct] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // Gesture nativa: catturiamo il puntatore e trasciniamo in % della larghezza
  useEffect(() => {
    const el = swipeContainerRef.current;
    if (!el) return;

    const ANG = 30; // lock orizzontale
    const TAN = Math.tan((ANG * Math.PI) / 180);
    const SLOP = 6; // px per lock
    const TRIGGER_RATIO = 0.10; // 10% della larghezza per cambiare vista

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

      // prendiamo SUBITO il controllo degli eventi successivi
      try { el.setPointerCapture?.(pid as any); } catch {}
      // impediamo che il parent armi il suo swipe
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

      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      setDragging(true);

      // Convertiamo i px in % del nostro "slider": 50% = mezza larghezza (secondo pannello)
      const deltaPct = (dx / width) * 50; // dx negativo → sposta verso la seconda tab
      let t = basePct() + deltaPct;

      // Limita l'escursione tra 0% e -50% (non oltre)
      if (t > 0) t = 0;
      if (t < -50) t = -50;

      setDragPct(t);
    };

    const onEnd = (e: PointerEvent) => {
      if (!hasDown || (pid !== null && e.pointerId !== pid)) return;

      // Decisione: se lo spostamento supera il 10% della larghezza, cambia vista
      const dx = e.clientX - sx;
      const triggerPx = (el.getBoundingClientRect().width || 1) * TRIGGER_RATIO;

      if (lock === 'h') {
        if (activeView === 'quick' && dx <= -triggerPx) setActiveView('custom');
        else if (activeView === 'custom' && dx >= triggerPx) setActiveView('quick');
      }

      setDragging(false);
      setDragPct(null); // torna alla posizione base con transizione dolce
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
    <div className="flex-shrink-0 z-30">
      <div className="bg-white/95 backdrop-blur-sm shadow-[0_-8px_20px_-5px_rgba(0,0,0,0.08)]">
        <div className="max-w-4xl mx-auto px-4 pt-3 pb-2 rounded-t-2xl">
          <div
            className="overflow-hidden"
            ref={swipeContainerRef}
            // Lascia lo scroll verticale al browser, blocca tutti i back/overscroll orizzontali
            style={{ touchAction: 'pan-y', overscrollBehaviorX: 'contain' }}
          >
            <div
              className="flex"
              style={{
                width: '200%',
                transform: `translateX(${translateX}%)`,
                transition: dragging ? 'none' : 'transform 0.16s ease-out'
              }}
            >
              <div className="w-1/2 flex-shrink-0">
                <QuickFilterTable
                  onSelect={onSelectQuickFilter}
                  currentValue={currentQuickFilter}
                  isCustomActive={isCustomRangeActive}
                />
              </div>
              <div className="w-1/2 flex-shrink-0">
                <CustomDateFilter
                  onChange={onCustomRangeChange}
                  currentRange={currentCustomRange}
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
  );
};