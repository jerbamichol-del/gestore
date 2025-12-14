
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Expense, Account } from '../types';
import { getCategoryStyle } from '../utils/categoryStyles';
import { getAccountIcon } from '../utils/accountIcons';
import { formatCurrency } from '../components/icons/formatters';
import { TrashIcon } from '../components/icons/TrashIcon';
import { HistoryFilterCard } from '../components/HistoryFilterCard';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { CheckIcon } from '../components/icons/CheckIcon';
import { ArrowsUpDownIcon } from '../components/icons/ArrowsUpDownIcon';
import { parseLocalYYYYMMDD } from '../utils/date';
import ConfirmationModal from '../components/ConfirmationModal';
import { useTapBridge } from '../hooks/useTapBridge';

type DateFilter = 'all' | '7d' | '30d' | '6m' | '1y';
type PeriodType = 'day' | 'week' | 'month' | 'year';
type ActiveFilterMode = 'quick' | 'period' | 'custom';
type SortOption = 'date' | 'amount-desc' | 'amount-asc' | 'category';

interface ExpenseItemProps {
  expense: Expense;
  accounts: Account[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
  isOpen: boolean;
  onOpen: (id: string) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onLongPress: (id: string) => void;
  isIncomeMode: boolean;
}

const ACTION_WIDTH = 72;

const ExpenseItem: React.FC<ExpenseItemProps> = ({
  expense, accounts, onEdit, onDelete, isOpen, onOpen, isSelectionMode, isSelected, onToggleSelection, onLongPress, isIncomeMode,
}) => {
  const style = getCategoryStyle(expense.category);
  const account = accounts.find((a) => a.id === expense.accountId);
  const accountName = account?.name || 'Sconosciuto';
  const iconKey = account ? (['paypal', 'crypto', 'revolut', 'poste'].includes(account.id) ? account.id : (account.icon || account.id)) : 'default';
  const AccountIcon = isIncomeMode ? getAccountIcon(iconKey) : null;
  const itemRef = useRef<HTMLDivElement>(null);
  const tapBridge = useTapBridge();
  const isRecurringInstance = !!expense.recurringExpenseId;
  const isAdjustment = expense.type === 'adjustment';
  const itemBgClass = isSelected ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : isRecurringInstance ? 'bg-amber-50' : isAdjustment ? 'bg-slate-50 opacity-90' : 'bg-white';
  const longPressTimer = useRef<number | null>(null);

  const handlePointerDownItem = (e: React.PointerEvent) => {
    if (isSelectionMode) return; 
    longPressTimer.current = window.setTimeout(() => {
        onLongPress(expense.id);
        if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const cancelLongPress = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const dragState = useRef({
    isDragging: false, isLocked: false, startX: 0, startY: 0, startTime: 0, initialTranslateX: 0, pointerId: null as number | null, wasHorizontal: false,
  });

  const setTranslateX = useCallback((x: number, animated: boolean) => {
    if (!itemRef.current) return;
    itemRef.current.style.transition = animated ? 'transform 0.2s cubic-bezier(0.22,0.61,0.36,1)' : 'none';
    itemRef.current.style.transform = `translateX(${x}px)`;
  }, []);

  useEffect(() => {
    if (!dragState.current.isDragging) {
      setTranslateX(isOpen && !isSelectionMode ? -ACTION_WIDTH : 0, true);
    }
  }, [isOpen, isSelectionMode, setTranslateX]);

  const handlePointerDown = (e: React.PointerEvent) => {
    handlePointerDownItem(e);
    if ((e.target as HTMLElement).closest('button') || !itemRef.current) return;
    if (isSelectionMode) return;
    itemRef.current.style.transition = 'none';
    const m = new DOMMatrixReadOnly(window.getComputedStyle(itemRef.current).transform);
    dragState.current = { isDragging: false, isLocked: false, startX: e.clientX, startY: e.clientY, startTime: performance.now(), initialTranslateX: m.m41, pointerId: e.pointerId, wasHorizontal: false };
    try { itemRef.current.setPointerCapture(e.pointerId); } catch (err) { console.warn('Could not capture pointer: ', err); }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const ds = dragState.current;
    if (longPressTimer.current) {
        const dist = Math.hypot(e.clientX - ds.startX, e.clientY - ds.startY);
        if (dist > 10) cancelLongPress();
    }
    if (ds.pointerId !== e.pointerId) return;
    if (isSelectionMode) return; 
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (!ds.isDragging) {
      if (Math.hypot(dx, dy) > 8) {
        ds.isDragging = true;
        ds.isLocked = Math.abs(dx) > Math.abs(dy) * 2;
        if (!ds.isLocked) {
          if (ds.pointerId !== null) itemRef.current?.releasePointerCapture(ds.pointerId);
          ds.pointerId = null;
          ds.isDragging = false;
          return;
        } else { e.stopPropagation(); }
      } else { return; }
    }
    if (ds.isDragging && ds.isLocked) {
      ds.wasHorizontal = true;
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      let x = ds.initialTranslateX + dx;
      if (x > 0) x = 0;
      if (x < -ACTION_WIDTH) x = -ACTION_WIDTH;
      setTranslateX(x, false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    cancelLongPress();
    const ds = dragState.current;
    if (ds.pointerId !== e.pointerId) return;
    if (ds.pointerId !== null) itemRef.current?.releasePointerCapture(ds.pointerId);
    const wasDragging = ds.isDragging;
    const wasHorizontal = ds.wasHorizontal;
    ds.isDragging = false;
    ds.pointerId = null;
    if (wasDragging && wasHorizontal) {
      const duration = performance.now() - ds.startTime;
      const dx = e.clientX - ds.startX;
      const endX = new DOMMatrixReadOnly(window.getComputedStyle(itemRef.current!).transform).m41;
      const velocity = dx / (duration || 1);
      const shouldOpen = endX < -ACTION_WIDTH / 2 || (velocity < -0.3 && dx < -20);
      onOpen(shouldOpen ? expense.id : '');
      setTranslateX(shouldOpen ? -ACTION_WIDTH : 0, true);
    }
    setTimeout(() => { dragState.current.wasHorizontal = false; }, 0);
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    cancelLongPress();
    const ds = dragState.current;
    if (ds.pointerId !== e.pointerId) return;
    if (ds.pointerId !== null) itemRef.current?.releasePointerCapture(ds.pointerId);
    ds.isDragging = false;
    ds.isLocked = false;
    ds.pointerId = null;
    ds.wasHorizontal = false;
    setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dragState.current.isDragging || dragState.current.wasHorizontal) return;
    if (isSelectionMode) { onToggleSelection(expense.id); } else if (isOpen) { onOpen(''); } else { onEdit(expense); }
  };

  const renderIcon = () => {
      if (isSelected) return <span className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center bg-indigo-600 text-white transition-transform duration-200 transform scale-100"><CheckIcon className="w-6 h-6" strokeWidth={3} /></span>;
      if (isAdjustment) return <span className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center bg-slate-200 text-slate-500"><ArrowsUpDownIcon className="w-6 h-6" /></span>;
      if (isIncomeMode && AccountIcon) return <AccountIcon className="w-10 h-10 text-green-600 flex-shrink-0 transition-transform duration-200" />;
      return <style.Icon className="w-10 h-10 flex-shrink-0 transition-transform duration-200" />;
  };

  const renderAmount = () => {
      const amt = Number(expense.amount) || 0;
      if (isAdjustment) return <span className={`font-bold text-lg text-right shrink-0 whitespace-nowrap min-w-[90px] ${isSelected ? 'text-indigo-900' : 'text-slate-500'}`}>{formatCurrency(amt)}</span>;
      return <p className={`font-bold text-lg text-right shrink-0 whitespace-nowrap min-w-[90px] ${isSelected ? 'text-indigo-900' : isIncomeMode ? 'text-green-600' : 'text-slate-900'}`}>{isIncomeMode ? '+' : ''}{formatCurrency(amt)}</p>;
  };

  return (
    <div className={`relative ${itemBgClass} overflow-hidden transition-colors duration-200 select-none`}>
      <div className="absolute top-0 right-0 h-full flex items-center z-0">
        <button onClick={() => onDelete(expense.id)} className="w-[72px] h-full flex flex-col items-center justify-center bg-red-600 text-white text-xs font-semibold focus:outline-none focus:visible:ring-2 focus:visible:ring-inset focus:visible:ring-white" aria-label="Elimina spesa" {...tapBridge}><TrashIcon className="w-6 h-6" /><span className="text-xs mt-1">Elimina</span></button>
      </div>
      <div ref={itemRef} data-expense-swipe="1" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel} onClick={handleClick} className={`relative flex items-center gap-4 py-3 px-4 ${itemBgClass} z-10 cursor-pointer transition-colors duration-200 select-none`} style={{ touchAction: 'pan-y' }}>
        {isRecurringInstance && !isSelectionMode && !isAdjustment && (<span className="absolute top-1.5 right-1.5 w-5 h-5 text-slate-900 bg-amber-100 border border-amber-400 text-[10px] font-bold rounded-full flex items-center justify-center z-20" title="Spesa Programmata">P</span>)}
        {renderIcon()}
        <div className="flex-grow min-w-0"><p className={`font-semibold truncate ${isSelected ? 'text-indigo-900' : isAdjustment ? 'text-slate-600' : 'text-slate-800'}`}>{isAdjustment ? 'Rettifica Saldo' : isIncomeMode ? accountName : `${expense.subcategory || style.label} • ${accountName}`}</p><p className={`text-sm truncate ${isSelected ? 'text-indigo-700' : 'text-slate-500'}`} title={expense.description}>{expense.description || 'Senza descrizione'}</p></div>
        {renderAmount()}
      </div>
    </div>
  );
};

interface HistoryScreenProps {
  expenses: Expense[];
  accounts: Account[];
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onDeleteExpenses: (ids: string[]) => void; 
  isEditingOrDeleting: boolean;
  onDateModalStateChange: (isOpen: boolean) => void;
  onClose: () => void;
  onCloseStart?: () => void; 
  onFilterPanelOpenStateChange: (isOpen: boolean) => void;
  isOverlayed: boolean;
  filterType?: 'expense' | 'income'; 
}

interface ExpenseGroup { year: number; week: number; label: string; dateRange: string; expenses: Expense[]; total: number; }

const getISOWeek = (date: Date): [number, number] => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return [d.getUTCFullYear(), Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)];
};

const getWeekDateRangeLabel = (year: number, week: number) => {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const startOfWeek = new Date(jan4);
  startOfWeek.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (week - 1) * 7);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
  const fmt = (d: Date) => {
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = d.toLocaleString('it-IT', { month: 'short', timeZone: 'UTC' }).replace('.', '');
    return `${day}${month}`;
  };
  return `(${fmt(startOfWeek)}-${fmt(endOfWeek)} ${year})`;
};

const getWeekLabel = (y: number, w: number) => {
  const now = new Date();
  const [cy, cw] = getISOWeek(now);
  if (y === cy) { if (w === cw) return 'Questa Settimana'; if (w === cw - 1) return 'Settimana Scorsa'; }
  return `Settimana ${w}`;
};

const HistoryScreen: React.FC<HistoryScreenProps> = ({ expenses, accounts, onEditExpense, onDeleteExpense, onDeleteExpenses, isEditingOrDeleting, onDateModalStateChange, onClose, onCloseStart, onFilterPanelOpenStateChange, isOverlayed, filterType = 'expense' }) => {
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const tapBridge = useTapBridge();
  const isIncomeMode = filterType === 'income';
  const [activeFilterMode, setActiveFilterMode] = useState<ActiveFilterMode>('quick');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customRange, setCustomRange] = useState<{ start: string | null; end: string | null; }>({ start: null, end: null });
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [periodDate, setPeriodDate] = useState<Date>(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [filterAccount, setFilterAccount] = useState<string | null>(null);
  const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());
  const [filterDescription, setFilterDescription] = useState('');
  const [filterAmountRange, setFilterAmountRange] = useState<{ min: string; max: string }>({ min: '', max: '' });
  const [sortOption, setSortOption] = useState<SortOption>('date');
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [isInternalDateModalOpen, setIsInternalDateModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const autoCloseRef = useRef<number | null>(null);
  const prevOpRef = useRef(isEditingOrDeleting);
  const isSelectionMode = selectedIds.size > 0;

  useEffect(() => { const timer = setTimeout(() => setIsAnimatingIn(true), 10); return () => clearTimeout(timer); }, []);
  const handleClose = () => { setOpenItemId(null); if (onCloseStart) onCloseStart(); setIsAnimatingIn(false); setTimeout(onClose, 300); };
  const handleDateModalStateChange = useCallback((isOpen: boolean) => { setIsInternalDateModalOpen(isOpen); onDateModalStateChange(isOpen); }, [onDateModalStateChange]);
  
  useEffect(() => { if (prevOpRef.current && !isEditingOrDeleting) { setOpenItemId(null); } prevOpRef.current = isEditingOrDeleting; }, [isEditingOrDeleting]);
  useEffect(() => { if (!isAnimatingIn) { setOpenItemId(null); } }, [isAnimatingIn]);
  useEffect(() => { if (autoCloseRef.current) clearTimeout(autoCloseRef.current); if (openItemId && !isEditingOrDeleting) { autoCloseRef.current = window.setTimeout(() => setOpenItemId(null), 5000); } return () => { if (autoCloseRef.current) clearTimeout(autoCloseRef.current); }; }, [openItemId, isEditingOrDeleting]);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (isSortMenuOpen && sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node) && sortButtonRef.current && !sortButtonRef.current.contains(event.target as Node)) {
            setIsSortMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSortMenuOpen]);

  const filteredExpenses = useMemo(() => {
    let result = (expenses || []).filter(e => {
        if (filterType === 'income') return e.type === 'income';
        if (filterType === 'expense') return e.type === 'expense';
        return true;
    });

    if (activeFilterMode === 'period') {
      const start = new Date(periodDate); start.setHours(0, 0, 0, 0);
      const end = new Date(periodDate); end.setHours(23, 59, 59, 999);
      switch (periodType) {
        case 'week': { const day = start.getDay(); const diff = start.getDate() - day + (day === 0 ? -6 : 1); start.setDate(diff); end.setDate(start.getDate() + 6); break; }
        case 'month': start.setDate(1); end.setMonth(end.getMonth() + 1); end.setDate(0); break;
        case 'year': start.setMonth(0, 1); end.setFullYear(end.getFullYear() + 1); end.setMonth(0, 0); break;
      }
      const t0 = start.getTime(); const t1 = end.getTime();
      result = result.filter((e) => { const d = parseLocalYYYYMMDD(e.date); if (isNaN(d.getTime())) return false; const t = d.getTime(); return t >= t0 && t <= t1; });
    } else if (activeFilterMode === 'custom' && customRange.start && customRange.end) {
      const t0 = parseLocalYYYYMMDD(customRange.start).getTime();
      const endDay = parseLocalYYYYMMDD(customRange.end); endDay.setDate(endDay.getDate() + 1); const t1 = endDay.getTime();
      result = result.filter((e) => { const d = parseLocalYYYYMMDD(e.date); if (isNaN(d.getTime())) return false; const t = d.getTime(); return t >= t0 && t < t1; });
    } else if (dateFilter !== 'all') {
      const startDate = new Date(); startDate.setHours(0, 0, 0, 0);
      switch (dateFilter) {
        case '7d': startDate.setDate(startDate.getDate() - 6); break;
        case '30d': startDate.setDate(startDate.getDate() - 29); break;
        case '6m': startDate.setMonth(startDate.getMonth() - 6); break;
        case '1y': startDate.setFullYear(startDate.getFullYear() - 1); break;
      }
      const t0 = startDate.getTime();
      result = result.filter((e) => { const d = parseLocalYYYYMMDD(e.date); return !isNaN(d.getTime()) && d.getTime() >= t0; });
    }

    if (filterAccount) result = result.filter(e => e.accountId === filterAccount);
    if (filterCategories.size > 0) result = result.filter(e => { const whole = e.category; const sub = `${e.category}:${e.subcategory || ''}`; return filterCategories.has(whole) || (e.subcategory && filterCategories.has(sub)); });
    if (filterDescription.trim()) { const q = filterDescription.toLowerCase(); result = result.filter(e => (e.description || '').toLowerCase().includes(q)); }
    if (filterAmountRange.min) { const min = parseFloat(filterAmountRange.min); if (!isNaN(min)) result = result.filter(e => Math.abs(e.amount) >= min); }
    if (filterAmountRange.max) { const max = parseFloat(filterAmountRange.max); if (!isNaN(max)) result = result.filter(e => Math.abs(e.amount) <= max); }

    return result;
  }, [expenses, activeFilterMode, dateFilter, customRange, periodType, periodDate, filterAccount, filterCategories, filterDescription, filterAmountRange, filterType]);

  const groupedExpenses = useMemo(() => {
    const sorted = [...(filteredExpenses || [])].sort((a, b) => {
        if (sortOption === 'amount-desc') return Math.abs(b.amount) - Math.abs(a.amount);
        if (sortOption === 'amount-asc') return Math.abs(a.amount) - Math.abs(b.amount);
        if (sortOption === 'category') return a.category.localeCompare(b.category);
        const db = parseLocalYYYYMMDD(b.date); const da = parseLocalYYYYMMDD(a.date);
        if (b.time) { const [h, m] = b.time.split(':').map(Number); if (!isNaN(h) && !isNaN(m)) db.setHours(h, m); }
        if (a.time) { const [h, m] = a.time.split(':').map(Number); if (!isNaN(h) && !isNaN(m)) da.setHours(h, m); }
        return db.getTime() - da.getTime();
    });

    if (sortOption !== 'date') {
        const total = sorted.reduce((acc, e) => { if (e.type === 'adjustment') return acc; return acc + (Number(e.amount) || 0); }, 0);
        let label = 'Tutte le transazioni'; if (sortOption === 'amount-desc') label = 'Per Importo (Decrescente)'; if (sortOption === 'amount-asc') label = 'Per Importo (Crescente)'; if (sortOption === 'category') label = 'Per Categoria';
        return { 'global': { year: 0, week: 0, label: label, dateRange: `${sorted.length} risultati`, expenses: sorted, total: total } };
    }

    return sorted.reduce<Record<string, ExpenseGroup>>((acc, e) => {
      const d = parseLocalYYYYMMDD(e.date); if (isNaN(d.getTime())) return acc;
      const [y, w] = getISOWeek(d); const key = `${y}-${w}`;
      if (!acc[key]) { acc[key] = { year: y, week: w, label: getWeekLabel(y, w), dateRange: getWeekDateRangeLabel(y, w), expenses: [], total: 0 }; }
      acc[key].expenses.push(e);
      if (e.type !== 'adjustment') acc[key].total += Number(e.amount) || 0;
      return acc;
    }, {});
  }, [filteredExpenses, sortOption]);

  const expenseGroups = (Object.values(groupedExpenses) as ExpenseGroup[]).sort((a, b) => (a.year !== b.year ? b.year - a.year : b.week - a.week));
  const handleOpenItem = (id: string) => setOpenItemId(id || null);
  const handleToggleCategoryFilter = (key: string) => { setFilterCategories(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; }); };
  const handleClearCategoryFilters = () => setFilterCategories(new Set());
  const handleLongPress = (id: string) => { setSelectedIds(new Set([id])); if (navigator.vibrate) navigator.vibrate(50); };
  const handleToggleSelection = (id: string) => { setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const handleCancelSelection = () => { setSelectedIds(new Set()); };
  const handleBulkDeleteClick = () => { if (selectedIds.size > 0) setIsBulkDeleteModalOpen(true); };
  const handleConfirmBulkDelete = () => { onDeleteExpenses(Array.from(selectedIds)); setIsBulkDeleteModalOpen(false); setSelectedIds(new Set()); };
  const handleSortOptionSelect = (value: 'date' | 'amount' | 'category') => { if (value === 'amount') { setSortOption(prev => prev === 'amount-desc' ? 'amount-asc' : 'amount-desc'); } else { setSortOption(value); } setIsSortMenuOpen(false); };

  return (
    <div className={`fixed inset-0 z-20 bg-slate-100 transform transition-transform duration-300 ease-in-out ${isAnimatingIn ? 'translate-y-0 pointer-events-auto' : 'translate-y-full pointer-events-none'}`} style={{ touchAction: 'pan-y', willChange: 'transform', visibility: isAnimatingIn ? 'visible' : 'hidden', transitionProperty: 'transform, visibility', transitionDuration: '300ms, 0s', transitionDelay: isAnimatingIn ? '0s, 0s' : '0s, 300ms' }} onClick={() => { if (openItemId) setOpenItemId(null); }} {...tapBridge}>
      <header className="sticky top-0 z-20 flex items-center gap-4 p-4 bg-white/80 backdrop-blur-sm shadow-sm h-[60px]">
        {isSelectionMode ? (
            <>
                <button onClick={handleCancelSelection} className="p-2 -ml-2 rounded-full hover:bg-slate-200 transition-colors text-slate-600" aria-label="Annulla selezione"><ArrowLeftIcon className="w-6 h-6" /></button>
                <h1 className="text-xl font-bold text-indigo-800 flex-1">{selectedIds.size} Selezionati</h1>
                <button onClick={handleBulkDeleteClick} className="p-2 rounded-full hover:bg-red-100 text-red-600 transition-colors" aria-label="Elimina selezionati"><TrashIcon className="w-6 h-6" /></button>
            </>
        ) : (
            <>
                <button onClick={handleClose} className="p-2 -ml-2 rounded-full hover:bg-slate-200 transition-colors" aria-label="Indietro"><ArrowLeftIcon className="w-6 h-6 text-slate-700" /></button>
                <h1 className="text-xl font-bold text-slate-800 flex-1">{isIncomeMode ? 'Storico Entrate' : 'Storico Spese'}</h1>
                <div className="relative">
                    <button ref={sortButtonRef} onClick={(e) => { e.stopPropagation(); setIsSortMenuOpen(!isSortMenuOpen); }} className={`p-2 rounded-full transition-colors ${sortOption !== 'date' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-200 text-slate-600'}`} aria-label="Ordina spese"><ArrowsUpDownIcon className="w-6 h-6" /></button>
                    {isSortMenuOpen && (
                        <div ref={sortMenuRef} className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up" style={{ animationDuration: '150ms' }} onPointerDown={(e) => e.stopPropagation()}>
                            <div className="py-1">
                                <button onClick={() => handleSortOptionSelect('amount')} className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center justify-between hover:bg-slate-50 ${(sortOption === 'amount-desc' || sortOption === 'amount-asc') ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}><span>Per Importo {sortOption === 'amount-asc' ? '(Crescente)' : '(Decrescente)'}</span>{(sortOption === 'amount-desc' || sortOption === 'amount-asc') && <CheckIcon className="w-4 h-4" />}</button>
                                <button onClick={() => handleSortOptionSelect('category')} className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center justify-between hover:bg-slate-50 ${sortOption === 'category' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}><span>Per Categoria</span>{sortOption === 'category' && <CheckIcon className="w-4 h-4" />}</button>
                                <div className="border-t border-slate-100 my-1"></div>
                                <button onClick={() => handleSortOptionSelect('date')} className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center justify-between hover:bg-slate-50 ${sortOption === 'date' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}><span>Per Data (Default)</span>{sortOption === 'date' && <CheckIcon className="w-4 h-4" />}</button>
                            </div>
                        </div>
                    )}
                </div>
            </>
        )}
      </header>

      <main className="overflow-y-auto h-[calc(100%-60px)]" style={{ touchAction: 'pan-y' }}>
        <div className="flex-1 overflow-y-auto pb-36" style={{ touchAction: 'pan-y' }}>
          {expenseGroups.length > 0 ? (
            expenseGroups.map((group) => (
              <div key={group.label} className="mb-6 last:mb-0">
                <div className="flex items-center justify-between font-bold text-slate-800 text-lg px-4 py-2 sticky top-0 bg-slate-100/80 backdrop-blur-sm z-10">
                  <h2 className="flex items-baseline flex-wrap gap-x-2"><span>{group.label}{group.label.startsWith('Settimana') && /\d/.test(group.label) ? ',' : ''}</span><span className="text-sm font-normal text-slate-500">{group.dateRange}</span></h2>
                  <p className={`font-bold text-xl ${isIncomeMode ? 'text-green-600' : 'text-indigo-600'}`}>{formatCurrency(group.total)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-md mx-2 overflow-hidden">
                  {group.expenses.map((expense, index) => (
                    <React.Fragment key={expense.id}>
                      {index > 0 && <hr className="border-t border-slate-200 ml-16" />}
                      <ExpenseItem expense={expense} accounts={accounts} onEdit={onEditExpense} onDelete={onDeleteExpense} isOpen={openItemId === expense.id} onOpen={handleOpenItem} isSelectionMode={isSelectionMode} isSelected={selectedIds.has(expense.id)} onToggleSelection={handleToggleSelection} onLongPress={handleLongPress} isIncomeMode={isIncomeMode} />
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-slate-500 pt-20 px-6">
              <p className="text-lg font-semibold">{isIncomeMode ? 'Nessuna entrata trovata' : 'Nessuna spesa trovata'}</p>
              <p className="mt-2">Prova a modificare i filtri o aggiungi una nuova {isIncomeMode ? 'entrata' : 'spesa'} dalla schermata Home.</p>
            </div>
          )}
        </div>
      </main>

      <HistoryFilterCard isActive={isAnimatingIn && !isInternalDateModalOpen && !isOverlayed && !isSelectionMode} onSelectQuickFilter={(value) => { setDateFilter(value); setActiveFilterMode('quick'); }} currentQuickFilter={dateFilter} onCustomRangeChange={(range) => { setCustomRange(range); setActiveFilterMode('custom'); }} currentCustomRange={customRange} isCustomRangeActive={activeFilterMode === 'custom'} onDateModalStateChange={handleDateModalStateChange} periodType={periodType} periodDate={periodDate} onSelectPeriodType={(type) => { setPeriodType(type); setPeriodDate(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }); setActiveFilterMode('period'); }} onSetPeriodDate={setPeriodDate} isPeriodFilterActive={activeFilterMode === 'period'} onActivatePeriodFilter={() => setActiveFilterMode('period')} onOpenStateChange={onFilterPanelOpenStateChange} accounts={accounts} selectedAccountId={filterAccount} selectedCategoryFilters={filterCategories} onToggleCategoryFilter={handleToggleCategoryFilter} onClearCategoryFilters={handleClearCategoryFilters} descriptionQuery={filterDescription} onDescriptionChange={setFilterDescription} amountRange={filterAmountRange} onAmountRangeChange={setFilterAmountRange} onSelectAccount={setFilterAccount} />
      <ConfirmationModal isOpen={isBulkDeleteModalOpen} onClose={() => setIsBulkDeleteModalOpen(false)} onConfirm={handleConfirmBulkDelete} title="Elimina Selezionati" message={`Sei sicuro di voler eliminare ${selectedIds.size} elementi? L'azione è irreversibile.`} variant="danger" confirmButtonText="Elimina" cancelButtonText="Annulla" />
    </div>
  );
};

export default HistoryScreen;
