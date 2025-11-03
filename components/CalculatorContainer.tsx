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
  const [isMounted, setIsMounted] = useState(false);
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
      frequency: undefined, // No default frequency
      recurrence: undefined, // reset this too to be clean
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
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [dateError, setDateError] = useState(false);

  const isDesktop = useMediaQuery('(min-width: 768px)');

  const containerRef = useRef<HTMLDivElement>(null);
  const swipeableDivRef = useRef<HTMLDivElement>(null);
  const calculatorPageRef = useRef<HTMLDivElement>(null);
  const detailsPageRef = useRef<HTMLDivElement>(null);

  const handleDisableDrag = useCallback((intent: 'left' | 'right') => {
    if (view === 'details' && intent === 'right' && isInputFocused) {
        return true;
    }
    return false;
  }, [view, isInputFocused]);

  const { progress, isSwiping } = useSwipe(
    containerRef,
    {
      onSwipeLeft: view === 'calculator' ? () => navigateTo('details') : undefined,
      onSwipeRight: view === 'details' ? () => navigateTo('calculator') : undefined,
    },
    { 
        enabled: !isDesktop && isOpen && !isMenuOpen, 
        threshold: 32, 
        slop: 6,
        disableDrag: handleDisableDrag,
    }
  );

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setView('calculator');
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else if (isMounted) {
      setIsAnimating(false);
      const timers: number[] = [];
      timers.push(window.setTimeout(() => {
        setFormData(resetFormData());
        setDateError(false);
      }, 300));
      timers.push(window.setTimeout(() => {
        setIsMounted(false);
      }, 300));
      return () => timers.forEach(clearTimeout);
    }
  }, [isOpen, isMounted, resetFormData]);

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
    if (view !== targetView) {
      // 1. Start the visual transition immediately
      setView(targetView);
      
      // 2. Dispatch cleanup and notification events
      window.dispatchEvent(new Event('numPad:cancelLongPress'));
      window.dispatchEvent(new CustomEvent('page-activated', { detail: targetView }));

      // 3. After a very short delay, blur the active element.
      // This gives the CSS transition a head start before the viewport resizes,
      // preventing the animation from stalling.
      setTimeout(() => {
        const activeElement = document.activeElement as HTMLElement | null;
        if (activeElement?.blur) {
          activeElement.blur();
        }
      }, 50);

      // 4. Focus the new container to prevent the keyboard from popping back up.
      requestAnimationFrame(() => {
        const node = targetView === 'details' ? detailsPageRef.current : calculatorPageRef.current;
        if (node?.focus) {
          node.focus({ preventScroll: true });
        }
      });
    }
  };

  if (!isMounted) return null;

  const translateX = (view === 'calculator' ? 0 : -50) + (progress * 50);
  const isCalculatorActive = view === 'calculator';
  const isDetailsActive = view === 'details';
  const isClosing = isMounted && !isOpen;

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-100 transform transition-transform duration-300 ease-in-out ${
        isAnimating ? 'translate-y-0' : 'translate-y-full'
      } ${isClosing ? 'pointer-events-none' : ''}`}
      aria-modal="true"
      role="dialog"
    >
      <div ref={containerRef} className="relative h-full w-full overflow-hidden">
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
              onInputFocusChange={setIsInputFocused}
              dateError={dateError}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorContainer;
