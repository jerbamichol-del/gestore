import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Account, Expense } from '../types';
import { formatCurrency } from '../components/icons/formatters';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { getAccountIcon } from '../utils/accountIcons';
import { CurrencyEuroIcon } from '../components/icons/CurrencyEuroIcon';
import { XMarkIcon } from '../components/icons/XMarkIcon';

interface AccountsScreenProps {
  accounts: Account[];
  expenses: Expense[];
  onClose: () => void;
  onAddTransaction?: (expense: Omit<Expense, 'id'>) => void;
}

const AccountsScreen: React.FC<AccountsScreenProps> = ({ accounts, expenses, onClose, onAddTransaction }) => {
  
  // State for modification modal
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [newBalanceValue, setNewBalanceValue] = useState<string>('');
  const [isModalAnimating, setIsModalAnimating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    });

    return balances;
  }, [accounts, expenses]);

  const totalBalance = (Object.values(accountBalances) as number[]).reduce((acc, val) => acc + val, 0);

  // --- Handlers for Balance Modification ---

  const handleAccountClick = (accountId: string) => {
      // Only open if modification is possible (onAddTransaction is provided)
      if (!onAddTransaction) return;

      setEditingAccountId(accountId);
      // Pre-fill with current balance? Or empty? 
      // Empty usually better for "setting new value" to avoid clearing.
      // But maybe placeholder shows current.
      setNewBalanceValue('');
      
      // Animation & Focus
      setTimeout(() => setIsModalAnimating(true), 10);
      setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleModalClose = () => {
      setIsModalAnimating(false);
      setTimeout(() => {
          setEditingAccountId(null);
          setNewBalanceValue('');
      }, 300);
  };

  const handleSaveBalance = () => {
      if (!editingAccountId || !onAddTransaction) return;

      const currentBalance = accountBalances[editingAccountId] || 0;
      const targetBalance = parseFloat(newBalanceValue.replace(',', '.'));

      if (isNaN(targetBalance)) {
          // Maybe show error or just return
          return;
      }

      const diff = targetBalance - currentBalance;

      if (Math.abs(diff) < 0.01) {
          handleModalClose();
          return;
      }

      // Create Adjustment Transaction
      const adjustment: Omit<Expense, 'id'> = {
          amount: Math.abs(diff),
          type: diff > 0 ? 'income' : 'expense',
          description: 'Rettifica manuale saldo',
          date: new Date().toISOString().split('T')[0],
          // Important: set time to current time to appear at end of day list if sorted
          time: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
          category: 'Altro', 
          accountId: editingAccountId,
          tags: ['Rettifica'],
          receipts: []
      };

      onAddTransaction(adjustment);
      handleModalClose();
  };

  const editingAccount = accounts.find(a => a.id === editingAccountId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col animate-fade-in-up">
      <header className="sticky top-0 z-20 flex items-center gap-4 p-4 bg-white/80 backdrop-blur-sm shadow-sm h-[60px]">
        <button
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-slate-200 transition-colors"
            aria-label="Indietro"
        >
            <ArrowLeftIcon className="w-6 h-6 text-slate-700" />
        </button>
        <h1 className="text-xl font-bold text-slate-800">I Miei Conti</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Card Totale */}
        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
            <p className="text-indigo-100 text-sm font-medium mb-1">Patrimonio Totale</p>
            <p className="text-3xl font-bold">{formatCurrency(totalBalance)}</p>
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
                        onClick={() => handleAccountClick(acc.id)}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between active:scale-[0.98] transition-transform cursor-pointer"
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

      {/* MODAL EDIT SALDO */}
      {editingAccountId && (
          <div 
            className={`fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 ${isModalAnimating ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleModalClose}
          >
              <div 
                className={`bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300 ${isModalAnimating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
                onClick={e => e.stopPropagation()}
              >
                  <div className="flex justify-between items-center p-4 border-b border-slate-100">
                      <h3 className="font-bold text-lg text-slate-800">
                          Modifica Saldo {editingAccount?.name}
                      </h3>
                      <button onClick={handleModalClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-500">
                          <XMarkIcon className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-4">
                      <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-200">
                          <p className="text-xs text-slate-500 uppercase font-bold tracking-wide">Attuale</p>
                          <p className="text-xl font-bold text-slate-800">{formatCurrency(accountBalances[editingAccountId] || 0)}</p>
                      </div>

                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nuovo Saldo</label>
                          <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <CurrencyEuroIcon className="h-5 w-5 text-slate-400" />
                              </div>
                              <input
                                  ref={inputRef}
                                  type="number"
                                  inputMode="decimal"
                                  step="0.01"
                                  value={newBalanceValue}
                                  onChange={(e) => setNewBalanceValue(e.target.value)}
                                  placeholder="0.00"
                                  className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-lg font-semibold text-slate-900"
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveBalance();
                                  }}
                              />
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                              Verrà creata una transazione di rettifica automatica.
                          </p>
                      </div>
                  </div>

                  <div className="p-4 bg-slate-50 flex gap-3 justify-end">
                      <button 
                          onClick={handleModalClose}
                          className="px-4 py-2 text-slate-700 font-semibold hover:bg-slate-200 rounded-lg transition-colors"
                      >
                          Annulla
                      </button>
                      <button 
                          onClick={handleSaveBalance}
                          className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
                      >
                          Salva
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AccountsScreen;
