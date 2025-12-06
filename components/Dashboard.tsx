import React, { useState } from 'react';
import { Expense, Account, CATEGORIES } from '../types';
import { getCategoryStyle } from '../utils/categoryStyles';
import { formatCurrency } from './icons/formatters';
import { CreditCardIcon } from './icons/CreditCardIcon';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';
import { ChevronRightIcon } from './icons/ChevronRightIcon';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { ArrowsRightLeftIcon } from './icons/ArrowsRightLeftIcon';

interface DashboardProps {
  expenses: Expense[];
  recurringExpenses: Expense[];
  onNavigateToRecurring: () => void;
  onNavigateToHistory: () => void;
  onReceiveSharedFile: (file: File) => void;
  onImportFile: (file: File) => void;
  onExportJSON?: () => void;
  onImportJSON?: (file: File) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ 
  expenses, 
  recurringExpenses, 
  onNavigateToRecurring, 
  onNavigateToHistory,
  onReceiveSharedFile,
  onImportFile,
  onExportJSON,
  onImportJSON
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isDataMenuOpen, setIsDataMenuOpen] = useState(false);

  // Calcolo Totali
  const currentMonthStr = currentMonth.toISOString().slice(0, 7);
  const monthlyExpenses = expenses.filter(e => e.date.startsWith(currentMonthStr));
  const totalMonthly = monthlyExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayExpenses = expenses.filter(e => e.date === todayStr);
  const totalToday = todayExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Raggruppamento categorie
  const expensesByCategory = monthlyExpenses.reduce((acc, expense) => {
    const cat = expense.category || 'Altro';
    acc[cat] = (acc[cat] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories = Object.entries(expensesByCategory)
    .sort(([, a], [, b]) => b - a);

  // Gestione Mese
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };
  const resetMonth = () => setCurrentMonth(new Date());

  const monthLabel = currentMonth.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
  const isCurrentMonth = currentMonthStr === new Date().toISOString().slice(0, 7);

  // Handler Import Generico
  const handleImportClick = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      if (file.name.endsWith('.json') && onImportJSON) {
          onImportJSON(file);
      } else {
          // Fallback per CSV/Excel esistente
          onImportFile(file);
      }
      e.target.value = ''; // Reset
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* CARD TOTALE */}
      <div className="bg-white rounded-2xl shadow-sm p-6 text-center border border-slate-100">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">SPESA MENSILE</h2>
        <p className="text-sm text-slate-400 mb-2 capitalize">{monthLabel}</p>
        <div className="text-5xl font-bold text-indigo-600 mb-6 tracking-tight">
          {formatCurrency(totalMonthly).replace('€', '')} <span className="text-3xl text-indigo-400">€</span>
        </div>
        
        {/* Navigazione Mese */}
        <div className="flex items-center justify-center gap-4 mb-4">
            <button onClick={prevMonth} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronLeftIcon className="w-6 h-6"/></button>
            <button onClick={resetMonth} disabled={isCurrentMonth} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${isCurrentMonth ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {isCurrentMonth ? 'Questo Mese' : 'Torna a Oggi'}
            </button>
            <button onClick={nextMonth} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronRightIcon className="w-6 h-6"/></button>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
            <div className="text-left">
                <p className="text-xs text-slate-400 font-semibold uppercase">Spesa Oggi</p>
                <p className="text-xl font-bold text-slate-700">{formatCurrency(totalToday)}</p>
            </div>
            <div className="flex gap-2">
                <button onClick={onNavigateToRecurring} className="px-3 py-2 bg-amber-100 text-amber-700 rounded-lg text-sm font-semibold hover:bg-amber-200 transition-colors">S. Programmate</button>
                <button onClick={onNavigateToHistory} className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-200 transition-colors">Storico Spese</button>
            </div>
        </div>
      </div>

      {/* PULSANTE GESTIONE DATI (MODIFICATO) */}
      <button 
        onClick={() => setIsDataMenuOpen(true)}
        className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 p-4 rounded-xl flex items-center justify-center gap-3 transition-colors border border-indigo-100 shadow-sm"
      >
        <ArrowsRightLeftIcon className="w-5 h-5" />
        <span className="font-semibold">Imp/Exp (CSV/Excel/JSON)</span>
      </button>

      {/* LISTA CATEGORIE */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-800 px-1">Riepilogo Categorie <span className="text-sm font-normal text-slate-400 block">{monthLabel}</span></h3>
        <div className="space-y-3">
          {sortedCategories.length > 0 ? sortedCategories.map(([cat, amount]) => {
            const style = getCategoryStyle(cat);
            const percentage = Math.round((amount / totalMonthly) * 100);
            return (
              <div key={cat} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                 <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${style.bgColor} ${style.color}`}>
                        <style.Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-semibold text-slate-700">{cat}</p>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full ${style.bgColor.replace('bg-', 'bg-')}`} style={{ width: `${percentage}%`, backgroundColor: 'currentColor', color: 'inherit' }} /> 
                            {/* Hack veloce per colore, meglio usare classi statiche se possibile */}
                        </div>
                    </div>
                 </div>
                 <div className="text-right">
                     <p className="font-bold text-slate-700">{formatCurrency(amount)}</p>
                     <p className="text-xs text-slate-400">{percentage}%</p>
                 </div>
              </div>
            );
          }) : (
              <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                  Nessuna spesa in questo periodo
              </div>
          )}
        </div>
      </div>

      {/* MODAL GESTIONE DATI */}
      {isDataMenuOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsDataMenuOpen(false)}>
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-6 space-y-4 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-slate-800">Gestione Dati</h3>
                    <button onClick={() => setIsDataMenuOpen(false)} className="p-1 hover:bg-slate-100 rounded-full"><XMarkIcon className="w-6 h-6 text-slate-500"/></button>
                </div>
                
                {/* IMPORTA */}
                <label className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 cursor-pointer transition-all group">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ArrowDownTrayIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-slate-700 group-hover:text-emerald-700">Importa (CSV/Excel/JSON)</h4>
                        <p className="text-xs text-slate-500">Ripristina backup o carica dati</p>
                    </div>
                    <input type="file" accept=".csv, .xlsx, .xls, .json" className="hidden" onChange={handleImportClick} />
                </label>

                {/* ESPORTA */}
                <button onClick={onExportJSON} className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all group text-left">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <ArrowUpTrayIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-bold text-slate-700 group-hover:text-blue-700">Esporta (JSON)</h4>
                        <p className="text-xs text-slate-500">Salva un backup completo con foto</p>
                    </div>
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
