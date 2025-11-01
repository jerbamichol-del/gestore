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

// Hook per media query
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    window.addEventListener('resize', listener);
    return () => window.removeEventListener('resize', listener);
  }, [matches, query]);
  return matches;
};

const getCurrentTime = () => new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

const CalculatorContainer: React.FC<CalculatorContainerProps> = ({
  isOpen,
  onClose,
  onSubmit,
  accounts,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [view, setView] = useState<'calculator' | 'details'>('calculator');
  
  const resetFormData = useCallback(() => ({
    amount: 0,
    description: '',
    date: new Date().toISOString().split('T')[0],
    time: getCurrentTime(),
    accountId: accounts.length > 0 ? accounts[0].id : '',
    category: 'Altro',
    subcategory: undefined,
    frequency: 'single',
    recurrence: 'monthly',
    recurrenceInterval: 1,
    recurrenceEndType: 'forever',
    recurrenceEndDate: undefined,
    recurrenceCount: undefined,
  }), [accounts]);

  const [formData, setFormData] = useState<Partial<Omit<Expense, 'id'>>>(resetFormData);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isDesktop = useMediaQuery('(min-width: 768px)');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const swipeableDivRef = useRef<HTMLDivElement>(null);

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
      // BUG FIX: Reset the form state reliably *after* the closing animation completes.
      // This prevents flickering by ensuring the component is pristine before it's shown again.
      const resetTimer = setTimeout(() => {
        setFormData(resetFormData());
      }, 300); // Matches the transition duration
      return () => clearTimeout(resetTimer);
    }
  }, [isOpen, resetFormData]);
  
  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  const handleFormChange = (newData: Partial<Omit<Expense, 'id'>>) => {
    setFormData(prev => ({...prev, ...newData}));
  };
  
  const handleFinalSubmit = (data: Omit<Expense, 'id'>) => {
    onSubmit(data);
  };

  const navigateTo = (targetView: 'calculator' | 'details') => {
      setView(targetView);
  };
  
  if (!isOpen) {
    return null;
  }
  
  const translateX = (view === 'calculator' ? 0 : -50) + (progress * 50);

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
          <div className="w-1/2 md:w-auto h-full relative">
            <CalculatorInputScreen
              formData={formData}
              onFormChange={handleFormChange}
              onClose={handleClose}
              onSubmit={handleFinalSubmit}
              accounts={accounts}
              onNavigateToDetails={() => navigateTo('details')}
              onMenuStateChange={setIsMenuOpen}
              isDesktop={isDesktop}
              isVisible={view === 'calculator' || isDesktop}
            />
          </div>
          <div className="w-1/2 md:w-auto h-full relative">
              <TransactionDetailPage
                formData={formData}
                onFormChange={handleFormChange}
                accounts={accounts}
                onClose={() => navigateTo('calculator')}
                onSubmit={handleFinalSubmit}
                isDesktop={isDesktop}
                isVisible={view === 'details' || isDesktop}
                onMenuStateChange={setIsMenuOpen}
              />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalculatorContainer;