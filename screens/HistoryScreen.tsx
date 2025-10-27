import React, { useMemo, useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Expense, Account } from '../types';
import { getCategoryStyle } from '../utils/categoryStyles';
import { formatCurrency, formatDate } from '../components/icons/formatters';
import { PencilSquareIcon } from '../components/icons/PencilSquareIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { HistoryFilterCard } from '../components/HistoryFilterCard';

type DateFilter = 'all' | '7d' | '30d' | '6m' | '1y';

interface ExpenseItemProps {
  expense: Expense;
  accounts: Account[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onInteractionChange: (isInteracting: boolean) => void;
  onNavigateHome: () => void;
}

const ACTION_WIDTH = 144; // 9rem in pixels (w-36)

const ExpenseItem: React.FC<ExpenseItemProps> = ({ expense, accounts, onEdit, onDelete, isOpen, onOpen, onInteractionChange, onNavigateHome }) => {
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
    });
    
    const getTranslateX = (element: HTMLElement | null): number => {
      if (!element) return 0;
      const style = window.getComputedStyle(element);
      const matrix = new DOMMatrix(style.transform);
      return matrix.m41;
    };

    const setTranslateX = useCallback((x: number, animated: boolean) => {
        if (itemRef.current) {
            itemRef.current.style.transition = animated ? 'transform 0.2s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none';
            itemRef.current.style.transform = `translateX(${x}px)`;
        }
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        
        const currentTranslateX = getTranslateX(itemRef.current);
        dragState.current = {
            isDragging: true,
            isLocked: false,
            startX: e.clientX,
            startY: e.clientY,
            startTime: performance.now(),
            initialTranslateX: currentTranslateX,
        };
        
        setTranslateX(currentTranslateX, false);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragState.current.isDragging) return;

        const deltaX = e.clientX - dragState.current.startX;
        const deltaY = e.clientY - dragState.current.startY;

        if (!dragState.current.isLocked) {
          const SLOP = 5;
          if (Math.abs(deltaX) <= SLOP && Math.abs(deltaY) <= SLOP) {
            return;
          }

          const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);

          if (isHorizontal) {
            dragState.current.isLocked = true;
            onInteractionChange(true);
            e.stopPropagation();
            try { itemRef.current?.setPointerCapture(e.pointerId); } catch {}
          } else {
            dragState.current.isDragging = false;
            return;
          }
        }
        
        if (dragState.current.isLocked) {
            e.stopPropagation();
            let newX = dragState.current.initialTranslateX + deltaX;

            // Clamp the translation to prevent overshooting to the right
            if (newX > 0) newX = 0;
            if (newX < -ACTION_WIDTH) newX = -ACTION_WIDTH - Math.tanh((-newX - ACTION_WIDTH) / 50) * 25;

            setTranslateX(newX, false);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!dragState.current.isDragging) return;
    
        const wasLocked = dragState.current.isLocked;
    
        dragState.current.isDragging = false;
        dragState.current.isLocked = false;
    
        if (wasLocked) {
            onInteractionChange(false);
            try { itemRef.current?.releasePointerCapture(e.pointerId); } catch {}
    
            const elapsed = performance.now() - dragState.current.startTime;
            const deltaX = e.clientX - dragState.current.startX;
            const velocityX = elapsed > 10 ? deltaX / elapsed : 0;
            
            const wasClosed = dragState.current.initialTranslateX === 0;

            const isConfirmedRightSwipe = (deltaX > ACTION_WIDTH / 2) || (velocityX > 0.4 && deltaX > 20);
            if (wasClosed && isConfirmedRightSwipe) {
                onNavigateHome();
                return;
            }
    
            const wasOpen = !wasClosed;
            let shouldOpen: boolean;
    
            const flickedRight = velocityX > 0.2 && deltaX > 15;
            const draggedFarRight = deltaX > ACTION_WIDTH * 0.4;
            const flickedLeft = velocityX < -0.2 && deltaX < -15;
            const draggedFarLeft = deltaX < -ACTION_WIDTH * 0.4;
    
            if (wasOpen) {
                shouldOpen = !(flickedRight || draggedFarRight);
            } else {
                shouldOpen = flickedLeft || draggedFarLeft;
            }
            
            if (shouldOpen === isOpen) {
                setTranslateX(shouldOpen ? -ACTION_WIDTH : 0, true);
            } else {
                onOpen(shouldOpen ? expense.id : '');
            }
        }
    };
    
    useEffect(() => {
        if (!dragState.current.isDragging) {
            setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
        }
    }, [isOpen, setTranslateX]);

    return (
        <div data-expense-item-root className="relative bg-white overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Actions Layer (underneath) */}
            <div className="absolute top-0 right-0 h-full flex items-center z-0">
                <button
                    onPointerDown={(e) => e.preventDefault()}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      onEdit(expense);
                    }}
                    className="w-[72px] h-full flex flex-col items-center justify-center bg-indigo-500 text-white hover:bg-indigo-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                    aria-label="Modifica spesa"
                >
                    <PencilSquareIcon className="w-6 h-6" />
                    <span className="text-xs mt-1">Modifica</span>
                </button>
                <button
                    onPointerDown={(e) => e.preventDefault()}
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
            
            {/* Content Layer (swipeable) */}
            <div
                ref={itemRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                data-swipeable-item="true"
                className="relative flex items-center gap-4 py-3 px-4 bg-white z-10"
                style={{ touchAction: 'pan-y' }}
            >
                <span className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${style.bgColor}`}>
                    <style.Icon className={`w-6 h-6 ${style.color}`} />
                </span>
                <div className="flex-grow min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{expense.subcategory || style.label} • {accountName}</p>
                    <p className="text-sm text-slate-500 truncate" title={expense.description}>{expense.description || 'Senza descrizione'}</p>
                </div>
                <p className="font-bold text-slate-900 text-lg text-right shrink-0 whitespace-nowrap min-w-[90px]">{formatCurrency(Number(expense.amount) || 0)}</p>
            </div>
        </div>
    );
};

interface HistoryScreenProps {
  expenses: Expense[];
  accounts: Account[];
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onItemStateChange: (state: { isOpen: boolean, isInteracting: boolean }) => void;
  isEditingOrDeleting: boolean;
  onNavigateHome: () => void;
}

interface HistoryScreenHandles {
  closeOpenItem: () => void;
}

// Helper per ottenere l'anno e il numero della settimana ISO 8601
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
        if (week === currentWeek) return "Questa Settimana";
        if (week === currentWeek - 1) return "Settimana Scorsa";
    }

    return `Settimana ${week}, ${year}`;
};


const HistoryScreen = forwardRef<HistoryScreenHandles, HistoryScreenProps>(({ expenses, accounts, onEditExpense, onDeleteExpense, onItemStateChange, isEditingOrDeleting, onNavigateHome }, ref) => {
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');
    const [customRange, setCustomRange] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });
    const [openItemId, setOpenItemId] = useState<string | null>(null);
    const [isInteracting, setIsInteracting] = useState(false);
    const autoCloseTimerRef = useRef<number | null>(null);
    const tapStartRef = useRef<{ x: number; y: number } | null>(null);

    useImperativeHandle(ref, () => ({
      closeOpenItem: () => {
        setOpenItemId(null);
      }
    }));

    useEffect(() => {
        onItemStateChange({ isOpen: openItemId !== null, isInteracting });
    }, [openItemId, isInteracting, onItemStateChange]);

    // Effetto per la chiusura automatica
    useEffect(() => {
        if (autoCloseTimerRef.current) {
            clearTimeout(autoCloseTimerRef.current);
        }
        if (openItemId && !isEditingOrDeleting) {
            autoCloseTimerRef.current = window.setTimeout(() => {
                setOpenItemId(null);
            }, 5000);
        }
        return () => {
            if (autoCloseTimerRef.current) {
                clearTimeout(autoCloseTimerRef.current);
            }
        };
    }, [openItemId, isEditingOrDeleting]);

    const isCustomRangeActive = customRange.start !== null && customRange.end !== null;
    
    const filteredExpenses = useMemo(() => {
        if (isCustomRangeActive) {
             const startTime = new Date(customRange.start!).getTime();
             // Add one day minus one millisecond to include the entire end day
             const endTime = new Date(customRange.end!).getTime() + (24 * 60 * 60 * 1000 - 1);

             return expenses.filter(e => {
                const expenseDate = new Date(e.date);
                if (isNaN(expenseDate.getTime())) return false;
                const expenseTime = expenseDate.getTime();
                return expenseTime >= startTime && expenseTime <= endTime;
             });
        }
        
        if (dateFilter === 'all') {
            return expenses;
        }

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

        const startTime = startDate.getTime();

        return expenses.filter(e => {
            const expenseDate = new Date(e.date);
            return !isNaN(expenseDate.getTime()) && expenseDate.getTime() >= startTime;
        });
    }, [expenses, dateFilter, customRange, isCustomRangeActive]);

    const historyData = useMemo(() => {
        const sortedExpenses = [...filteredExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const weeklyGroups: Record<string, Expense[]> = sortedExpenses.reduce((acc, expense) => {
            const date = new Date(expense.date);
            if (isNaN(date.getTime())) return acc;
            const [year, week] = getISOWeek(date);
            const weekKey = `${year}-${String(week).padStart(2, '0')}`;
            if (!acc[weekKey]) acc[weekKey] = [];
            acc[weekKey].push(expense);
            return acc;
        }, {} as Record<string, Expense[]>);

        return Object.entries(weeklyGroups).map(([weekKey, weekExpenses]) => {
            const [yearStr, weekStr] = weekKey.split('-');
            const year = parseInt(yearStr);
            const week = parseInt(weekStr);
            
            const weekTotal = weekExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
            const weekLabel = getWeekLabel(year, week);
            
            const dailyGroups: Record<string, Expense[]> = weekExpenses.reduce((acc, expense) => {
                if (!acc[expense.date]) acc[expense.date] = [];
                acc[expense.date].push(expense);
                return acc;
            }, {} as Record<string, Expense[]>);
            
            const days = Object.entries(dailyGroups)
              .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
              .map(([date, items]) => ({
                date,
                dailyTotal: items.reduce((sum, item) => sum + Number(item.amount), 0),
                items,
            }));
            
            return { weekKey, weekLabel, weekTotal, days };
        });
    }, [filteredExpenses]);
    
    const handleSelectQuickFilter = (filter: DateFilter) => {
        setDateFilter(filter);
        setCustomRange({ start: null, end: null });
    };

    const handleCustomRangeChange = (range: { start: string, end: string }) => {
        setCustomRange(range);
        setDateFilter('all');
    };
    
    const handleItemOpen = useCallback((id: string) => {
        setOpenItemId(id || null);
    }, []);

    const noExpensesMessage = (dateFilter === 'all' && !isCustomRangeActive) 
    ? {
        title: 'Nessuna spesa registrata.',
        subtitle: 'Aggiungi una nuova spesa per iniziare il tuo storico.'
      }
    : {
        title: 'Nessuna spesa trovata.',
        subtitle: 'Prova a selezionare un periodo di tempo diverso.'
    };

    const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        tapStartRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleContainerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (tapStartRef.current) {
            const dx = Math.abs(e.clientX - tapStartRef.current.x);
            const dy = Math.abs(e.clientY - tapStartRef.current.y);
            const isTap = dx < 5 && dy < 5;

            if (isTap && openItemId) {
                const isClickInsideAnItem = (e.target as HTMLElement).closest('[data-expense-item-root]');
                if (!isClickInsideAnItem) {
                    setOpenItemId(null);
                }
            }
        }
        tapStartRef.current = null;
    };


    return (
        <div className="h-full flex flex-col animate-fade-in-up">
            <div className="flex-shrink-0 pt-4 md:pt-8">
                <div className="mb-6 px-4 md:px-8">
                    <h1 className="text-xl font-bold text-slate-700">Storico Spese</h1>
                </div>
            </div>

            <div 
              className="flex-1 overflow-y-auto pb-28" 
              style={{ touchAction: 'pan-y' }}
              onPointerDownCapture={handleContainerPointerDown}
              onPointerUp={handleContainerPointerUp}
            >
                {historyData.length > 0 ? (
                    <div className="space-y-6">
                        {historyData.map(({ weekKey, weekLabel, weekTotal, days }) => (
                            <div key={weekKey}>
                                <div className="p-4 flex justify-between items-baseline bg-slate-100 border-b border-slate-200 sticky top-0 z-10">
                                    <h2 className="text-xl font-bold text-slate-700 capitalize">{weekLabel}</h2>
                                    <p className="text-lg font-semibold text-indigo-600">{formatCurrency(weekTotal)}</p>
                                </div>
                                
                                <div className="bg-white">
                                    {days.map(({ date, dailyTotal, items }) => (
                                        <div key={date} className="p-2">
                                            <div className="flex justify-between items-center py-2 px-2">
                                                <p className="font-semibold text-slate-600">
                                                    {formatDate(new Date(date))}
                                                </p>
                                                <p className="text-sm font-medium text-slate-500">{formatCurrency(dailyTotal)}</p>
                                            </div>
                                            <div className="divide-y divide-slate-200">
                                                {items.map(expense => (
                                                    <ExpenseItem
                                                        key={expense.id}
                                                        expense={expense}
                                                        accounts={accounts}
                                                        onEdit={onEditExpense}
                                                        onDelete={onDeleteExpense}
                                                        isOpen={openItemId === expense.id}
                                                        onOpen={handleItemOpen}
                                                        onInteractionChange={setIsInteracting}
                                                        onNavigateHome={onNavigateHome}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-slate-500 py-20 bg-white rounded-2xl shadow-lg mx-4 md:mx-8">
                        <p className="text-lg">{noExpensesMessage.title}</p>
                        <p className="text-sm mt-2">{noExpensesMessage.subtitle}</p>
                    </div>
                )}
            </div>
            
            <HistoryFilterCard
                onSelectQuickFilter={handleSelectQuickFilter}
                currentQuickFilter={dateFilter}
                onCustomRangeChange={handleCustomRangeChange}
                currentCustomRange={customRange}
                isCustomRangeActive={isCustomRangeActive}
            />
        </div>
    );
});

export default HistoryScreen;