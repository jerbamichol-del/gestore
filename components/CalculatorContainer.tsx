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
  expenses: Expense[];
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentTime = () =>
  new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

const CalculatorContainer: React.FC<CalculatorContainerProps> = ({
  isOpen,
  onClose,
  onSubmit,
  accounts,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [view, setView] = useState<'calculator' | 'details'>('calculator');

  const resetFormData = useCallback(
    (): Partial<Omit<Expense, 'id'>> => ({
      amount: 0,
      description: '',
      date: toYYYYMMDD(new Date()),
      time: getCurrentTime(),
      accountId: accounts.length > 0 ? accounts[0].id : '',
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

  const isDesktop = useMediaQuery('(min-width: 768px)');

  const containerRef = useRef<HTMLDivElement>(null);
  const swipeableDivRef = useRef<HTMLDivElement>(null);
  const calculatorPageRef = useRef<HTMLDivElement>(null);
  const detailsPageRef = useRef<HTMLDivElement>(null);

  // --- Rilevazione apertura tastiera: disabilita swipe quando è aperta ---
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;

    let base = vv.height;
    const onResize = () => {
      const dh = base - vv.height;
      // Se l’altezza cala di ~120px o più → tastiera presumibilmente aperta
      if (dh > 120) {
        setKeyboardOpen(true);
      } else {
        setKeyboardOpen(false);
        // aggiorna la base solo quando la tastiera è chiusa per seguire rotazioni ecc.
        base = vv.height;
      }
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // --- Tap-fix: se navighi dopo che un input era a fuoco, il primo tap non va perso ---
  const armNextTapFixRef = useRef<null | (() => void)>(null);
  const armNextTapFix = useCallback(() => {
    // rimuovi eventuale handler pendente
    if (armNextTapFixRef.current) {
      armNextTapFixRef.current();
      armNextTapFixRef.current = null;
    }
    const handler = (ev: Event) => {
      // una sola volta
      document.removeEventListener('click', handler, true);
      armNextTapFixRef.current = null;
      // Trasforma il primo tap in un click reale sul target
      const target = ev.target as HTMLElement | null;
      if (target) {
        ev.preventDefault();
        (ev as any).stopImmediatePropagation?.();
        // Dispatch dopo il repaint, così non si sovrappone al blur
        setTimeout(() => {
          // se è ancora in DOM
          if (document.contains(target)) {
            target.click();
          }
        }, 0);
      }
    };
    document.addEventListener('click', handler, true);
    // Failsafe: disarma dopo 600ms
    armNextTapFixRef.current = () => document.removeEventListener('click', handler, true);
    setTimeout(() => {
      if (armNextTapFixRef.current) {
        armNextTapFixRef.current();
        armNextTapFixRef.current = null;
      }
    }, 600);
  }, []);

  const { progress, isSwiping } = useSwipe(
    containerRef,
    {
      onSwipeLeft: view === 'calculator' ? () => navigateTo('details') : undefined,
      onSwipeRight: view === 'details' ? () => navigateTo('calculator') : undefined,
    },
    {
      // aggiunto !keyboardOpen per bloccare lo swipe con tastiera aperta
      enabled: !isDesktop && isOpen && !isMenuOpen && !keyboardOpen,
      threshold: 32,
      slop: 6,
      // NOTA: lasciamo lo swipe attivo ovunque come in tua richiesta precedente
      // (nessun ignoreSelector) per non cambiare UX.
    }
  );

  useEffect(() => {
    if (isOpen) {
      setView('calculator');
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
      const t = window.setTimeout(() => {
        setFormData(resetFormData());
        setDateError(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen, resetFormData]);

  const handleClose = () => {
    onClose();
  };

  const handleFormChange = (newData: Partial<Omit<Expense, 'id'>>) => {
    if ('date' in newData && newData.date) {
      setDateError(false);
    }
    setFormData(prev => ({ ...prev, ...newData }));
  };

  const handleAttemptSubmit = (submittedData: Omit<Expense, 'id'>) => {
    if (!submittedData.date) {
      navigateTo('details');
      setDateError(true);
      setTimeout(() => document.getElementById('date')?.focus(), 150);
      return;
    }
    setDateError(false);
    onSubmit(submittedData);
  };

  const navigateTo = (targetView: 'calculator' | 'details') => {
    if (view === targetView) return;

    // 0) Se c'è un input a fuoco, prepara il “tap-fix” per non perdere il primo tap
    const ae = document.activeElement as HTMLElement | null;
    const wasEditing =
      !!ae &&
      (ae.tagName === 'INPUT' ||
        ae.tagName === 'TEXTAREA' ||
        ae.getAttribute('contenteditable') === 'true');
    if (wasEditing) {
      // blur immediato
      ae.blur?.();
      // arma il fix per il primo tap nella nuova pagina
      armNextTapFix();
    }

    // 1) Imposta subito la vista (parte la transizione)
    setView(targetView);

    // 2) Notifiche/cleanup esistenti
    window.dispatchEvent(new Event('numPad:cancelLongPress'));
    window.dispatchEvent(new CustomEvent('page-activated', { detail: targetView }));

    // 3) Dai un frame alla transizione e metti a fuoco il contenitore della nuova pagina
    requestAnimationFrame(() => {
      const node = targetView === 'details' ? detailsPageRef.current : calculatorPageRef.current;
      node?.focus?.({ preventScroll: true });
    });
  };

  if (!isOpen) return null;

  const translateX = (view === 'calculator' ? 0 : -50) + (progress * 50);
  const isCalculatorActive = view === 'calculator';
  const isDetailsActive = view === 'details';
  const isClosing = !isOpen;

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-100 transform transition-transform duration-300 ease-in-out ${
        isAnimating ? 'translate-y-0' : 'translate-y-full'
      } ${isClosing ? 'pointer-events-none' : ''}`}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden"
        // aiuta su mobile a ridurre ambiguità di tap
        style={{ touchAction: 'pan-y' }}
      >
        <div
          ref={swipeableDivRef}
          className="absolute inset-0 flex w-[200%] md:w-full md:grid md:grid-cols-2"
          style={{
            transform: isDesktop ? 'none' : `translateX(${translateX}%)`,
            transition: isSwiping ? 'none' : 'transform 0.12s ease-out',
            willChange: 'transform',
          }}
        >
          <div
            className={`w-1/2 md:w-auto h-full relative ${
              isCalculatorActive ? 'z-10' : 'z-0'
            } ${!isCalculatorActive ? 'pointer-events-none' : ''}`}
            aria-hidden={!isCalculatorActive}
          >
            <CalculatorInputScreen
              ref={calculatorPageRef}
              formData={formData}
              onFormChange={handleFormChange}
              onClose={handleClose}
              onSubmit={handleAttemptSubmit}
              accounts={accounts}
              onNavigateToDetails={() => navigateTo('details')}
              onMenuStateChange={setIsMenuOpen}
              isDesktop={isDesktop}
            />
          </div>

          <div
            className={`w-1/2 md:w-auto h-full relative ${
              isDetailsActive ? 'z-10' : 'z-0'
            } ${!isDetailsActive ? 'pointer-events-none' : ''}`}
            aria-hidden={!isDetailsActive}
          >
            <TransactionDetailPage
              ref={detailsPageRef}
              formData={formData}
              onFormChange={handleFormChange}
              accounts={accounts}
              onClose={() => navigateTo('calculator')}
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
