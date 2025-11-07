import React, { useEffect, useMemo, useRef, useState } from 'react';

type DateFilter = 'all' | '7d' | '30d' | '6m' | '1y';
type PeriodType = 'day' | 'week' | 'month' | 'year';

export interface HistoryFilterCardProps {
  // Stato della pagina (usato solo per eventuali ottimizzazioni UI)
  isActive: boolean;

  // QUICK FILTER (chip tipo 7d/30d/6m/1y/all)
  onSelectQuickFilter: (value: DateFilter) => void;
  currentQuickFilter: DateFilter;

  // CUSTOM RANGE (start/end stringhe 'YYYY-MM-DD')
  onCustomRangeChange: (range: { start: string | null; end: string | null }) => void;
  currentCustomRange: { start: string | null; end: string | null };
  isCustomRangeActive: boolean;

  // Notifica al parent quando un date-modal/popup si apre o si chiude
  onDateModalStateChange: (isOpen: boolean) => void;

  // PERIODO CENTRALE (freccia sx, selettore periodo, freccia dx)
  periodType: PeriodType;
  periodDate: Date;
  onSelectPeriodType: (type: PeriodType) => void;
  onSetPeriodDate: (date: Date) => void;
  isPeriodFilterActive: boolean;
  onActivatePeriodFilter: () => void;

  // NEW: wiring per chiudere i menu quando lo swipe di pagina parte
  onAnyMenuStateChange?: (isOpen: boolean) => void;
  closeMenusRef?: React.MutableRefObject<(() => void) | null>;
}

/* -------------------- Util -------------------- */
const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseYMD = (s: string | null): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return isNaN(dt.getTime()) ? null : dt;
};

const getWeekBounds = (base: Date) => {
  // Settimana ISO-like: lunedì (1) — domenica (7)
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = domenica
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
};

const formatPeriodLabel = (type: PeriodType, date: Date) => {
  const fmtDay = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  const fmtMonth = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });

  switch (type) {
    case 'day':
      return fmtDay.format(date).replace('.', '');
    case 'week': {
      const { start, end } = getWeekBounds(date);
      const fmtShort = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' });
      const year = date.getFullYear();
      return `${fmtShort.format(start).replace('.', '')} — ${fmtShort.format(end).replace('.', '')} ${year}`;
    }
    case 'month':
      return fmtMonth.format(date);
    case 'year':
      return String(date.getFullYear());
  }
};

const shiftPeriod = (type: PeriodType, date: Date, delta: number) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  switch (type) {
    case 'day':
      d.setDate(d.getDate() + delta);
      break;
    case 'week':
      d.setDate(d.getDate() + delta * 7);
      break;
    case 'month':
      d.setMonth(d.getMonth() + delta);
      break;
    case 'year':
      d.setFullYear(d.getFullYear() + delta);
      break;
  }
  return d;
};

/* -------------------- Component -------------------- */
export const HistoryFilterCard: React.FC<HistoryFilterCardProps> = ({
  isActive,

  onSelectQuickFilter,
  currentQuickFilter,

  onCustomRangeChange,
  currentCustomRange,
  isCustomRangeActive,

  onDateModalStateChange,

  periodType,
  periodDate,
  onSelectPeriodType,
  onSetPeriodDate,
  isPeriodFilterActive,
  onActivatePeriodFilter,

  onAnyMenuStateChange,
  closeMenusRef,
}) => {
  // Stato interni dei popup/menù della card
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const [isRangePopupOpen, setIsRangePopupOpen] = useState(false);

  // Effetto: esponi al parent una funzione che chiude *tutti* i popup
  useEffect(() => {
    if (!closeMenusRef) return;

    const closeAll = () => {
      setIsPeriodMenuOpen(false);
      setIsRangePopupOpen(false);
      onAnyMenuStateChange?.(false);
      onDateModalStateChange(false);
    };

    closeMenusRef.current = closeAll;
    return () => {
      if (closeMenusRef.current === closeAll) closeMenusRef.current = null;
    };
  }, [closeMenusRef, onAnyMenuStateChange, onDateModalStateChange]);

  // Effetto: notifica al parent se *qualunque* menu è aperto
  useEffect(() => {
    const anyOpen = isPeriodMenuOpen || isRangePopupOpen;
    onAnyMenuStateChange?.(anyOpen);
  }, [isPeriodMenuOpen, isRangePopupOpen, onAnyMenuStateChange]);

  // Effetto: tratta il popup range come “date modal” ai fini del parent
  useEffect(() => {
    onDateModalStateChange(isRangePopupOpen);
  }, [isRangePopupOpen, onDateModalStateChange]);

  const label = useMemo(() => formatPeriodLabel(periodType, periodDate), [periodType, periodDate]);

  // Handler frecce periodo
  const goPrev = () => onSetPeriodDate(shiftPeriod(periodType, periodDate, -1));
  const goNext = () => onSetPeriodDate(shiftPeriod(periodType, periodDate, +1));

  // Cambio tipo periodo dal menu => attivo anche la modalità "period"
  const handleSelectPeriodType = (t: PeriodType) => {
    onSelectPeriodType(t);
    onActivatePeriodFilter();
    setIsPeriodMenuOpen(false);
    onAnyMenuStateChange?.(false);
  };

  // Toggle del menu periodo
  const togglePeriodMenu = () => {
    setIsPeriodMenuOpen(prev => {
      const next = !prev;
      onAnyMenuStateChange?.(next || isRangePopupOpen);
      return next;
    });
  };

  // Toggle popup range personalizzato
  const toggleRangePopup = () => {
    setIsRangePopupOpen(prev => {
      const next = !prev;
      // Consideriamo anche questo come “date modal”
      onDateModalStateChange(next);
      onAnyMenuStateChange?.(next || isPeriodMenuOpen);
      return next;
    });
  };

  const quickFilters: { key: DateFilter; label: string }[] = [
    { key: '7d', label: '7g' },
    { key: '30d', label: '30g' },
    { key: '6m', label: '6m' },
    { key: '1y', label: '1a' },
    { key: 'all', label: 'Tutte' },
  ];

  // UI
  return (
    <div className="bg-white border-t border-slate-200 pt-2 pb-3">
      {/* Riga quick filters */}
      <div className="px-3 flex gap-2 overflow-x-auto no-scrollbar">
        {quickFilters.map(({ key, label }) => {
          const active = currentQuickFilter === key && !isCustomRangeActive && !isPeriodFilterActive;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelectQuickFilter(key);
                // Chiudi eventuali popup aperti
                setIsPeriodMenuOpen(false);
                setIsRangePopupOpen(false);
                onAnyMenuStateChange?.(false);
                onDateModalStateChange(false);
              }}
              className={
                'px-3 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ' +
                (active
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-800 hover:bg-slate-200')
              }
            >
              {label}
            </button>
          );
        })}

        {/* Intervallo personalizzato */}
        <button
          type="button"
          onClick={toggleRangePopup}
          className={
            'ml-auto px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ' +
            (isCustomRangeActive
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'bg-slate-100 text-slate-800 hover:bg-slate-200')
          }
        >
          Intervallo
        </button>
      </div>

      {/* Popup intervallo */}
      {isRangePopupOpen && (
        <div
          className="relative px-3 mt-2"
          // Evita che i click chiudano/propaghino oltre
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute left-3 right-3 z-20 bg-white border border-slate-200 rounded-xl shadow-lg p-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-slate-600">
                Dal
                <input
                  type="date"
                  className="mt-1 block w-full rounded-md border border-slate-300 bg-white py-2 px-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  value={currentCustomRange.start || ''}
                  onChange={(e) =>
                    onCustomRangeChange({
                      start: e.target.value || null,
                      end: currentCustomRange.end || null,
                    })
                  }
                />
              </label>
              <label className="text-sm text-slate-600">
                Al
                <input
                  type="date"
                  className="mt-1 block w-full rounded-md border border-slate-300 bg-white py-2 px-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  value={currentCustomRange.end || ''}
                  onChange={(e) =>
                    onCustomRangeChange({
                      start: currentCustomRange.start || null,
                      end: e.target.value || null,
                    })
                  }
                />
              </label>
            </div>

            <div className="mt-3 flex justify-between">
              <button
                type="button"
                onClick={() => {
                  onCustomRangeChange({ start: null, end: null });
                  setIsRangePopupOpen(false);
                  onAnyMenuStateChange?.(isPeriodMenuOpen);
                  onDateModalStateChange(false);
                }}
                className="px-3 py-1.5 rounded-md text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => {
                  // Attiva la modalità custom se valido (anche se lo stato attivo viene gestito dal parent)
                  setIsRangePopupOpen(false);
                  onAnyMenuStateChange?.(isPeriodMenuOpen);
                  onDateModalStateChange(false);
                }}
                className="px-3 py-1.5 rounded-md text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Applica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Riga periodo centrale */}
      <div className="px-3 mt-3">
        <div className="flex items-stretch gap-2">
          {/* Prev */}
          <button
            type="button"
            onClick={goPrev}
            className="px-3 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            aria-label="Periodo precedente"
          >
            ‹
          </button>

          {/* Bottone periodo (apre menu tipi) */}
          <div className="relative flex-1">
            <button
              type="button"
              onClick={togglePeriodMenu}
              className={
                'w-full px-3 py-2 rounded-lg border text-left transition-colors ' +
                (isPeriodFilterActive
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50')
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold truncate">{label}</span>
                <span className="text-slate-500">▾</span>
              </div>
            </button>

            {isPeriodMenuOpen && (
              <div
                className="absolute left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {(['day', 'week', 'month', 'year'] as PeriodType[]).map((t) => {
                  const active = t === periodType;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleSelectPeriodType(t)}
                      className={
                        'w-full text-left px-3 py-2 text-sm font-semibold transition-colors ' +
                        (active
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'bg-white text-slate-800 hover:bg-slate-50')
                      }
                    >
                      {t === 'day' && 'Giorno'}
                      {t === 'week' && 'Settimana'}
                      {t === 'month' && 'Mese'}
                      {t === 'year' && 'Anno'}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Next */}
          <button
            type="button"
            onClick={goNext}
            className="px-3 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            aria-label="Periodo successivo"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
};
