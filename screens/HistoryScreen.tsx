import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
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

const ACTION_WIDTH = 72; // w-[72px] for delete button

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

    const setTranslateX = useCallback((x: number, animated: boolean) => {
        if (itemRef.current) {
            itemRef.current.style.transition = animated ? 'transform 0.2s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none';
            itemRef.current.style.transform = `translateX(${x}px)`;
        }
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button') || !itemRef.current) return;
        
        const transform = window.getComputedStyle(itemRef.current).transform;
        const currentTranslateX = new DOMMatrixReadOnly(transform).m41;
        
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
          const SLOP = 10;
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

            if (newX > 0) newX = 0;
            if (newX < -ACTION_WIDTH) newX = -ACTION_WIDTH - Math.tanh((-newX - ACTION_WIDTH) / 50) * 25;

            setTranslateX(newX, false);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!dragState.current.isDragging || !itemRef.current) return;
    
        const wasLocked = dragState.current.isLocked;
        const deltaX = e.clientX - dragState.current.startX;
        const deltaY = e.clientY - dragState.current.startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const elapsed = performance.now() - dragState.current.startTime;
        const isTap = distance < 12 && elapsed < 250;
    
        // Reset dragging state immediately
        dragState.current.isDragging = false;
        dragState.current.isLocked = false;
        if (wasLocked) {
            onInteractionChange(false);
            try { itemRef.current?.releasePointerCapture(e.pointerId); } catch {}
        }
    
        const wasOpen = Math.abs(dragState.current.initialTranslateX) > 1;
    
        // 1. Handle Tap Interaction
        if (isTap) {
            e.preventDefault();
            e.stopPropagation();
            if (wasOpen) {
                onOpen(''); // Close menu on tap if it was open
            } else {
                onEdit(expense); // Open edit modal on tap if it was closed
            }
            return;
        }
    
        // 2. Handle Swipe Interaction (only if it was locked)
        if (wasLocked) {
            e.stopPropagation();
            
            const transform = window.getComputedStyle(itemRef.current).transform;
            const finalTranslateX = new DOMMatrixReadOnly(transform).m41;
    
            // Check for right swipe to navigate home
            if (!wasOpen && deltaX > ACTION_WIDTH * 0.75) {
                 onNavigateHome();
                 onOpen(''); 
                 return;
            }
    
            // Decision is purely based on how much the item is revealed
            const shouldOpen = finalTranslateX < -ACTION_WIDTH / 2;
            onOpen(shouldOpen ? expense.id : '');
        }
    };
    
    useEffect(() => {
        if (!dragState.current.isDragging) {
            setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
        }
    }, [isOpen, setTranslateX]);

    return (
        <div data-expense-item-root className="relative bg-white overflow-hidden">
            {/* Actions Layer (underneath) */}
            <div className="absolute top-0 right-0 h-full flex items-center z-0">
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
  isActive: boolean;
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
        if (week === currentWeek) return "Questa Settimana";
        if (week === currentWeek - 1) return "Settimana Scorsa";
    }

    return `Settimana ${week}, ${year}`;
};


const HistoryScreen: React.FC<HistoryScreenProps> = ({ expenses, accounts, onEditExpense, onDeleteExpense, onItemStateChange, isEditingOrDeleting, onNavigateHome, isActive }) => {
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');
    const [customRange, setCustomRange] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });
    const [openItemId, setOpenItemId] = useState<string | null>(null);
    const [isInteracting, setIsInteracting] = useState(false);
    const autoCloseTimerRef = useRef<number | null>(null);


    useEffect(() => {
        if (!isActive) {
            setOpenItemId(null);
        }
    }, [isActive]);

    useEffect(() => {
        onItemStateChange({ isOpen: openItemId !== null, isInteracting });
    }, [openItemId, isInteracting, onItemStateChange]);

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

    const groupedExpenses = useMemo(() => {
        const sortedExpenses = [...filteredExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
        return sortedExpenses.reduce<Record<string, ExpenseGroup>>((acc, expense) => {
            const expenseDate = new Date(expense.date);
            if (isNaN(expenseDate.getTime())) return acc;
    
            const [year, week] = getISOWeek(expenseDate);
            const key = `${year}-${week}`;
    
            if (!acc[key]) {
                acc[key] = {
                    year,
                    week,
                    label: getWeekLabel(year, week),
                    expenses: []
                };
            }
            acc[key].expenses.push(expense);
            return acc;
        }, {} as Record<string, ExpenseGroup>);
    }, [filteredExpenses]);

    const expenseGroups = (Object.values(groupedExpenses) as ExpenseGroup[]).sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.week - a.week;
    });
    
    const handleOpenItem = (id: string) => {
        setOpenItemId(id);
    };
    
    const handleInteractionChange = (isInteracting: boolean) => {
        setIsInteracting(isInteracting);
    };
    
    return (
        <div 
            className="h-full flex flex-col bg-slate-100"
        >
            <div className="flex-1 overflow-y-auto" style={{ touchAction: 'pan-y' }}>
                {expenseGroups.length > 0 ? (
                    expenseGroups.map(group => (
                        <div key={group.label} className="mb-6 last:mb-0">
                            <h2 className="font-bold text-slate-800 text-lg px-4 py-2 sticky top-0 bg-slate-100/80 backdrop-blur-sm z-10">{group.label}</h2>
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
                onSelectQuickFilter={(value) => {
                    setDateFilter(value);
                    setCustomRange({ start: null, end: null });
                }}
                currentQuickFilter={dateFilter}
                onCustomRangeChange={(range) => {
                    setCustomRange(range);
                    setDateFilter('all');
                }}
                currentCustomRange={customRange}
                isCustomRangeActive={isCustomRangeActive}
            />
        </div>
    );
};

export default HistoryScreen;