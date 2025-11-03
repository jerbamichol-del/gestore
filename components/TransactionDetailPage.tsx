
// TransactionDetailPage.tsx
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
  onInputFocusChange: (isFocused: boolean) => void;
  dateError: boolean;
}

const toYYYYMMDD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentTime = () => new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

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

const daysOfWeekLabels = {
    0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Gio', 5: 'Ven', 6: 'Sab'
};
const dayOfWeekNames = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const ordinalSuffixes = ['primo', 'secondo', 'terzo', 'quarto', 'ultimo'];

const formatShortDate = (dateString: string | undefined): string => {
    if (!dateString) return '';
    const date = parseLocalYYYYMMDD(dateString);
    if (!date) return '';
    return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(date);
};

const getRecurrenceSummary = (
    expense: Partial<Expense>
): string => {
    if (expense.frequency !== 'recurring' || !expense.recurrence) {
        return 'Imposta ricorrenza';
    }

    const { 
        recurrence, 
        recurrenceInterval = 1, 
        recurrenceDays, 
        monthlyRecurrenceType, 
        date: dateString,
        recurrenceEndType = 'forever',
        recurrenceEndDate,
        recurrenceCount
    } = expense;

    let summary = '';

    // Part 1: Frequency and Interval
    if (recurrenceInterval === 1) {
        summary = recurrenceLabels[recurrence]; // Giornaliera, Settimanale, etc.
    } else {
        switch (recurrence) {
            case 'daily': summary = `Ogni ${recurrenceInterval} giorni`; break;
            case 'weekly': summary = `Ogni ${recurrenceInterval} sett.`; break; // Abbreviate
            case 'monthly': summary = `Ogni ${recurrenceInterval} mesi`; break;
            case 'yearly': summary = `Ogni ${recurrenceInterval} anni`; break;
        }
    }

    // Part 2: Specific details
    if (recurrence === 'weekly' && recurrenceDays && recurrenceDays.length > 0) {
        const orderedDays = [...recurrenceDays].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
        const dayLabels = orderedDays.map(d => daysOfWeekLabels[d as keyof typeof daysOfWeekLabels]);
        summary += `: ${dayLabels.join(', ')}`;
    }

    if (recurrence === 'monthly' && monthlyRecurrenceType === 'dayOfWeek' && dateString) {
        const date = parseLocalYYYYMMDD(dateString);
        if (date) {
            const dayOfMonth = date.getDate();
            const dayOfWeek = date.getDay();
            const weekOfMonth = Math.floor((dayOfMonth - 1) / 7);
            const dayName = dayOfWeekNames[dayOfWeek].substring(0, 3); // Abbreviate
            const ordinal = ordinalSuffixes[weekOfMonth];
            summary += ` (${ordinal} ${dayName}.)`;
        }
    }

    // Part 3: End condition
    if (recurrenceEndType === 'date' && recurrenceEndDate) {
        summary += `, fino al ${formatShortDate(recurrenceEndDate)}`;
    } else if (recurrenceEndType === 'count' && recurrenceCount && recurrenceCount > 0) {
        summary += `, ${recurrenceCount} volte`;
    }

    return summary;
};


const getIntervalLabel = (recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly', interval?: number) => {
    const count = interval || 1;
    switch (recurrence) {
        case 'daily': return count === 1 ? 'giorno' : 'giorni';
        case 'weekly': return count === 1 ? 'settimana' : 'settimane';
        case 'monthly': return count === 1 ? 'mese' : 'mesi';
        case 'yearly': return count === 1 ? 'anno' : 'anni';
        default: return 'mese'; // fallback
    }
};

const daysOfWeekForPicker = [
    { label: 'Lun', value: 1 },
    { label: 'Mar', value: 2 },
    { label: 'Mer', value: 3 },
    { label: 'Gio', value: 4 },
    { label: 'Ven', value: 5 },
    { label: 'Sab', value: 6 },
    { label: 'Dom', value: 0 },
];

const TransactionDetailPage = React.forwardRef<HTMLDivElement, TransactionDetailPageProps>(({
  formData,
  onFormChange,
  accounts,
  onClose,
  onSubmit,
  isDesktop,
  onMenuStateChange,
  onInputFocusChange,
  dateError,
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
  const [isRecurrenceEndOptionsOpen, setIsRecurrenceEndOptionsOpen] = useState(false);
  const [tempRecurrence, setTempRecurrence] = useState(formData.recurrence);
  const [tempRecurrenceInterval, setTempRecurrenceInterval] = useState<number | undefined>(formData.recurrenceInterval);
  const [tempRecurrenceDays, setTempRecurrenceDays] = useState<number[] | undefined>(formData.recurrenceDays);
  const [tempMonthlyRecurrenceType, setTempMonthlyRecurrenceType] = useState(formData.monthlyRecurrenceType);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // ===== First-tap fixer: valido SOLO per TAP (non per swipe) =====
  const needsFirstTapFixRef = useRef(false);
  const firstTapDataRef = useRef({
    armed: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    moved: false,
  });
  const TAP_MS = 300;
  const SLOP_PX = 10;

  useEffect(() => {
    const page = (ref as React.RefObject<HTMLDivElement>).current;
    if (!page) return;

    const handleFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        onInputFocusChange(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        onInputFocusChange(false);
      }
    };

    page.addEventListener('focusin', handleFocusIn);
    page.addEventListener('focusout', handleFocusOut);

    return () => {
      page.removeEventListener('focusin', handleFocusIn);
      page.removeEventListener('focusout', handleFocusOut);
    };
  }, [ref, onInputFocusChange]);
  
  useEffect(() => {
    const onActivated = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail === 'details') {
        needsFirstTapFixRef.current = true;
        firstTapDataRef.current = { armed: false, startX: 0, startY: 0, startTime: 0, moved: false };
      }
    };
    window.addEventListener('page-activated', onActivated as EventListener);
    return () => window.removeEventListener('page-activated', onActivated as EventListener);
  }, []);

  const onFirstTapPointerDownCapture: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!needsFirstTapFixRef.current) return;
    firstTapDataRef.current.armed = true;
    firstTapDataRef.current.startX = e.clientX ?? 0;
    firstTapDataRef.current.startY = e.clientY ?? 0;
    firstTapDataRef.current.startTime = performance.now();
    firstTapDataRef.current.moved = false;
  };

  const onFirstTapPointerMoveCapture: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const d = firstTapDataRef.current;
    if (!d.armed || d.moved) return;
    const dx = Math.abs((e.clientX ?? 0) - d.startX);
    const dy = Math.abs((e.clientY ?? 0) - d.startY);
    if (dx > SLOP_PX || dy > SLOP_PX) {
      // è uno swipe: disarmo e lascio passare il gesto
      d.moved = true;
      d.armed = false;
      needsFirstTapFixRef.current = false;
    }
  };

  const onFirstTapPointerUpCapture: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const d = firstTapDataRef.current;
    if (!d.armed) return;

    const dt = performance.now() - d.startTime;
    const isTap = !d.moved && dt < TAP_MS;

    d.armed = false;
    needsFirstTapFixRef.current = false;

    if (!isTap) return; // swipe o tap lungo: non facciamo nulla

    // TAP breve: trasformiamo il “primo tap a vuoto” in tap valido
    const raw = e.target as HTMLElement;
    const focusable = (raw.closest('input,button,select,[role="button"],label') as HTMLElement) || raw;
    try {
      if (focusable instanceof HTMLLabelElement) {
        const forId = (focusable as HTMLLabelElement).htmlFor;
        if (forId) {
          const labelled = document.getElementById(forId) as HTMLElement | null;
          labelled?.focus?.({ preventScroll: true } as any);
          setTimeout(() => labelled?.click?.(), 0);
        } else {
          setTimeout(() => (focusable as any).click?.(), 0);
        }
      } else {
        (focusable as any).focus?.({ preventScroll: true });
        setTimeout(() => (focusable as any).click?.(), 0);
      }
    } catch {}

    e.preventDefault();
    e.stopPropagation();
  };

  const onFirstTapPointerCancelCapture: React.PointerEventHandler<HTMLDivElement> = () => {
    firstTapDataRef.current.armed = false;
  };
  // ===== fine first-tap fixer =====

  useEffect(() => {
    const isAnyMenuOpen =
      activeMenu !== null || isFrequencyModalOpen || isRecurrenceModalOpen;
    onMenuStateChange(isAnyMenuOpen);
  }, [activeMenu, isFrequencyModalOpen, isRecurrenceModalOpen, onMenuStateChange]);

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
      setTempRecurrenceDays(formData.recurrenceDays || []);
      setTempMonthlyRecurrenceType(formData.monthlyRecurrenceType || 'dayOfMonth');
      setIsRecurrenceOptionsOpen(false);
      const timer = setTimeout(() => setIsRecurrenceModalAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsRecurrenceModalAnimating(false);
    }
  }, [isRecurrenceModalOpen, formData.recurrence, formData.recurrenceInterval, formData.recurrenceDays, formData.monthlyRecurrenceType]);

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
  }, [formData.amount, isAmountFocused, amountStr]);

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
    if (name === 'recurrenceEndDate' && value === '') {
        onFormChange({ recurrenceEndType: 'forever', recurrenceEndDate: undefined });
        return;
    }
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

  const handleFrequencySelect = (frequency: 'none' | 'single' | 'recurring') => {
    const updates: Partial<Omit<Expense, 'id'>> = {};

    if (frequency === 'none') {
        updates.frequency = undefined;
        updates.date = toYYYYMMDD(new Date());
        updates.time = getCurrentTime();
        // Clear all recurrence fields
        updates.recurrence = undefined;
        updates.monthlyRecurrenceType = undefined;
        updates.recurrenceInterval = undefined;
        updates.recurrenceDays = undefined;
        updates.recurrenceEndType = 'forever';
        updates.recurrenceEndDate = undefined;
        updates.recurrenceCount = undefined;
    } else { // 'single' or 'recurring'
        updates.frequency = 'recurring'; // Both are recurring templates now
        updates.time = undefined;
        // set default recurrence if not set
        if (!formData.recurrence) {
            updates.recurrence = 'monthly';
        }

        if (frequency === 'single') {
            updates.recurrenceEndType = 'count';
            updates.recurrenceCount = 1;
            updates.recurrenceEndDate = undefined; // clear other end types
        } else { // 'recurring'
            updates.recurrenceEndType = 'forever';
            updates.recurrenceCount = undefined;
            updates.recurrenceEndDate = undefined;
        }
    }
    onFormChange(updates);
    handleCloseFrequencyModal();
  };

  const handleCloseFrequencyModal = () => {
    setIsFrequencyModalAnimating(false);
    setIsFrequencyModalOpen(false);
  };

  const handleCloseRecurrenceModal = () => {
    setIsRecurrenceModalAnimating(false);
    setIsRecurrenceModalOpen(false);
  };

  const handleApplyRecurrence = () => {
    onFormChange({
      recurrence: tempRecurrence as any,
      recurrenceInterval: tempRecurrenceInterval || 1,
      recurrenceDays: tempRecurrence === 'weekly' ? tempRecurrenceDays : undefined,
      monthlyRecurrenceType: tempRecurrence === 'monthly' ? tempMonthlyRecurrenceType : undefined,
    });
    handleCloseRecurrenceModal();
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
    setIsRecurrenceEndOptionsOpen(false);
  };
  
  const handleToggleDay = (dayValue: number) => {
    setTempRecurrenceDays(prevDays => {
        const currentDays = prevDays || [];
        const newDays = currentDays.includes(dayValue)
            ? currentDays.filter(d => d !== dayValue)
            : [...currentDays, dayValue];
        // Sort: Mon, Tue, ..., Sun
        return newDays.sort((a, b) => {
            const dayA = a === 0 ? 7 : a;
            const dayB = b === 0 ? 7 : b;
            return dayA - dayB;
        });
    });
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
  
  const dynamicMonthlyDayOfWeekLabel = useMemo(() => {
    const dateString = formData.date;
    if (!dateString) return "Seleziona una data di inizio valida";
    const date = parseLocalYYYYMMDD(dateString);
    if (!date) return "Data non valida";

    const dayOfMonth = date.getDate();
    const dayOfWeek = date.getDay();
    const weekOfMonth = Math.floor((dayOfMonth - 1) / 7);

    return `Ogni ${ordinalSuffixes[weekOfMonth]} ${dayOfWeekNames[dayOfWeek]} del mese`;
  }, [formData.date]);


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
      <div
        ref={ref}
        tabIndex={-1}
        className="flex flex-col h-full bg-slate-100 items-center justify-center p-4"
      >
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

  const isFrequencySet = !!formData.frequency;

  const DateTimeInputs = (
    <div className={`grid ${!formData.frequency ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
      <div>
        <label htmlFor="date" className={`block text-base font-medium mb-1 transition-colors ${dateError ? 'text-red-600' : 'text-slate-700'}`}>
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
            className={`block w-full rounded-md border bg-white py-2.5 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:outline-none text-base ${dateError ? 'border-red-500 ring-1 ring-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'}`}
          />
        </div>
        {dateError && <p className="mt-1 text-sm text-red-600 animate-fade-in-up" style={{ animationDuration: '150ms' }}>Per favore, imposta una data.</p>}
      </div>
      {!formData.frequency && (
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
      )}
    </div>
  );


  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="flex flex-col h-full bg-slate-100 focus:outline-none"
      onPointerDownCapture={onFirstTapPointerDownCapture}
      onPointerMoveCapture={onFirstTapPointerMoveCapture}
      onPointerUpCapture={onFirstTapPointerUpCapture}
      onPointerCancelCapture={onFirstTapPointerCancelCapture}
    >
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

          {!isFrequencySet && DateTimeInputs}

          <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
            <div>
              <label className="block text-base font-medium text-slate-700 mb-1">Frequenza</label>
              <button
                type="button"
                onClick={() => setIsFrequencyModalOpen(true)}
                className={`w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${
                  isFrequencySet
                    ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                    : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span className="truncate flex-1 capitalize">
                  {formData.frequency === 'recurring' ? 'Ricorrente' : formData.frequency === 'single' ? 'Singolo' : 'Nessuna'}
                </span>
                <ChevronDownIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {isFrequencySet && DateTimeInputs}

            {formData.frequency === 'recurring' && (
              <div>
                <label className="block text-base font-medium text-slate-700 mb-1">Ricorrenza</label>
                <button
                  type="button"
                  onClick={() => setIsRecurrenceModalOpen(true)}
                  className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                >
                  <span className="truncate flex-1">
                    {getRecurrenceSummary(formData)}
                  </span>
                  <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                </button>
              </div>
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
              <button onClick={() => handleFrequencySelect('none')} className="w-full text-center px-4 py-3 text-base font-semibold rounded-lg transition-colors bg-slate-100 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800">Nessuna</button>
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
                  onClick={() => { setIsRecurrenceOptionsOpen(prev => !prev); setIsRecurrenceEndOptionsOpen(false); }}
                  className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                >
                  <span className="truncate flex-1 capitalize">
                    {recurrenceLabels[tempRecurrence as keyof typeof recurrenceLabels] || 'Seleziona'}
                  </span>
                  <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform ${isRecurrenceOptionsOpen ? 'rotate-180' : ''}`} />
                </button>

                {isRecurrenceOptionsOpen && (
                  <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 shadow-lg rounded-lg z-20 p-2 space-y-1 animate-fade-in-down">
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
                    onFocus={(e) => e.currentTarget.select()}
                    className="w-12 text-center text-lg font-bold text-slate-800 bg-transparent border-0 border-b-2 border-slate-400 focus:ring-0 focus:outline-none focus:border-indigo-600 p-0"
                    min="1"
                  />
                  <span className="text-base text-slate-700">
                    {getIntervalLabel(tempRecurrence as any, tempRecurrenceInterval)}
                  </span>
                </div>
              </div>

              {tempRecurrence === 'weekly' && (
                <div className="animate-fade-in-up pt-2">
                  <div className="flex flex-wrap justify-center gap-2">
                    {daysOfWeekForPicker.map(day => (
                      <button
                        key={day.value}
                        onClick={() => handleToggleDay(day.value)}
                        className={`w-14 h-14 rounded-full text-sm font-semibold transition-colors focus:outline-none border-2 ${
                          (tempRecurrenceDays || []).includes(day.value)
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-800 border-indigo-400 hover:bg-indigo-50'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {tempRecurrence === 'monthly' && (
                <div className="animate-fade-in-up pt-4 space-y-2 border-t border-slate-200">
                  <div
                    role="radio"
                    aria-checked={tempMonthlyRecurrenceType === 'dayOfMonth'}
                    onClick={() => setTempMonthlyRecurrenceType('dayOfMonth')}
                    className="flex items-center gap-3 p-2 cursor-pointer rounded-lg hover:bg-slate-100"
                  >
                    <div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center flex-shrink-0">
                      {tempMonthlyRecurrenceType === 'dayOfMonth' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                    </div>
                    <label className="text-sm font-medium text-slate-700 cursor-pointer">Lo stesso giorno di ogni mese</label>
                  </div>
                  <div
                    role="radio"
                    aria-checked={tempMonthlyRecurrenceType === 'dayOfWeek'}
                    onClick={() => setTempMonthlyRecurrenceType('dayOfWeek')}
                    className="flex items-center gap-3 p-2 cursor-pointer rounded-lg hover:bg-slate-100"
                  >
                    <div className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center flex-shrink-0">
                       {tempMonthlyRecurrenceType === 'dayOfWeek' && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />}
                    </div>
                    <label className="text-sm font-medium text-slate-700 cursor-pointer">{dynamicMonthlyDayOfWeekLabel}</label>
                  </div>
                </div>
              )}
              
              <div className="pt-4 border-t border-slate-200">
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div className={`relative ${!formData.recurrenceEndType || formData.recurrenceEndType === 'forever' ? 'col-span-2' : ''}`}>
                    <button
                      type="button"
                      onClick={() => { setIsRecurrenceEndOptionsOpen(prev => !prev); setIsRecurrenceOptionsOpen(false); }}
                      className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                    >
                      <span className="truncate flex-1 capitalize">
                        {getRecurrenceEndLabel()}
                      </span>
                      <ChevronDownIcon className={`w-5 h-5 text-slate-500 transition-transform ${isRecurrenceEndOptionsOpen ? 'rotate-180' : ''}`} />
                    </button>
                     {isRecurrenceEndOptionsOpen && (
                        <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 shadow-lg rounded-lg z-10 p-2 space-y-1 animate-fade-in-down">
                            {(['forever', 'date', 'count'] as const).map(key => (
                                <button
                                    key={key}
                                    onClick={() => handleRecurrenceEndTypeSelect(key)}
                                    className="w-full text-left px-4 py-3 text-base font-semibold rounded-lg transition-colors bg-slate-50 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800"
                                >
                                    {key === 'forever' ? 'Per sempre' : key === 'date' ? 'Fino a' : 'Numero di volte'}
                                </button>
                            ))}
                        </div>
                    )}
                  </div>

                  {formData.recurrenceEndType === 'date' && (
                    <div className="animate-fade-in-up">
                      <label
                        htmlFor="recurrence-end-date"
                        className="relative w-full flex items-center justify-center gap-2 px-3 py-2.5 text-base rounded-lg focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 text-indigo-600 hover:bg-indigo-100 font-semibold cursor-pointer h-[46.5px]"
                      >
                        <CalendarIcon className="w-5 h-5"/>
                        <span>
                            {formData.recurrenceEndDate ? formatDate(parseLocalYYYYMMDD(formData.recurrenceEndDate)!) : 'Seleziona'}
                        </span>
                        <input
                            type="date"
                            id="recurrence-end-date"
                            name="recurrenceEndDate"
                            value={formData.recurrenceEndDate || ''}
                            onChange={(e) => onFormChange({ recurrenceEndDate: e.target.value, recurrenceEndType: 'date' })}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        />
                      </label>
                    </div>
                  )}
                  {formData.recurrenceEndType === 'count' && (
                  <div className="animate-fade-in-up">
                      <div className="relative">
                          <input
                              type="number"
                              id="recurrence-count"
                              name="recurrenceCount"
                              value={formData.recurrenceCount || ''}
                              onChange={handleInputChange}
                              className="block w-full text-center rounded-md border border-slate-300 bg-white py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-base"
                              placeholder="N."
                              min="1"
                          />
                      </div>
                  </div>
                  )}
                </div>
              </div>

            </main>
            
            <footer className="p-4 bg-slate-100 border-t border-slate-200 flex justify-end">
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

    </div>
  );
});

export default TransactionDetailPage;
