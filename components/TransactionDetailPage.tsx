import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Expense, Account } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { formatDate } from './icons/formatters';
import SelectionMenu from './SelectionMenu';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { CreditCardIcon } from './icons/CreditCardIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { CurrencyEuroIcon } from './icons/CurrencyEuroIcon';

interface TransactionDetailPageProps {
  formData: Partial<Omit<Expense, 'id'>>;
  onFormChange: (newData: Partial<Omit<Expense, 'id'>>) => void;
  accounts: Account[];
  onClose: () => void; // Per tornare alla calcolatrice
  onSubmit: (data: Omit<Expense, 'id'>) => void;
  isDesktop: boolean;
  onMenuStateChange: (isOpen: boolean) => void;
}

const toYYYYMMDD = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseLocalYYYYMMDD = (dateString: string | null): Date | null => {
  if (!dateString) return null;
  const parts = dateString.split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]); // locale 00:00
};

const recurrenceLabels = {
    daily: 'Giornaliera',
    weekly: 'Settimanale',
    monthly: 'Mensile',
    yearly: 'Annuale',
};
const getRecurrenceLabel = (value?: keyof typeof recurrenceLabels) => {
    if (!value) return null;
    return recurrenceLabels[value];
}

const TransactionDetailPage = React.forwardRef<HTMLDivElement, TransactionDetailPageProps>(({
    formData,
    onFormChange,
    accounts,
    onClose,
    onSubmit,
    isDesktop,
    onMenuStateChange,
}, ref) => {
    const [activeMenu, setActiveMenu] = useState<'account' | null>(null);
    const [amountStr, setAmountStr] = useState('');
    const [isAmountFocused, setIsAmountFocused] = useState(false);
    const isSyncingAmountFromParent = useRef(false);
    
    const [isFrequencyModalOpen, setIsFrequencyModalOpen] = useState(false);
    const [isFrequencyModalAnimating, setIsFrequencyModalAnimating] = useState(false);
    
    // State for the recurrence modal
    const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
    const [isRecurrenceModalAnimating, setIsRecurrenceModalAnimating] = useState(false);
    const [isRecurrenceOptionsOpen, setIsRecurrenceOptionsOpen] = useState(false);
    const [tempRecurrence, setTempRecurrence] = useState(formData.recurrence);
    const [tempRecurrenceInterval, setTempRecurrenceInterval] = useState<number | undefined>(formData.recurrenceInterval);

    // State for the recurrence end modal
    const [isRecurrenceEndModalOpen, setIsRecurrenceEndModalOpen] = useState(false);
    const [isRecurrenceEndModalAnimating, setIsRecurrenceEndModalAnimating] = useState(false);

    const amountInputRef = useRef<HTMLInputElement>(null);
    const descriptionInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        const isAnyMenuOpen = activeMenu !== null || isFrequencyModalOpen || isRecurrenceModalOpen || isRecurrenceEndModalOpen;
        onMenuStateChange(isAnyMenuOpen);
    }, [activeMenu, isFrequencyModalOpen, isRecurrenceModalOpen, isRecurrenceEndModalOpen, onMenuStateChange]);

     useEffect(() => {
        if (isFrequencyModalOpen) {
            const timer = setTimeout(() => setIsFrequencyModalAnimating(true), 10);
            return () => clearTimeout(timer);
        } else {
            setIsFrequencyModalAnimating(false);
        }
    }, [isFrequencyModalOpen]);

    useEffect(() => {
        if (isRecurrenceModalOpen) {
            // Initialize temp state when modal opens
            setTempRecurrence(formData.recurrence || 'monthly');
            setTempRecurrenceInterval(formData.recurrenceInterval || 1);
            setIsRecurrenceOptionsOpen(false);
            const timer = setTimeout(() => setIsRecurrenceModalAnimating(true), 10);
            return () => clearTimeout(timer);
        } else {
            setIsRecurrenceModalAnimating(false);
        }
    }, [isRecurrenceModalOpen, formData.recurrence, formData.recurrenceInterval]);

    useEffect(() => {
        if (isRecurrenceEndModalOpen) {
            const timer = setTimeout(() => setIsRecurrenceEndModalAnimating(true), 10);
            return () => clearTimeout(timer);
        } else {
            setIsRecurrenceEndModalAnimating(false);
        }
    }, [isRecurrenceEndModalOpen]);

    // Sync from parent state to local amount string
    useEffect(() => {
        if (!isAmountFocused) {
            const parentAmount = formData.amount || 0;
            const localAmount = parseFloat(String(amountStr).replace(',', '.')) || 0;

            if (Math.abs(parentAmount - localAmount) > 1e-9) {
                isSyncingAmountFromParent.current = true;
                setAmountStr(parentAmount === 0 ? '' : String(parentAmount).replace('.', ','));
            }
        }
    }, [formData.amount, isAmountFocused]);
    
    // Sync from local amount string to parent state
    useEffect(() => {
        if (isSyncingAmountFromParent.current) {
            isSyncingAmountFromParent.current = false;
            return;
        }

        const num = parseFloat(amountStr.replace(',', '.'));
        const newAmount = isNaN(num) ? 0 : num;
        if (newAmount !== formData.amount) {
            onFormChange({ amount: newAmount });
        }
    }, [amountStr, formData.amount, onFormChange]);


    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'recurrenceCount') {
            const num = parseInt(value, 10);
            onFormChange({ [name]: isNaN(num) || num <= 0 ? undefined : num });
        } else if (name === 'amount') {
            let sanitized = value.replace(/[^0-9,]/g, '');
            const parts = sanitized.split(',');
            if (parts.length > 2) {
                sanitized = parts[0] + ',' + parts.slice(1).join('');
            }
            if (parts[1] && parts[1].length > 2) {
                sanitized = parts[0] + ',' + parts[1].substring(0, 2);
            }
            setAmountStr(sanitized);
        } else {
            onFormChange({ [name]: value });
        }
    };
    
    const handleAccountSelect = (accountId: string) => {
        onFormChange({ accountId });
        setActiveMenu(null);
    };
    
     const handleFrequencySelect = (frequency: string) => {
        onFormChange({ frequency: frequency as 'single' | 'recurring' });
        handleCloseFrequencyModal();
    };

    const handleCloseFrequencyModal = () => {
        setIsFrequencyModalAnimating(false);
        setTimeout(() => {
            setIsFrequencyModalOpen(false);
        }, 300);
    };

    const handleCloseRecurrenceModal = () => {
        setIsRecurrenceModalAnimating(false);
        setTimeout(() => {
            setIsRecurrenceModalOpen(false);
        }, 300);
    };
    
    const handleApplyRecurrence = () => {
        onFormChange({
            recurrence: tempRecurrence as any,
            recurrenceInterval: tempRecurrence === 'monthly' ? (tempRecurrenceInterval || 1) : 1
        });
        handleCloseRecurrenceModal();
    };

    const handleCloseRecurrenceEndModal = () => {
        setIsRecurrenceEndModalAnimating(false);
        setTimeout(() => {
            setIsRecurrenceEndModalOpen(false);
        }, 300);
    };
    
    const handleRecurrenceEndTypeSelect = (type: 'forever' | 'date' | 'count') => {
        const updates: Partial<Expense> = { recurrenceEndType: type };
        if (type === 'forever') {
            updates.recurrenceEndDate = undefined;
            updates.recurrenceCount = undefined;
        } else if (type === 'date') {
            updates.recurrenceEndDate = formData.recurrenceEndDate || toYYYYMMDD(new Date());
            updates.recurrenceCount = undefined;
        } else if (type === 'count') {
            updates.recurrenceEndDate = undefined;
            updates.recurrenceCount = formData.recurrenceCount || 1;
        }
        onFormChange(updates);
        handleCloseRecurrenceEndModal();
    };

    const handleSubmit = () => {
        const dataToSubmit = {
            ...formData,
            category: formData.category || 'Altro',
        };
        onSubmit(dataToSubmit as Omit<Expense, 'id'>);
    };
    
    const selectedAccountLabel = accounts.find(a => a.id === formData.accountId)?.name;
    const accountOptions = accounts.map(acc => ({ value: acc.id, label: acc.name }));
    const today = toYYYYMMDD(new Date());

    const getRecurrenceEndLabel = () => {
        const { recurrenceEndType } = formData;
        if (!recurrenceEndType || recurrenceEndType === 'forever') {
            return 'Per sempre';
        }
        if (recurrenceEndType === 'date') {
            return 'Fino a';
        }
        if (recurrenceEndType === 'count') {
            return 'Numero di volte';
        }
        return 'Per sempre';
    };


    if (typeof formData.amount !== 'number') {
        return (
            <div className="flex flex-col h-full bg-slate-100 items-center justify-center p-4">
                 <header className={`p-4 flex items-center gap-4 text-slate-800 bg-white shadow-sm absolute top-0 left-0 right-0 z-10`}>
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
        <div ref={ref} tabIndex={-1} className="flex flex-col h-full bg-slate-100 focus:outline-none">
             <header className={`p-4 flex items-center justify-between gap-4 text-slate-800 bg-white shadow-sm sticky top-0 z-10`}>
                <div className="flex items-center gap-4">
                    {!isDesktop && (
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200" aria-label="Torna alla calcolatrice">
                            <ArrowLeftIcon className="w-6 h-6" />
                        </button>
                    )}
                    <h2 className="text-xl font-bold">Aggiungi Dettagli</h2>
                </div>
                <div className="w-11 h-11 flex items-center justify-center" />
            </header>
            <main className="flex-1 p-4 flex flex-col overflow-y-auto" style={{ touchAction: 'pan-y' }}>
                <div className="space-y-4">
                     <div>
                        <label htmlFor="amount" className="block text-base font-medium text-slate-700 mb-1">Importo</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <CurrencyEuroIcon className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                ref={amountInputRef}
                                id="amount"
                                name="amount"
                                type="text"
                                inputMode="decimal"
                                value={amountStr}
                                onChange={handleInputChange}
                                onFocus={() => setIsAmountFocused(true)}
                                onBlur={() => setIsAmountFocused(false)}
                                className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-base"
                                placeholder="0,00"
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-base font-medium text-slate-700 mb-1">Descrizione</label>
                        <div className="relative">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <DocumentTextIcon className="h-5 w-5 text-slate-400" />
                            </div>
                            <input
                                ref={descriptionInputRef}
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

                    <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
                        <div>
                            <label className="block text-base font-medium text-slate-700 mb-1">Frequenza</label>
                            <button
                                type="button"
                                onClick={() => setIsFrequencyModalOpen(true)}
                                className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                            >
                                <span className="truncate flex-1 capitalize">
                                    {formData.frequency === 'recurring' ? 'Ricorrente' : formData.frequency === 'single' ? 'Singolo' : 'Seleziona'}
                                </span>
                                <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label htmlFor="date" className="block text-base font-medium text-slate-700 mb-1">
                                    {formData.frequency === 'recurring' ? 'Data di inizio' : 'Data'}
                                </label>
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
                                <label htmlFor="time" className="block text-base font-medium text-slate-700 mb-1">Ora</label>
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                        <ClockIcon className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        id="time"
                                        name="time"
                                        type="time"
                                        value={formData.time || ''}
                                        onChange={handleInputChange}
                                        className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-base"
                                    />
                                </div>
                            </div>
                        </div>
                        {formData.frequency === 'recurring' && (
                             <>
                                <div>
                                    <label className="block text-base font-medium text-slate-700 mb-1">Ricorrenza</label>
                                    <button
                                        type="button"
                                        onClick={() => setIsRecurrenceModalOpen(true)}
                                        className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                                    >
                                        <span className="truncate flex-1 capitalize">
                                            {getRecurrenceLabel(formData.recurrence as any) || 'Imposta ricorrenza'}
                                        </span>
                                        <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4 items-end">
                                    <div>
                                        <label className="block text-base font-medium text-slate-700 mb-1">Termina</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsRecurrenceEndModalOpen(true)}
                                            className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                                        >
                                            <span className="truncate flex-1">
                                                {getRecurrenceEndLabel()}
                                            </span>
                                            <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                                        </button>
                                    </div>

                                    {formData.recurrenceEndType === 'date' && (
                                        <div className="animate-fade-in-up">
                                            <label className="block text-base font-medium text-slate-700 mb-1 invisible" aria-hidden="true">Data fine</label>
                                            <label
                                                htmlFor="recurrence-end-date"
                                                className="relative w-full flex items-center justify-center gap-2 px-3 py-2.5 text-base rounded-lg focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 text-indigo-600 hover:bg-indigo-100 font-semibold cursor-pointer"
                                            >
                                                <CalendarIcon className="h-5 w-5" />
                                                <span>
                                                    {formData.recurrenceEndDate
                                                        ? formatDate(parseLocalYYYYMMDD(formData.recurrenceEndDate)!)
                                                        : 'Seleziona'}
                                                </span>
                                                <input
                                                    id="recurrence-end-date"
                                                    type="date"
                                                    name="recurrenceEndDate"
                                                    value={formData.recurrenceEndDate || ''}
                                                    onChange={handleInputChange}
                                                    min={formData.date}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                    aria-label="Data di fine ricorrenza"
                                                />
                                            </label>
                                        </div>
                                    )}
                                    {formData.recurrenceEndType === 'count' && (
                                        <div className="animate-fade-in-up">
                                            <label htmlFor="recurrence-count" className="block text-base font-medium text-slate-700 mb-1">N. di volte</label>
                                            <input
                                                type="number"
                                                id="recurrence-count"
                                                name="recurrenceCount"
                                                value={formData.recurrenceCount || ''}
                                                onChange={handleInputChange}
                                                min="1"
                                                placeholder="Es. 12"
                                                className="block w-full rounded-md border border-slate-300 bg-white py-2.5 px-3 text-slate-900 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-base"
                                            />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
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

            {isFrequencyModalOpen && (
                 <div
                    className={`absolute inset-0 z-[60] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isFrequencyModalAnimating ? 'opacity-100' : 'opacity-0'} bg-slate-900/60 backdrop-blur-sm`}
                    onClick={handleCloseFrequencyModal}
                    aria-modal="true" role="dialog"
                >
                    <div
                        className={`bg-white rounded-lg shadow-xl w-full max-w-xs transform transition-all duration-300 ease-in-out ${isFrequencyModalAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center p-4 border-b border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800">Seleziona Frequenza</h2>
                            <button type="button" onClick={handleCloseFrequencyModal} className="text-slate-500 hover:text-slate-800 transition-colors p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Chiudi">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                             <button onClick={() => handleFrequencySelect('single')} className="w-full text-center px-4 py-3 text-base font-semibold rounded-lg transition-colors bg-slate-100 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800">Singolo</button>
                             <button onClick={() => handleFrequencySelect('recurring')} className="w-full text-center px-4 py-3 text-base font-semibold rounded-lg transition-colors bg-slate-100 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800">Ricorrente</button>
                        </div>
                    </div>
                </div>
            )}
            
            {isRecurrenceModalOpen && (
                <div
                    className={`absolute inset-0 z-[60] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isRecurrenceModalAnimating ? 'opacity-100' : 'opacity-0'} bg-slate-900/60 backdrop-blur-sm`}
                    onClick={handleCloseRecurrenceModal}
                    aria-modal="true"
                    role="dialog"
                >
                    <div
                        className={`bg-white rounded-lg shadow-xl w-full max-w-sm transform transition-all duration-300 ease-in-out ${isRecurrenceModalAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <header className="flex justify-between items-center p-4 border-b border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800">Imposta Ricorrenza</h2>
                            <button type="button" onClick={handleCloseRecurrenceModal} className="text-slate-500 hover:text-slate-800 transition-colors p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Chiudi">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </header>
                        
                        <main className="p-4 space-y-4">
                            <div className="relative">
                                <button
                                    onClick={() => setIsRecurrenceOptionsOpen(prev => !prev)}
                                    className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                                >
                                    <span className="truncate flex-1 capitalize">
                                        {getRecurrenceLabel(tempRecurrence as any) || 'Seleziona'}
                                    </span>
                                    <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform ${isRecurrenceOptionsOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isRecurrenceOptionsOpen && (
                                    <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 shadow-lg rounded-lg z-10 p-2 space-y-1 animate-fade-in-down">
                                        {(Object.keys(recurrenceLabels) as Array<keyof typeof recurrenceLabels>).map((key) => (
                                            <button
                                                key={key}
                                                onClick={() => {
                                                    setTempRecurrence(key);
                                                    setIsRecurrenceOptionsOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-3 text-base font-semibold rounded-lg transition-colors bg-slate-50 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800"
                                            >
                                                {recurrenceLabels[key]}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {tempRecurrence === 'monthly' && (
                                <div className="animate-fade-in-up pt-2" style={{animationDuration: '200ms'}}>
                                    <div className="flex items-center justify-center gap-2 bg-slate-100 p-3 rounded-lg">
                                        <span className="text-base text-slate-700">Ogni</span>
                                        <input
                                            type="number"
                                            value={tempRecurrenceInterval || ''}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === '') {
                                                    setTempRecurrenceInterval(undefined);
                                                } else {
                                                    const num = parseInt(val, 10);
                                                    if (!isNaN(num) && num > 0) {
                                                        setTempRecurrenceInterval(num);
                                                    }
                                                }
                                            }}
                                            onFocus={(e) => e.target.select()}
                                            className="w-12 text-center text-lg font-bold text-slate-800 bg-transparent border-0 border-b-2 border-slate-400 focus:ring-0 focus:outline-none focus:border-indigo-600 p-0"
                                            min="1"
                                        />
                                        <span className="text-base text-slate-700">
                                            {(tempRecurrenceInterval || 1) === 1 ? 'mese' : 'mesi'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </main>

                        <footer className="px-4 py-3 bg-slate-100 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCloseRecurrenceModal}
                                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                            >
                                Annulla
                            </button>
                            <button
                                type="button"
                                onClick={handleApplyRecurrence}
                                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                            >
                                Applica
                            </button>
                        </footer>
                    </div>
                </div>
            )}

            {isRecurrenceEndModalOpen && (
                <div
                    className={`absolute inset-0 z-[60] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isRecurrenceEndModalAnimating ? 'opacity-100' : 'opacity-0'} bg-slate-900/60 backdrop-blur-sm`}
                    onClick={handleCloseRecurrenceEndModal}
                    aria-modal="true"
                    role="dialog"
                >
                    <div
                        className={`bg-white rounded-lg shadow-xl w-full max-w-xs transform transition-all duration-300 ease-in-out ${isRecurrenceEndModalAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center p-4 border-b border-slate-200">
                            <h2 className="text-lg font-bold text-slate-800">Termina Ripetizione</h2>
                            <button type="button" onClick={handleCloseRecurrenceEndModal} className="text-slate-500 hover:text-slate-800 transition-colors p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Chiudi">
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                            <button onClick={() => handleRecurrenceEndTypeSelect('forever')} className="w-full text-center px-4 py-3 text-base font-semibold rounded-lg transition-colors bg-slate-100 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800">Per sempre</button>
                            <button onClick={() => handleRecurrenceEndTypeSelect('date')} className="w-full text-center px-4 py-3 text-base font-semibold rounded-lg transition-colors bg-slate-100 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800">Fino a</button>
                            <button onClick={() => handleRecurrenceEndTypeSelect('count')} className="w-full text-center px-4 py-3 text-base font-semibold rounded-lg transition-colors bg-slate-100 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800">Numero di volte</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default TransactionDetailPage;