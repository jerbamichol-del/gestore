import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Expense, Account } from '../types';
import CalculatorInputScreen from './CalculatorInputScreen';
import TransactionDetailPage from './TransactionDetailPage';
import { useSwipe } from '../hooks/useSwipe';

interface CalculatorContainerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Expense, 'id'>) => void;
  accounts: Account[];
  expenses?: Expense[];
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
}

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, [matches, query]);
  return matches;
};

const toYYYYMMDD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getCurrentTime = () =>
  new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

const CalculatorContainer: React.FC<CalculatorContainerProps> = ({
  isOpen,
  onClose,
  onSubmit,
  accounts,
}) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // Vista: 'calculator' o 'details'
  const [view, setView] = useState<'calculator' | 'details'>('calculator');
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  // Sorgente unica della verità (niente conflitti importo)
  const resetFormData = useCallback(
    (): Partial<Omit<Expense, 'id'>> => ({
      amount: 0,
      description: '',
      date: toYYYYMMDD(new Date()),
      time: getCurrentTime(),
      accountId: accounts[0]?.id || '',
      category: '',
      subcategory: undefined,
      frequency: undefined,
      recurrence: undefined,
      monthlyRecurrenceType: 'dayOfMonth',
      recurrenceInterval: undefined,
      recurrenceDays: undefined,
      recurrenceEndType: 'forever',
      recurrenceEndDate: undefined,
      recurrenceCount: undefined,
    }),
    [accounts]
  );
  const [formData, setFormData] = useState<Partial<Omit<Expense, 'id'>>>(resetFormData);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dateError, setDateError] = useState(false);

  // Tastiera virtuale
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const keyboardOpenRef = useRef(false);
  useEffect(() => { keyboardOpenRef.current = keyboardOpen; }, [keyboardOpen]);

  useEffect(() => {
    const vv: VisualViewport | undefined = (window as any).visualViewport;
    if (!vv) return;
    let base = vv.height;
    const onResize = () => {
      const delta = base - vv.height;
      if (delta > 120) {
        setKeyboardOpen(true);
      } else {
        setKeyboardOpen(false);
        base = vv.height;
      }
    };
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  // Non blocco mai l'UI: chiudi tastiera in background (se aperta)
  const waitForKeyboardClose = useCallback((timeoutMs = 200) => {
    return new Promise<void>((resolve) => {
      if (!keyboardOpenRef.current) { resolve(); return; }
      const start = Date.now();
      const step = () => {
        if (!keyboardOpenRef.current || Date.now() - start > timeoutMs) { resolve(); return; }
        requestAnimationFrame(step);
      };
      step();
    });
  }, []);

  // ----- TAP BRIDGE (se il click nativo non arriva, lo sintetizzo) -----
  const containerRef = useRef<HTMLDivElement>(null);
  const tapRef = useRef<{
    id: number | null;
    t0: number;
    x0: number;
    y0: number;
    moved: boolean;
    clicked: boolean;
    target: EventTarget | null;
  }>({ id: null, t0: 0, x0: 0, y0: 0, moved: false, clicked: false, target: null });

  const SLOP = 10;           // tolleranza movimento
  const TAP_MS = 350;        // finestra massima per considerare tap

  const onPDcap = useCallback((e: React.PointerEvent) => {
    tapRef.current = {
      id: e.pointerId,
      t0: performance.now(),
      x0: e.clientX,
      y0: e.clientY,
      moved: false,
      clicked: false,
      target: e.target,
    };
  }, []);

  const onPMcap = useCallback((e: React.PointerEvent) => {
    const st = tapRef.current;
    if (st.id !== e.pointerId) return;
    if (st.moved) return;
    const dx = Math.abs(e.clientX - st.x0);
    const dy = Math.abs(e.clientY - st.y0);
    if (dx > SLOP || dy > SLOP) st.moved = true;
  }, []);

  const onPUcap = useCallback((e: React.PointerEvent) => {
    const st = tapRef.current;
    if (st.id !== e.pointerId) return;

    // se non è swipe e non è arrivato il click nativo, sintetizzo
    const withinTime = performance.now() - st.t0 < TAP_MS;
    if (!st.moved && withinTime && !st.clicked && st.target instanceof Element) {
      // evita area con [data-no-synthetic-click]
      if (!(st.target as Element).closest('[data-no-synthetic-click]')) {
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
        st.target.dispatchEvent(ev);
      }
    }
    // reset
    tapRef.current.id = null;
  }, []);

  const onClickCap = useCallback(() => {
    tapRef.current.clicked = true; // è arrivato un click nativo → non sintetizzare
  }, []);
  // ---------------------------------------------------------------------

  // Swipe tra le due viste (solo mobile, disabilitato con tastiera o menu aperti)
  const { progress, isSwiping } = useSwipe(
    containerRef,
    {
      onSwipeLeft: view === 'calculator' ? () => navigate('details') : undefined,
      onSwipeRight: view === 'details' ? () => navigate('calculator') : undefined,
    },
    {
      enabled: !isDesktop && isOpen && !isMenuOpen && !keyboardOpen,
      threshold: 36,
      slop: 10,
    }
  );

  // Mount/Unmount come bottom sheet
  useEffect(() => {
    if (isOpen) {
      setView('calculator');
      const t = setTimeout(() => setIsAnimatingIn(true), 10);
      return () => clearTimeout(t);
    } else {
      setIsAnimatingIn(false);
      const t = window.setTimeout(() => {
        setFormData(resetFormData());
        setDateError(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [isOpen, resetFormData]);

  const handleFormChange = (patch: Partial<Omit<Expense, 'id'>>) => {
    if ('date' in patch && patch.date) setDateError(false);
    setFormData(prev => ({ ...prev, ...patch }));
  };

  const handleAttemptSubmit = (data: Omit<Expense, 'id'>) => {
    if (!data.date) {
      navigate('details');
      setDateError(true);
      setTimeout(() => document.getElementById('date')?.focus(), 150);
      return;
    }
    setDateError(false);
    onSubmit(data);
  };

  // Navigazione: immediata; tastiera si chiude in background
  const navigate = useCallback((next: 'calculator' | 'details') => {
    if (view === next) return;
    const ae = document.activeElement as HTMLElement | null;
    ae?.blur?.();
    setView(next);                 // subito (non blocco i tap)
    waitForKeyboardClose();        // in background
    // cleanup long press tastierino, ecc.
    window.dispatchEvent(new Event('numPad:cancelLongPress'));
    window.dispatchEvent(new CustomEvent('page-activated', { detail: next }));
  }, [view, waitForKeyboardClose]);

  if (!isOpen) return null;

  const translateX = (view === 'calculator' ? 0 : -50) + (progress * 50);
  const isCalc = view === 'calculator';
  const isDet = view === 'details';

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-100 transform transition-transform duration-200 ease-out ${
        isAnimatingIn ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden"
        style={{ touchAction: 'pan-y' }}
        onPointerDownCapture={onPDcap}
        onPointerMoveCapture={onPMcap}
        onPointerUpCapture={onPUcap}
        onClickCapture={onClickCap}
      >
        <div
          className="absolute inset-0 flex w-[200%] md:w-full md:grid md:grid-cols-2"
          style={{
            transform: isDesktop ? 'none' : `translateX(${translateX}%)`,
            transition: isSwiping ? 'none' : 'transform 0.08s ease-out',
            willChange: 'transform',
          }}
        >
          <div
            className={`w-1/2 md:w-auto h-full relative ${isCalc ? 'z-10' : 'z-0'}`}
            aria-hidden={!isCalc}
            style={{ pointerEvents: isCalc ? 'auto' : 'none' }}
          >
            <CalculatorInputScreen
              // unified state: niente conflitto importo
              formData={formData}
              onFormChange={handleFormChange}
              onClose={onClose}
              onSubmit={handleAttemptSubmit}
              accounts={accounts}
              onNavigateToDetails={() => navigate('details')}
              onMenuStateChange={setIsMenuOpen}
              isDesktop={isDesktop}
            />
          </div>

          <div
            className={`w-1/2 md:w-auto h-full relative ${isDet ? 'z-10' : 'z-0'}`}
            aria-hidden={!isDet}
            style={{ pointerEvents: isDet ? 'auto' : 'none' }}
          >
            <TransactionDetailPage
              formData={formData}
              onFormChange={handleFormChange}
              accounts={accounts}
              onClose={() => navigate('calculator')}
              onSubmit={handleAttemptSubmit}
              isDesktop={isDesktop}
              onMenuStateChange={setIsMenuOpen}
              dateError={dateError}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorContainer;
