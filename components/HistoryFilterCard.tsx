import React, { useCallback, useMemo, useRef } from 'react';

type DateFilter = 'all' | '7d' | '30d' | '6m' | '1y';
type PeriodType = 'day' | 'week' | 'month' | 'year';

interface HistoryFilterCardProps {
  isActive: boolean;

  // Quick
  onSelectQuickFilter: (value: DateFilter) => void;
  currentQuickFilter: DateFilter;

  // Custom range (apri modal esterna + ritorno range)
  onCustomRangeChange: (range: { start: string | null; end: string | null }) => void;
  currentCustomRange: { start: string | null; end: string | null };
  isCustomRangeActive: boolean;
  onDateModalStateChange: (isOpen: boolean) => void;

  // Period
  periodType: PeriodType;
  periodDate: Date;
  onSelectPeriodType: (type: PeriodType) => void;
  onSetPeriodDate: (date: Date) => void;
  isPeriodFilterActive: boolean;
  onActivatePeriodFilter: () => void;
}

/** Util: etichette per i chip veloci */
const QUICK: Array<{ k: DateFilter; label: string }> = [
  { k: 'all',  label: 'Tutto' },
  { k: '7d',   label: '7 giorni' },
  { k: '30d',  label: '30 giorni' },
  { k: '6m',   label: '6 mesi' },
  { k: '1y',   label: '1 anno' },
];

/** Util: label periodo */
const PERIOD_LABEL: Record<PeriodType, string> = {
  day: 'Giorno',
  week: 'Settimana',
  month: 'Mese',
  year: 'Anno',
};

/** TapGuard: converte il tap (pointer) in azione affidabile anche su mobile */
function useTap(handler: () => void) {
  const st = useRef<{ id: number | null; x: number; y: number; moved: boolean }>({
    id: null, x: 0, y: 0, moved: false
  });

  const onPointerDown: React.PointerEventHandler = (e) => {
    st.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };

  const onPointerMove: React.PointerEventHandler = (e) => {
    if (st.current.id !== e.pointerId) return;
    if (st.current.moved) return;
    const dx = Math.abs(e.clientX - st.current.x);
    const dy = Math.abs(e.clientY - st.current.y);
    // soglia piccola: se parte uno swipe, non consideriamo più il tap
    if (dx > 8 || dy > 8) st.current.moved = true;
  };

  const onPointerUp: React.PointerEventHandler = (e) => {
    if (st.current.id !== e.pointerId) return;
    const moved = st.current.moved;
    st.current.id = null;
    if (!moved) {
      // evitiamo click sintetici/ritardi
      e.preventDefault();
      e.stopPropagation();
      handler();
    }
  };

  const onClick: React.MouseEventHandler = (e) => {
    // se il browser genera anche il click, non vogliamo doppioni
    e.preventDefault();
    e.stopPropagation();
  };

  return { onPointerDown, onPointerMove, onPointerUp, onClick };
}

const HistoryFilterCard: React.FC<HistoryFilterCardProps> = ({
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
}) => {
  const openCustomModal = useTap(() => onDateModalStateChange(true));

  const quickChip = (k: DateFilter, label: string) => {
    const tap = useTap(() => onSelectQuickFilter(k));
    const active = currentQuickFilter === k && !isCustomRangeActive && !isPeriodFilterActive;
    return (
      <button
        key={k}
        type="button"
        {...tap}
        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors select-none
          ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'}`}
        style={{ touchAction: 'manipulation' }}
      >
        {label}
      </button>
    );
  };

  const clearCustomRange = useTap(() => {
    onCustomRangeChange({ start: null, end: null });
  });

  const customLabel = useMemo(() => {
    const { start, end } = currentCustomRange || {};
    if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`;
    return 'Intervallo personalizzato';
  }, [currentCustomRange]);

  const setPrevPeriod = useTap(() => {
    const d = new Date(periodDate);
    if (periodType === 'day') d.setDate(d.getDate() - 1);
    else if (periodType === 'week') d.setDate(d.getDate() - 7);
    else if (periodType === 'month') d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    onSetPeriodDate(d);
    if (!isPeriodFilterActive) onActivatePeriodFilter();
  });

  const setNextPeriod = useTap(() => {
    const d = new Date(periodDate);
    if (periodType === 'day') d.setDate(d.getDate() + 1);
    else if (periodType === 'week') d.setDate(d.getDate() + 7);
    else if (periodType === 'month') d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    onSetPeriodDate(d);
    if (!isPeriodFilterActive) onActivatePeriodFilter();
  });

  const choosePeriodType = (t: PeriodType) => {
    const tap = useTap(() => onSelectPeriodType(t));
    const active = isPeriodFilterActive && periodType === t;
    return (
      <button
        key={t}
        type="button"
        {...tap}
        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors select-none
          ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'}`}
        style={{ touchAction: 'manipulation' }}
      >
        {PERIOD_LABEL[t]}
      </button>
    );
  };

  return (
    <div
      data-no-page-swipe
      className="bg-white border-t border-slate-200 p-3 sm:p-4"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Quick */}
      <div className="flex flex-wrap gap-2">
        {QUICK.map(q => quickChip(q.k, q.label))}
      </div>

      {/* Custom range */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          {...openCustomModal}
          className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors select-none
            ${isCustomRangeActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'}`}
          style={{ touchAction: 'manipulation' }}
          title="Seleziona intervallo personalizzato"
        >
          {customLabel}
        </button>

        {isCustomRangeActive && (
          <button
            type="button"
            {...clearCustomRange}
            className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
            style={{ touchAction: 'manipulation' }}
            title="Pulisci intervallo"
          >
            Pulisci
          </button>
        )}
      </div>

      {/* Period */}
      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(['day','week','month','year'] as PeriodType[]).map(t => choosePeriodType(t))}
          {!isPeriodFilterActive && (
            <button
              type="button"
              {...useTap(onActivatePeriodFilter)}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50"
              style={{ touchAction: 'manipulation' }}
              title="Attiva filtro periodo"
            >
              Attiva
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            {...setPrevPeriod}
            className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-300 hover:bg-slate-50"
            style={{ touchAction: 'manipulation' }}
            aria-label="Periodo precedente"
            title="Periodo precedente"
          >
            ‹
          </button>

          <span className="px-3 py-2 rounded-md bg-slate-100 text-slate-800 text-sm font-medium select-none">
            {formatPeriod(periodType, periodDate)}
          </span>

          <button
            type="button"
            {...setNextPeriod}
            className="px-3 py-2 rounded-lg text-sm font-semibold border border-slate-300 hover:bg-slate-50"
            style={{ touchAction: 'manipulation' }}
            aria-label="Periodo successivo"
            title="Periodo successivo"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryFilterCard;

/* ======= helpers ======= */
function fmtDate(s: string) {
  const [Y, M, D] = s.split('-').map(Number);
  const d = new Date(Y, (M || 1) - 1, D || 1);
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' }).format(d);
}
function formatPeriod(t: PeriodType, d: Date) {
  if (t === 'day') {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  }
  if (t === 'week') {
    const start = new Date(d);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${fmtDateISO(start)} – ${fmtDateISO(end)}`;
  }
  if (t === 'month') {
    return new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(d);
  }
  return String(d.getFullYear());
}
function fmtDateISO(d: Date) {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit' }).format(d);
}
