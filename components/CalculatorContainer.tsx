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

  // Tastiera virtuale
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const keyboardOpenRef = useRef(false);
  useEffect(() => {
    keyboardOpenRef.current = keyboardOpen;
  }, [keyboardOpen]);

  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;
    let baseHeight = vv.height;
    const onResize = () => {
      const delta = baseHeight - vv.height;
      if (delta > 120) {
        setKeyboardOpen(true);
      } else {
        setKeyboardOpen(false);
        baseHeight = vv.height;
      }
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const navigateTo = useCallback((targetView: 'calculator' | 'details') => {
    if (view === targetView) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    
    // Cleanup from old navigateTo
    window.dispatchEvent(new Event('numPad:cancelLongPress'));

    setView(targetView); // cambia subito
    
    // Notify from old navigateTo
    window.dispatchEvent(new CustomEvent('page-activated', { detail: targetView }));

    // chiudi tastiera in background (se serve), senza bloccare i tap
    setTimeout(() => {
      const vv: any = (window as any).visualViewport;
      const start = Date.now();
      const check = () => {
        // se la visualViewport torna alta, bene; altrimenti smetti dopo 200ms
        if (!vv || Date.now() - start > 200) return;
        requestAnimationFrame(check);
      };
      check();
    }, 0);
  }, [view]);

  const { progress, isSwiping } = useSwipe(
    containerRef,
    {
      onSwipeLeft: view === 'calculator' ? () => navigateTo('details') : undefined,
      onSwipeRight: view === 'details' ? () => navigateTo('calculator') : undefined,
    },
    {
      enabled: !isDesktop && isOpen && !isMenuOpen && !keyboardOpen,
      threshold: 36,
      slop: 10,
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

  const handleClose = () => onClose();

  const handleFormChange = (newData: Partial<Omit<Expense, 'id'>>) => {
    if ('date' in newData && newData.date) setDateError(false);
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
        style={{ touchAction: 'pan-y' }}
      >
        <div
          ref={swipeableDivRef}
          className="absolute inset-0 flex w-[200%] md:w-full md:grid md:grid-cols-2"
          style={{
            transform: isDesktop ? 'none' : `translateX(${translateX}%)`,
            transition: isSwiping ? 'none' : 'transform 0.08s ease-out',
            willChange: 'transform',
          }}
        >
          <div
            className="w-1/2 md:w-auto h-full relative"
            style={{
              zIndex: isCalculatorActive ? 10 : 0,
              pointerEvents: isCalculatorActive ? 'auto' : 'none',
            }}
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
            className="w-1/2 md:w-auto h-full relative"
            style={{
              zIndex: isDetailsActive ? 10 : 0,
              pointerEvents: isDetailsActive ? 'auto' : 'none',
            }}
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