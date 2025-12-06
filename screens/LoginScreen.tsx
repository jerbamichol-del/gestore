import React, { useState, useEffect, useRef } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import PinInput from '../components/auth/PinInput';
import { login, getUsers, saveUsers, StoredUser } from '../utils/api';
import { loadFromCloud } from '../utils/cloud';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { useLocalStorage } from '../hooks/useLocalStorage';
import LoginEmail from '../components/auth/LoginEmail';
import { FingerprintIcon } from '../components/icons/FingerprintIcon';
// biometria
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

// lock di sessione per evitare doppio avvio (StrictMode / re-render)
const BIO_AUTOPROMPT_LOCK_KEY = 'bio.autoprompt.lock';
const hasAutoPromptLock = () => {
  try {
    return sessionStorage.getItem(BIO_AUTOPROMPT_LOCK_KEY) === '1';
  } catch {
    return false;
  }
};
const setAutoPromptLock = () => {
  try {
    sessionStorage.setItem(BIO_AUTOPROMPT_LOCK_KEY, '1');
  } catch {}
};

// email usata con la biometria (per auto-prompt anche sulla schermata email)
const BIOMETRIC_LAST_EMAIL_KEY = 'bio.last_email';

interface LoginScreenProps {
  onLoginSuccess: (token: string, email: string) => void;
  onGoToRegister: () => void;
  onGoToForgotPassword: () => void;
  onGoToForgotEmail: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  onGoToRegister,
  onGoToForgotPassword,
  onGoToForgotEmail,
}) => {
  const [activeEmail, setActiveEmail] = useLocalStorage<string | null>(
    'last_active_user_email',
    null,
  );
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // biometria
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [showEnableBox, setShowEnableBox] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const autoStartedRef = useRef(false);

  // email salvata assieme alla biometria (es. da un login precedente)
  const [biometricEmail, setBiometricEmail] = useState<string | null>(null);

  // carica/stabilisce l'email da usare per la biometria
  useEffect(() => {
    // se abbiamo già un utente attivo, quella è l'email biometrica
    if (activeEmail) {
      setBiometricEmail(activeEmail);
      return;
    }

    // siamo sulla schermata email → proviamo a leggere l'ultima email biometrica salvata
    try {
      if (typeof window === 'undefined') return;
      const raw = window.localStorage.getItem(BIOMETRIC_LAST_EMAIL_KEY);
      if (!raw || raw === 'null' || raw === 'undefined') {
        setBiometricEmail(null);
      } else {
        setBiometricEmail(raw);
      }
    } catch {
      setBiometricEmail(null);
    }
  }, [activeEmail]);

  // verifica stato biometria (supporto / enabled / se mostrare il box)
  useEffect(() => {
    let mounted = true;

    (async () => {
      const supported = await isBiometricsAvailable();
      const enabled = isBiometricsEnabled();

      let shouldShow = false;

      if (supported) {
        if (enabled) {
          // già attivata → mostra direttamente il pulsante impronta
          shouldShow = true;
        } else if (activeEmail) {
          // Se siamo sulla schermata PIN e supportato ma non attivo, mostriamo sempre "Abilita"
          // (ignoriamo eventuali opt-out passati per permettere l'attivazione ritardata)
          shouldShow = true;
        }
      }

      if (!mounted) return;

      setBioSupported(supported);
      setBioEnabled(enabled);
      setShowEnableBox(shouldShow);
    })();

    return () => {
      mounted = false;
    };
  }, [activeEmail]);

  // email effettiva da usare per l'auto-prompt (PIN o schermata email)
  const autoPromptEmail = activeEmail ?? biometricEmail ?? null;

  // Autoprompt biometrico: 1 solo tentativo totale per sessione.
  useEffect(() => {
    if (!autoPromptEmail) return;
    if (!bioSupported || !bioEnabled) return;
    if (autoStartedRef.current) return;
    if (hasAutoPromptLock()) return;

    autoStartedRef.current = true;
    setAutoPromptLock();

    (async () => {
      const { isBiometricSnoozed, setBiometricSnooze, clearBiometricSnooze } =
        (await import('../services/biometrics')) as unknown as BioHelpers;

      if (isBiometricSnoozed()) return;

      try {
        setBioBusy(true);
        const ok = await unlockWithBiometric('Sblocca con impronta / FaceID');
        setBioBusy(false);
        if (ok) {
          clearBiometricSnooze();

          const normalized = autoPromptEmail.toLowerCase();

          // Salva email biometrica dedicata
          try {
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(BIOMETRIC_LAST_EMAIL_KEY, normalized);
            }
          } catch {}

          // Se eravamo sulla schermata email, settiamo anche l'activeEmail
          if (!activeEmail) {
            setActiveEmail(normalized);
          }

          onLoginSuccess('biometric-local', normalized);
        }
      } catch (err: any) {
        setBioBusy(false);
        const name = err?.name || '';
        const msg = String(err?.message || '');
        if (name === 'NotAllowedError' || name === 'AbortError' || /timeout/i.test(msg)) {
          setBiometricSnooze();
        }
        // resta sulla schermata corrente
      }
    })();
  }, [autoPromptEmail, activeEmail, bioSupported, bioEnabled, onLoginSuccess, setActiveEmail]);

  // Verifica PIN
  useEffect(() => {
    if (pin.length === 4 && activeEmail) {
      handlePinVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, activeEmail]);

  const handleEmailSubmit = async (email: string) => {
    if (email) {
      const normalized = email.toLowerCase();
      // 1. Controllo Locale
      const localUsers = getUsers();
      if (localUsers[normalized]) {
          setActiveEmail(normalized);
          setError(null);
          setBiometricEmail(normalized);
          return;
      }

      // 2. Se non c'è, cerca nel Cloud (Ripristino)
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
              setError("Nessun account trovato (locale o cloud).");
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
      setTimeout(() => {
        setPin('');
        setError(null);
        setIsLoading(false);
      }, 1500);
    }
  };

  const loginWithBiometrics = async () => {
    const emailForBio = activeEmail ?? biometricEmail;
    if (!emailForBio) return;

    try {
      setBioBusy(true);
      const { clearBiometricSnooze, setBiometricSnooze } =
        (await import('../services/biometrics')) as unknown as BioHelpers;
      // login richiesto esplicitamente → azzero lo snooze
      clearBiometricSnooze();
      const ok = await unlockWithBiometric('Sblocca con impronta / FaceID');
      setBioBusy(false);
      if (ok) {
        const normalized = emailForBio.toLowerCase();
        // salva anche qui la mail biometrica
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(BIOMETRIC_LAST_EMAIL_KEY, normalized);
          }
        } catch {}

        if (!activeEmail) {
          setActiveEmail(normalized);
        }
        setBiometricEmail(normalized);

        onLoginSuccess('biometric-local', normalized);
      }
    } catch (err) {
      setBioBusy(false);
      console.error('Login biometrico fallito', err);
      const name = (err as any)?.name || '';
      const msg = String((err as any)?.message || '');
      if (name === 'NotAllowedError' || name === 'AbortError' || /timeout/i.test(msg)) {
        const { setBiometricSnooze } =
          (await import('../services/biometrics')) as unknown as BioHelpers;
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

      // salva email biometrica dedicata
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(BIOMETRIC_LAST_EMAIL_KEY, normalized);
        }
      } catch {}

      if (!activeEmail) {
        setActiveEmail(normalized);
      }
      setBiometricEmail(normalized);

      // Tentativo manuale subito dopo l’abilitazione
      await loginWithBiometrics();
    } catch {
      setBioBusy(false);
      // se annulla in registrazione, resta tutto com’è
    }
  };

  const optOutBiometrics = () => {
    try {
      setBiometricsOptOut(true);
    } catch {
      // se fallisce non è la fine del mondo
    }
    setShowEnableBox(false);
  };

  const handleSwitchUser = () => {
    setActiveEmail(null);
    setPin('');
    setError(null);
    autoStartedRef.current = false;
    // non resetto il lock globale: niente altro auto-prompt in questa sessione
  };

  const renderContent = () => {
    // —— SCHERMATA EMAIL ——
    if (!activeEmail) {
      return (
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Bentornato!</h2>
          <p className="text-slate-500 mb-6">Inserisci la tua email per continuare.</p>

          <LoginEmail onSubmit={handleEmailSubmit} />
          
          {isLoading && (
             <div className="mt-4 flex justify-center">
                <SpinnerIcon className="w-6 h-6 text-indigo-600" />
             </div>
          )}
          
          {error && (
             <p className="mt-4 text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>
          )}

          {/* PULSANTE BIOMETRICO NELLA SCHERMATA EMAIL */}
          {bioSupported && bioEnabled && biometricEmail && !isLoading && (
            <div className="mt-6">
              <button
                type="button"
                onClick={loginWithBiometrics}
                disabled={bioBusy}
                className="flex items-center justify-center w-full gap-2 px-4 py-3 text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50 shadow-sm border border-indigo-100"
              >
                <FingerprintIcon className="w-5 h-5" />
                {bioBusy ? 'Accesso in corso...' : 'Accedi con impronta'}
              </button>
            </div>
          )}

          <div className="mt-4 space-y-3">
            <a
              href="https://t.me/mailsendreset_bot?start=recover"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Email dimenticata?
            </a>
            <p className="text-sm text-slate-500">
              Non hai un account?{' '}
              <button
                onClick={onGoToRegister}
                className="font-semibold text-indigo-600 hover:text-indigo-500"
              >
                Registrati
              </button>
            </p>
          </div>
        </div>
      );
    }

    // —— SCHERMATA PIN ——
    return (
      <div className="text-center">
        <p className="text-sm text-slate-600 mb-2 truncate" title={activeEmail}>
          {activeEmail}
        </p>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Inserisci il PIN di 4 cifre</h2>
        
        {/* Container for status/error that collapses when empty */}
        <div className={`flex items-center justify-center transition-all duration-200 overflow-hidden ${error || isLoading ? 'h-6 mb-2' : 'h-0'}`}>
            {isLoading ? (
                <SpinnerIcon className="w-4 h-4 text-indigo-600" />
            ) : error ? (
                <p className="text-sm text-red-500">{error}</p>
            ) : null}
        </div>

        <PinInput 
            pin={pin} 
            onPinChange={setPin}
            showBiometric={showEnableBox}
            onBiometric={bioEnabled ? loginWithBiometrics : enableBiometricsNow}
        />

        <div className="mt-6 flex flex-col items-center justify-center gap-y-3">
          <div className="flex w-full items-center justify-between px-1">
            <button
              onClick={handleSwitchUser}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              Cambia Utente
            </button>
            <button
              onClick={onGoToForgotPassword}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              PIN Dimenticato?
            </button>
          </div>
        </div>
      </div>
    );
  };

  return <AuthLayout>{renderContent()}</AuthLayout>;
};

export default LoginScreen;
