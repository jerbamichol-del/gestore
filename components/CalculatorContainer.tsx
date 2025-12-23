// CalculatorContainer.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Expense, Account } from '../types';
import CalculatorInputScreen from './CalculatorInputScreen';
import TransactionDetailPage from './TransactionDetailPage';
import { useSwipe } from '../hooks/useSwipe';
import { useTapBridge } from '../hooks/useTapBridge';
import { toYYYYMMDD } from '../utils/date';

interface CalculatorContainerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Expense, 'id'>) => void;
  accounts: Account[];
  expenses?: Expense[];
  onEditExpense?: (expense: Expense) => void;
  onDeleteExpense?: (id: string) => void;
  onMenuStateChange?: (isOpen: boolean) => void;
}

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
};

const getCurrentTime = () =>
  new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

const CalculatorContainer: React.FC<CalculatorContainerProps> = ({
  isOpen,
  onClose,
  onSubmit,
  accounts,
  onMenuStateChange = (_isOpen: boolean) => {},
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [view, setView] = useState<'calculator' | 'details'>('calculator');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [dateError, setDateError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [swipeReady, setSwipeReady] = useState(false);
  const [isEntryAnimationFinished, setIsEntryAnimationFinished] = useState(false);
  const timeoutsRef = useRef<number[]>([]);
  const tapBridgeHandlers = useTapBridge();

  const addTimeout = useCallback((timeout: number) => {
    timeoutsRef.current.push(timeout);
    return timeout;
  }, []);

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
      type: 'expense'
    }),
    [accounts]
  );

  const [formData, setFormData] = useState<Partial<Omit<Expense, 'id'>>>(resetFormData);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !isOpen) return;
    setKeyboardOpen(false);
    const handleResize = () => {
      const isKeyboardVisible = window.innerHeight - vv.height > 120;
      setKeyboardOpen(isKeyboardVisible);
    };
    vv.addEventListener('resize', handleResize);
    return () => vv.removeEventListener('resize', handleResize);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setFormData(resetFormData());
      setDateError(false);
      setIsSubmitting(false);
      submittingRef.current = false;
      setView('calculator');
      setSwipeReady(false);
      setIsEntryAnimationFinished(false);
      const t1 = addTimeout(window.setTimeout(() => setIsAnimating(true), 10));
      const t2 = addTimeout(window.setTimeout(() => setSwipeReady(true), 50));
      const t3 = addTimeout(window.setTimeout(() => setIsEntryAnimationFinished(true), 300));
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    } else {
      setIsAnimating(false);
      setSwipeReady(false);
      setIsEntryAnimationFinished(false);
      const t = addTimeout(window.setTimeout(() => {
        setFormData(resetFormData());
        setDateError(false);
        setIsSubmitting(false);
        submittingRef.current = false;
      }, 300));
      return () => clearTimeout(t);
    }
  }, [isOpen, resetFormData, addTimeout]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePopState = (event: PopStateEvent) => {
      if (view === 'details') {
        const state = event.state;
        if (!state || state.modal !== 'calculator_details') {
          setView('calculator');
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, view]);

  useEffect(() => { return () => timeoutsRef.current.forEach(clearTimeout); }, []);

  const containerRef = useRef<HTMLDivElement>(null);

  const navigateTo = useCallback((next: 'calculator' | 'details') => {
    if (view === next) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (next === 'details') { window.history.pushState({ modal: 'calculator_details' }, ''); }
    else if (next === 'calculator' && view === 'details') { window.history.back(); return; }
    setView(next);
    window.dispatchEvent(new CustomEvent('page-activated', { detail: next }));
    setTimeout(() => {
      const vv: any = (window as any).visualViewport;
      const start = Date.now();
      const check = () => { if (!vv || Date.now() - start > 200) return; requestAnimationFrame(check); };
      check();
    }, 0);
  }, [view]);

  const { progress, isSwiping } = useSwipe(
    containerRef,
    {
      onSwipeLeft: (view === 'calculator' && formData.type !== 'transfer') ? () => navigateTo('details') : undefined,
      onSwipeRight: view === 'details' ? () => navigateTo('calculator') : undefined,
    },
    { threshold: 60, slop: 10, enabled: swipeReady }
  );

  const handleFormChange = useCallback((newData: Partial<Omit<Expense, 'id'>>) => {
    setFormData(prev => ({ ...prev, ...newData }));
  }, []);

  const handleSubmit = useCallback((data: Omit<Expense, 'id'>) => {
    if (isSubmitting || submittingRef.current) return;
    setIsSubmitting(true);
    submittingRef.current = true;
    onSubmit(data);
  }, [isSubmitting, onSubmit]);

  const currentTransform = useMemo(() => {
      let base = view === 'calculator' ? 0 : -50;
      let shift = 0;

      if (isSwiping) {
          shift = progress * 50;
          if (view === 'calculator') {
              if (shift > 0) shift = 0;
              if (formData.type === 'transfer' && shift < 0) shift = 0;
          } else {
              if (shift < 0) shift = 0;
          }
      }
      
      return `translateX(${base + shift}%)`;
  }, [view, isSwiping, progress, formData.type]);

  if (!isOpen && !isAnimating) return null;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[5000] bg-slate-100 transition-transform duration-300 ease-in-out pb-[env(safe-area-inset-bottom)] ${isAnimating ? 'translate-y-0' : 'translate-y-full'}`}
      {...tapBridgeHandlers}
    >
      <div 
        className="flex flex-row w-[200%] h-full will-change-transform"
        style={{ 
            transform: currentTransform,
            transition: isSwiping ? 'none' : 'transform 0.12s ease-out'
        }}
      >
        <div className="w-1/2 h-full shrink-0 relative">
            <CalculatorInputScreen
              onClose={onClose}
              onSubmit={handleSubmit}
              accounts={accounts}
              formData={formData}
              onFormChange={handleFormChange}
              onMenuStateChange={onMenuStateChange}
              isDesktop={isDesktop}
              onNavigateToDetails={() => navigateTo('details')}
            />
        </div>
        <div className="w-1/2 h-full shrink-0 relative">
            <TransactionDetailPage
              formData={formData}
              onFormChange={handleFormChange}
              accounts={accounts}
              onClose={() => navigateTo('calculator')}
              onSubmit={handleSubmit}
              isDesktop={isDesktop}
              onMenuStateChange={onMenuStateChange}
              dateError={dateError}
            />
        </div>
      </div>
    </div>
  );
};

export default CalculatorContainer;