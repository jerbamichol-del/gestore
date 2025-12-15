
import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Account, Expense } from '../types';
import { formatCurrency, formatDate } from '../components/icons/formatters';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { getAccountIcon } from '../utils/accountIcons';
import { CurrencyEuroIcon } from '../components/icons/CurrencyEuroIcon';
import { XMarkIcon } from '../components/icons/XMarkIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { ArrowRightIcon } from '../components/icons/ArrowRightIcon';
import { CheckIcon } from '../components/icons/CheckIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ArrowsUpDownIcon } from '../components/icons/ArrowsUpDownIcon';
import { parseLocalYYYYMMDD } from '../utils/date';
import { useTapBridge } from '../hooks/useTapBridge';
import ConfirmationModal from '../components/ConfirmationModal';

interface AccountsScreenProps {
  accounts: Account[];
  expenses: Expense[];
  onClose: () => void;
  onAddTransaction?: (expense: Omit<Expense, 'id'>) => void;
  onDeleteTransaction?: (id: string) => void;
  onDeleteTransactions?: (ids: string[]) => void;
}

// Separati i tipi per permettere la combinazione
type SortOption = 'date' | 'amount-desc' | 'amount-asc';
type FilterOption = 'all' | 'incoming' | 'outgoing';

const ACTION_WIDTH = 72;

// Componente riga swipeable interno
const SwipableTransferRow: React.FC<{
    transfer: Expense;
    isIncoming: boolean;
    otherAccountName: string;
    onDelete: (id: string) => void;
    onOpen: (id: string | null) => void;
    isOpen: boolean;
    isSelectionMode: boolean;
    isSelected: boolean;
    onToggleSelection: (id: string) => void;
    onLongPress: (id: string) => void;
}> = ({ transfer, isIncoming, otherAccountName, onDelete, onOpen, isOpen, isSelectionMode, isSelected, onToggleSelection, onLongPress }) => {
    const itemRef = useRef<HTMLDivElement>(null);
    const tapBridge = useTapBridge();
    const longPressTimer = useRef<number | null>(null);
    const dragState = useRef({
        isDragging: false,
        isLocked: false,
        startX: 0,
        startY: 0,
        startTime: 0,
        initialTranslateX: 0,
        pointerId: null as number | null,
        wasHorizontal: false
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
        if ((e.target as HTMLElement).closest('button') || !itemRef.current) return;
        
        if (!isSelectionMode) {
            longPressTimer.current = window.setTimeout(() => {
                onLongPress(transfer.id);
                if (navigator.vibrate) navigator.vibrate(50);
            }, 500);
        }

        if (isSelectionMode) return;

        itemRef.current.style.transition = 'none';
        const m = new DOMMatrixReadOnly(window.getComputedStyle(itemRef.current).transform);
        dragState.current = {
            isDragging: false,
            isLocked: false,
            startX: e.clientX,
            startY: e.clientY,
            startTime: performance.now(),
            initialTranslateX: m.m41,
            pointerId: e.pointerId,
            wasHorizontal: false
        };
        try { itemRef.current.setPointerCapture(e.pointerId); } catch (err) {}
    };

    const cancelLongPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
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
                } else {
                    e.stopPropagation();
                }
            } else {
                return;
            }
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
            
            onOpen(shouldOpen ? transfer.id : null);
            setTranslateX(shouldOpen ? -ACTION_WIDTH : 0, true);
        } else {
            setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
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
        setTranslateX(isOpen ? -ACTION_WIDTH : 0, true);
    };

    const handleClick = (e: React.MouseEvent) => {
        if (dragState.current.isDragging || dragState.current.wasHorizontal) {
            e.stopPropagation();
            return;
        }
        if (isSelectionMode) {
            onToggleSelection(transfer.id);
        } else if (isOpen) {
            e.stopPropagation();
            onOpen(null);
        }
    };

    const bgClass = isSelected ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : 'bg-slate-50';

    return (
        <div className={`relative rounded-lg overflow-hidden border border-slate-100 mb-2 transition-colors duration-200 ${bgClass}`}>
            <div className="absolute top-0 right-0 h-full flex items-center z-0">
                <button 
                    onClick={() => onDelete(transfer.id)}
                    className="w-[72px] h-full flex flex-col items-center justify-center bg-red-600 text-white text-xs font-semibold focus:outline-none focus:visible:ring-2 focus:visible:ring-inset focus:visible:ring-white"
                    {...tapBridge}
                >
                    <TrashIcon className="w-6 h-6" />
                    <span className="text-xs mt-1">Elimina</span>
                </button>
            </div>
            
            <div
                ref={itemRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onClick={handleClick}
                className={`relative p-3 flex justify-between items-center z-10 touch-pan-y select-none transition-colors duration-200 ${bgClass}`}
            >
                <div className="flex items-center gap-3">
                    {isSelected ? (
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-indigo-600 text-white flex-shrink-0">
                            <CheckIcon className="w-5 h-5" strokeWidth={3} />
                        </div>
                    ) : (
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isIncoming ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            <ArrowRightIcon className={`w-4 h-4 transform ${isIncoming ? 'rotate-180' : ''}`} />
                        </div>
                    )}
                    <div>
                        <p className={`text-sm font-semibold ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                            {isIncoming ? `Da: ${otherAccountName}` : `A: ${otherAccountName}`}
                        </p>
                        <p className={`text-xs ${isSelected ? 'text-indigo-700' : 'text-slate-500'}`}>
                            {formatDate(parseLocalYYYYMMDD(transfer.date))}
                        </p>
                    </div>
                </div>
                <span className={`font-bold ${isSelected ? 'text-indigo-900' : isIncoming ? 'text-green-600' : 'text-slate-700'}`}>
                    {isIncoming ? '+' : '-'}{formatCurrency(transfer.amount)}
                </span>
            </div>
        </div>
    );
};

const AccountsScreen: React.FC<AccountsScreenProps> = ({ accounts, expenses, onClose, onAddTransaction, onDeleteTransaction, onDeleteTransactions }) => {
  
  // State for modification modal
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [newBalanceValue, setNewBalanceValue] = useState<string>('');
  const [isModalAnimating, setIsModalAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // State for expanding total card
  const [isTotalExpanded, setIsTotalExpanded] = useState(false);
  
  // State for swipeable rows & selection
  const [openTransferId, setOpenTransferId] = useState<string | null>(null);
  const [selectedTransferIds, setSelectedTransferIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // State for Sorting & Filtering (Separated)
  const [sortOption, setSortOption] = useState<SortOption>('date');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const sortButtonRef = useRef<HTMLButtonElement>(null);

  const isSelectionMode = selectedTransferIds.size > 0;

  // Chiudi il menu se si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (isSortMenuOpen && 
            sortMenuRef.current && 
            !sortMenuRef.current.contains(event.target as Node) &&
            sortButtonRef.current &&
            !sortButtonRef.current.contains(event.target as Node)) {
            setIsSortMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSortMenuOpen]);

  const accountBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    
    // Inizializza a 0
    accounts.forEach(acc => {
        balances[acc.id] = 0;
    });

    // Calcola
    expenses.forEach(e => {
        const amt = Number(e.amount) || 0;
        
        // Gestione Uscita (Expense)
        if (e.type === 'expense') {
            if (balances[e.accountId] !== undefined) {
                balances[e.accountId] -= amt;
            }
        }
        // Gestione Entrata (Income)
        else if (e.type === 'income') {
            if (balances[e.accountId] !== undefined) {
                balances[e.accountId] += amt;
            }
        }
        // Gestione Trasferimento (Transfer)
        else if (e.type === 'transfer') {
            // Sottrai dal conto di origine
            if (balances[e.accountId] !== undefined) {
                balances[e.accountId] -= amt;
            }
            // Aggiungi al conto di destinazione (se esiste)
            if (e.toAccountId && balances[e.toAccountId] !== undefined) {
                balances[e.toAccountId] += amt;
            }
        }
        // Gestione Rettifica (Adjustment) - Importo può essere negativo o positivo
        else if (e.type === 'adjustment') {
            if (balances[e.accountId] !== undefined) {
                balances[e.accountId] += amt;
            }
        }
    });

    return balances;
  }, [accounts, expenses]);

  const totalBalance = (Object.values(accountBalances) as number[]).reduce((acc, val) => acc + val, 0);

  // Calculate recent transfers for Total Card
  const recentTransfers = useMemo(() => {
      return expenses
        .filter(e => e.type === 'transfer')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 3);
  }, [expenses]);

  // Calculate transfers for the specific account being edited with filtering
  const accountSpecificTransfers = useMemo(() => {
      if (!editingAccountId) return [];
      
      let filtered = expenses.filter(e => 
          e.type === 'transfer' && 
          (e.accountId === editingAccountId || e.toAccountId === editingAccountId)
      );

      // 1. Filtering Logic
      if (filterOption === 'incoming') {
          filtered = filtered.filter(e => e.toAccountId === editingAccountId);
      } else if (filterOption === 'outgoing') {
          filtered = filtered.filter(e => e.accountId === editingAccountId);
      }

      // 2. Sorting Logic
      return filtered.sort((a, b) => {
          if (sortOption === 'amount-desc') {
              return b.amount - a.amount;
          }
          if (sortOption === 'amount-asc') {
              return a.amount - b.amount;
          }
          // Default: Date Descending
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [expenses, editingAccountId, sortOption, filterOption]);

  // --- Handlers for Balance Modification ---

  const handleAccountClick = (accountId: string) => {
      // Only open if modification is possible (onAddTransaction is provided)
      if (!onAddTransaction) return;

      setEditingAccountId(accountId);
      setNewBalanceValue('');
      setOpenTransferId(null);
      setSelectedTransferIds(new Set());
      setSortOption('date'); // Reset sorting
      setFilterOption('all'); // Reset filtering
      
      // Animation & Focus
      setTimeout(() => setIsModalAnimating(true), 10);
      setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleModalClose = () => {
      setIsModalAnimating(false);
      setTimeout(() => {
          setEditingAccountId(null);
          setNewBalanceValue('');
          setOpenTransferId(null);
          setSelectedTransferIds(new Set());
      }, 300);
  };

  const handleSaveBalance = () => {
      if (!editingAccountId || !onAddTransaction) return;

      const currentBalance = accountBalances[editingAccountId] || 0;
      const targetBalance = parseFloat(newBalanceValue.replace(',', '.'));

      if (isNaN(targetBalance)) {
          return;
      }

      const diff = targetBalance - currentBalance;

      if (Math.abs(diff) < 0.01) {
          handleModalClose();
          return;
      }

      // Create Adjustment Transaction
      const adjustment: Omit<Expense, 'id'> = {
          amount: diff, 
          type: 'adjustment',
          description: 'Rettifica manuale saldo',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          category: 'Altro', 
          accountId: editingAccountId,
          tags: ['Rettifica'],
          receipts: []
      };

      onAddTransaction(adjustment);
      handleModalClose();
  };
  
  const handleDeleteTransfer = (id: string) => {
      if (onDeleteTransaction) {
          onDeleteTransaction(id);
          setOpenTransferId(null);
      }
  };

  // --- Selection & Bulk Delete Handlers ---

  const handleLongPress = (id: string) => {
      setSelectedTransferIds(new Set([id]));
  };

  const handleToggleSelection = (id: string) => {
      setSelectedTransferIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const handleCancelSelection = () => {
      setSelectedTransferIds(new Set());
  };

  const handleBulkDeleteClick = () => {
      if (selectedTransferIds.size > 0) setIsBulkDeleteModalOpen(true);
  };

  const handleConfirmBulkDelete = () => {
      if (onDeleteTransactions) {
          onDeleteTransactions(Array.from(selectedTransferIds));
          setIsBulkDeleteModalOpen(false);
          setSelectedTransferIds(new Set());
          setOpenTransferId(null);
      }
  };

  const handleSortSelect = (option: SortOption) => {
      setSortOption(option);
      setIsSortMenuOpen(false);
  };

  const handleFilterSelect = (option: FilterOption) => {
      setFilterOption(option);
      setIsSortMenuOpen(false);
  };

  const editingAccount = accounts.find(a => a.id === editingAccountId);
  
  const isFilterActive = sortOption !== 'date' || filterOption !== 'all';

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col animate-fade-in-up">
      <header className="sticky top-0 z-20 flex items-center gap-4 p-4 bg-white/80 backdrop-blur-sm shadow-sm h-[60px]">
        {isSelectionMode && !editingAccountId ? (
            <>
                <button onClick={handleCancelSelection} className="p-2 -ml-2 rounded-full hover:bg-slate-200 transition-colors text-slate-600" aria-label="Annulla selezione"><ArrowLeftIcon className="w-6 h-6" /></button>
                <h1 className="text-xl font-bold text-indigo-800 flex-1">{selectedTransferIds.size} Selezionati</h1>
                <button onClick={handleBulkDeleteClick} className="p-2 rounded-full hover:bg-red-100 text-red-600 transition-colors" aria-label="Elimina selezionati"><TrashIcon className="w-6 h-6" /></button>
            </>
        ) : (
            <>
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 rounded-full hover:bg-slate-200 transition-colors"
                    aria-label="Indietro"
                >
                    <ArrowLeftIcon className="w-6 h-6 text-slate-700" />
                </button>
                <h1 className="text-xl font-bold text-slate-800">I Miei Conti</h1>
            </>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Card Totale Espandibile */}
        <div 
            onClick={() => { if(!isSelectionMode) setIsTotalExpanded(!isTotalExpanded) }}
            className={`bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 transition-all duration-300 ${!isSelectionMode ? 'cursor-pointer active:scale-[0.98]' : ''}`}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-indigo-100 text-sm font-medium mb-1">Patrimonio Totale</p>
                    <p className="text-3xl font-bold">{formatCurrency(totalBalance)}</p>
                </div>
                <ChevronDownIcon className={`w-6 h-6 text-indigo-200 transition-transform duration-300 ${isTotalExpanded ? 'rotate-180' : ''}`} />
            </div>

            {isTotalExpanded && (
                <div className="mt-6 pt-4 border-t border-indigo-500/50 animate-fade-in-down" onClick={(e) => e.stopPropagation()}>
                    <p className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-3">Ultimi Trasferimenti</p>
                    {recentTransfers.length > 0 ? (
                        <div className="space-y-3">
                            {recentTransfers.map(t => {
                                const fromAcc = accounts.find(a => a.id === t.accountId)?.name || '???';
                                const toAcc = accounts.find(a => a.id === t.toAccountId)?.name || '???';
                                return (
                                    <div key={t.id} className="flex justify-between items-center text-sm">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 font-medium">
                                                <span>{fromAcc}</span>
                                                <ArrowRightIcon className="w-3 h-3 opacity-70" />
                                                <span>{toAcc}</span>
                                            </div>
                                            <span className="text-xs text-indigo-200">{formatDate(parseLocalYYYYMMDD(t.date))}</span>
                                        </div>
                                        <span className="font-bold">{formatCurrency(t.amount)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-indigo-200 italic">Nessun trasferimento recente.</p>
                    )}
                </div>
            )}
        </div>

        {/* Lista Conti */}
        <div className="space-y-3">
            {accounts.map(acc => {
                const balance = accountBalances[acc.id] || 0;
                const iconKey = ['paypal', 'crypto', 'revolut', 'poste'].includes(acc.id) ? acc.id : (acc.icon || acc.id);
                const Icon = getAccountIcon(iconKey);
                
                return (
                    <div 
                        key={acc.id} 
                        onClick={() => !isSelectionMode && handleAccountClick(acc.id)}
                        className={`bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between transition-transform ${!isSelectionMode ? 'active:scale-[0.98] cursor-pointer' : 'opacity-50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <Icon className="w-12 h-12 text-indigo-600" />
                            <span className="font-semibold text-slate-800 text-lg">{acc.name}</span>
                        </div>
                        <span className={`font-bold text-lg ${balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                            {formatCurrency(balance)}
                        </span>
                    </div>
                );
            })}
        </div>
        
        {/* Spacer */}
        <div className="h-24" />
      </main>

      {/* MODAL EDIT SALDO FULL SCREEN */}
      {editingAccountId && (
          <div 
            className={`fixed inset-0 z-[60] bg-white flex flex-col transition-all duration-300 ${isModalAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
            onClick={(e) => { e.stopPropagation(); if(openTransferId) setOpenTransferId(null); }}
          >
              <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-white sticky top-0 z-40">
                  {isSelectionMode ? (
                      <>
                        <button onClick={handleCancelSelection} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                        <h3 className="font-bold text-lg text-indigo-800 flex-1 ml-2">{selectedTransferIds.size} Selezionati</h3>
                        <button onClick={handleBulkDeleteClick} className="p-2 rounded-full hover:bg-red-50 text-red-600 transition-colors">
                            <TrashIcon className="w-6 h-6" />
                        </button>
                      </>
                  ) : (
                      <>
                        <button onClick={handleModalClose} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                        <h3 className="font-bold text-lg text-slate-800 flex-1 ml-4 text-left">
                            {editingAccount?.name}
                        </h3>
                        <div className="relative">
                            <button
                                ref={sortButtonRef}
                                onClick={(e) => { e.stopPropagation(); setIsSortMenuOpen(!isSortMenuOpen); }}
                                className={`p-2 rounded-full transition-colors ${isFilterActive ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100 text-slate-600'}`}
                                aria-label="Ordina e Filtra"
                            >
                                <ArrowsUpDownIcon className="w-6 h-6" />
                            </button>
                            {isSortMenuOpen && (
                                <div ref={sortMenuRef} className="absolute top-full right-0 mt-2 w-52 bg-white rounded-lg shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in-up" onPointerDown={(e) => e.stopPropagation()}>
                                    <div className="py-2">
                                        <p className="px-4 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Ordina per</p>
                                        <button onClick={() => handleSortSelect('date')} className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center justify-between hover:bg-slate-50 ${sortOption === 'date' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}><span>Data (Predefinito)</span>{sortOption === 'date' && <CheckIcon className="w-4 h-4" />}</button>
                                        <button onClick={() => handleSortSelect('amount-desc')} className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center justify-between hover:bg-slate-50 ${sortOption === 'amount-desc' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}><span>Importo (Decrescente)</span>{sortOption === 'amount-desc' && <CheckIcon className="w-4 h-4" />}</button>
                                        <button onClick={() => handleSortSelect('amount-asc')} className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center justify-between hover:bg-slate-50 ${sortOption === 'amount-asc' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}><span>Importo (Crescente)</span>{sortOption === 'amount-asc' && <CheckIcon className="w-4 h-4" />}</button>
                                        
                                        <div className="border-t border-slate-100 my-2"></div>
                                        
                                        <p className="px-4 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Filtra per</p>
                                        <button onClick={() => handleFilterSelect('all')} className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center justify-between hover:bg-slate-50 ${filterOption === 'all' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}><span>Tutti</span>{filterOption === 'all' && <CheckIcon className="w-4 h-4" />}</button>
                                        <button onClick={() => handleFilterSelect('incoming')} className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center justify-between hover:bg-slate-50 ${filterOption === 'incoming' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}><span>Solo Entrate</span>{filterOption === 'incoming' && <CheckIcon className="w-4 h-4" />}</button>
                                        <button onClick={() => handleFilterSelect('outgoing')} className={`w-full text-left px-4 py-2.5 text-sm font-semibold flex items-center justify-between hover:bg-slate-50 ${filterOption === 'outgoing' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-700'}`}><span>Solo Uscite</span>{filterOption === 'outgoing' && <CheckIcon className="w-4 h-4" />}</button>
                                    </div>
                                </div>
                            )}
                        </div>
                      </>
                  )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-6" onClick={() => setOpenTransferId(null)}>
                  <div className="space-y-6">
                      <div className="bg-slate-50 p-4 rounded-2xl text-center border border-slate-200">
                          <p className="text-xs text-slate-500 uppercase font-bold tracking-wide mb-1">Saldo Attuale</p>
                          <p className="text-3xl font-bold text-slate-800">{formatCurrency(accountBalances[editingAccountId] || 0)}</p>
                      </div>

                      <div className={isSelectionMode ? 'opacity-50 pointer-events-none' : ''}>
                          <label className="block text-sm font-medium text-slate-700 mb-2">Nuovo Saldo</label>
                          <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                  <CurrencyEuroIcon className="h-6 w-6 text-slate-400" />
                              </div>
                              <input
                                  ref={inputRef}
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  value={newBalanceValue}
                                  onChange={(e) => setNewBalanceValue(e.target.value)}
                                  placeholder="0.00"
                                  className="block w-full pl-12 pr-14 py-4 border border-slate-300 rounded-2xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-2xl font-semibold text-slate-900 shadow-sm"
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveBalance();
                                  }}
                              />
                              <button
                                  onClick={handleSaveBalance}
                                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-green-600 hover:text-green-700 transition-colors focus:outline-none"
                                  aria-label="Conferma nuovo saldo"
                              >
                                  <CheckIcon className="w-8 h-8" strokeWidth={3} />
                              </button>
                          </div>
                          <p className="text-xs text-slate-500 mt-2 ml-1">
                              Verrà creata una transazione di rettifica automatica.
                          </p>
                      </div>

                      <div className={`flex gap-3 pt-2 ${isSelectionMode ? 'opacity-50 pointer-events-none' : ''}`}>
                          <button 
                              onClick={handleModalClose}
                              className="flex-1 py-3 text-slate-700 font-bold bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                          >
                              Annulla
                          </button>
                          <button 
                              onClick={handleSaveBalance}
                              className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-colors"
                          >
                              Salva
                          </button>
                      </div>

                      {/* Storico Trasferimenti */}
                      <div className="pt-6 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Storico Trasferimenti</h4>
                              {isFilterActive && (
                                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                                      Filtro attivo
                                  </span>
                              )}
                          </div>
                          
                          {accountSpecificTransfers.length > 0 ? (
                              <div className="space-y-3">
                                  {accountSpecificTransfers.map(t => {
                                      const isIncoming = t.toAccountId === editingAccountId;
                                      const otherAccountId = isIncoming ? t.accountId : t.toAccountId;
                                      const otherAccountName = accounts.find(a => a.id === otherAccountId)?.name || 'Conto Eliminato';
                                      
                                      return (
                                          <SwipableTransferRow 
                                              key={t.id}
                                              transfer={t}
                                              isIncoming={isIncoming}
                                              otherAccountName={otherAccountName}
                                              onDelete={() => handleDeleteTransfer(t.id)}
                                              onOpen={setOpenTransferId}
                                              isOpen={openTransferId === t.id}
                                              isSelectionMode={isSelectionMode}
                                              isSelected={selectedTransferIds.has(t.id)}
                                              onToggleSelection={handleToggleSelection}
                                              onLongPress={handleLongPress}
                                          />
                                      );
                                  })}
                                  <div className="h-24" />
                              </div>
                          ) : (
                              <p className="text-center text-slate-400 text-sm py-4">
                                  {!isFilterActive 
                                    ? 'Nessun trasferimento registrato per questo conto.' 
                                    : 'Nessun trasferimento corrisponde ai filtri selezionati.'}
                              </p>
                          )}
                      </div>
                  </div>
              </div>
          </div>
      )}
      
      <ConfirmationModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        title="Elimina Selezionati"
        message={`Sei sicuro di voler eliminare ${selectedTransferIds.size} trasferimenti? L'azione è irreversibile.`}
        variant="danger"
        confirmButtonText="Elimina"
        cancelButtonText="Annulla"
      />
    </div>
  );
};

export default AccountsScreen;
