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
  // presenti in App.tsx ma non usati qui: li accetto per compatibilità
  expenses?: Expense[];
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
}

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    setMatches(media.matches);
    media.addEventListener?.('change', listener);
    return () => media.removeEventListener?.('change', listener);
  }, [query]);
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
  accounts
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [view, setView] = useState<'calculator' | 'details'>('calculator');
  const [isTransitioning, setIsTransitioning] = useState(false);

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

  const isDesktop = useMediaQuery('(min-width: 768px)');

  // tastiera virtuale
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const keyboardOpenRef = useRef(false);
  useEffect(() => { keyboardOpenRef.current = keyboardOpen; }, [keyboardOpen]);

  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
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
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const waitForKeyboardClose = useCallback((timeoutMs = 200) => {
    return new Promise<void>((resolve) => {
      if (!keyboardOpenRef.current) { resolve(); return; }
      const vv = (window as any).visualViewport as VisualViewport | undefined;
      let done = false;
      const finish = () => { if (done) return; done = true; vv?.removeEventListener('resize', onResize); resolve(); };
      const onResize = () => { if (!keyboardOpenRef.current) finish(); };
      vv?.addEventListener('resize', onResize);
      setTimeout(finish, timeoutMs);
    });
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  const { progress, isSwiping } = useSwipe(
    containerRef,
    {
      onSwipeLeft: view === 'calculator' ? () => navigateTo('details') : undefined,
      onSwipeRight: view === 'details' ? () => navigateTo('calculator') : undefined,
    },
    {
      enabled: !isDesktop && isOpen && !isMenuOpen && !keyboardOpen,
      threshold: 32,
      slop: 6,
    }
  );

  useEffect(() => {
    if (isOpen) {
      setView('calculator');
      const t = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(t);
    } else {
      setIsAnimating(false);
      const t = window.setTimeout(() => {
        setFormData(resetFormData());
        setDateError(false);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen, resetFormData]);

  const handleFormChange = (patch: Partial<Omit<Expense, 'id'>>) => {
    if ('date' in patch && patch.date) setDateError(false);
    setFormData(prev => ({ ...prev, ...patch }));
  };

  const handleAttemptSubmit = (data: Omit<Expense, 'id'>) => {
    if (!data.date) {
      navigateTo('details');
      setDateError(true);
      setTimeout(() => document.getElementById('date')?.focus(), 150);
      return;
    }
    setDateError(false);
    onSubmit(data);
  };

  // Cambia pagina SUBITO; chiusura tastiera in background (no await)
  const navigateTo = (target: 'calculator' | 'details') => {
    if (view === target) return;

    // blur sicuro dell’elemento attivo (evita input “appesi”)
    const ae = document.activeElement as HTMLElement | null;
    ae?.blur?.();

    // notifica per eventuali long-press/key-repeat da cancellare
    window.dispatchEvent(new Event('numPad:cancelLongPress'));

    // cambio vista immediato
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), 150);
    setView(target);

    // chiudi tastiera dietro le quinte
    if (keyboardOpenRef.current) {
      waitForKeyboardClose().catch(() => {});
    }

    // signal di pagina attiva (eventuali cleanup interni)
    window.dispatchEvent(new CustomEvent('page-activated', { detail: target }));
  };

  if (!isOpen) return null;

  const translateX = (view === 'calculator' ? 0 : -50) + (progress * 50);
  const isCalculatorActive = view === 'calculator';
  const isDetailsActive = view === 'details';

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-100 transform transition-transform duration-300 ease-in-out ${
        isAnimating ? 'translate-y-0' : 'translate-y-full'
      }`}
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={containerRef}
        className="relative h-full w-full overflow-hidden"
        style={{ touchAction: 'pan-y' }}
      >
        <div
          className="absolute inset-0 flex w-[200%] md:w-full md:grid md:grid-cols-2"
          style={{
            transform: isDesktop ? 'none' : `translateX(${translateX}%)`,
            transition: isSwiping ? 'none' : 'transform 0.12s ease-out',
            willChange: 'transform',
            pointerEvents: isTransitioning ? 'none' : 'auto',
          }}
        >
          <div className={`w-1/2 md:w-auto h-full ${isCalculatorActive ? 'z-10' : 'z-0'}`} aria-hidden={!isCalculatorActive}>
            <CalculatorInputScreen
              formData={formData}
              onFormChange={handleFormChange}
              onClose={onClose}
              onSubmit={handleAttemptSubmit}
              accounts={accounts}
              onNavigateToDetails={() => navigateTo('details')}
              onMenuStateChange={setIsMenuOpen}
              isDesktop={isDesktop}
            />
          </div>

          <div className={`w-1/2 md:w-auto h-full ${isDetailsActive ? 'z-10' : 'z-0'}`} aria-hidden={!isDetailsActive}>
            <TransactionDetailPage
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
