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
  onMenuStateChange: (isOpen: boolean) => void;
  dateError: boolean;
}

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
    s = recurrenceLabels[recurrence];
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

/* ================= TAP helper (niente swipe) ================= */
const isFocusable = (el: HTMLElement | null) =>
  !!el && (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );

const findFocusTarget = (start: HTMLElement, root: HTMLElement) => {
  const sel = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

  if (start.matches(sel)) return start;

  const viaLabel = start.closest('label');
  if (viaLabel) {
    const forId = viaLabel.getAttribute('for');
    if (forId) {
      const byId = root.querySelector<HTMLElement>(`#${CSS.escape(forId)}`);
      if (byId) return byId;
    }
    const nested = viaLabel.querySelector<HTMLElement>(sel);
    if (nested) return nested;
  }

  const container = start.closest<HTMLElement>('.relative, .input-wrapper, .field');
  if (container) {
    const nested = container.querySelector<HTMLElement>(sel);
    if (nested) return nested;
  }

  return start.closest<HTMLElement>(sel);
};
/* ============================================================ */

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
  const amountInputRef = useRef<HTMLInputElement>(null);

  const [activeMenu, setActiveMenu] = useState<'account' | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [isAmountFocused, setIsAmountFocused] = useState(false);

  const [isFrequencyModalOpen, setIsFrequencyModalOpen] = useState(false);
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);

  // comunica al parent quando un menu/modale è aperto (senza toccare lo swipe)
  useEffect(() => {
    onMenuStateChange(!!(activeMenu || isFrequencyModalOpen || isRecurrenceModalOpen));
  }, [activeMenu, isFrequencyModalOpen, isRecurrenceModalOpen, onMenuStateChange]);

  // sync amount string <- parent (solo quando non sto editando)
  useEffect(() => {
    if (!isAmountFocused) {
      const parent = formData.amount ?? 0;
      const local = parseFloat((amountStr || '0').replace(',', '.')) || 0;
      if (Math.abs(parent - local) > 1e-9) {
        setAmountStr(parent === 0 ? '' : String(parent).replace('.', ','));
      }
    }
  }, [formData.amount, isAmountFocused, amountStr]);

  // sync parent <- amount string
  useEffect(() => {
    const num = parseFloat((amountStr || '').replace(',', '.'));
    const next = isNaN(num) ? 0 : num;
    if (next !== formData.amount) onFormChange({ amount: next });
  }, [amountStr, formData.amount, onFormChange]);

  /* =============== TAP guard in capture: elimina tap “a vuoto” =============== */
  const cancelNextClick = useRef(false);
  const ptr = useRef<{ id: number | null; startX: number; startY: number; moved: boolean; target: HTMLElement | null; }>({
    id: null, startX: 0, startY: 0, moved: false, target: null
  });
  const SLOP = 12;

  const onRootPointerDownCapture = useCallback((e: React.PointerEvent) => {
    const root = rootRef.current;
    if (!root) return;
    // se arrivo da fuori, blur per evitare focus “appiccicato” dalla pagina precedente
    const ae = document.activeElement as HTMLElement | null;
    if (ae && !root.contains(ae)) ae.blur();
    ptr.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, target: e.target as HTMLElement };
  }, []);

  const onRootPointerMoveCapture = useCallback((e: React.PointerEvent) => {
    if (ptr.current.id !== e.pointerId) return;
    const dx = e.clientX - ptr.current.startX;
    const dy = e.clientY - ptr.current.startY;
    if (!ptr.current.moved && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SLOP) {
      ptr.current.moved = true;
      cancelNextClick.current = true;
    }
  }, []);

  const onRootPointerUpCapture = useCallback((e: React.PointerEvent) => {
    const root = rootRef.current;
    if (!root || ptr.current.id !== e.pointerId) return;
    const wasSwipe = ptr.current.moved;

    if (!wasSwipe && ptr.current.target) {
      const focusEl = findFocusTarget(ptr.current.target, root);
      if (focusEl && isFocusable(focusEl) && focusEl !== document.activeElement) {
        requestAnimationFrame(() => {
          (focusEl as HTMLElement).focus({ preventScroll: true });
          const t = focusEl as HTMLInputElement;
          if (t.type === 'date' || t.type === 'time') t.click?.(); // apre nativo al primo tap
        });
      }
    }
    setTimeout(() => { cancelNextClick.current = false; }, 0);
    ptr.current.id = null;
  }, []);

  const onRootClickCapture = useCallback((e: React.MouseEvent) => {
    if (cancelNextClick.current) {
      e.preventDefault();
      e.stopPropagation();
      cancelNextClick.current = false;
    }
  }, []);
  /* ========================================================================== */

  if (typeof formData.amount !== 'number') {
    return (
      <div
        ref={rootRef}
        tabIndex={-1}
        className="flex flex-col h-full bg-slate-100 items-center justify-center p-4"
        style={{ touchAction: 'pan-y' }}
        onPointerDownCapture={onRootPointerDownCapture}
        onPointerMoveCapture={onRootPointerMoveCapture}
        onPointerUpCapture={onRootPointerUpCapture}
        onClickCapture={onRootClickCapture}
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

  const isFrequencySet = !!formData.frequency;
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
            onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); e.preventDefault(); } }}
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
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); e.preventDefault(); } }}
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
      data-details-page
      className="flex flex-col h-full bg-slate-100 focus:outline-none"
      style={{ touchAction: 'pan-y' }}
      onPointerDownCapture={onRootPointerDownCapture}
      onPointerMoveCapture={onRootPointerMoveCapture}
      onPointerUpCapture={onRootPointerUpCapture}
      onClickCapture={onRootClickCapture}
    >
      <header className="p-4 flex items-center justify-between gap-4 text-slate-800 bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-4">
          {!isDesktop && (
            <button
              onClick={() => {
                (document.activeElement as HTMLElement | null)?.blur?.();
                onClose();
              }}
              className="p-2 rounded-full hover:bg-slate-200"
              aria-label="Torna alla calcolatrice"
            >
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
                ref={amountInputRef}
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
                onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); e.preventDefault(); } }}
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
                onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); e.preventDefault(); } }}
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

          {!isFrequencySet && DateTimeInputs}

          <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-4">
            <div>
              <label className="block text-base font-medium text-slate-700 mb-1">Frequenza</label>
              <button
                type="button"
                onClick={() => {
                  (document.activeElement as HTMLElement | null)?.blur?.();
                  setIsFrequencyModalOpen(true);
                }}
                className={`w-full flex items-center justify-between text-left gap-2 px-3 py-2.5 text-base rounded-lg border shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${
                  isFrequencySet
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

            {isFrequencySet && DateTimeInputs}

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
            onClick={() => {
              (document.activeElement as HTMLElement | null)?.blur?.();
              onSubmit({ ...(formData as any), category: formData.category || 'Altro' });
            }}
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
        onSelect={(accountId) => {
          onFormChange({ accountId });
          setActiveMenu(null);
        }}
      />

      {isFrequencyModalOpen && (
        <ModalOverlay title="Seleziona Frequenza" onClose={() => setIsFrequencyModalOpen(false)}>
          <div className="p-4 space-y-2">
            <button onClick={() => {
              onFormChange({
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
              setIsFrequencyModalOpen(false);
            }} className="w-full px-4 py-3 text-base font-semibold rounded-lg bg-slate-100 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800">Nessuna</button>

            <button onClick={() => {
              onFormChange({
                frequency: 'recurring',
                time: undefined,
                recurrence: 'monthly',
                recurrenceEndType: 'count',
                recurrenceCount: 1,
                recurrenceEndDate: undefined,
              });
              setIsFrequencyModalOpen(false);
            }} className="w-full px-4 py-3 text-base font-semibold rounded-lg bg-slate-100 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800">Singolo</button>

            <button onClick={() => {
              onFormChange({
                frequency: 'recurring',
                time: undefined,
                recurrence: formData.recurrence || 'monthly',
                recurrenceEndType: 'forever',
                recurrenceCount: undefined,
                recurrenceEndDate: undefined,
              });
              setIsFrequencyModalOpen(false);
            }} className="w-full px-4 py-3 text-base font-semibold rounded-lg bg-slate-100 text-slate-800 hover:bg-indigo-100 hover:text-indigo-800">Ricorrente</button>
          </div>
        </ModalOverlay>
      )}

      {isRecurrenceModalOpen && (
        <ModalOverlay title="Imposta Ricorrenza" onClose={() => setIsRecurrenceModalOpen(false)}>
          {/* Mantieni il tuo contenuto esistente qui se ne avevi uno personalizzato;
              il “tap fix” lavora sopra in capture e non richiede altro. */}
          <div className="p-4 text-slate-600">
            Configura la ricorrenza come preferisci (contenuto invariato rispetto alla tua UI).
          </div>
        </ModalOverlay>
      )}
    </div>
  );
};

const ModalOverlay: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div
    className="absolute inset-0 z-[60] flex justify-center items-center p-4 bg-slate-900/60 backdrop-blur-sm"
    onClick={onClose}
    aria-modal="true"
    role="dialog"
  >
    <div
      className="bg-white rounded-lg shadow-xl w-full max-w-sm transform transition-all duration-200 scale-100 opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <header className="flex justify-between items-center p-4 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500" aria-label="Chiudi">
          <XMarkIcon className="w-6 h-6" />
        </button>
      </header>
      {children}
    </div>
  </div>
);

export default TransactionDetailPage;
