import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Expense, Account } from '../types';
import { getCategoryStyle } from '../utils/categoryStyles';
import { formatCurrency } from '../components/icons/formatters';
import { TrashIcon } from '../components/icons/TrashIcon';
import { HistoryFilterCard } from '../components/HistoryFilterCard';
import { useTapBridge } from '../hooks/useTapBridge';

type DateFilter = 'all' | '7d' | '30d' | '6m' | '1y';
type PeriodType = 'day' | 'week' | 'month' | 'year';
type ActiveFilterMode = 'quick' | 'period' | 'custom';

interface ExpenseItemProps {
  expense: Expense;
  accounts: Account[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onInteractionChange: (isInteracting: boolean) => void;
  onNavigateHome: () => void;
  isPageSwiping: boolean;
}

const ACTION_WIDTH = 72;

// Soglie per apertura/chiusura + flick
const OPEN_SNAP  = 0.20;  // ≥20% verso sinistra → apri
const CLOSE_SNAP = 0.50;  // ≤50% verso destra quando aperto → chiudi
const OPEN_VX    = -0.08; // px/ms
const CLOSE_VX   =  0.18; // px/ms

/* ==================== ExpenseItem ==================== */
const ExpenseItem: React.FC<ExpenseItemProps> = ({
  expense,
  accounts,
  onEdit,
  onDelete,
  isOpen,
  onOpen,
  onInteractionChange,
  onNavigateHome,
  isPageSwiping,
}) => {
  const tapBridge = useTapBridge();

  const style = getCategoryStyle(expense.category);
  const accountName = accounts.find(a => a.id === expense.accountId)?.name || 'Sconosciuto';

  const itemRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    isDragging: false,
    isLocked: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastT: 0,
    initialTranslateX: 0,
    pointerId: null as number | null,
  });
  const animTimer = useRef<number | null>(null);

  const setTranslateX = useCallback((x: number, animated: boolean) => {
    const el = itemRef.current;
    if (!el) return;
    el.style.transition = animated ? 'transform 0.2s cubic-bezier(0.22,0.61,0.36,1)' : 'none';
    el.style.transform = `translateX(${x}px)`;
  }, []);

  // Se il pager swipa la pagina, abortisci il drag dell'item
  useEffect(() => {
    if (isPageSwiping && dragState.current.isDragging) {
      dragState.current.isDragging = false;
      dragState.current.isLocked = false;
      dragState.current.pointerId = null;
      setTranslateX(0, true);
      onInteractionChange(false);
    }
  }, [isPageSwiping, onInteractionChange, setTranslateX]);

  const handlePointerDown = (e: React.PointerEvent) => {
    tapBridge.onPointerDown(e);
    const el = itemRef.current;
    if (!el) return;
    if ((e.target as HTMLElement).closest('button')) return;

    if (animTimer.current) { clearTimeout(animTimer.current); animTimer.current = null; }

    el.style.transition = 'none';
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    const currentX = m.m41;

    dragState.current = {
      isDragging: true,
      isLocked: false,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastT: performance.now(),
      initialTranslateX: currentX || 0,
      pointerId: e.pointerId,
    };

    // Se già aperto, blocca subito il pager: la chiusura è "locale"
    if (isOpen) {
      dragState.current.isLocked = true;
      try { el.setPointerCapture(e.pointerId); } catch {}
      onInteractionChange(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    tapBridge.onPointerMove(e);
    const ds = dragState.current;
    const el = itemRef.current;
    if (!ds.isDragging || ds.pointerId !== e.pointerId || !el) return;

    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;

    if (!ds.isLocked) {
      const SLOP = 6;
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;

      // Follow immediato a sinistra: lock appena superi lo slop
      if (dx < -SLOP) {
        ds.isLocked = true;
        try { el.setPointerCapture(ds.pointerId!); } catch {}
        onInteractionChange(true);
      } else if (dx > SLOP) {
        // Destra: se chiuso → cedi al pager; se aperto → lock per chiudere senza spostare la pagina
        if (!isOpen) {
          ds.isDragging = false;
          ds.pointerId = null;
          return; // lascia il pager
        }
        ds.isLocked = true;
        try { el.setPointerCapture(ds.pointerId!); } catch {}
        onInteractionChange(true);
      } else {
        if (Math.abs(dy) > Math.abs(dx) * 1.2) {
          ds.isDragging = false;
          ds.pointerId = null;
          return;
        }
      }
    }

    if (e.cancelable) e.preventDefault();

    // Limiti con elasticità
    let nx = ds.initialTranslateX + dx;
    if (nx > 0) nx = Math.tanh(nx / 100) * 60;
    if (nx < -ACTION_WIDTH) {
      const over = -ACTION_WIDTH - nx;
      nx = -ACTION_WIDTH - Math.tanh(over / 100) * 60;
    }

    setTranslateX(nx, false); // segue il dito
    ds.lastX = e.clientX;
    ds.lastT = performance.now();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    tapBridge.onPointerUp(e);
    const ds = dragState.current;
    const el = itemRef.current;
    if (!ds.isDragging || ds.pointerId !== e.pointerId || !el) return;

    if (ds.isLocked) {
      try { el.releasePointerCapture(ds.pointerId!); } catch {}
    }

    const dt = Math.max(1, performance.now() - ds.lastT);
    const vx = (e.clientX - ds.lastX) / dt; // px/ms
    const cur = new DOMMatrixReadOnly(getComputedStyle(el).transform).m41;
    const progress = Math.min(1, Math.max(0, Math.abs(cur) / ACTION_WIDTH)); // 0..1

    // Follow + flick
    let open = isOpen;
    if (!isOpen) {
      open = (vx <= OPEN_VX) || (progress >= OPEN_SNAP);
    } else {
      open = !((vx >= CLOSE_VX) || (progress <= CLOSE_SNAP));
    }

    onInteractionChange(true);
    setTranslateX(open ? -ACTION_WIDTH : 0, true);
    animTimer.current = window.setTimeout(() => {
      if (open !== isOpen) onOpen(open ? expense.id : '');
      onInteractionChange(false);
      animTimer.current = null;
    }, 210);

    ds.isDragging = false;
    ds.isLocked = false;
    ds.pointerId = null;
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    tapBridge.onPointerCancel?.(e as any);
    const ds = dragState.current;
    const el = itemRef.current;
    if (!ds.isDragging || ds.pointerId !== e.pointerId || !el) return;

    try { el.releasePointerCapture(ds.pointerId!); } catch {}
    ds.isDragging = false;
    ds.isLocked = false;
    ds.pointerId = null;

    onInteractionChange(true);
    setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
    animTimer.current = window.setTimeout(() => {
      onInteractionChange(false);
      animTimer.current = null;
    }, 210);
  };

  // Allinea quando cambia isOpen dall'esterno
  useEffect(() => {
    if (!dragState.current.isDragging) {
      setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
    }
  }, [isOpen, setTranslateX]);

  return (
    <div className="relative bg-white overflow-hidden">
      {/* azioni a destra */}
      <div className="absolute top-0 right-0 h-full flex items-center z-0">
        <button
          onClick={() => onDelete(expense.id)}
          className="w-[72px] h-full flex flex-col items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          aria-label="Elimina spesa"
        >
          <TrashIcon className="w-6 h-6" />
          <span className="text-xs mt-1">Elimina</span>
        </button>
      </div>

      {/* contenuto swipeable */}
      <div
        ref={itemRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClickCapture={(e) => tapBridge.onClickCapture(e as any)}
        className="relative flex items-center gap-4 py-3 px-4 bg-white z-10 cursor-pointer"
        style={{ touchAction: 'pan-y' }}
      >
        <span className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${style.bgColor}`}>
          <style.Icon className={`w-6 h-6 ${style.color}`} />
        </span>
        <div className="flex-grow min-w-0">
          <p className="font-semibold text-slate-800 truncate">
            {expense.subcategory || style.label} • {accountName}
          </p>
          <p className="text-sm text-slate-500 truncate" title={expense.description}>
            {expense.description || 'Senza descrizione'}
          </p>
        </div>
        <p className="font-bold text-slate-900 text-lg text-right shrink-0 whitespace-nowrap min-w-[90px]">
          {formatCurrency(Number(expense.amount) || 0)}
        </p>
      </div>
    </div>
  );
};

/* ==================== HistoryScreen ==================== */
interface HistoryScreenProps {
  expenses: Expense[];
  accounts: Account[];
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onItemStateChange: (state: { isOpen: boolean; isInteracting: boolean }) => void;
  isEditingOrDeleting: boolean;
  onNavigateHome: () => void;
  isActive: boolean; // true solo nella pagina "Storico"
  onDateModalStateChange: (isOpen: boolean) => void;
  isPageSwiping: boolean; // dal pager esterno
}

interface ExpenseGroup {
  year: number;
  week: number;
  label: string;
  expenses: Expense[];
}

const getISOWeek = (date: Date): [number, number] => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return [d.getUTCFullYear(), Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)];
};

const getWeekLabel = (y: number, w: number) => {
  const now = new Date();
  const [cy, cw] = getISOWeek(now);
  if (y === cy) {
    if (w === cw) return 'Questa Settimana';
    if (w === cw - 1) return 'Settimana Scorsa';
  }
  return `Settimana ${w}, ${y}`;
};

const parseLocalYYYYMMDD = (s: string) => {
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
};

const HistoryScreen: React.FC<HistoryScreenProps> = ({
  expenses,
  accounts,
  onEditExpense,
  onDeleteExpense,
  onItemStateChange,
  isEditingOrDeleting,
  onNavigateHome,
  isActive,
  onDateModalStateChange,
  isPageSwiping,
}) => {
  const tapBridge = useTapBridge();

  const [activeFilterMode, setActiveFilterMode] = useState<ActiveFilterMode>('quick');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customRange, setCustomRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });

  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [periodDate, setPeriodDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // ⬇️ UNA SOLA DICHIARAZIONE (niente duplicati più in basso)
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);

  const autoCloseTimerRef = useRef<number | null>(null);
  const prevIsEditingOrDeleting = useRef(isEditingOrDeleting);

  useEffect(() => {
    if (prevIsEditingOrDeleting.current && !isEditingOrDeleting) {
      setOpenItemId(null);
    }
    prevIsEditingOrDeleting.current = isEditingOrDeleting;
  }, [isEditingOrDeleting]);

  useEffect(() => {
    if (!isActive) setOpenItemId(null);
  }, [isActive]);

  useEffect(() => {
    onItemStateChange({ isOpen: openItemId !== null, isInteracting });
  }, [openItemId, isInteracting, onItemStateChange]);

  useEffect(() => {
    if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    if (openItemId && !isEditingOrDeleting) {
      autoCloseTimerRef.current = window.setTimeout(() => setOpenItemId(null), 5000);
    }
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
    };
  }, [openItemId, isEditingOrDeleting]);

  const filteredExpenses = useMemo(() => {
    if (activeFilterMode === 'period') {
      const start = new Date(periodDate); start.setHours(0,0,0,0);
      const end = new Date(periodDate); end.setHours(23,59,59,999);

      switch (periodType) {
        case 'day': break;
        case 'week': {
          const day = start.getDay();
          const diff = start.getDate() - day + (day === 0 ? -6 : 1);
          start.setDate(diff);
          end.setDate(start.getDate() + 6);
          break;
        }
        case 'month':
          start.setDate(1);
          end.setMonth(end.getMonth() + 1);
          end.setDate(0);
          break;
        case 'year':
          start.setMonth(0, 1);
          end.setFullYear(end.getFullYear() + 1);
          end.setMonth(0, 0);
          break;
      }

      const t0 = start.getTime();
      const t1 = end.getTime();
      return expenses.filter(e => {
        const d = parseLocalYYYYMMDD(e.date);
        if (isNaN(d.getTime())) return false;
        const t = d.getTime();
        return t >= t0 && t <= t1;
      });
    }

    if (activeFilterMode === 'custom' && customRange.start && customRange.end) {
      const t0 = parseLocalYYYYMMDD(customRange.start!).getTime();
      const endDay = parseLocalYYYYMMDD(customRange.end!);
      endDay.setDate(endDay.getDate() + 1);
      const t1 = endDay.getTime();
      return expenses.filter(e => {
        const d = parseLocalYYYYMMDD(e.date);
        if (isNaN(d.getTime())) return false;
        const t = d.getTime();
        return t >= t0 && t < t1;
      });
    }

    if (dateFilter === 'all') return expenses;

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    switch (dateFilter) {
      case '7d': startDate.setDate(startDate.getDate() - 6); break;
      case '30d': startDate.setDate(startDate.getDate() - 29); break;
      case '6m': startDate.setMonth(startDate.getMonth() - 6); break;
      case '1y': startDate.setFullYear(startDate.getFullYear() - 1); break;
    }
    const t0 = startDate.getTime();

    return expenses.filter(e => {
      const d = parseLocalYYYYMMDD(e.date);
      return !isNaN(d.getTime()) && d.getTime() >= t0;
    });
  }, [expenses, activeFilterMode, dateFilter, customRange, periodType, periodDate]);

  const groupedExpenses = useMemo(() => {
    const sorted = [...filteredExpenses].sort((a, b) => {
      const db = parseLocalYYYYMMDD(b.date);
      const da = parseLocalYYYYMMDD(a.date);
      if (b.time) { const [h, m] = b.time.split(':').map(Number); if (!isNaN(h) && !isNaN(m)) db.setHours(h, m); }
      if (a.time) { const [h, m] = a.time.split(':').map(Number); if (!isNaN(h) && !isNaN(m)) da.setHours(h, m); }
      return db.getTime() - da.getTime();
    });

    return sorted.reduce<Record<string, ExpenseGroup>>((acc, e) => {
      const d = parseLocalYYYYMMDD(e.date);
      if (isNaN(d.getTime())) return acc;
      const [y, w] = getISOWeek(d);
      const key = `${y}-${w}`;
      if (!acc[key]) acc[key] = { year: y, week: w, label: getWeekLabel(y, w), expenses: [] };
      acc[key].expenses.push(e);
      return acc;
    }, {});
  }, [filteredExpenses]);

  const expenseGroups = (Object.values(groupedExpenses) as ExpenseGroup[]).sort(
    (a, b) => (a.year !== b.year ? b.year - a.year : b.week - a.week)
  );

  const handleOpenItem = (id: string) => setOpenItemId(id || null);
  const handleInteractionChange = (v: boolean) => setIsInteracting(v);

  return (
    <div className="h-full flex flex-col bg-slate-100" style={{ touchAction: 'pan-y' }}>
      <div
        className="flex-1 overflow-y-auto pb-36"
        style={{ touchAction: 'pan-y' }}
        onPointerDownCapture={(e) => tapBridge.onPointerDown(e)}
        onPointerMoveCapture={(e) => tapBridge.onPointerMove(e)}
        onPointerUpCapture={(e) => tapBridge.onPointerUp(e)}
        onPointerCancelCapture={(e) => tapBridge.onPointerCancel?.(e as any)}
        onClickCapture={(e) => tapBridge.onClickCapture(e as any)}
      >
        {expenseGroups.length > 0 ? (
          expenseGroups.map(group => (
            <div key={group.label} className="mb-6 last:mb-0">
              <h2 className="font-bold text-slate-800 text-lg px-4 py-2 sticky top-0 bg-slate-100/80 backdrop-blur-sm z-10">
                {group.label}
              </h2>

              {/* niente data-no-page-swipe: lo swipe verso Home funziona sopra la lista */}
              <div className="bg-white rounded-xl shadow-md mx-2 overflow-hidden">
                {group.expenses.map((expense, index) => (
                  <React.Fragment key={expense.id}>
                    {index > 0 && <hr className="border-t border-slate-200 ml-16" />}
                    <ExpenseItem
                      expense={expense}
                      accounts={accounts}
                      onEdit={onEditExpense}
                      onDelete={onDeleteExpense}
                      isOpen={openItemId === expense.id}
                      onOpen={handleOpenItem}
                      onInteractionChange={handleInteractionChange}
                      onNavigateHome={onNavigateHome}
                      isPageSwiping={isPageSwiping}
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-slate-500 pt-20 px-6">
            <p className="text-lg font-semibold">Nessuna spesa trovata</p>
            <p className="mt-2">Prova a modificare i filtri o aggiungi una nuova spesa dalla schermata Home.</p>
          </div>
        )}
      </div>

      <HistoryFilterCard
        isActive={isActive}
        onSelectQuickFilter={(value) => { setDateFilter(value); setActiveFilterMode('quick'); }}
        currentQuickFilter={dateFilter}
        onCustomRangeChange={(range) => { setCustomRange(range); setActiveFilterMode('custom'); }}
        currentCustomRange={customRange}
        isCustomRangeActive={activeFilterMode === 'custom'}
        onDateModalStateChange={onDateModalStateChange}
        periodType={periodType}
        periodDate={periodDate}
        onSelectPeriodType={(type) => {
          setPeriodType(type);
          setPeriodDate(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
          setActiveFilterMode('period');
        }}
        onSetPeriodDate={setPeriodDate}
        isPeriodFilterActive={activeFilterMode === 'period'}
        onActivatePeriodFilter={() => setActiveFilterMode('period')}
      />
    </div>
  );
};

export default HistoryScreen;
