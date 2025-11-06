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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dateError, setDateError] = useState(false);

  // Tastiera aperta → disabilita swipe
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const baselineVVH = useRef<number | null>(null);
  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;
    const setFlag = () => {
      if (baselineVVH.current == null) baselineVVH.current = vv.height;
      const delta = (baselineVVH.current || 0) - vv.height;
      setIsKeyboardOpen(delta > 120);
    };
    setFlag();
    vv.addEventListener('resize', setFlag);
    return () => vv.removeEventListener('resize', setFlag);
  }, []);

  const isDesktop = useMediaQuery('(min-width: 768px)');

  const containerRef = useRef<HTMLDivElement>(null);
  const swipeableDivRef = useRef<HTMLDivElement>(null);
  const calculatorPageRef = useRef<HTMLDivElement>(null);
  const detailsPageRef = useRef<HTMLDivElement>(null);

  // wrapper esterni delle due pagine (per gestire inert)
  const calcWrapRef = useRef<HTMLDivElement>(null);
  const detailsWrapRef = useRef<HTMLDivElement>(null);

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

  // Swipe globale del contenitore
  const { progress, isSwiping } = useSwipe(
    containerRef,
    {
      onSwipeLeft: view === 'calculator' ? () => navigateTo('details') : undefined,
      onSwipeRight: view === 'details' ? () => navigateTo('calculator') : undefined,
    },
    {
      enabled: !isDesktop && isOpen && !isMenuOpen && !isKeyboardOpen,
      threshold: 32,
      slop: 10,
    }
  );

  // Imposta inert sulla pagina non attiva (evita focus/gesture fantasma)
  useEffect(() => {
    const calc = calcWrapRef.current;
    const det = detailsWrapRef.current;
    if (!calc || !det) return;
    if (view === 'calculator') {
      calc.removeAttribute('inert');
      det.setAttribute('inert', '');
    } else {
      det.removeAttribute('inert');
      calc.setAttribute('inert', '');
    }
  }, [view]);

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

  const blurActiveElementNow = () => {
    const ae = document.activeElement as HTMLElement | null;
    if (!ae) return;
    // blur immediato su input/textarea/contentEditable
    const isEditable =
      ae.tagName === 'INPUT' ||
      ae.tagName === 'TEXTAREA' ||
      (ae as any).isContentEditable;
    if (isEditable && ae.blur) ae.blur();
  };

  const navigateTo = (targetView: 'calculator' | 'details') => {
    if (view === targetView) return;

    // 1) BLUR SUBITO (così la tastiera si chiude e il primo tap non viene “mangiato”)
    blurActiveElementNow();

    // 2) Notifica e cleanup long-press
    window.dispatchEvent(new Event('numPad:cancelLongPress'));
    window.dispatchEvent(new CustomEvent('page-activated', { detail: targetView }));

    // 3) Cambia vista (niente focus programmatico sul container: su mobile crea tap persi)
    setView(targetView);
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
        // Swipe orizzontale nostro + scroll verticale nativo
        style={{ touchAction: isDesktop ? 'auto' : 'pan-y' }}
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
            ref={calcWrapRef}
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
            ref={detailsWrapRef}
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
