import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Expense, Account } from '../types';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { CreditCardIcon } from './icons/CreditCardIcon';
import { ClockIcon } from './icons/ClockIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { XMarkIcon } from './icons/XMarkIcon';
import { CurrencyEuroIcon } from './icons/CurrencyEuroIcon';
import SelectionMenu from './SelectionMenu';

interface TransactionDetailPageProps {
  formData: Partial<Omit<Expense, 'id'>>;
  onFormChange: (newData: Partial<Omit<Expense, 'id'>>) => void;
  accounts: Account[];
  onClose: () => void;
  onSubmit: (data: Omit<Expense, 'id'>) => void;
  isDesktop: boolean;
  onMenuStateChange: (isOpen: boolean) => void; // lasciato per compatibilità
  dateError: boolean;
}

/* ---------------- helpers ---------------- */
const toYYYYMMDD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getCurrentTime = () =>
  new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

const parseLocalYYYYMMDD = (s?: string | null) => {
  if (!s) return null;
  const [Y, M, D] = s.split('-').map(Number);
  return new Date(Y, M - 1, D);
};

const recurrenceLabels = {
  daily: 'Giornaliera',
  weekly: 'Settimanale',
  monthly: 'Mensile',
  yearly: 'Annuale',
} as const;

const daysOfWeekLabels = { 0: 'Dom', 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Gio', 5: 'Ven', 6: 'Sab' } as const;
const dayOfWeekNames = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
const ordinalSuffixes = ['primo','secondo','terzo','quarto','ultimo'];

const formatShortDate = (s?: string) => {
  const d = parseLocalYYYYMMDD(s);
  if (!d) return '';
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' })
    .format(d)
    .replace('.', '');
};

const getRecurrenceSummary = (e: Partial<Expense>) => {
  if (e.frequency !== 'recurring' || !e.recurrence) return 'Imposta ricorrenza';

  const {
    recurrence,
    recurrenceInterval = 1,
    recurrenceDays,
    monthlyRecurrenceType,
    date: startDate,
    recurrenceEndType = 'forever',
    recurrenceEndDate,
    recurrenceCount,
  } = e;

  let s = '';
  if (recurrenceInterval === 1) {
    s = recurrenceLabels[recurrence as keyof typeof recurrenceLabels];
  } else {
    s =
      recurrence === 'daily'   ? `Ogni ${recurrenceInterval} giorni` :
      recurrence === 'weekly'  ? `Ogni ${recurrenceInterval} sett.` :
      recurrence === 'monthly' ? `Ogni ${recurrenceInterval} mesi` :
                                 `Ogni ${recurrenceInterval} anni`;
  }

  if (recurrence === 'weekly' && recurrenceDays?.length) {
    const ordered = [...recurrenceDays].sort(
      (a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)
    );
    const labels = ordered.map(d => daysOfWeekLabels[d as keyof typeof daysOfWeekLabels]);
    s += `: ${labels.join(', ')}`;
  }

  if (recurrence === 'monthly' && monthlyRecurrenceType === 'dayOfWeek' && startDate) {
    const d = parseLocalYYYYMMDD(startDate);
    if (d) {
      const dom = d.getDate();
      const dow = d.getDay();
      const wom = Math.floor((dom - 1) / 7);
      s += ` (${ordinalSuffixes[wom]} ${dayOfWeekNames[dow].slice(0,3)}.)`;
    }
  }

  if (recurrenceEndType === 'date' && recurrenceEndDate) {
    s += `, fino al ${formatShortDate(recurrenceEndDate)}`;
  } else if (recurrenceEndType === 'count' && recurrenceCount && recurrenceCount > 0) {
    s += `, ${recurrenceCount} volte`;
  }

  return s;
};

const isEditableEl = (el: Element | null) =>
  !!el && (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    (el as HTMLElement).isContentEditable
  );

const STOP_PROP = (e: any) => {
  if (e?.stopPropagation) e.stopPropagation();
  if (e?.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
    e.nativeEvent.stopImmediatePropagation();
  }
};

/* ---------------- component ---------------- */
const TransactionDetailPage: React.FC<TransactionDetailPageProps> = ({
  formData,
  onFormChange,
  accounts,
  onClose,
  onSubmit,
  isDesktop,
  onMenuStateChange,
  dateError,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [activeMenu, setActiveMenu] = useState<'account' | null>(null);

  // Importo: fonte unica = input locale (niente conflitti con calcolatrice)
  const [amountStr, setAmountStr] = useState('');
  const [isAmountFocused, setIsAmountFocused] = useState(false);

  // Init una volta dall’eventuale valore del parent
  useEffect(() => {
    const parent = formData.amount ?? 0;
    setAmountStr(parent === 0 ? '' : String(parent).replace('.', ','));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo mount

  // Sync parent <- input locale
  useEffect(() => {
    const num = parseFloat((amountStr || '').replace(',', '.'));
    const next = isNaN(num) ? 0 : num;
    if (next !== formData.amount) onFormChange({ amount: next });
  }, [amountStr, formData.amount, onFormChange]);

  // Disattiva calcolatrice mentre Dettagli è montata (niente conflitti)
  useEffect(() => {
    const send = (enabled: boolean) =>
      window.dispatchEvent(new CustomEvent('gs:calc:enabled', { detail: enabled }));
    send(false);
    return () => send(true);
  }, []);

  // Disabilita swipe del pager per tutta la durata della schermata
  useEffect(() => {
    onMenuStateChange(true); // segnala “blocco attivo” al container
    return () => onMenuStateChange(false);
  }, [onMenuStateChange]);

  // BLOCCO AGGRESSIVO DEI GESTI VERSO IL PAGER (senza rompere lo scroll interno):
  // Stop *propagazione* in fase di capture per pointer/touch/wheel/click/keydown.
  const onPointerDownCapture = useCallback((e: React.PointerEvent) => {
    // Focus immediato sugli input (niente “primo tap a vuoto”)
    const root = rootRef.current;
    STOP_PROP(e);
    const t = e.target as HTMLElement;
    if (t.matches('input, textarea, select')) {
      t.focus({ preventScroll: true });
      if (t instanceof HTMLInputElement && (t.type === 'text' || t.type === 'number')) {
        requestAnimationFrame(() => t.select?.());
      }
    } else if (root) {
      // Se hai toccato un label, sposta focus al relativo input
      const lbl = t.closest('label');
      if (lbl) {
        const forId = lbl.getAttribute('for');
        if (forId) {
          const byId = root.querySelector<HTMLElement>('#' + CSS.escape(forId));
          byId?.focus?.({ preventScroll: true });
        }
      }
    }
  }, []);

  const onPointerMoveCapture   = useCallback(STOP_PROP, []);
  const onPointerUpCapture     = useCallback(STOP_PROP, []);
  const onPointerCancelCapture = useCallback(STOP_PROP, []);
  const onTouchStartCapture    = useCallback(STOP_PROP, []);
  const onTouchMoveCapture     = useCallback(STOP_PROP, []);
  const onWheelCapture         = useCallback(STOP_PROP, []);
  const onClickCapture         = useCallback(STOP_PROP, []);
  const onKeyDownCapture = useCallback((e: React.KeyboardEvent) => {
    // Impedisci che i tasti vadano a handler globali (calcolatrice/pager)
    if (
      /[0-9,.]/.test(e.key) ||
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'Enter' ||
      e.key === 'Escape' ||
      e.key === 'Tab' ||
      e.key === 'ArrowLeft' || e.key === 'ArrowRight'
    ) {
      STOP_PROP(e);
    }
  }, []);

  if (typeof formData.amount !== 'number') {
    return (
      <div
        ref={rootRef}
        tabIndex={-1}
        className="flex flex-col h-full bg-slate-100 items-center justify-center p-4"
        onPointerDownCapture={onPointerDownCapture}
        onPointerMoveCapture={onPointerMoveCapture}
        onPointerUpCapture={onPointerUpCapture}
        onPointerCancelCapture={onPointerCancelCapture}
        onTouchStartCapture={onTouchStartCapture}
        onTouchMoveCapture={onTouchMoveCapture}
        onWheelCapture={onWheelCapture}
        onClickCapture={onClickCapture}
        onKeyDownCapture={onKeyDownCapture}
        style={{ touchAction: 'pan-y' }}
      >
        <header className="p-4 flex items-center gap-4 text-slate-800 bg-white shadow-sm absolute top-0 left-0 right-0 z-10">
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

  const isSingleRecurring =
    formData.frequency === 'recurring' &&
    formData.recurrenceEndType === 'count' &&
    formData.recurrenceCount === 1;

  const selectedAccountLabel = accounts.find(a => a.id === formData.accountId)?.name;
  const accountOptions = accounts.map(a => ({ value: a.id, label: a.name }));

  const DateTimeInputs = (
    <div className={`grid ${!formData.frequency ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
      <div>
        <label htmlFor="date" className={`block text-base font-medium mb-1 ${dateError ? 'text-red-600' : 'text-slate-700'}`}>
          {isSingleRecurring ? 'Data del Pagamento' : formData.frequency === 'recurring' ? 'Data di inizio' : 'Data'}
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
            onChange={(e) => onFormChange({ date: e.target.value })}
            className={`block w-full rounded-md bg-white py-2.5 pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none ${dateError ? 'border-red-500 ring-1 ring-red-500' : 'border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'}`}
            enterKeyHint="done"
            onKeyDown={(e) => { if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); e.preventDefault(); } }}
          />
        </div>
        {dateError && <p className="mt-1 text-sm text-red-600">Per favore, imposta una data.</p>}
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
              onChange={(e) => onFormChange({ time: e.target.value })}
              className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              enterKeyHint="done"
              onKeyDown={(e) => { if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); e.preventDefault(); } }}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="flex flex-col h-full bg-slate-100 focus:outline-none"
      style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
      onPointerDownCapture={onPointerDownCapture}
      onPointerMoveCapture={onPointerMoveCapture}
      onPointerUpCapture={onPointerUpCapture}
      onPointerCancelCapture={onPointerCancelCapture}
      onTouchStartCapture={onTouchStartCapture}
      onTouchMoveCapture={onTouchMoveCapture}
      onWheelCapture={onWheelCapture}
      onClickCapture={onClickCapture}
      onKeyDownCapture={onKeyDownCapture}
    >
      <header className="p-4 flex items-center justify-between gap-4 text-slate-800 bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          {!isDesktop && (
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200" aria-label="Torna alla calcolatrice">
              <ArrowLeftIcon className="w-6 h-6" />
            </button>
          )}
          <h2 className="text-xl font-bold">Aggiungi Dettagli</h2>
        </div>
        <div className="w-11 h-11" />
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
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => {
                  let s = e.target.value.replace(/[^0-9,]/g, '');
                  const parts = s.split(',');
                  if (parts.length > 2) s = parts[0] + ',' + parts.slice(1).join('');
                  if (parts[1]?.length > 2) s = parts[0] + ',' + parts[1].slice(0, 2);
                  setAmountStr(s);
                }}
                onFocus={() => setIsAmountFocused(true)}
                onBlur={() => setIsAmountFocused(false)}
                className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="0,00"
                enterKeyHint="done"
                onKeyDown={(e) => { if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); e.preventDefault(); } }}
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
                id="description"
                name="description"
                type="text"
                value={formData.description || ''}
                onChange={(e) => onFormChange({ description: e.target.value })}
                className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="Es. Caffè al bar"
                enterKeyHint="done"
                onKeyDown={(e) => { if (e.key === 'Enter') { (e.currentTarget as HTMLInputElement).blur(); e.preventDefault(); } }}
              />
            </div>
          </div>

          <div>
            <label className="block text-base font-medium text-slate-700 mb-1">Conto</label>
            <button
              type="button"
              onClick={() => {
                (document.activeElement as HTMLElement | null)?.blur?.();
                setActiveMenu('account');
              }}
              className="w-full flex items-center text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
            >
              <CreditCardIcon className="h-5 w-5 text-slate-400" />
              <span className="truncate flex-1">{selectedAccountLabel || 'Seleziona'}</span>
              <ChevronDownIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {!formData.frequency && DateTimeInputs}

          <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
            <div>
              <label className="block text-base font-medium text-slate-700 mb-1">Frequenza</label>
              <button
                type="button"
                onClick={() => {
                  (document.activeElement as HTMLElement | null)?.blur?.();
                  window.setTimeout(() => {}, 0);
                  // apre modale
                  setIsFrequencyModalOpen(true);
                }}
                className={`w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${
                  formData.frequency
                    ? 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                    : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <span className="truncate flex-1 capitalize">
                  {isSingleRecurring ? 'Singolo' : formData.frequency === 'recurring' ? 'Ricorrente' : 'Nessuna'}
                </span>
                <ChevronDownIcon className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {formData.frequency && DateTimeInputs}

            {formData.frequency === 'recurring' && !isSingleRecurring && (
              <div>
                <label className="block text-base font-medium text-slate-700 mb-1">Ricorrenza</label>
                <button
                  type="button"
                  onClick={() => {
                    (document.activeElement as HTMLElement | null)?.blur?.();
                    setIsRecurrenceModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                >
                  <span className="truncate flex-1">{getRecurrenceSummary(formData)}</span>
                  <ChevronDownIcon className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={() => onSubmit({ ...(formData as any), category: formData.category || 'Altro' })}
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
        onSelect={(accountId) => { onFormChange({ accountId }); setActiveMenu(null); }}
      />

      {/* Modale Frequenza */}
      <FrequencyModal
        open={false /* verrà gestito nello stesso file o estrai come vuoi */}
        onClose={() => {}}
        onSelect={(mode) => {
          const up: Partial<Expense> = {};
          if (mode === 'none') {
            Object.assign(up, {
              frequency: undefined,
              date: toYYYYMMDD(new Date()),
              time: getCurrentTime(),
              recurrence: undefined,
              monthlyRecurrenceType: undefined,
              recurrenceInterval: undefined,
              recurrenceDays: undefined,
              recurrenceEndType: 'forever',
              recurrenceEndDate: undefined,
              recurrenceCount: undefined,
            });
          } else {
            up.frequency = 'recurring';
            up.time = undefined;
            if (!formData.recurrence) up.recurrence = 'monthly';
            if (mode === 'single') {
              up.recurrenceEndType = 'count';
              up.recurrenceCount = 1;
              up.recurrenceEndDate = undefined;
            } else {
              up.recurrenceEndType = 'forever';
              up.recurrenceCount = undefined;
              up.recurrenceEndDate = undefined;
            }
          }
          onFormChange(up);
        }}
      />
      {/* Se usi già le tue modali originali, lascia pure le tue al posto di questo placeholder */}
    </div>
  );
};

/* --- Placeholder minimale per evitare errori TS se non usi le tue modali --- */
const FrequencyModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelect: (m: 'none' | 'single' | 'recurring') => void;
}> = () => null;

export default TransactionDetailPage;
