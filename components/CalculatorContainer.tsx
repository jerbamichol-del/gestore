import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Expense, Account } from '../types';
import CalculatorInputScreen from './CalculatorInputScreen';
import TransactionDetailPage from './TransactionDetailPage';

/** Helpers data */
const toYYYYMMDD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const getCurrentTime = () =>
  new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

type View = 'calc' | 'details';

/**
 * NOTA INTEGRAZIONE:
 * - Non cambio la firma “esterna”: esporta default e usa gli stessi figli.
 * - Le props sono opzionali così non spacchiamo niente se la firma originale differisce.
 */
type Props = Partial<{
  accounts: Account[];
  isDesktop: boolean;
  /** Salvataggio definitivo dell’expense */
  onCreateExpense: (exp: Omit<Expense, 'id'>) => void;
  /** Se il container superiore ha un pager con swipe, puoi bloccarlo qui */
  onPagerSwipeToggle: (locked: boolean) => void;
}>;

const CalculatorContainer: React.FC<Props> = ({
  accounts = [],
  isDesktop = false,
  onCreateExpense,
  onPagerSwipeToggle,
}) => {
  /** Vista attuale */
  const [view, setView] = useState<View>('calc');

  /** Sorgente unica di verità per i dettagli (niente conflitti tra pagine) */
  const [formData, setFormData] = useState<Partial<Omit<Expense, 'id'>>>({
    amount: 0,
    description: '',
    date: toYYYYMMDD(new Date()),
    time: getCurrentTime(),
    accountId: accounts[0]?.id,
  });

  /** Stato tastiera (mobile) e blocco swipe del pager superiore */
  const keyboardOpenRef = useRef(false);
  const lockedSwipeRef = useRef(false);

  const lockPagerSwipe = useCallback((lock: boolean) => {
    if (lockedSwipeRef.current === lock) return;
    lockedSwipeRef.current = lock;
    try {
      onPagerSwipeToggle?.(lock);
    } catch {}
    // In caso di CSS globale che disabilita gesture
    document.documentElement.classList.toggle('no-page-swipe', lock);
  }, [onPagerSwipeToggle]);

  /** Rilevazione soft della tastiera con VisualViewport (non blocca) */
  useEffect(() => {
    const vv: VisualViewport | undefined = (window as any).visualViewport;
    if (!vv) return;

    let baseline = vv.height;
    const onResize = () => {
      // Consideriamo “aperta” se l’altezza cala di almeno ~80px
      const open = vv.height < baseline - 80;
      keyboardOpenRef.current = open;
      if (view === 'details') lockPagerSwipe(open);
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, [view, lockPagerSwipe]);

  /** Non blocchiamo mai l’UI: chiudi tastiera in background se serve */
  const waitForKeyboardClose = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (!keyboardOpenRef.current) {
        resolve();
        return;
      }
      const start = Date.now();
      const step = () => {
        // fail-safe: max ~200ms
        if (!keyboardOpenRef.current || Date.now() - start > 200) {
          resolve();
          return;
        }
        requestAnimationFrame(step);
      };
      step();
    });
  }, []);

  /** Piccola guard anti “tap fantasma” solo al cambio vista (80ms) */
  const briefTapGuard = () => {
    document.body.classList.add('tap-guard');
    // NB: la classe non deve disabilitare l’UI intera, solo bloccare click in bubbling:
    // ad es. in CSS puoi avere: .tap-guard * { touch-action: manipulation; }
    setTimeout(() => document.body.classList.remove('tap-guard'), 80);
  };

  /** Navigazione immediata (niente await che bloccano i tap) */
  const navigate = useCallback(
    (next: View) => {
      setView(next);
      briefTapGuard();
      // Chiudi tastiera in background, senza attendere
      // (se servisse per lo swipe del pager, il resize sopra la rileva e blocca lo swipe)
      waitForKeyboardClose().catch(() => {});
    },
    [waitForKeyboardClose]
  );

  /** Calcolatrice → cambia importo (sorgente unica in container) */
  const handleCalcAmountChange = useCallback((amount: number) => {
    setFormData((p) => ({ ...p, amount: amount || 0 }));
  }, []);

  /** Calcolatrice → vai alla pagina dettagli */
  const handleProceedFromCalc = useCallback(() => {
    navigate('details');
  }, [navigate]);

  /** Dettagli → patch dei campi (compreso amount se viene editato lì) */
  const handleFormChange = useCallback((patch: Partial<Omit<Expense, 'id'>>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
  }, []);

  /** Dettagli → chiudi */
  const handleCloseDetails = useCallback(() => {
    navigate('calc');
  }, [navigate]);

  /** Dettagli → submit definitivo */
  const handleSubmitDetails = useCallback(
    (data: Omit<Expense, 'id'>) => {
      onCreateExpense?.(data);
      // reset minimo: svuoto descrizione e azzero importo
      setFormData((prev) => ({
        ...prev,
        description: '',
        amount: 0,
        time: getCurrentTime(),
        date: toYYYYMMDD(new Date()),
      }));
      navigate('calc');
    },
    [navigate, onCreateExpense]
  );

  /** Dettagli → quando apre menu/modali blocchiamo swipe del pager */
  const handleMenuStateChange = useCallback(
    (isOpen: boolean) => {
      if (view === 'details') lockPagerSwipe(isOpen || keyboardOpenRef.current);
    },
    [view, lockPagerSwipe]
  );

  /** Se cambia la lista conti e manca accountId, assegna il primo */
  useEffect(() => {
    if (!formData.accountId && accounts[0]?.id) {
      setFormData((p) => ({ ...p, accountId: accounts[0]!.id }));
    }
  }, [accounts, formData.accountId]);

  return (
    <div className="h-full w-full relative" style={{ touchAction: 'pan-y' }}>
      {/* CALC */}
      <div
        aria-hidden={view !== 'calc'}
        className={`absolute inset-0 ${view === 'calc' ? 'z-10' : 'z-0'}`}
        style={{
          transform: view === 'calc' ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.08s ease-out',
          pointerEvents: view === 'calc' ? 'auto' : 'none',
        }}
      >
        <CalculatorInputScreen
          // Questi props sono comuni nelle implementazioni tipiche; se i nomi nel tuo file differiscono,
          // mappa velocemente ai tuoi (la logica resta identica).
          amount={Number(formData.amount) || 0}
          onAmountChange={handleCalcAmountChange}
          onProceed={handleProceedFromCalc}
          onKeyboardStateChange={(open: boolean) => {
            keyboardOpenRef.current = open;
            if (view === 'details') lockPagerSwipe(open);
          }}
        />
      </div>

      {/* DETAILS */}
      <div
        aria-hidden={view !== 'details'}
        className={`absolute inset-0 ${view === 'details' ? 'z-10' : 'z-0'}`}
        style={{
          transform: view === 'details' ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.08s ease-out',
          pointerEvents: view === 'details' ? 'auto' : 'none',
        }}
      >
        <TransactionDetailPage
          formData={formData}
          onFormChange={handleFormChange}
          accounts={accounts}
          onClose={handleCloseDetails}
          onSubmit={handleSubmitDetails}
          isDesktop={isDesktop}
          onMenuStateChange={handleMenuStateChange}
          dateError={!formData.date}
        />
      </div>
    </div>
  );
};

export default CalculatorContainer;
