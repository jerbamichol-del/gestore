import React, { useState } from 'react';
import { Expense, Account } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { formatCurrency } from './icons/formatters';
import SelectionMenu from './SelectionMenu';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { CreditCardIcon } from './icons/CreditCardIcon';

interface TransactionDetailPageProps {
  formData: Partial<Omit<Expense, 'id'>>;
  onFormChange: (newData: Partial<Omit<Expense, 'id'>>) => void;
  accounts: Account[];
  onClose: () => void; // Per tornare alla calcolatrice
  onSubmit: (data: Omit<Expense, 'id'>) => void;
  isVisible: boolean;
  isDesktop: boolean;
}

const TransactionDetailPage: React.FC<TransactionDetailPageProps> = ({
    formData,
    onFormChange,
    accounts,
    onClose,
    onSubmit,
    isVisible,
    isDesktop,
}) => {
    const [activeMenu, setActiveMenu] = useState<'account' | null>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        onFormChange({ [name]: value });
    };
    
    const handleAccountSelect = (accountId: string) => {
        onFormChange({ accountId });
        setActiveMenu(null);
    };
    
    const handleSubmit = () => {
        onSubmit(formData as Omit<Expense, 'id'>);
    };
    
    const selectedAccountLabel = accounts.find(a => a.id === formData.accountId)?.name;
    const accountOptions = accounts.map(acc => ({ value: acc.id, label: acc.name }));
    const today = new Date().toISOString().split('T')[0];
    
    if (typeof formData.amount !== 'number') {
        return (
            <div className="flex flex-col h-full bg-slate-100 items-center justify-center p-4">
                 <header className={`p-4 flex items-center gap-4 text-slate-800 bg-white shadow-sm absolute top-0 left-0 right-0 z-10 transition-opacity ${!isVisible ? 'opacity-0 invisible' : 'opacity-100'}`}>
                    {!isDesktop && (
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200" aria-label="Torna alla calcolatrice">
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                    )}
                    <h2 className="text-xl font-bold">Aggiungi Dettagli</h2>
                </header>
                <p className="text-slate-500 text-center">Nessun dato dall'importo. Torna indietro e inserisci una spesa.</p>
            </div>
        );
    }


    return (
        <div className="flex flex-col h-full bg-slate-100">
            <header className={`p-4 flex items-center gap-4 text-slate-800 bg-white shadow-sm sticky top-0 z-10 transition-opacity ${!isVisible ? 'opacity-0 invisible' : 'opacity-100'}`}>
                {!isDesktop && (
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200" aria-label="Torna alla calcolatrice">
                        <ArrowLeftIcon className="w-6 h-6" />
                    </button>
                )}
                <h2 className="text-xl font-bold">Aggiungi Dettagli</h2>
            </header>
            <main className="flex-1 p-4 flex flex-col">
                <div className="text-center mb-6">
                    <span className="text-slate-500 text-lg">Importo</span>
                    <p className="text-5xl font-extrabold text-indigo-600">{formatCurrency(formData.amount || 0)}</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="description" className="block text-base font-medium text-slate-700 mb-1">Descrizione</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <DocumentTextIcon className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                id="description"
                                name="description"
                                type="text"
                                value={formData.description || ''}
                                onChange={handleInputChange}
                                className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-base"
                                placeholder="Es. Caffè al bar"
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label htmlFor="date" className="block text-base font-medium text-slate-700 mb-1">Data</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <CalendarIcon className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                id="date"
                                name="date"
                                type="date"
                                value={formData.date || ''}
                                onChange={handleInputChange}
                                max={today}
                                className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-base"
                            />
                        </div>
                    </div>
                     <div>
                        <label className="block text-base font-medium text-slate-700 mb-1">Conto</label>
                        <button
                          type="button"
                          onClick={() => setActiveMenu('account')}
                          className="w-full flex items-center text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                        >
                          <CreditCardIcon className="h-5 w-5 text-slate-400" />
                          <span className="truncate flex-1">
                            {selectedAccountLabel || 'Seleziona'}
                          </span>
                        </button>
                    </div>
                </div>
                <div className="mt-auto pt-6">
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={(formData.amount ?? 0) <= 0}
                        className="w-full px-4 py-3 text-base font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
                    >
                       Aggiungi Spesa
                    </button>
                </div>
            </main>
             <SelectionMenu 
                isOpen={activeMenu === 'account'}
                onClose={() => setActiveMenu(null)}
                title="Seleziona un Conto"
                options={accountOptions}
                selectedValue={formData.accountId || ''}
                onSelect={handleAccountSelect}
              />
        </div>
    );
};

export default TransactionDetailPage;