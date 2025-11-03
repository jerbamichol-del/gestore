
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Expense, Account } from '../types';
import { getCategoryStyle } from '../utils/categoryStyles';
import { formatCurrency } from '../components/icons/formatters';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { CalendarDaysIcon } from '../components/icons/CalendarDaysIcon';

const ACTION_WIDTH = 72;

const recurrenceLabels: Record<string, string> = {
  daily: 'Ogni Giorno',
  weekly: 'Ogni Settimana',
  monthly: 'Ogni Mese',
  yearly: 'Ogni Anno',
};

const getRecurrenceSummary = (expense: Expense): string => {
    if (expense.frequency !== 'recurring' || !expense.recurrence) {
        return 'Non ricorrente';
    }
    const { recurrence, recurrenceInterval = 1 } = expense;
    if (recurrenceInterval > 1) {
        return `Ogni ${recurrenceInterval} ${recurrence === 'daily' ? 'giorni' : recurrence === 'weekly' ? 'settimane' : recurrence === 'monthly' ? 'mesi' : 'anni'}`;
    }
    return recurrenceLabels[recurrence] || 'Ricorrente';
};

const RecurringExpenseItem: React.FC<{
  expense: Expense;
  accounts: Account[];
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}> = ({ expense, accounts, onEdit, onDelete }) => {
    const style = getCategoryStyle(expense.category);
    const accountName = accounts.find(a => a.id === expense.accountId)?.name || 'Sconosciuto';
    const itemRef = useRef<HTMLDivElement>(null);
    const [isSwiping, setIsSwiping] = useState(false);
    const [translateX, setTranslateX] = useState(0);
    const startX = useRef(0);
    const currentX = useRef(0);
    const tapThreshold = 10;
    const startTime = useRef(0);

    const handlePointerDown = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        startX.current = e.clientX;
        currentX.current = translateX;
        startTime.current = Date.now();
        setIsSwiping(true);
        itemRef.current?.setPointerCapture(e.pointerId);
        itemRef.current!.style.transition = 'none';
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isSwiping) return;
        const deltaX = e.clientX - startX.current;
        let newTranslateX = currentX.current + deltaX;
        if (newTranslateX > 0) newTranslateX = 0;
        if (newTranslateX < -ACTION_WIDTH) {
             newTranslateX = -ACTION_WIDTH - Math.tanh((-newTranslateX - ACTION_WIDTH) / 50) * 25;
        }
        setTranslateX(newTranslateX);
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!isSwiping) return;
        setIsSwiping(false);
        itemRef.current?.releasePointerCapture(e.pointerId);
        itemRef.current!.style.transition = 'transform 0.2s ease-out';
        
        const deltaX = e.clientX - startX.current;
        const duration = Date.now() - startTime.current;
        const isTap = Math.abs(deltaX) < tapThreshold && duration < 200;

        if (isTap) {
            if(translateX !== 0) {
                 setTranslateX(0);
            } else {
                onEdit(expense);
            }
            return;
        }

        if (translateX < -ACTION_WIDTH / 2) {
            setTranslateX(-ACTION_WIDTH);
        } else {
            setTranslateX(0);
        }
    };

    return (
        <div className="relative bg-white overflow-hidden">
            <div className="absolute top-0 right-0 h-full flex items-center z-0">
                <button
                    onClick={() => onDelete(expense.id)}
                    className="w-[72px] h-full flex flex-col items-center justify-center bg-red-500 text-white hover:bg-red-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                    aria-label="Elimina spesa ricorrente"
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
                onPointerCancel={handlePointerUp}
                className="relative flex items-center gap-4 py-3 px-4 bg-white z-10"
                style={{ transform: `translateX(${translateX}px)`, touchAction: 'pan-y' }}
            >
                <span className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${style.bgColor}`}>
                    <style.Icon className={`w-6 h-6 ${style.color}`} />
                </span>
                <div className="flex-grow min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{expense.description || 'Senza descrizione'}</p>
                    <p className="text-sm text-slate-500 truncate">{getRecurrenceSummary(expense)} • {accountName}</p>
                </div>
                <p className="font-bold text-slate-900 text-lg text-right shrink-0">{formatCurrency(Number(expense.amount) || 0)}</p>
            </div>
        </div>
    );
};

interface RecurringExpensesScreenProps {
  recurringExpenses: Expense[];
  accounts: Account[];
  onClose: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

const RecurringExpensesScreen: React.FC<RecurringExpensesScreenProps> = ({ recurringExpenses, accounts, onClose, onEdit, onDelete }) => {
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsAnimatingIn(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
      setIsAnimatingIn(false);
      setTimeout(onClose, 300);
  }
  
  const sortedExpenses = [...recurringExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className={`fixed inset-0 z-50 bg-slate-100 transform transition-transform duration-300 ease-in-out ${isAnimatingIn ? 'translate-x-0' : 'translate-x-full'}`}>
      <header className="sticky top-0 z-20 flex items-center gap-4 p-4 bg-white/80 backdrop-blur-sm shadow-sm">
        <button onClick={handleClose} className="p-2 rounded-full hover:bg-slate-200 transition-colors" aria-label="Indietro">
          <ArrowLeftIcon className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-xl font-bold text-slate-800">Spese Ricorrenti</h1>
      </header>
      <main className="overflow-y-auto h-[calc(100%-68px)] p-2">
        {sortedExpenses.length > 0 ? (
            <div className="bg-white rounded-xl shadow-md overflow-hidden my-4">
                {sortedExpenses.map((expense, index) => (
                    <React.Fragment key={expense.id}>
                        {index > 0 && <hr className="border-t border-slate-200 ml-16" />}
                        <RecurringExpenseItem
                            expense={expense}
                            accounts={accounts}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    </React.Fragment>
                ))}
            </div>
        ) : (
          <div className="text-center text-slate-500 pt-20 px-6">
            <CalendarDaysIcon className="w-16 h-16 mx-auto text-slate-400" />
            <p className="text-lg font-semibold mt-4">Nessuna spesa ricorrente</p>
            <p className="mt-2">Puoi creare una spesa ricorrente quando aggiungi una nuova spesa.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default RecurringExpensesScreen;
