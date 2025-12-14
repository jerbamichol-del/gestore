
import { useState, useEffect, useRef } from 'react';
import { ModalType } from '../types/navigation';

export const useBackNavigation = (
    onToast: (msg: any) => void,
    setAnalysisImage: (img: any) => void
) => {
  // UI State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCalculatorContainerOpen, setIsCalculatorContainerOpen] = useState(false);
  const [isImageSourceModalOpen, setIsImageSourceModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isMultipleExpensesModalOpen, setIsMultipleExpensesModalOpen] = useState(false);
  
  const [isRecurringScreenOpen, setIsRecurringScreenOpen] = useState(false);
  const [isRecurringClosing, setIsRecurringClosing] = useState(false); 

  const [isHistoryScreenOpen, setIsHistoryScreenOpen] = useState(false);
  const [isHistoryClosing, setIsHistoryClosing] = useState(false);
  
  const [isIncomeHistoryOpen, setIsIncomeHistoryOpen] = useState(false);
  const [isIncomeHistoryClosing, setIsIncomeHistoryClosing] = useState(false);

  const [isAccountsScreenOpen, setIsAccountsScreenOpen] = useState(false);
  
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false);

  const lastBackPressTime = useRef(0);

  const closeAllModals = () => {
      setIsFormOpen(false); setIsCalculatorContainerOpen(false); setIsImageSourceModalOpen(false);
      setIsVoiceModalOpen(false); setIsMultipleExpensesModalOpen(false); setIsQrModalOpen(false);
      setIsHistoryScreenOpen(false); setIsHistoryFilterOpen(false); setIsRecurringScreenOpen(false);
      setIsIncomeHistoryOpen(false); setIsIncomeHistoryClosing(false); setIsAccountsScreenOpen(false);
      setAnalysisImage(null);
  };

  const forceNavigateHome = () => {
      try { window.history.replaceState({ modal: 'home' }, '', window.location.pathname); } catch (e) {}
      window.dispatchEvent(new PopStateEvent('popstate', { state: { modal: 'home' } }));
  };

  const closeModalWithHistory = () => {
      if (window.history.state?.modal === 'history') { setIsHistoryScreenOpen(false); setIsHistoryClosing(false); }
      if (window.history.state?.modal === 'income_history') { setIsIncomeHistoryOpen(false); setIsIncomeHistoryClosing(false); }
      if (window.history.state?.modal === 'recurring') { setIsRecurringScreenOpen(false); setIsRecurringClosing(false); }
      if (window.history.state?.modal === 'accounts') { setIsAccountsScreenOpen(false); }
      
      if (window.history.state?.modal && window.history.state.modal !== 'home' && window.history.state.modal !== 'exit_guard') window.history.back();
      else forceNavigateHome();
  };

  // Setup Exit Guard
  useEffect(() => {
    if (!window.history.state?.modal) {
        window.history.replaceState({ modal: 'exit_guard' }, ''); 
        window.history.pushState({ modal: 'home' }, '');
    }
  }, []);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const modal = event.state?.modal as ModalType | undefined;
      
      if (modal === 'exit_guard') {
          const now = Date.now();
          if (now - lastBackPressTime.current < 2000) { window.history.back(); return; } 
          else {
              lastBackPressTime.current = now;
              onToast({ message: 'Premi di nuovo indietro per uscire', type: 'info' });
              window.history.pushState({ modal: 'home' }, ''); 
              closeAllModals();
          }
          return;
      }

      // Close specific modals based on state changes
      if (modal !== 'form') setIsFormOpen(false);
      if (modal !== 'voice') setIsVoiceModalOpen(false);
      if (modal !== 'source') setIsImageSourceModalOpen(false);
      if (modal !== 'multiple') setIsMultipleExpensesModalOpen(false);
      if (modal !== 'qr') setIsQrModalOpen(false);
      if (modal !== 'calculator' && modal !== 'calculator_details') setIsCalculatorContainerOpen(false);

      // Handle Screen Navigation
      if (!modal || modal === 'home') {
        setIsHistoryScreenOpen(false);
        setIsHistoryClosing(false); 
        setIsIncomeHistoryOpen(false);
        setIsIncomeHistoryClosing(false);
        setIsHistoryFilterOpen(false); 
        setIsRecurringScreenOpen(false);
        setIsRecurringClosing(false); 
        setIsAccountsScreenOpen(false);
        setAnalysisImage(null);
      } else if (modal === 'history') {
        setIsHistoryScreenOpen(true);
        if (isHistoryClosing) setIsHistoryClosing(false);
        setIsRecurringScreenOpen(false);
        setIsRecurringClosing(false);
        setIsIncomeHistoryOpen(false);
        setIsAccountsScreenOpen(false);
      } else if (modal === 'income_history') {
        setIsIncomeHistoryOpen(true);
        if (isIncomeHistoryClosing) setIsIncomeHistoryClosing(false);
        setIsHistoryScreenOpen(false);
        setIsRecurringScreenOpen(false);
        setIsAccountsScreenOpen(false);
      } else if (modal === 'recurring') {
        setIsRecurringScreenOpen(true);
        if (isRecurringClosing) setIsRecurringClosing(false); 
        setIsHistoryScreenOpen(false);
        setIsIncomeHistoryOpen(false);
        setIsAccountsScreenOpen(false);
      } else if (modal === 'accounts') {
        setIsAccountsScreenOpen(true);
        setIsHistoryScreenOpen(false);
        setIsIncomeHistoryOpen(false);
        setIsRecurringScreenOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onToast, isHistoryClosing, isRecurringClosing, isIncomeHistoryClosing, setAnalysisImage]);

  return {
    isFormOpen, setIsFormOpen,
    isCalculatorContainerOpen, setIsCalculatorContainerOpen,
    isImageSourceModalOpen, setIsImageSourceModalOpen,
    isVoiceModalOpen, setIsVoiceModalOpen,
    isMultipleExpensesModalOpen, setIsMultipleExpensesModalOpen,
    isRecurringScreenOpen, setIsRecurringScreenOpen, isRecurringClosing, setIsRecurringClosing,
    isHistoryScreenOpen, setIsHistoryScreenOpen, isHistoryClosing, setIsHistoryClosing,
    isIncomeHistoryOpen, setIsIncomeHistoryOpen, isIncomeHistoryClosing, setIsIncomeHistoryClosing,
    isAccountsScreenOpen, setIsAccountsScreenOpen,
    isQrModalOpen, setIsQrModalOpen,
    isHistoryFilterOpen, setIsHistoryFilterOpen,
    closeModalWithHistory,
    forceNavigateHome,
    closeAllModals
  };
};
