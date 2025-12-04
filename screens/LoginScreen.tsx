import React, { useState, useEffect, useRef } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import PinInput from '../components/auth/PinInput';
// NUOVI IMPORT AGGIUNTI
import { login, getUsers, saveUsers, StoredUser } from '../utils/api';
import { loadFromCloud } from '../utils/cloud';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { useLocalStorage } from '../hooks/useLocalStorage';
import LoginEmail from '../components/auth/LoginEmail';
import { FingerprintIcon } from '../components/icons/FingerprintIcon';
import {
  isBiometricsAvailable,
  isBiometricsEnabled,
  unlockWithBiometric,
  registerBiometric,
  setBiometricsOptOut,
} from '../services/biometrics';

type BioHelpers = {
  isBiometricSnoozed: () => boolean;
  setBiometricSnooze: () => void;
  clearBiometricSnooze: () => void;
};

const BIO_AUTOPROMPT_LOCK_KEY = 'bio.autoprompt.lock';
const hasAutoPromptLock = () => { try { return sessionStorage.getItem(BIO_AUTOPROMPT_LOCK_KEY) === '1'; } catch { return false; } };
const setAutoPromptLock = () => { try { sessionStorage.setItem(BIO_AUTOPROMPT_LOCK_KEY, '1'); } catch {} };
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
  const [bioBusy, setBioBusy] = useState(false);
  const autoStartedRef = useRef(false);
  const [biometricEmail, setBiometricEmail] = useState<string | null>(null);

  useEffect(() => {
    if (activeEmail) { setBiometricEmail(activeEmail); return; }
    try {
      const raw = window.localStorage.getItem(BIOMETRIC_LAST_EMAIL_KEY);
      if (raw && raw !== 'null' && raw !== 'undefined') setBiometricEmail(raw);
      else setBiometricEmail(null);
    } catch { setBiometricEmail(null); }
  }, [activeEmail]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const supported = await isBiometricsAvailable();
      const enabled = isBiometricsEnabled();
      let shouldShow = false;
      if (supported) {
        if (enabled) shouldShow = true;
        else if (activeEmail) shouldShow = true;
      }
      if (!mounted) return;
      setBioSupported(supported);
      setBioEnabled(enabled);
      setShowEnableBox(shouldShow);
    })();
    return () => { mounted = false; };
  }, [activeEmail]);

  const autoPromptEmail = activeEmail ?? biometricEmail ?? null;

  useEffect(() => {
    if (!autoPromptEmail) return;
    if (!bioSupported || !bioEnabled) return;
    if (autoStartedRef.current) return;
    if (hasAutoPromptLock()) return;

    autoStartedRef.current = true;
    setAutoPromptLock();

    (async () => {
      const { isBiometricSnoozed, setBiometricSnooze, clearBiometricSnooze } = (await import('../services/biometrics')) as unknown as BioHelpers;
      if (isBiometricSnoozed()) return;
      try {
        setBioBusy(true);
        const ok = await unlockWithBiometric('Sblocca con impronta / FaceID');
        setBioBusy(false);
        if (ok) {
          clearBiometricSnooze();
          const normalized = autoPromptEmail.toLowerCase();
          try { window.localStorage.setItem(BIOMETRIC_LAST_EMAIL_KEY, normalized); } catch {}
          if (!activeEmail) setActiveEmail(normalized);
          onLoginSuccess('biometric-local', normalized);
        }
      } catch (err: any) {
        setBioBusy(false);
        const msg = String(err?.message || '');
        if (err?.name === 'NotAllowedError' || err?.name === 'AbortError' || /timeout/i.test(msg)) setBiometricSnooze();
      }
    })();
  }, [autoPromptEmail, activeEmail, bioSupported, bioEnabled, onLoginSuccess, setActiveEmail]);

  useEffect(() => { if (pin.length === 4 && activeEmail) handlePinVerify(); }, [pin, activeEmail]);

  // --- LOGICA DI RIPRISTINO CLOUD ---
  const handleEmailSubmit = async (email: string) => {
    if (email) {
      const normalized = email.toLowerCase();
      // 1. Cerca in locale
      const localUsers = getUsers();
      if (localUsers[normalized]) {
          setActiveEmail(normalized);
          setError(null);
          setBiometricEmail(normalized);
          return;
      }

      // 2. Se non c'è, cerca nel Cloud
      setIsLoading(true);
      try {
          const cloudResult = await loadFromCloud(normalized);
          if (cloudResult) {
              // Ripristino dati
              localStorage.setItem('expenses_v2', JSON.stringify(cloudResult.data.expenses));
              localStorage.setItem('recurring_expenses_v1', JSON.stringify(cloudResult.data.recurringExpenses));
              localStorage.setItem('accounts_v1', JSON.stringify(cloudResult.data.accounts));
              
              // Ripristino utente (Hash/Salt)
              const newUser: StoredUser = {
                  email: normalized,
                  pinHash: cloudResult.pinHash,
                  pinSalt: cloudResult.pinSalt,
                  createdAt: new Date().toISOString()
              };
              localUsers[normalized] = newUser;
              saveUsers(localUsers);

              // Login riuscito (vai al PIN)
              setActiveEmail(normalized);
              setError(null);
              setBiometricEmail(normalized);
          } else {
              setError("Account non trovato (locale o cloud).");
          }
      } catch (e) {
          setError("Errore di connessione cloud.");
      } finally {
          setIsLoading(false);
      }
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

  const loginWithBiometrics = async () => {
    const emailForBio = activeEmail ?? biometricEmail;
    if (!emailForBio) return;
    try {
      setBioBusy(true);
      const { clearBiometricSnooze, setBiometricSnooze } = (await import('../services/biometrics')) as unknown as BioHelpers;
      clearBiometricSnooze();
      const ok = await unlockWithBiometric('Sblocca con impronta / FaceID');
      setBioBusy(false);
      if (ok) {
        const normalized = emailForBio.toLowerCase();
        try { window.localStorage.setItem(BIOMETRIC_LAST_EMAIL_KEY, normalized); } catch {}
        if (!activeEmail) setActiveEmail(normalized);
        setBiometricEmail(normalized);
        onLoginSuccess('biometric-local', normalized);
      }
    } catch (err) {
      setBioBusy(false);
      const msg = String((err as any)?.message || '');
      if ((err as any)?.name === 'NotAllowedError' || (err as any)?.name === 'AbortError' || /timeout/i.test(msg)) {
        const { setBiometricSnooze } = (await import('../services/biometrics')) as unknown as BioHelpers;
        setBiometricSnooze();
      }
    }
  };

  const enableBiometricsNow = async () => {
    const emailForBio = activeEmail ?? biometricEmail;
    if (!emailForBio) return;
    try {
      setBioBusy(true);
      await registerBiometric('Profilo locale');
      setBioEnabled(true);
      setBioBusy(false);
      const normalized = emailForBio.toLowerCase();
      try { window.localStorage.setItem(BIOMETRIC_LAST_EMAIL_KEY, normalized); } catch {}
      if (!activeEmail) setActiveEmail(normalized);
      setBiometricEmail(normalized);
      await loginWithBiometrics();
    } catch { setBioBusy(false); }
  };

  const optOutBiometrics = () => { try { setBiometricsOptOut(true); } catch {} setShowEnableBox(false); };

  const handleSwitchUser = () => { setActiveEmail(null); setPin(''); setError(null); autoStartedRef.current = false; };

  const renderContent = () => {
    if (!activeEmail) {
      return (
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Bentornato!</h2>
          <p className="text-slate-500 mb-6">Inserisci la tua email per accedere o ripristinare i dati.</p>
          <LoginEmail onSubmit={handleEmailSubmit} />
          {isLoading && <div className="mt-4 flex justify-center"><SpinnerIcon className="w-6 h-6 text-indigo-600"/></div>}
          {error && <p className="mt-4 text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>}
          {bioSupported && bioEnabled && biometricEmail && !isLoading && (
            <div className="mt-6">
              <button type="button" onClick={loginWithBiometrics} disabled={bioBusy} className="flex items-center justify-center w-full gap-2 px-4 py-3 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50 shadow-sm border border-indigo-100">
                <FingerprintIcon className="w-5 h-5" />{bioBusy ? 'Accesso in corso...' : 'Accedi con impronta'}
              </button>
            </div>
          )}
          <div className="mt-4 space-y-3">
            <a href="https://t.me/mailsendreset_bot?start=recover" target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-500">Email dimenticata?</a>
            <p className="text-sm text-slate-500">Non hai un account? <button onClick={onGoToRegister} className="font-semibold text-indigo-600 hover:text-indigo-500">Registrati</button></p>
          </div>
        </div>
      );
    }

    return (
      <div className="text-center">
        <p className="text-sm text-slate-600 mb-2 truncate" title={activeEmail}>{activeEmail}</p>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Inserisci il PIN</h2>
        <p className={`h-10 flex items-center justify-center transition-colors ${error ? 'text-red-500' : 'text-slate-500'}`}>
          {isLoading ? <SpinnerIcon className="w-6 h-6 text-indigo-600" /> : error || (bioEnabled && bioSupported ? 'Puoi anche usare l’impronta.' : 'Inserisci il tuo PIN di 4 cifre.')}
        </p>
        <PinInput pin={pin} onPinChange={setPin} />
        <div className="mt-6 flex flex-col items-center justify-center gap-y-3">
          {showEnableBox && (
            <div className="w-full mb-2">
              <button onClick={bioEnabled ? loginWithBiometrics : enableBiometricsNow} disabled={bioBusy} className="flex items-center justify-center w-full gap-2 px-4 py-3 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50 shadow-sm border border-indigo-100">
                <FingerprintIcon className="w-5 h-5" />{bioBusy ? 'Attendere...' : bioEnabled ? 'Accedi con impronta' : 'Abilita impronta'}
              </button>
              {!bioEnabled && <button type="button" onClick={optOutBiometrics} className="mt-2 text-xs text-slate-400 hover:text-slate-500">Non ora</button>}
            </div>
          )}
          <div className="flex w-full items-center justify-between px-1">
            <button onClick={handleSwitchUser} className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">Cambia Utente</button>
            <button onClick={onGoToForgotPassword} className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">PIN Dimenticato?</button>
          </div>
        </div>
      </div>
    );
  };

  return <AuthLayout>{renderContent()}</AuthLayout>;
};

export default LoginScreen;
