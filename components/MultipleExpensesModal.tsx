import React, { useState, useEffect } from 'react';
import { Expense, Account, CATEGORIES } from '../types';
import { XMarkIcon } from './icons/XMarkIcon';
import { formatCurrency } from './icons/formatters';
import { getCategoryStyle } from '../utils/categoryStyles';
import CustomSelect from './CustomSelect';
import { PencilSquareIcon } from './icons/PencilSquareIcon';
import { DocumentTextIcon } from './icons/DocumentTextIcon';
import { TagIcon } from './icons/TagIcon';

interface MultipleExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Partial<Omit<Expense, 'id'>>[];
  accounts: Account[];
  onConfirm: (expenses: Omit<Expense, 'id'>[]) => void;
}

// A custom styled checkbox component
const CustomCheckbox = ({ checked, onChange, id, label }: { checked: boolean, onChange: () => void, id: string, label: string }) => (
    <div className="flex items-center">
        <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
        <label htmlFor={id} className="ml-2 text-sm font-medium text-slate-700 sr-only">
            {label}
        </label>
    </div>
);


const MultipleExpensesModal: React.FC<MultipleExpensesModalProps> = ({ isOpen, onClose, expenses, accounts, onConfirm }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [editableExpenses, setEditableExpenses] = useState<Partial<Omit<Expense, 'id'>>[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      const newEditableExpenses = expenses.map(e => ({...e}));
      setEditableExpenses(newEditableExpenses);
      setSelectedIndices(new Set(expenses.map((_, index) => index)));
      setExpandedIndex(null);
      
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen, expenses]);
  
  const handleToggleSelection = (index: number) => {
      const newSelection = new Set(selectedIndices);
      if (newSelection.has(index)) {
          newSelection.delete(index);
      } else {
          newSelection.add(index);
      }
      setSelectedIndices(newSelection);
  };

  const handleToggleSelectAll = () => {
      if (selectedIndices.size === editableExpenses.length) {
          setSelectedIndices(new Set());
      } else {
          setSelectedIndices(new Set(editableExpenses.map((_, index) => index)));
      }
  };

  const handleFieldChange = (index: number, field: keyof Omit<Expense, 'id' | 'amount'>, value: string) => {
      const updatedExpenses = [...editableExpenses];
      const expenseToUpdate = { ...updatedExpenses[index], [field]: value };

      if (field === 'category') {
          expenseToUpdate.subcategory = '';
      }
      updatedExpenses[index] = expenseToUpdate;
      setEditableExpenses(updatedExpenses);
  };

  const handleToggleExpand = (index: number) => {
    setExpandedIndex(prevIndex => (prevIndex === index ? null : index));
  };


  const handleConfirm = () => {
    const defaultAccountId = accounts.length > 0 ? accounts[0].id : '';
    const expensesToAdd = editableExpenses
      .filter((_, index) => selectedIndices.has(index))
      .map(exp => ({
        description: exp.description || 'Senza descrizione',
        amount: exp.amount!,
        date: exp.date || new Date().toISOString().split('T')[0],
        category: exp.category || 'Altro',
        subcategory: exp.subcategory || undefined,
        accountId: exp.accountId || defaultAccountId,
      }))
      .filter(exp => exp.amount > 0); 

    if (expensesToAdd.length > 0) {
        onConfirm(expensesToAdd);
    }
    onClose();
  };


  if (!isOpen) return null;
  
  const areAllSelected = selectedIndices.size === editableExpenses.length && editableExpenses.length > 0;

  const categoryOptions = Object.keys(CATEGORIES).map(cat => ({
    value: cat,
    label: getCategoryStyle(cat).label,
    Icon: getCategoryStyle(cat).Icon,
    color: getCategoryStyle(cat).color,
    bgColor: getCategoryStyle(cat).bgColor,
  }));

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center items-start p-4 transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-slate-900/60 backdrop-blur-sm overflow-y-auto`}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-slate-50 rounded-lg shadow-xl w-full max-w-3xl my-8 transform transition-all duration-300 ease-in-out ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-200 sticky top-0 bg-slate-50/80 backdrop-blur-sm rounded-t-lg z-20">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Spese Rilevate</h2>
            <p className="text-sm text-slate-500">Abbiamo trovato {expenses.length} spese. Seleziona e modifica i dettagli prima di aggiungerle.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 transition-colors p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Chiudi"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center bg-slate-100 p-2 rounded-md mb-4 border border-slate-200">
                <CustomCheckbox 
                    id="select-all" 
                    checked={areAllSelected} 
                    onChange={handleToggleSelectAll} 
                    label="Seleziona tutto"
                />
                <label htmlFor="select-all" className="ml-3 text-sm font-medium text-slate-700 cursor-pointer">
                    Seleziona / Deseleziona tutto
                </label>
            </div>
            <div className="space-y-3">
                {editableExpenses.map((expense, index) => {
                    const isSelected = selectedIndices.has(index);
                    const isExpanded = expandedIndex === index;
                    const categoryStyle = getCategoryStyle(expense.category || 'Altro');
                    
                    const subcategoriesForCategory = expense.category ? CATEGORIES[expense.category as keyof typeof CATEGORIES] : undefined;
                    const availableSubcategories = Array.isArray(subcategoriesForCategory) ? subcategoriesForCategory : [];
                    
                    const subcategoryOptions = availableSubcategories.map(subcat => ({
                        value: subcat,
                        label: subcat
                    }));


                    return (
                    <div 
                        key={index} 
                        className={`relative bg-white rounded-lg shadow-sm border ${isSelected ? 'border-indigo-400' : 'border-slate-200'} ${isExpanded ? 'ring-2 ring-indigo-300 z-10' : 'z-0'} transition-all duration-300 animate-fade-in-up`} 
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <div className="p-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                                <CustomCheckbox 
                                    id={`expense-${index}`} 
                                    checked={isSelected} 
                                    onChange={() => handleToggleSelection(index)}
                                    label={`Seleziona spesa ${expense.description}`}
                                />
                                <span className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${categoryStyle.bgColor}`}>
                                    <categoryStyle.Icon className={`w-6 h-6 ${categoryStyle.color}`} />
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-slate-800 truncate" title={expense.description}>{expense.description || 'Senza descrizione'}</p>
                                    <p className="text-sm text-slate-500 truncate">{expense.category || 'Altro'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <input 
                                    type="date"
                                    value={expense.date || ''}
                                    onChange={(e) => handleFieldChange(index, 'date', e.target.value)}
                                    className="w-36 text-sm rounded-md border border-slate-300 bg-white py-1.5 px-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                                <p className="text-lg font-bold text-indigo-600 w-28 text-right">{formatCurrency(expense.amount || 0)}</p>
                                <button onClick={() => handleToggleExpand(index)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors" aria-label="Modifica spesa">
                                    <PencilSquareIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        
                        {isExpanded && (
                            <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-4">
                                <div>
                                    <label htmlFor={`description-${index}`} className="block text-sm font-medium text-slate-700 mb-1">Descrizione</label>
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <DocumentTextIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                                        </div>
                                        <input
                                            type="text"
                                            id={`description-${index}`}
                                            value={expense.description || ''}
                                            onChange={(e) => handleFieldChange(index, 'description', e.target.value)}
                                            className="block w-full rounded-md border border-slate-300 bg-white py-2 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                                            placeholder="Es. Spesa al supermercato"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                     <div>
                                        <label htmlFor={`category-${index}`} className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                                        <CustomSelect
                                            options={categoryOptions}
                                            selectedValue={expense.category || ''}
                                            onSelect={(value) => handleFieldChange(index, 'category', value)}
                                            placeholder="Seleziona categoria"
                                            icon={<TagIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />}
                                        />
                                     </div>
                                      <div>
                                        <label htmlFor={`subcategory-${index}`} className="block text-sm font-medium text-slate-700 mb-1">Sottocategoria</label>
                                        <CustomSelect
                                            options={subcategoryOptions}
                                            selectedValue={expense.subcategory || ''}
                                            onSelect={(value) => handleFieldChange(index, 'subcategory', value)}
                                            placeholder="Nessuna"
                                            icon={<TagIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />}
                                            disabled={!expense.category || availableSubcategories.length === 0}
                                        />
                                      </div>
                                </div>
                            </div>
                        )}
                    </div>
                    );
                })}
            </div>
        </div>
        
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 rounded-b-lg">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              Annulla
            </button>
           <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedIndices.size === 0}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:bg-indigo-300 disabled:cursor-not-allowed"
            >
              Aggiungi {selectedIndices.size} Spes{selectedIndices.size !== 1 ? 'e' : 'a'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default MultipleExpensesModal;