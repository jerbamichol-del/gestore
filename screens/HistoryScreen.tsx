
import React, { useMemo, useState } from 'react';
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
}

const ExpenseItem: React.FC<ExpenseItemProps> = ({ expense, accounts, onEdit, onDelete }) => {
    const style = getCategoryStyle(expense.category);
    const accountName = accounts.find(a => a.id === expense.accountId)?.name || 'Sconosciuto';
    return (
        <div className="flex items-center gap-4 py-3 px-4">
            <span className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${style.bgColor}`}>
                <style.Icon className={`w-6 h-6 ${style.color}`} />
            </span>
            <div className="flex-grow min-w-0 overflow-hidden">
                <p className="font-semibold text-slate-800 truncate">{expense.subcategory || style.label} • {accountName}</p>
                <p className="text-sm text-slate-500 truncate" title={expense.description}>{expense.description || 'Senza descrizione'}</p>
            </div>
            <p className="font-bold text-slate-900 text-lg text-right shrink-0 whitespace-nowrap">{formatCurrency(Number(expense.amount) || 0)}</p>
            <div className="flex items-center gap-1">
                 <button onClick={() => onEdit(expense)} className="p-2 text-slate-500 hover:text-indigo-600 rounded-full hover:bg-indigo-50 transition-colors" aria-label="Modifica">
                    <PencilSquareIcon className="w-5 h-5" />
                </button>
                <button onClick={() => onDelete(expense.id)} className="p-2 text-slate-500 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors" aria-label="Elimina">
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

interface HistoryScreenProps {
  expenses: Expense[];
  accounts: Account[];
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
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


const HistoryScreen: React.FC<HistoryScreenProps> = ({ expenses, accounts, onEditExpense, onDeleteExpense }) => {
    const [dateFilter, setDateFilter] = useState<DateFilter>('all');
    const [customRange, setCustomRange] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });

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

    const noExpensesMessage = (dateFilter === 'all' && !isCustomRangeActive) 
    ? {
        title: 'Nessuna spesa registrata.',
        subtitle: 'Aggiungi una nuova spesa per iniziare il tuo storico.'
      }
    : {
        title: 'Nessuna spesa trovata.',
        subtitle: 'Prova a selezionare un periodo di tempo diverso.'
    };

    return (
        <div className="h-full flex flex-col animate-fade-in-up">
            <div className="flex-shrink-0 pt-4 md:pt-8">
                <div className="mb-6 px-4 md:px-8">
                    <h1 className="text-2xl font-bold text-slate-800">Storico Spese</h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-28" style={{ touchAction: 'pan-y' }}>
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
};

export default HistoryScreen;
