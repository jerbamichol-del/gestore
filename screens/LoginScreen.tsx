import React, { useState, useEffect, useRef } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import PinInput from '../components/auth/PinInput';
import { login, getUsers, saveUsers, StoredUser } from '../utils/api';
import { loadFromCloud } from '../utils/cloud';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { useLocalStorage } from '../hooks/useLocalStorage';
import LoginEmail from '../components/auth/LoginEmail';
import { FingerprintIcon } from '../components/icons/FingerprintIcon';
import { isBiometricsAvailable, isBiometricsEnabled, unlockWithBiometric, registerBiometric, setBiometricsOptOut } from '../services/biometrics';

const BIOMETRIC_LAST_EMAIL_KEY = 'bio.last_email';

interface LoginScreenProps {
  onLoginSuccess: (token: string, email: string) => void;
  onGoToRegister: () => void;
  onGoToForgotPassword: () => void;
  onGoToForgotEmail: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onGoToRegister, onGoToForgotPassword, onGoToForgotEmail }) => {
  const [activeEmail, setActiveEmail] = useLocalStorage<string | null>('last_active_user_email', null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [showEnableBox, setShowEnableBox] = useState(false);
  const [biometricEmail, setBiometricEmail] = useState<string | null>(null);

  // --- LOGICA CHIAVE PER IL RIPRISTINO ---
  const handleEmailSubmit = async (email: string) => {
    if (!email) return;
    const normalized = email.toLowerCase();
    
    // 1. Controllo Locale
    const localUsers = getUsers();
    
    if (localUsers[normalized]) {
      setActiveEmail(normalized);
      setError(null);
      return;
    }

    // 2. Utente NON esiste locale -> CERCO NEL CLOUD
    setIsLoading(true);
    try {
      const cloudResult = await loadFromCloud(normalized);
      
      if (cloudResult) {
        // TROVATO! Ripristiniamo tutto
        localStorage.setItem('expenses_v2', JSON.stringify(cloudResult.data.expenses));
        localStorage.setItem('recurring_expenses_v1', JSON.stringify(cloudResult.data.recurringExpenses));
        localStorage.setItem('accounts_v1', JSON.stringify(cloudResult.data.accounts));
        
        // Ripristiniamo l'utente "finto" per permettere il login col PIN
        const newUser: StoredUser = {
            email: normalized,
            pinHash: cloudResult.pinHash,
            pinSalt: cloudResult.pinSalt,
            createdAt: new Date().toISOString()
        };
        localUsers[normalized] = newUser;
        saveUsers(localUsers);

        setActiveEmail(normalized);
        setError(null); 
      } else {
        setError("Nessun account trovato (nè locale nè cloud).");
      }
    } catch (e) {
      setError("Errore di connessione cloud.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinVerify = async () => {
    if (isLoading || !activeEmail) return;
    setIsLoading(true);
    setError(null);
    const response = await login(activeEmail, pin);
    if (response.success && response.token) {
      onLoginSuccess(response.token, activeEmail);
    } else {
      setError(response.message);
      setTimeout(() => { setPin(''); setError(null); setIsLoading(false); }, 1500);
    }
  };

  useEffect(() => { if (pin.length === 4 && activeEmail) handlePinVerify(); }, [pin, activeEmail]);

  // -- Biometria (Semplificata per brevità, la logica è standard) --
  useEffect(() => {
      (async () => {
          const avail = await isBiometricsAvailable();
          setBioSupported(avail);
          setBioEnabled(isBiometricsEnabled());
          if (avail && !isBiometricsEnabled() && activeEmail) setShowEnableBox(true);
      })();
  }, [activeEmail]);

  const renderContent = () => {
    if (!activeEmail) {
      return (
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Bentornato!</h2>
          <p className="text-slate-500 mb-6">Inserisci la email per accedere o ripristinare i dati.</p>
          <LoginEmail onSubmit={handleEmailSubmit} />
          {isLoading && <div className="mt-4 flex justify-center"><SpinnerIcon className="w-6 h-6 text-indigo-600"/></div>}
          {error && <p className="mt-4 text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>}
          <div className="mt-4 space-y-3">
            <button onClick={onGoToRegister} className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">Non hai un account? Registrati</button>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center">
        <p className="text-sm text-slate-600 mb-2 truncate">{activeEmail}</p>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Inserisci PIN</h2>
        <p className={`h-10 flex items-center justify-center transition-colors ${error ? 'text-red-500' : 'text-slate-500'}`}>
          {isLoading ? <SpinnerIcon className="w-6 h-6 text-indigo-600" /> : error || 'Inserisci il PIN di 4 cifre.'}
        </p>
        <PinInput pin={pin} onPinChange={setPin} />
        <div className="mt-6 flex flex-col items-center gap-y-3">
            <button onClick={() => { setActiveEmail(null); setPin(''); setError(null); }} className="text-sm font-semibold text-indigo-600">Cambia Utente</button>
            <button onClick={onGoToForgotPassword} className="text-sm font-semibold text-indigo-600">PIN Dimenticato?</button>
        </div>
      </div>
    );
  };

  return <AuthLayout>{renderContent()}</AuthLayout>;
};

export default LoginScreen;
