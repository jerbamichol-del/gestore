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
}

const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const apply = () => setMatches(media.matches);
    apply();
    media.addEventListener?.('change', apply);
    window.addEventListener('resize', apply);
    return () => {
      media.removeEventListener?.('change', apply);
      window.removeEventListener('resize', apply);
    };
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
  accounts,
}) => {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  // UI/page state
  const [isAnimating, setIsAnimating] = useState(false);
  const [view, setView] = useState<'calculator' | 'details'>('calculator');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dateError, setDateError] = useState(false);

  // form state
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

  // keyboard detection
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const keyboardOpenRef = useRef(false);
  useEffect(() => { keyboardOpenRef.current = keyboardOpen; }, [keyboardOpen]);

  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;
    let baseline = vv.height;
    const onResize = () => {
      const delta = baseline - vv.height;
      if (delta > 120) {
        setKeyboardOpen(true);
      } else {
        setKeyboardOpen(false);
        baseline = vv.height;
      }
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // non blocca più i tap: chiude la tastiera in background
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

  // swipe container
  const containerRef = useRef<HTMLDivElement>(null);
  const { progress, isSwiping } = useSwipe(
    containerRef,
    {
      onSwipeLeft: !isDesktop && view === 'calculator' ? () => navigateTo('details') : undefined,
      onSwipeRight: !isDesktop && view === 'details' ? () => navigateTo('calculator') : undefined,
    },
    {
      enabled: isOpen && !isDesktop && !isMenuOpen && !keyboardOpen,
      threshold: 32,
      slop: 6,
    }
  );

  // open/close animation + cleanup
  useEffect(() => {
    if (isOpen) {
      setView('calculator');
      const t = window.setTimeout(() => setIsAnimating(true), 10);
      return () => window.clearTimeout(t);
    } else {
      setIsAnimating(false);
      const t = window.setTimeout(() => {
        setFormData(resetFormData());
        setDateError(false);
      }, 300);
      return () => window.clearTimeout(t);
    }
  }, [isOpen, resetFormData]);

  const handleFormChange = (newData: Partial<Omit<Expense, 'id'>>) => {
    if ('date' in newData && newData.date) setDateError(false);
    setFormData(prev => ({ ...prev, ...newData }));
  };

  const handleAttemptSubmit = (submitted: Omit<Expense, 'id'>) => {
    if (!submitted.date) {
      // forza focus sulla data
      navigateTo('details');
      setDateError(true);
      setTimeout(() => document.getElementById('date')?.focus(), 120);
      return;
    }
    setDateError(false);
    onSubmit(submitted);
  };

  // <<< QUI la modifica richiesta: niente await >>>
  const navigateTo = (targetView: 'calculator' | 'details') => {
    if (view === targetView) return;

    // stacca subito l'eventuale focus (evita tap “a vuoto” alla pagina successiva)
    const ae = document.activeElement as HTMLElement | null;
    ae?.blur?.();

    // cambia pagina immediatamente
    setView(targetView);

    // chiudi eventuale lungo-press in corso sulla calcolatrice
    window.dispatchEvent(new Event('numPad:cancelLongPress'));

    // annuncia attivazione pagina (usato dagli schermi figli per reset interni)
    window.dispatchEvent(new CustomEvent('page-activated', { detail: targetView }));

    // chiudi tastiera in background, senza bloccare l’UI
    if (keyboardOpenRef.current) {
      waitForKeyboardClose().catch(() => {});
    }
  };

  if (!isOpen) return null;

  const translateX = (view === 'calculator' ? 0 : -50) + (progress * 50);
  const isCalculatorActive = view === 'calculator';
  const isDetailsActive = view === 'details';

  return (
    <div
      className={`fixed inset-0 z-50 bg-slate-100 transform transition-transform duration-300 ease-in-out ${isAnimating ? 'translate-y-0' : 'translate-y-full'}`}
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
            pointerEvents: 'auto',
          }}
        >
          {/* Calculator */}
          <div className={`w-1/2 md:w-auto h-full relative ${isCalculatorActive ? 'z-10' : 'z-0'}`} aria-hidden={!isCalculatorActive}>
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

          {/* Details */}
          <div className={`w-1/2 md:w-auto h-full relative ${isDetailsActive ? 'z-10' : 'z-0'}`} aria-hidden={!isDetailsActive}>
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
