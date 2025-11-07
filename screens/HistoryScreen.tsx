import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Expense, Account } from '../types';
import { getCategoryStyle } from '../utils/categoryStyles';
import { formatCurrency, formatDate } from '../components/icons/formatters';
import { PencilSquareIcon } from '../components/icons/PencilSquareIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { HistoryFilterCard } from '../components/HistoryFilterCard';

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

/* -------------------- ExpenseItem -------------------- */
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
  const style = getCategoryStyle(expense.category);
  const accountName = accounts.find(a => a.id === expense.accountId)?.name || 'Sconosciuto';

  const itemRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    isDragging: false,
    isLocked: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    initialTranslateX: 0,
    pointerId: null as number | null,
  });

  const setTranslateX = useCallback((x: number, animated: boolean) => {
    if (!itemRef.current) return;
    itemRef.current.style.transition = animated ? 'transform 0.2s cubic-bezier(0.22,0.61,0.36,1)' : 'none';
    itemRef.current.style.transform = `translateX(${x}px)`;
  }, []);

  // Se il pager prende lo swipe, resettiamo
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
    // Evita che il parent armi il page-swipe
    e.stopPropagation();

    if ((e.target as HTMLElement).closest('button') || !itemRef.current) return;

    itemRef.current.style.transition = 'none';

    const m = new DOMMatrixReadOnly(window.getComputedStyle(itemRef.current).transform);
    const currentX = m.m41;

    dragState.current = {
      isDragging: true,
      isLocked: false,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      initialTranslateX: currentX,
      pointerId: e.pointerId,
    };

    try {
      itemRef.current.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds.isDragging || e.pointerId !== ds.pointerId) return;

    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;

    if (!ds.isLocked) {
      const SLOP = 8; // reattivo
      if (Math.abs(dx) <= SLOP && Math.abs(dy) <= SLOP) return;

      const horizontal = Math.abs(dx) > Math.abs(dy) * 2;

      if (!horizontal) {
        ds.isDragging = false;
        if (ds.pointerId !== null) {
          itemRef.current?.releasePointerCapture(ds.pointerId);
        }
        ds.pointerId = null;
        return;
      }

      const wasOpen = ds.initialTranslateX < -1 || isOpen;
      if (dx > 0 && !wasOpen) {
        ds.isDragging = false;
        if (ds.pointerId !== null) {
          itemRef.current?.releasePointerCapture(ds.pointerId);
        }
        ds.pointerId = null;
        return;
      }

      ds.isLocked = true;
      onInteractionChange(true);
    }

    // Se lo swipe è dell’item, non farlo salire al parent
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();

    let x = ds.initialTranslateX + dx;
    if (x > 0) {
      x = Math.tanh(x / 50) * 25;
    }
    if (x < -ACTION_WIDTH) {
      x = -ACTION_WIDTH - Math.tanh((Math.abs(x) - ACTION_WIDTH) / 50) * 25;
    }
    setTranslateX(x, false);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds.isDragging || e.pointerId !== ds.pointerId) return;

    // Se l'item aveva lockato lo swipe, non propagare l'UP
    if (ds.isLocked) e.stopPropagation();

    if (ds.pointerId !== null) {
      itemRef.current?.releasePointerCapture(ds.pointerId);
    }

    const wasLocked = ds.isLocked;

    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    const dist = Math.hypot(dx, dy);
    const duration = performance.now() - ds.startTime;

    const isTap = dist < 10 && duration < 250; // tap sensibile

    ds.isDragging = false;
    ds.isLocked = false;
    ds.pointerId = null;
    if (wasLocked) {
      onInteractionChange(false);
    }

    if (isTap) {
      setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
      if (isOpen) {
        onOpen('');
      } else {
        onEdit(expense);
      }
      return;
    }

    if (wasLocked) {
      const endX = new DOMMatrixReadOnly(window.getComputedStyle(itemRef.current!).transform).m41;
      const velocity = dx / (duration || 1);
      const shouldOpen = endX < -ACTION_WIDTH / 2 || (velocity < -0.3 && dx < -20);

      onOpen(shouldOpen ? expense.id : '');
      setTranslateX(shouldOpen ? -ACTION_WIDTH : 0, true);
    } else {
      setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds.isDragging || e.pointerId !== ds.pointerId) return;

    if (ds.isLocked) e.stopPropagation();

    if (ds.pointerId !== null) {
      itemRef.current?.releasePointerCapture(ds.pointerId);
    }

    ds.isDragging = false;
    ds.isLocked = false;
    ds.pointerId = null;
    onInteractionChange(false);
    setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
  };

  useEffect(() => {
    if (!dragState.current.isDragging) {
      setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
    }
  }, [isOpen, setTranslateX]);

  return (
    <div className="relative bg-white overflow-hidden">
      {/* layer azioni */}
      <div className="absolute top-0 right-0 h-full flex items-center z-0">
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            onDelete(expense.id);
          }}
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
        data-no-page-swipe="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        // doppia rete: blocca in capture se l'item sta gestendo il gesto
        onPointerDownCapture={(e) => e.stopPropagation()}
        onPointerMoveCapture={(e) => { if (dragState.current.isLocked) e.stopPropagation(); }}
        onPointerUpCapture={(e) => { if (dragState.current.isLocked) e.stopPropagation(); }}
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

/* -------------------- HistoryScreen -------------------- */
interface HistoryScreenProps {
  expenses: Expense[];
  accounts: Account[];
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onItemStateChange: (state: { isOpen: boolean; isInteracting: boolean }) => void;
  isEditingOrDeleting: boolean;
  onNavigateHome: () => void;
  isActive: boolean;
  onDateModalStateChange: (isOpen: boolean) => void;
  isPageSwiping: boolean;
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

const getWeekLabel = (year: number, week: number): string => {
  const now = new Date();
  const [currentYear, currentWeek] = getISOWeek(now);
  if (year === currentYear) {
    if (week === currentWeek) return 'Questa Settimana';
    if (week === currentWeek - 1) return 'Settimana Scorsa';
  }
  return `Settimana ${week}, ${year}`;
};

const parseLocalYYYYMMDD = (s: string): Date => {
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
  const [activeFilterMode, setActiveFilterMode] = useState<ActiveFilterMode>('quick');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customRange, setCustomRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });

  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [periodDate, setPeriodDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const autoCloseTimerRef = useRef<number | null>(null);

  // ===== FULL-SURFACE PAGE SWIPE (capture phase) =====
  const pageRef = useRef<HTMLDivElement>(null);
  const pageDrag = useRef({
    active: false,
    locked: false,
    pointerId: null as number | null,
    startX: 0,
    startY: 0,
  });

  const onPDcap = (e: React.PointerEvent) => {
    if (
      isInteracting ||
      openItemId ||
      (e.target as HTMLElement).closest('[data-no-page-swipe], [role="dialog"], button, input, select, textarea')
    ) {
      return;
    }
    pageDrag.current = {
      active: true,
      locked: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
    };
  };

  const onPMcap = (e: React.PointerEvent) => {
    const pg = pageDrag.current;
    if (!pg.active || pg.pointerId !== e.pointerId) return;

    const dx = e.clientX - pg.startX;
    const dy = e.clientY - pg.startY;

    if (!pg.locked) {
      const SLOP = 15;
      if (Math.abs(dx) <= SLOP && Math.abs(dy) <= SLOP) return;

      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
      if (!horizontal) {
        pg.active = false;
        pg.pointerId = null;
        return;
      }

      pg.locked = true;
      try {
        pageRef.current?.setPointerCapture(e.pointerId);
      } catch {}
    }
  };

  const onPUcap = (e: React.PointerEvent) => {
    const pg = pageDrag.current;
    if (!pg.active || pg.pointerId !== e.pointerId) return;

    if (pg.locked) {
      try {
        pageRef.current?.releasePointerCapture(e.pointerId);
      } catch {}
    }

    const wasLocked = pg.locked;

    pg.active = false;
    pg.locked = false;
    pg.pointerId = null;

    if (wasLocked) {
      const dx = e.clientX - pg.startX;
      const dy = e.clientY - pg.startY;

      const THRESH = 100;
      if (Math.abs(dx) > Math.abs(dy) && dx > THRESH && !isInteracting && !openItemId) {
        onNavigateHome();
      }
    }
  };

  const onPCcap = (e: React.PointerEvent) => {
    const pg = pageDrag.current;
    if (!pg.active || pg.pointerId !== e.pointerId) return;

    if (pg.locked) {
      try {
        pageRef.current?.releasePointerCapture(e.pointerId);
      } catch {}
    }

    pg.active = false;
    pg.locked = false;
    pg.pointerId = null;
  };
  // ====================================================

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
      const start = new Date(periodDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(periodDate);
      end.setHours(23, 59, 59, 999);

      switch (periodType) {
        case 'day':
          break;
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
      case '7d':
        startDate.setDate(startDate.getDate() - 6);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 29);
        break;
      case '6m':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
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
      if (b.time) {
        const [h, m] = b.time.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) db.setHours(h, m);
      }
      if (a.time) {
        const [h, m] = a.time.split(':').map(Number);
        if (!isNaN(h) && !isNaN(m)) da.setHours(h, m);
      }
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

  const expenseGroups = (Object.values(groupedExpenses) as ExpenseGroup[]).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.week - a.week;
  });

  const handleOpenItem = (id: string) => setOpenItemId(id);
  const handleInteractionChange = (v: boolean) => setIsInteracting(v);

  return (
    <div
      ref={pageRef}
      className="h-full flex flex-col bg-slate-100"
      style={{ touchAction: 'pan-y' }}
      onPointerDownCapture={onPDcap}
      onPointerMoveCapture={onPMcap}
      onPointerUpCapture={onPUcap}
      onPointerCancelCapture={onPCcap}
    >
      <div className="flex-1 overflow-y-auto" style={{ touchAction: 'pan-y' }}>
        {expenseGroups.length > 0 ? (
          expenseGroups.map(group => (
            <div key={group.label} className="mb-6 last:mb-0">
              <h2 className="font-bold text-slate-800 text-lg px-4 py-2 sticky top-0 bg-slate-100/80 backdrop-blur-sm z-10">
                {group.label}
              </h2>
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

      <div data-no-page-swipe>
        <HistoryFilterCard
          isActive={isActive}
          onSelectQuickFilter={(value) => {
            setDateFilter(value);
            setActiveFilterMode('quick');
          }}
          currentQuickFilter={dateFilter}
          onCustomRangeChange={(range) => {
            setCustomRange(range);
            setActiveFilterMode('custom');
          }}
          currentCustomRange={customRange}
          isCustomRangeActive={activeFilterMode === 'custom'}
          onDateModalStateChange={onDateModalStateChange}
          periodType={periodType}
          periodDate={periodDate}
          onSelectPeriodType={(type) => {
            setPeriodType(type);
            setPeriodDate(() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              return d;
            });
            setActiveFilterMode('period');
          }}
          onSetPeriodDate={setPeriodDate}
          isPeriodFilterActive={activeFilterMode === 'period'}
          onActivatePeriodFilter={() => setActiveFilterMode('period')}
        />
      </div>
    </div>
  );
};

export default HistoryScreen;
