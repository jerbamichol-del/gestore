
import React, { useCallback, useEffect, useRef } from 'react';
import { Expense, Account } from '../types';
import { saveToCloud, loadFromCloud } from '../utils/cloud';
import { getUsers } from '../utils/api';

const SCRIPT_URL = (import.meta as any).env?.VITE_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzuAtweyuib21-BX4dQszoxEL5BW-nzVN2Vyum4UZvWH-TzP3GLZB5He1jFkrO6242JPA/exec';

export const useCloudSync = (
  currentEmail: string,
  isOnline: boolean,
  expenses: Expense[],
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>,
  recurringExpenses: Expense[],
  setRecurringExpenses: React.Dispatch<React.SetStateAction<Expense[]>>,
  accounts: Account[],
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>,
  showToast: (msg: { message: string; type: 'success' | 'info' | 'error' }) => void
) => {
  const isSaving = useRef(false);

  // --- SYNC DAL CLOUD (Con modalità silenziosa) ---
  const handleSyncFromCloud = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) showToast({ message: 'Sincronizzazione...', type: 'info' });
      
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'load', email: currentEmail })
      });
      
      const json = await response.json();
      
      if (json.success && json.data) {
        setExpenses(json.data.expenses || []);
        if (json.data.recurringExpenses) setRecurringExpenses(json.data.recurringExpenses);
        if (json.data.accounts) setAccounts(json.data.accounts);

        if (!isSilent) showToast({ message: 'Dati aggiornati!', type: 'success' });
        console.log("Sync completato con successo.");
      } 
    } catch (e) {
      console.error("Errore sync auto:", e);
      if (!isSilent) showToast({ message: 'Errore connessione.', type: 'error' });
    }
  }, [currentEmail, setExpenses, setRecurringExpenses, setAccounts, showToast]);

  // --- AUTOMAZIONE SYNC QUANDO L'APP SI APRE O TORNA VISIBILE ---
  useEffect(() => {
    const autoSync = async () => {
      if (isOnline && currentEmail) {
        console.log("App tornata attiva: Controllo aggiornamenti...");
        await handleSyncFromCloud(true); // true = modalità silenziosa
      }
    };

    autoSync();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        autoSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange); 

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isOnline, currentEmail, handleSyncFromCloud]);

  // --- CLOUD SYNC: INTELLIGENTE (Salva su modifiche e su uscita) ---
  const performSave = useCallback(() => {
    if (!currentEmail || !isOnline || isSaving.current) return;
    
    const allUsers = getUsers();
    const currentUser = allUsers[currentEmail.toLowerCase()];
    
    if (currentUser) {
       console.log("☁️ Salvataggio in corso...");
       isSaving.current = true;
       saveToCloud(
           currentEmail, 
           { expenses, recurringExpenses, accounts },
           currentUser.pinHash, 
           currentUser.pinSalt
       ).finally(() => {
           isSaving.current = false;
       });
    }
  }, [currentEmail, isOnline, expenses, recurringExpenses, accounts]);

  // Timer automatico (Debounce): Salva solo se ti fermi per 2 secondi
  useEffect(() => {
      const timer = setTimeout(() => {
          performSave();
      }, 2000);
      return () => clearTimeout(timer);
  }, [performSave]);

  // SALVATAGGIO DI EMERGENZA (Quando chiudi l'app)
  useEffect(() => {
    const handleBeforeUnload = () => performSave();
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') performSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [performSave]);

  return { handleSyncFromCloud };
};
