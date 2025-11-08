import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Expense, Account } from '../types';
import CalculatorInputScreen from './CalculatorInputScreen';
import TransactionDetailPage from './TransactionDetailPage';

interface CalculatorContainerProps {
  accounts: Account[];
  isDesktop?: boolean;
  onSubmit: (data: Omit<Expense, 'id'>) => void;
  onCancel?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  expenses?: Expense[];
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
}

/** Util */
const toYYYYMMDD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const getCurrentTime = () =>
  new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

const TRANSITION_MS = 80; // reattivo

const CalculatorContainer: React.FC<CalculatorContainerProps> = ({
  accounts,
  isDesktop = false,
  onSubmit,
  onCancel,
  isOpen = true,
  onClose,
}) => {
  /** View state */
  const [view, setView] = useState<'calc' | 'details'>('calc');

  /** Single source of truth per l’importo + form */
  const [amount, setAmount] = useState<number>(0);
  const [formData, setFormData] = useState<Partial<Omit<Expense, 'id'>>>(() => ({
    amount: 0,
    description: '',
    date: toYYYYMMDD(new Date()),
    time: getCurrentTime(),
    accountId: accounts[0]?.id,
    category: 'Altro',
  }));

  /** blocco swipe esterni quando i figli mostrano menu/modali/tastiera */
  const [childBlocksSwipe, setChildBlocksSwipe] = useState(false);

  /** Tastiera (soft keyboard) detection */
  const keyboardOpenRef = useRef(false);
  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;
    const onResize = () => {
      keyboardOpenRef.current = (window.innerHeight - vv.height) > 100;
    };
    vv.addEventListener('resize', onResize);
    onResize();
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  /** Chiudi tastiera senza bloccare l’UI */
  const waitForKeyboardClose = useCallback((maxMs = 200) => {
    return new Promise<void>((resolve) => {
      if (!keyboardOpenRef.current) { resolve(); return; }
      const t0 = performance.now();
      const id = setInterval(() => {
        if (!keyboardOpenRef.current || (performance.now() - t0) > maxMs) {
          clearInterval(id); resolve();
        }
      }, 30);
    });
  }, []);

  /** Navigazione tra viste (immediata; tastiera chiusa in background) */
  const navigateTo = useCallback((next: 'calc' | 'details') => {
    (document.activeElement as HTMLElement | null)?.blur();
    setView(next);
    if (keyboardOpenRef.current) {
      // non bloccare i tap
      waitForKeyboardClose().catch(() => {});
    }
  }, [waitForKeyboardClose]);

  /** Tap-guard per evitare “primo tap a vuoto” */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cancelNextClick = useRef(false);
  const pRef = useRef<{ id: number | null; startX: number; startY: number; moved: boolean }>({
    id: null, startX: 0, startY: 0, moved: false,
  });
  const SLOP = 12;

  const onPDcap = useCallback((e: React.PointerEvent) => {
    pRef.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
    // se l’elemento attivo è fuori, blur per evitare agganci strani
    const root = rootRef.current;
    const ae = document.activeElement as HTMLElement | null;
    if (root && ae && !root.contains(ae)) ae.blur();
  }, []);
  const onPMcap = useCallback((e: React.PointerEvent) => {
    const p = pRef.current; if (p.id !== e.pointerId) return;
    const dx = e.clientX - p.startX; const dy = e.clientY - p.startY;
    if (!p.moved && Math.abs(dx) > SLOP && Math.abs(dx) > Math.abs(dy)) {
      p.moved = true; cancelNextClick.current = true;
    }
  }, []);
  const onPUcap = useCallback((e: React.PointerEvent) => {
    const p = pRef.current; if (p.id !== e.pointerId) return;
    setTimeout(() => { cancelNextClick.current = false; }, 0);
    p.id = null;
  }, []);
  const onClickCap = useCallback((e: React.MouseEvent) => {
    if (cancelNextClick.current) {
      e.preventDefault(); e.stopPropagation(); cancelNextClick.current = false;
    }
  }, []);

  /** Slide wrapper */
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const n = wrapRef.current;
    if (!n) return;
    n.style.transition = `transform ${TRANSITION_MS}ms ease-out`;
    n.style.transform = view === 'calc' ? 'translateX(0%)' : 'translateX(-50%)';
  }, [view]);

  /** Sync tra calculator e dettagli (niente conflitti) */
  // quando cambia l’importo da calcolatrice ⇒ aggiorna formData ma NON toccare altri campi
  const handleAmountFromCalc = useCallback((next: number) => {
    setAmount(next);
    setFormData(prev => (prev.amount === next ? prev : { ...prev, amount: next }));
  }, []);

  // quando cambia il form nei dettagli ⇒ aggiorna formData + amount se serve
  const handleFormChange = useCallback((patch: Partial<Omit<Expense, 'id'>>) => {
    setFormData(prev => {
      const merged = { ...prev, ...patch };
      if (typeof merged.amount === 'number' && merged.amount !== amount) {
        setAmount(merged.amount);
      }
      return merged;
    });
  }, [amount]);

  const dateError = useMemo(() => !formData.frequency && !formData.date, [formData.frequency, formData.date]);

  const handleSubmit = useCallback((payload: Omit<Expense, 'id'>) => {
    onSubmit(payload);
    // reset vista e stato base
    setAmount(0);
    setFormData({
      amount: 0,
      description: '',
      date: toYYYYMMDD(new Date()),
      time: getCurrentTime(),
      accountId: accounts[0]?.id,
      category: 'Altro',
    });
    navigateTo('calc');
  }, [onSubmit, accounts, navigateTo]);

  // Nascondi il componente se non è aperto
  if (!isOpen) return null;

  return (
    <div
      ref={rootRef}
      className="relative h-full overflow-hidden bg-slate-100"
      style={{ touchAction: 'pan-y' }}
      onPointerDownCapture={onPDcap}
      onPointerMoveCapture={onPMcap}
      onPointerUpCapture={onPUcap}
      onClickCapture={onClickCap}
    >
      <div
        ref={wrapRef}
        className="absolute inset-0 flex will-change-transform"
        style={{ width: '200%', pointerEvents: 'auto' }}
        // niente swipe container: la navigazione è esplicita; evitiamo casini con tastiera
      >
        {/* CALC */}
        <section className="h-full w-1/2 shrink-0">
          {/* Passo prop “larghi”: il componente ignorerà quelli non usati */}
          <CalculatorInputScreen
            // importo come sola fonte di verità
            amount={amount}
            onAmountChange={handleAmountFromCalc}
            // passa la data per coerenza se la UI la mostra
            date={formData.date}
            time={formData.time}
            onOpenDetails={() => navigateTo('details')}
            accounts={accounts}
            isDesktop={isDesktop}
            // opzionali; se non esistono nel componente, vengono ignorati
            onCancel={onClose || onCancel}
          />
        </section>

        {/* DETTAGLI */}
        <section className="h-full w-1/2 shrink-0">
          <TransactionDetailPage
            formData={formData}
            onFormChange={handleFormChange}
            accounts={accounts}
            onClose={() => navigateTo('calc')}
            onSubmit={handleSubmit}
            isDesktop={isDesktop}
            onMenuStateChange={setChildBlocksSwipe}
            dateError={!!dateError}
          />
        </section>
      </div>
    </div>
  );
};

export default CalculatorContainer;
