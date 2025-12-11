import React, { useMemo } from 'react';
import { Account, Expense } from '../types';
import { formatCurrency } from '../components/icons/formatters';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { getAccountIcon } from '../utils/accountIcons';

interface AccountsScreenProps {
  accounts: Account[];
  expenses: Expense[];
  onClose: () => void;
}

const AccountsScreen: React.FC<AccountsScreenProps> = ({ accounts, expenses, onClose }) => {
  
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
                // Force specific icon for known IDs if needed, otherwise use icon property or ID as fallback
                const iconKey = ['paypal', 'crypto', 'revolut', 'poste'].includes(acc.id) ? acc.id : (acc.icon || acc.id);
                const Icon = getAccountIcon(iconKey);
                
                return (
                    <div key={acc.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {/* Icona ingrandita senza riquadro */}
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
      </main>
    </div>
  );
};

export default AccountsScreen;
