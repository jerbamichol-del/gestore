import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Expense, Account, CATEGORIES } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { CheckIcon } from './icons/CheckIcon';
import { BackspaceIcon } from './icons/BackspaceIcon';
import SelectionMenu from './SelectionMenu';
import { getCategoryStyle } from '../utils/categoryStyles';
import { ChevronLeftIcon } from './icons/ChevronLeftIcon';
import SmoothPullTab from './SmoothPullTab';

interface CalculatorInputScreenProps {
  onClose: () => void;
  onSubmit: (data: Omit<Expense, 'id'>) => void;
  accounts: Account[];
  onNavigateToDetails: () => void;
  formData: Partial<Omit<Expense, 'id'>>;
  onFormChange: (newData: Partial<Omit<Expense, 'id'>>) => void;
  onMenuStateChange: (isOpen: boolean) => void;
  isDesktop: boolean;
}

const formatAmountForDisplay = (numStr: string): string => {
  let sanitizedStr = String(numStr || '0').replace('.', ',');
  let [integerPart, decimalPart] = sanitizedStr.split(',');
  if (integerPart === '') integerPart = '0';
  const formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (decimalPart !== undefined) return `${formattedIntegerPart},${decimalPart}`;
  return formattedIntegerPart;
};

const getAmountFontSize = (value: string): string => {
  const len = value.length;
  if (len <= 4) return 'text-9xl';
  if (len <= 6) return 'text-8xl';
  if (len <= 8) return 'text-7xl';
  if (len <= 11) return 'text-6xl';
  return 'text-5xl';
};

const CalculatorInputScreen = React.forwardRef<HTMLDivElement, CalculatorInputScreenProps>(({
  onClose, onSubmit, accounts, onNavigateToDetails,
  formData, onFormChange, onMenuStateChange, isDesktop
}, ref) => {
  const [currentValue, setCurrentValue] = useState('0');
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [shouldResetCurrentValue, setShouldResetCurrentValue] = useState(false);
  const [justCalculated, setJustCalculated] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'account' | 'category' | 'subcategory' | null>(null);
  const isSyncingFromParent = useRef(false);

  useEffect(() => {
    onMenuStateChange(activeMenu !== null);
  }, [activeMenu, onMenuStateChange]);

  useEffect(() => {
    const parentAmount = formData.amount || 0;
    const currentDisplayAmount = parseFloat(currentValue.replace(/\./g, '').replace(',', '.')) || 0;

    if (Math.abs(parentAmount - currentDisplayAmount) > 1e-9) {
      isSyncingFromParent.current = true;
      setCurrentValue(String(parentAmount).replace('.', ','));
    }

    if (formData.amount === 0 || !formData.amount) {
      setPreviousValue(null);
      setOperator(null);
      setShouldResetCurrentValue(false);
      setJustCalculated(false);
    }
  }, [formData.amount]);

  useEffect(() => {
    if (isSyncingFromParent.current) {
      isSyncingFromParent.current = false;
      return;
    }

    const newAmount = parseFloat(currentValue.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(newAmount) && Math.abs((formData.amount || 0) - newAmount) > 1e-9) {
      onFormChange({ amount: newAmount });
    }
  }, [currentValue, onFormChange, formData.amount]);

  const handleClearAmount = useCallback(() => {
    setCurrentValue('0');
    setJustCalculated(false);
  }, []);

  const handleSingleBackspace = useCallback(() => {
    if (justCalculated) {
      handleClearAmount();
      return;
    }
    if (shouldResetCurrentValue) {
      setCurrentValue('0');
      setPreviousValue(null);
      setOperator(null);
      setShouldResetCurrentValue(false);
      return;
    }
    setCurrentValue(prev => {
      const valNoDots = prev.replace(/\./g, '');
      const newStr = valNoDots.length > 1 ? valNoDots.slice(0, -1) : '0';
      return newStr;
    });
  }, [justCalculated, shouldResetCurrentValue, handleClearAmount]);

  // --- Long-press solo per ⌫ ---
  const delTimerRef = useRef<number | null>(null);
  const delDidLongRef = useRef(false);
  const delStartXRef = useRef(0);
  const delStartYRef = useRef(0);

  const DEL_HOLD_MS = 450;   // durata long-press
  const DEL_SLOP_PX = 8;     // movimento massimo consentito

  function clearDelTimer() {
    if (delTimerRef.current !== null) {
      window.clearTimeout(delTimerRef.current);
      delTimerRef.current = null;
    }
  }

  const onDelPointerDownCapture: React.PointerEventHandler<HTMLDivElement> = (e) => {
    delDidLongRef.current = false;
    delStartXRef.current = e.clientX ?? 0;
    delStartYRef.current = e.clientY ?? 0;
    try { (e.currentTarget as any).setPointerCapture?.((e as any).pointerId ?? 1); } catch {}
    clearDelTimer();
    delTimerRef.current = window.setTimeout(() => {
      delDidLongRef.current = true;
      clearDelTimer();
      handleClearAmount();
      if (navigator.vibrate) navigator.vibrate(10);
    }, DEL_HOLD_MS);
  };

  const onDelPointerMoveCapture: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!delTimerRef.current) return;
    const dx = Math.abs((e.clientX ?? 0) - delStartXRef.current);
    const dy = Math.abs((e.clientY ?? 0) - delStartYRef.current);
    if (dx > DEL_SLOP_PX || dy > DEL_SLOP_PX) {
      clearDelTimer();
    }
  };

  const onDelPointerUpCapture: React.PointerEventHandler<HTMLDivElement> = () => {
    const didLong = delDidLongRef.current;
    clearDelTimer();
    if (didLong) {
      delDidLongRef.current = false;
      return;
    }
    handleSingleBackspace();
  };

  const onDelPointerCancelCapture: React.PointerEventHandler<HTMLDivElement> = () => {
    clearDelTimer();
  };

  const onDelContextMenu: React.MouseEventHandler<HTMLDivElement> = (e) => e.preventDefault();
  const onDelSelectStart: React.ReactEventHandler<HTMLDivElement> = (e) => e.preventDefault();

  useEffect(() => {
    const cancel = () => clearDelTimer();
    window.addEventListener('numPad:cancelLongPress', cancel);
    return () => window.removeEventListener('numPad:cancelLongPress', cancel);
  }, []);

  const calculate = (): string => {
    const prev = parseFloat((previousValue || '0').replace(/\./g, '').replace(',', '.'));
    const current = parseFloat(currentValue.replace(/\./g, '').replace(',', '.'));
    let result = 0;
    switch (operator) {
      case '+': result = prev + current; break;
      case '-': result = prev - current; break;
      case '×': result = prev * current; break;
      case '÷': if (current === 0) return 'Error'; result = prev / current; break;
      default: return currentValue.replace('.', ',');
    }
    setJustCalculated(true);
    const resultStr = String(parseFloat(result.toPrecision(12)));
    return resultStr.replace('.', ',');
  };

  const handleKeyPress = (key: string) => {
    if (['÷', '×', '-', '+'].includes(key)) {
      if (operator && previousValue && !shouldResetCurrentValue) {
        const result = calculate(); setPreviousValue(result); setCurrentValue(result);
      } else { setPreviousValue(currentValue); }
      setOperator(key); setShouldResetCurrentValue(true); setJustCalculated(false);
    } else if (key === '=') {
      if (operator && previousValue) {
        const result = calculate(); setCurrentValue(result);
        setPreviousValue(null); setOperator(null); setShouldResetCurrentValue(true);
      }
    } else {
      setJustCalculated(false);
      if (shouldResetCurrentValue) { setCurrentValue(key === ',' ? '0,' : key); setShouldResetCurrentValue(false); return; }
      setCurrentValue(prev => {
        const valNoDots = prev.replace(/\./g, '');
        if (key === ',' && valNoDots.includes(',')) return prev;
        const maxLength = 12;
        if (valNoDots.replace(',', '').length >= maxLength) return prev;
        if (valNoDots === '0' && key !== ',') return key;
        if (valNoDots.includes(',') && valNoDots.split(',')[1]?.length >= 2) return prev;
        return valNoDots + key;
      });
    }
  };

  const handleSubmit = () => {
    if (canSubmit) {
      const dataToSubmit = {
        ...formData,
        category: formData.category || 'Altro',
      };
      onSubmit(dataToSubmit as Omit<Expense, 'id'>);
    }
  };

  const handleSelectChange = (field: keyof Omit<Expense, 'id'>, value: string) => {
    const updatedFormData = { [field]: value };
    if (field === 'category') {
      (updatedFormData as any).subcategory = ''; // Reset subcategory when category changes
    }
    onFormChange(updatedFormData);
    setActiveMenu(null);
  };

  const canSubmit = (formData.amount ?? 0) > 0;

  const categoryOptions = Object.keys(CATEGORIES).map(cat => ({
    value: cat,
    label: getCategoryStyle(cat).label,
    Icon: getCategoryStyle(cat).Icon,
    color: getCategoryStyle(cat).color,
    bgColor: getCategoryStyle(cat).bgColor,
  }));
  const subcategoryOptions = formData.category
    ? (CATEGORIES[formData.category]?.map(sub => ({ value: sub, label: sub })) || [])
    : [];
  const accountOptions = accounts.map(acc => ({ value: acc.id, label: acc.name }));
  const isSubcategoryDisabled = !formData.category || subcategoryOptions.length === 0;

  const displayValue = formatAmountForDisplay(currentValue);
  const smallDisplayValue = previousValue && operator ? `${formatAmountForDisplay(previousValue)} ${operator}` : ' ';
  const fontSizeClass = getAmountFontSize(displayValue);

  type KeypadButtonProps = {
    children: React.ReactNode; 
    onClick?: () => void; 
    className?: string;
    onSelectStart?: React.ReactEventHandler<HTMLDivElement>;
  } & React.HTMLAttributes<HTMLDivElement>;

  const KeypadButton: React.FC<KeypadButtonProps> = ({ children, onClick, className = '', ...props }) => (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && onClick) { e.preventDefault(); onClick(); } }}
      className={`flex items-center justify-center text-5xl font-light focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 transition-colors duration-150 select-none cursor-pointer ${className}`}
      style={{
        WebkitTapHighlightColor: 'transparent',
        touchAction: 'manipulation',
        WebkitTouchCallout: 'none'
      } as React.CSSProperties}
      {...props}
    >
      <span className="pointer-events-none">{children}</span>
    </div>
  );

  const OperatorButton: React.FC<{ children: React.ReactNode; onClick: () => void }> = ({ children, onClick }) => (
    <div
      role="button" tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      className="flex-1 w-full text-5xl text-indigo-600 font-light active:bg-slate-300/80 transition-colors duration-150 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 select-none cursor-pointer"
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' } as React.CSSProperties}
    >
      <span className="pointer-events-none">{children}</span>
    </div>
  );

  return (
    <div ref={ref} className="bg-slate-100 w-full h-full flex flex-col focus:outline-none">
      <div className="flex-1 flex flex-col">
        <header className={`flex items-center justify-between p-4 flex-shrink-0`}>
          <button
            onClick={onClose}
            aria-label="Chiudi calcolatrice"
            className="w-11 h-11 flex items-center justify-center border border-red-300 text-red-600 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 rounded-full transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-slate-800">Nuova Spesa</h2>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Conferma spesa"
            className={`w-11 h-11 flex items-center justify-center border rounded-full transition-colors
                      border-green-500 bg-green-200 text-green-800 hover:bg-green-300 
                      focus:outline-none focus:ring-2 focus:ring-green-500 
                      disabled:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed
                      ${isDesktop ? 'hidden' : ''}`}
          >
            <CheckIcon className="w-7 h-7" />
          </button>
          {isDesktop && <div className="w-11 h-11" />}
        </header>

        <main className="flex-1 flex flex-col overflow-hidden relative" style={{ touchAction: 'pan-y' }}>
          <div className="flex-1 flex flex-col justify-center items-center p-4 pt-0">
            <div className="w-full px-4 text-center">
              <span className="text-slate-500 text-2xl font-light h-8 block">{smallDisplayValue}</span>
              <div className={`relative inline-block text-slate-800 font-light tracking-tighter whitespace-nowrap transition-all leading-none ${fontSizeClass}`}>
                {displayValue}
                <span className="absolute right-full top-1/2 -translate-y-1/2 opacity-75" style={{ fontSize: '0.6em', marginRight: '0.2em' }}>€</span>
              </div>
            </div>
          </div>
          
          <div
            role="button"
            tabIndex={0}
            onClick={onNavigateToDetails}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigateToDetails(); }}
            className={`absolute top-1/2 -right-px w-8 h-[148px] flex items-center justify-center cursor-pointer ${isDesktop ? 'hidden' : ''}`}
            style={{ transform: 'translateY(calc(-50% + 2px))' }}
            title="Aggiungi dettagli" aria-label="Aggiungi dettagli alla spesa"
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="transform -rotate-90">
                <SmoothPullTab
                  width="148"
                  height="32"
                  fill="rgba(199, 210, 254, 0.8)"
                />
              </div>
            </div>
            <ChevronLeftIcon className="relative z-10 w-6 h-6 text-indigo-600 transition-colors" />
          </div>
        </main>
      </div>
      
      <div className="flex-shrink-0 flex flex-col" style={{ height: '52vh' }}>
        <div className="flex justify-between items-center my-2 w-full px-4" style={{ touchAction: 'pan-y' }}>
          <button
            onClick={() => setActiveMenu('account')}
            className="font-semibold text-indigo-600 hover:text-indigo-800 text-lg w-1/3 truncate p-2 rounded-lg focus:outline-none focus:ring-0 text-left">
            {accounts.find(a => a.id === formData.accountId)?.name || 'Conto'}
          </button>
          <button
            onClick={() => setActiveMenu('category')}
            className="font-semibold text-indigo-600 hover:text-indigo-800 text-lg w-1/3 truncate p-2 rounded-lg focus:outline-none focus:ring-0 text-center">
            {formData.category ? getCategoryStyle(formData.category).label : 'Categoria'}
          </button>
          <button
            onClick={() => setActiveMenu('subcategory')}
            disabled={isSubcategoryDisabled}
            className="font-semibold text-lg w-1/3 truncate p-2 rounded-lg focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:text-slate-400 text-indigo-600 hover:text-indigo-800 transition-colors text-right">
            {formData.subcategory || 'Sottocateg.'}
          </button>
        </div>

        <div className="flex-1 p-2 flex flex-row gap-2 px-4 pb-4">
          <div className="h-full w-4/5 grid grid-cols-3 grid-rows-4 gap-2 num-pad">
            <KeypadButton onClick={() => handleKeyPress('7')} className="text-slate-900 active:bg-slate-200/60">7</KeypadButton>
            <KeypadButton onClick={() => handleKeyPress('8')} className="text-slate-900 active:bg-slate-200/60">8</KeypadButton>
            <KeypadButton onClick={() => handleKeyPress('9')} className="text-slate-900 active:bg-slate-200/60">9</KeypadButton>
            <KeypadButton onClick={() => handleKeyPress('4')} className="text-slate-900 active:bg-slate-200/60">4</KeypadButton>
            <KeypadButton onClick={() => handleKeyPress('5')} className="text-slate-900 active:bg-slate-200/60">5</KeypadButton>
            <KeypadButton onClick={() => handleKeyPress('6')} className="text-slate-900 active:bg-slate-200/60">6</KeypadButton>
            <KeypadButton onClick={() => handleKeyPress('1')} className="text-slate-900 active:bg-slate-200/60">1</KeypadButton>
            <KeypadButton onClick={() => handleKeyPress('2')} className="text-slate-900 active:bg-slate-200/60">2</KeypadButton>
            <KeypadButton onClick={() => handleKeyPress('3')} className="text-slate-900 active:bg-slate-200/60">3</KeypadButton>
            <KeypadButton onClick={() => handleKeyPress(',')} className="text-slate-900 active:bg-slate-200/60">,</KeypadButton>
            <KeypadButton onClick={() => handleKeyPress('0')} className="text-slate-900 active:bg-slate-200/60">0</KeypadButton>
            <KeypadButton
              className="text-slate-900 active:bg-slate-200/60"
              title="Tocca: cancella una cifra — Tieni premuto: cancella tutto"
              aria-label="Cancella"
              onPointerDownCapture={onDelPointerDownCapture}
              onPointerMoveCapture={onDelPointerMoveCapture}
              onPointerUpCapture={onDelPointerUpCapture}
              onPointerCancel={onDelPointerCancelCapture}
              onContextMenu={onDelContextMenu}
              onSelectStart={onDelSelectStart}
            >
              <BackspaceIcon className="w-8 h-8" />
            </KeypadButton>
          </div>

          <div 
            className="h-full w-1/5 flex flex-col gap-2 bg-slate-200 rounded-2xl p-1"
            style={{ touchAction: 'pan-y' }}
          >
            <OperatorButton onClick={() => handleKeyPress('÷')}>÷</OperatorButton>
            <OperatorButton onClick={() => handleKeyPress('×')}>×</OperatorButton>
            <OperatorButton onClick={() => handleKeyPress('-')}>-</OperatorButton>
            <OperatorButton onClick={() => handleKeyPress('+')}>+</OperatorButton>
            <OperatorButton onClick={() => handleKeyPress('=')}>=</OperatorButton>
          </div>
        </div>
      </div>

      <SelectionMenu
        isOpen={activeMenu === 'account'} onClose={() => setActiveMenu(null)}
        title="Seleziona un Conto"
        options={accountOptions}
        selectedValue={formData.accountId || ''}
        onSelect={(value) => handleSelectChange('accountId', value)}
      />
      <SelectionMenu
        isOpen={activeMenu === 'category'} onClose={() => setActiveMenu(null)}
        title="Seleziona una Categoria"
        options={categoryOptions}
        selectedValue={formData.category || ''}
        onSelect={(value) => handleSelectChange('category', value)}
      />
      <SelectionMenu
        isOpen={activeMenu === 'subcategory'} onClose={() => setActiveMenu(null)}
        title="Seleziona Sottocategoria"
        options={subcategoryOptions}
        selectedValue={formData.subcategory || ''}
        onSelect={(value) => handleSelectChange('subcategory', value)}
      />
    </div>
  );
});

export default CalculatorInputScreen;