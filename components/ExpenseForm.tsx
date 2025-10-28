import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Expense, Account, CATEGORIES } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { CurrencyEuroIcon } from './icons/CurrencyEuroIcon';
import { CalendarIcon } from './icons/CalendarIcon';
import { TagIcon } from './icons/TagIcon';
import { CreditCardIcon } from './icons/CreditCardIcon';
import SelectionMenu from './SelectionMenu';
import { getCategoryStyle } from '../utils/categoryStyles';

interface ExpenseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<Expense, 'id'> | Expense) => void;
  initialData?: Expense;
  prefilledData?: Partial<Omit<Expense, 'id'>>;
  accounts: Account[];
}

const getTodayString = () => new Date().toISOString().split('T')[0];

interface FormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  id: string;
  name: string;
  label: string;
  value: string | number | readonly string[] | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  icon: React.ReactNode;
}

// ✅ helper SOLO per la tastiera: attende la chiusura/stabilizzazione del visualViewport
const waitKeyboardClose = (): Promise<void> =>
  new Promise((resolve) => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) { setTimeout(resolve, 100); return; }
    let t: any;
    const finish = () => { vv.removeEventListener('resize', onVV as any); clearTimeout(t); resolve(); };
    const onVV = () => { clearTimeout(t); t = setTimeout(finish, 80); };
    vv.addEventListener('resize', onVV as any, { passive: true });
    t = setTimeout(finish, 180); // safety
  });

// A memoized and correctly ref-forwarded input component to prevent re-renders from causing focus issues.
const FormInput = React.memo(React.forwardRef<HTMLInputElement, FormInputProps>(({ id, name, label, value, onChange, icon, ...props }, ref) => {
  return (
    <div>
      <label htmlFor={id} className="block text-base font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          {icon}
        </div>
        <input
          ref={ref}
          id={id}
          name={name}
          value={value || ''}
          onChange={onChange}
          className="block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-base"
          {...props}
        />
      </div>
    </div>
  );
}));
FormInput.displayName = 'FormInput';

const ExpenseForm: React.FC<ExpenseFormProps> = ({ isOpen, onClose, onSubmit, initialData, prefilledData, accounts }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [formData, setFormData] = useState<Partial<Omit<Expense, 'id' | 'amount'>> & { amount?: number | string }>({});
  const [error, setError] = useState<string | null>(null);
  
  const [activeMenu, setActiveMenu] = useState<'category' | 'subcategory' | 'account' | null>(null);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const isEditing = !!initialData;

  const resetForm = useCallback(() => {
    const defaultAccountId = accounts.length > 0 ? accounts[0].id : '';
    setFormData({
      description: '',
      amount: '',
      date: getTodayString(),
      category: '',
      subcategory: '',
      accountId: defaultAccountId,
    });
    setError(null);
  }, [accounts]);
  
  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData(initialData);
      } else if (prefilledData) {
        const defaultAccountId = accounts.length > 0 ? accounts[0].id : '';
        setFormData({
          description: prefilledData.description || '',
          amount: prefilledData.amount || '',
          date: prefilledData.date || getTodayString(),
          category: prefilledData.category || '',
          subcategory: prefilledData.subcategory || '',
          accountId: prefilledData.accountId || defaultAccountId,
        });
      } else {
        resetForm();
      }
      
      const animTimer = setTimeout(() => {
        setIsAnimating(true);
        // Set focus on the title to prevent the browser from auto-focusing an input
        titleRef.current?.focus();
      }, 50);
      
      return () => {
        clearTimeout(animTimer);
      };
    } else {
      setIsAnimating(false);
    }
  }, [isOpen, initialData, prefilledData, resetForm, accounts]);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);
  
  const handleSelectChange = (field: keyof Omit<Expense, 'id'>, value: string) => {
    setFormData(currentData => {
      const newData = { ...currentData, [field]: value };
      if (field === 'category') {
        newData.subcategory = '';
      }
      return newData;
    });
    setActiveMenu(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountAsString = String(formData.amount).replace(',', '.').trim();
    const amountAsNumber = parseFloat(amountAsString);
    
    if (amountAsString === '' || isNaN(amountAsNumber) || amountAsNumber <= 0) {
      setError('Inserisci un importo valido.');
      return;
    }
    
    const finalDate = formData.date || getTodayString();
    
    if (!formData.accountId) {
      setError('Seleziona un conto.');
      return;
    }
    
    setError(null);

    const dataToSubmit = {
      ...formData,
      amount: amountAsNumber,
      date: finalDate,
      description: formData.description || '',
      category: formData.category || '',
      subcategory: formData.subcategory || undefined,
    };
    
    if (isEditing) {
        onSubmit({ ...initialData, ...dataToSubmit } as Expense);
    } else {
        onSubmit(dataToSubmit as Omit<Expense, 'id'>);
    }
  };

  // ⬇️ S O L O  T A S T I E R A: intercetta Enter su "Importo", chiude tastiera, niente submit
  const handleAmountEnter = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const el = e.currentTarget as HTMLInputElement;
    el.blur();                // chiude la tastiera
    await waitKeyboardClose(); // attende stabilizzazione viewport → evita sfarfallio
    // resta nel form per scegliere conto/categoria/sottocategoria
  }, []);

  if (!isOpen) return null;

  const categoryOptions = Object.keys(CATEGORIES).map(cat => {
    const style = getCategoryStyle(cat);
    return {
      value: cat,
      label: style.label,
      Icon: style.Icon,
      color: style.color,
      bgColor: style.bgColor,
    };
  });

  const subcategoryOptions = formData.category && CATEGORIES[formData.category]
    ? CATEGORIES[formData.category].map(sub => ({ value: sub, label: sub }))
    : [];
    
  const accountOptions = accounts.map(acc => ({
      value: acc.id,
      label: acc.name,
  }));

  const isSubcategoryDisabled = !formData.category || formData.category === 'Altro' || subcategoryOptions.length === 0;

  const SelectionButton = ({ label, value, onClick, placeholder, ariaLabel, disabled, icon }: { label: string, value?: string, onClick: () => void, placeholder: string, ariaLabel: string, disabled?: boolean, icon: React.ReactNode }) => {
    const hasValue = value && value !== placeholder && value !== '';
    return (
      <div>
        <label className={`block text-base font-medium mb-1 transition-colors ${disabled ? 'text-slate-400' : 'text-slate-700'}`}>{label}</label>
        <button
          type="button"
          onClick={onClick}
          aria-label={ariaLabel}
          disabled={disabled}
          className={`w-full flex items-center justify-center text-center gap-2 px-3 py-2.5 text-base font-semibold rounded-lg border shadow-sm focus:outline-none focus:ring-0 transition-colors ${
            disabled
              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
              : hasValue
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
          }`}
        >
          {icon}
          <span className="truncate">
            {value || placeholder}
          </span>
        </button>
      </div>
    );
  };

  const selectedAccountLabel = accounts.find(a => a.id === formData.accountId)?.name;
  const selectedCategoryLabel = formData.category ? getCategoryStyle(formData.category).label : undefined;
  
  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-slate-900/60 backdrop-blur-sm`}
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-slate-50 w-full h-full flex flex-col absolute bottom-0 transform transition-transform duration-300 ease-in-out ${isAnimating ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center p-6 border-b border-slate-200 flex-shrink-0">
          <h2 ref={titleRef} tabIndex={-1} className="text-2xl font-bold text-slate-800 focus:outline-none">{isEditing ? 'Modifica Spesa' : 'Aggiungi Spesa'}</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-800 transition-colors p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Chiudi"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>
        <form onSubmit={handleSubmit} noValidate className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 space-y-4 flex-1 overflow-y-auto">
               <FormInput
                  ref={descriptionInputRef}
                  id="description"
                  name="description"
                  label="Descrizione (opzionale)"
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  icon={<DocumentTextIcon className="h-5 w-5 text-slate-400" />}
                  type="text"
                  placeholder="Es. Caffè al bar"
               />

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <FormInput
                     ref={amountInputRef}
                     id="amount"
                     name="amount"
                     label="Importo"
                     value={formData.amount || ''}
                     onChange={handleInputChange}
                     onKeyDown={handleAmountEnter}  // ⬅️ Enter chiude tastiera, non invia
                     icon={<CurrencyEuroIcon className="h-5 w-5 text-slate-400" />}
                     // ⬇️ cambiamento CHIAVE per tastiera
                     type="text"
                     inputMode="decimal"
                     pattern="[0-9]*[.,]?[0-9]*"
                     placeholder="0.00"
                     required
                     autoComplete="off"
                  />
                  <FormInput
                      id="date"
                      name="date"
                      label="Data (opzionale)"
                      value={formData.date || ''}
                      onChange={handleInputChange}
                      icon={<CalendarIcon className="h-5 w-5 text-slate-400" />}
                      type="date"
                      max={getTodayString()}
                  />
               </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SelectionButton 
                    label="Conto"
                    value={selectedAccountLabel}
                    onClick={() => setActiveMenu('account')}
                    placeholder="Seleziona"
                    ariaLabel="Seleziona conto di pagamento"
                    icon={<CreditCardIcon className="h-5 w-5" />}
                />
                <SelectionButton 
                    label="Categoria (opzionale)"
                    value={selectedCategoryLabel}
                    onClick={() => setActiveMenu('category')}
                    placeholder="Seleziona"
                    ariaLabel="Seleziona categoria"
                    icon={<TagIcon className="h-5 w-5" />}
                />
                <SelectionButton 
                    label="Sottocategoria (opzionale)"
                    value={formData.subcategory}
                    onClick={() => setActiveMenu('subcategory')}
                    placeholder="Seleziona"
                    ariaLabel="Seleziona sottocategoria"
                    disabled={isSubcategoryDisabled}
                    icon={<TagIcon className="h-5 w-5" />}
                />
              </div>

               {error && <p className="text-base text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
          </div>
          <footer className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-base font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-base font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              >
                {isEditing ? 'Salva Modifiche' : 'Aggiungi Spesa'}
              </button>
          </footer>
        </form>
      </div>

      <SelectionMenu 
        isOpen={activeMenu === 'account'}
        onClose={() => setActiveMenu(null)}
        title="Seleziona un Conto"
        options={accountOptions}
        selectedValue={formData.accountId || ''}
        onSelect={(value) => handleSelectChange('accountId', value)}
      />

      <SelectionMenu 
        isOpen={activeMenu === 'category'}
        onClose={() => setActiveMenu(null)}
        title="Seleziona una Categoria"
        options={categoryOptions}
        selectedValue={formData.category || ''}
        onSelect={(value) => handleSelectChange('category', value)}
      />

      <SelectionMenu 
        isOpen={activeMenu === 'subcategory'}
        onClose={() => setActiveMenu(null)}
        title="Seleziona Sottocategoria"
        options={subcategoryOptions}
        selectedValue={formData.subcategory || ''}
        onSelect={(value) => handleSelectChange('subcategory', value)}
      />

    </div>
  );
};

export default ExpenseForm;