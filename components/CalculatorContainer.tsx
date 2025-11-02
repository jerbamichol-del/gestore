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
  const [isTransitioning, setIsTransitioning] = useState(false);

  const resetFormData = useCallback(
    (): Partial<Omit<Expense, 'id'>> => ({
      amount: 0,
      description: '',
      date: new Date().toISOString().split('T')[0],
      time: getCurrentTime(),
      accountId: accounts.length > 0 ? accounts[0].id : '',
      category: '',
      subcategory: undefined,
      frequency: 'single',
      recurrence: 'monthly',
      recurrenceInterval: 1,
      recurrenceEndType: 'forever',
      recurrenceEndDate: undefined,
      recurrenceCount: undefined,
    }),
    [accounts]
  );

  const [formData, setFormData] = useState<Partial<Omit<Expense, 'id'>>>(resetFormData);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isDesktop = useMediaQuery('(min-width: 768px)');

  const containerRef = useRef<HTMLDivElement>(null);
  const swipeableDivRef = useRef<HTMLDivElement>(null);
  const calculatorPageRef = useRef<HTMLDivElement>(null);
  const detailsPageRef = useRef<HTMLDivElement>(null);

  // 👇 Nuova logica anti “primo tap a vuoto”
  // Blocca solo il click sintetico post-navigazione, finché non avviene il primo pointerdown reale nella nuova vista.
  const awaitingFirstPointerDownRef = useRef(false);

  useEffect(() => {
    const onClickCapture = (ev: MouseEvent) => {
      if (!awaitingFirstPointerDownRef.current) return;
      const root = containerRef.current;
      if (!root) return;
      // Consuma SOLO il prossimo click (sintetico) dentro il container,
      // prima che l'utente tocchi la nuova pagina.
      if (root.contains(ev.target as Node)) {
        ev.preventDefault();
        ev.stopPropagation();
        // Non azzero il flag qui: lo farà il primo pointerdown reale.
      }
    };
    window.addEventListener('click', onClickCapture, true); // capture
    return () => window.removeEventListener('click', onClickCapture, true);
  }, []);

  const { progress, isSwiping } = useSwipe(
    containerRef,
    {
      onSwipeLeft: view === 'calculator' ? () => navigateTo('details') : undefined,
      onSwipeRight: view === 'details' ? () => navigateTo('calculator') : undefined,
    },
    { enabled: !isDesktop && isOpen && !isMenuOpen, threshold: 32, slop: 6 }
  );

  useEffect(() => {
    if (isOpen) {
      setView('calculator');
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
      const resetTimer = setTimeout(() => {
        setFormData(resetFormData());
      }, 300);
      return () => clearTimeout(resetTimer);
    }
  }, [isOpen, resetFormData]);

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  const handleFormChange = (newData: Partial<Omit<Expense, 'id'>>) => {
    setFormData(prev => ({ ...prev, ...newData }));
  };

  // Appena l’utente tocca la vista attiva, sblocca il primo tap
  const handleRootPointerDownCapture: React.PointerEventHandler<HTMLDivElement> = () => {
    window.dispatchEvent(new Event('numPad:cancelLongPress'));
    awaitingFirstPointerDownRef.current = false;
  };

  const navigateTo = (targetView: 'calculator' | 'details') => {
    if (view !== targetView) {
      window.dispatchEvent(new Event('numPad:cancelLongPress'));
      setIsTransitioning(true);
      // attiva il blocco per il click sintetico post-animazione
      awaitingFirstPointerDownRef.current = true;
      setView(targetView);
    }
  };

  const handleTransitionEnd = () => {
    setIsTransitioning(false);
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
      onPointerDownCapture={handleRootPointerDownCapture}
      ref={containerRef}
    >
      <div
        className={`relative h-full w-full overflow-hidden ${isTransitioning ? 'pointer-events-none' : ''}`}
      >
        <div
          ref={swipeableDivRef}
          onTransitionEnd={handleTransitionEnd}
          className="absolute inset-0 flex w-[200%] md:w-full md:grid md:grid-cols-2"
          style={{
            transform: isDesktop ? 'none' : `translateX(${translateX}%)`,
            transition: isSwiping ? 'none' : 'transform 0.12s ease-out',
            willChange: 'transform',
          }}
        >
          <div
            className={`w-1/2 md:w-auto h-full relative ${isCalculatorActive ? 'z-10' : 'z-0'} ${!isCalculatorActive ? 'pointer-events-none' : ''}`}
            aria-hidden={!isCalculatorActive}
          >
            <CalculatorInputScreen
              ref={calculatorPageRef}
              formData={formData}
              onFormChange={handleFormChange}
              onClose={handleClose}
              onSubmit={onSubmit}
              accounts={accounts}
              onNavigateToDetails={() => navigateTo('details')}
              onMenuStateChange={setIsMenuOpen}
              isDesktop={isDesktop}
            />
          </div>

          <div
            className={`w-1/2 md:w-auto h-full relative ${isDetailsActive ? 'z-10' : 'z-0'} ${!isDetailsActive ? 'pointer-events-none' : ''}`}
            aria-hidden={!isDetailsActive}
          >
            <TransactionDetailPage
              ref={detailsPageRef}
              formData={formData}
              onFormChange={handleFormChange}
              accounts={accounts}
              onClose={() => navigateTo('calculator')}
              onSubmit={onSubmit}
              isDesktop={isDesktop}
              onMenuStateChange={setIsMenuOpen}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorContainer;
