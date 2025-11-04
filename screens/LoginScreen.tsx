import React, { useState, useEffect, useRef } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import PinInput from '../components/auth/PinInput';
import { login } from '../utils/api';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { useLocalStorage } from '../hooks/useLocalStorage';
import LoginEmail from '../components/auth/LoginEmail';

// biometria
import {
  isBiometricsAvailable,
  isBiometricsEnabled,
  unlockWithBiometric,
  registerBiometric,
  shouldOfferBiometricEnable,
  setBiometricsOptOut,
} from '../services/biometrics';

// ——— Snooze di sessione: dopo “Annulla/Timeout” non auto-promptare più ———
const BIO_SNOOZE_KEY = 'bio.snooze';
const isBiometricSnoozed = () => {
  try { return sessionStorage.getItem(BIO_SNOOZE_KEY) === '1'; } catch { return false; }
};
const setBiometricSnooze = () => { try { sessionStorage.setItem(BIO_SNOOZE_KEY, '1'); } catch {} };
const clearBiometricSnooze = () => { try { sessionStorage.removeItem(BIO_SNOOZE_KEY); } catch {} };

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
  const [activeEmail, setActiveEmail] = useLocalStorage<string | null>('last_active_user_email', null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // biometria
  const [bioSupported, setBioSupported] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [showEnableBox, setShowEnableBox] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const attemptsRef = useRef(0);
  const autoStartedRef = useRef(false);

  // verifica stato biometria quando entri nella schermata PIN
  useEffect(() => {
    let mounted = true;
    (async () => {
      const supported = await isBiometricsAvailable();
      const enabled = isBiometricsEnabled();
      const offer = await shouldOfferBiometricEnable();
      if (!mounted) return;
      setBioSupported(supported);
      setBioEnabled(enabled);
      setShowEnableBox(offer);
    })();
    return () => { mounted = false; };
  }, [activeEmail]);

  // Autoprompt biometrico: NON se in snooze (utente ha premuto Annulla/timeout)
  useEffect(() => {
    if (!activeEmail) return;
    if (!bioSupported || !bioEnabled) return;
    if (autoStartedRef.current) return;
    if (isBiometricSnoozed()) return; // << blocca qualsiasi auto-prompt nella sessione

    autoStartedRef.current = true;

    const tryAuto = async () => {
      attemptsRef.current = 0;
      while (attemptsRef.current < 3) {
        try {
          setBioBusy(true);
          const ok = await unlockWithBiometric('Sblocca con impronta / FaceID');
          setBioBusy(false);
          if (ok) {
            clearBiometricSnooze(); // successo ⇒ consenti futuri auto-prompt
            onLoginSuccess('biometric-local', activeEmail);
            return;
          }
        } catch (err: any) {
          setBioBusy(false);
          // Se l'utente annulla (o c'è timeout), metti in snooze e non riproporre
          const name = err?.name || '';
          const msg  = String(err?.message || '');
          if (name === 'NotAllowedError' || name === 'AbortError' || /timeout/i.test(msg)) {
            setBiometricSnooze();
            break; // interrompi il while
          }
          // altri errori: tenta ancora fino a 3, poi lascia il PIN
        }
        attemptsRef.current += 1;
        await new Promise(r => setTimeout(r, 250));
      }
      // dopo 3 tentativi → lascia usare il PIN senza altri prompt automatici
    };

    tryAuto();
  }, [activeEmail, bioSupported, bioEnabled, onLoginSuccess]);

  // Verifica PIN
  useEffect(() => {
    if (pin.length === 4 && activeEmail) {
      handlePinVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, activeEmail]);

  const handleEmailSubmit = (email: string) => {
    if (email) {
      setActiveEmail(email.toLowerCase());
      setError(null);
      // non forziamo biometria qui; l'effetto sopra si occuperà, se non in snooze
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

  // Abilita ora (box interno) — se annulla il prompt, metti in snooze
  const enableBiometricsNow = async () => {
    try {
      setBioBusy(true);
      await registerBiometric('Profilo locale');
      setBioEnabled(true);
      setShowEnableBox(false);
      setBioBusy(false);
      // appena abilitato, prova 1 sblocco immediato (manuale)
      try {
        clearBiometricSnooze(); // nuova prova esplicita ⇒ consenti prompt
        const ok = await unlockWithBiometric('Sblocca con impronta / FaceID');
        if (ok && activeEmail) {
          onLoginSuccess('biometric-local', activeEmail);
          return;
        }
      } catch (err: any) {
        // Se annulla/timeout, NON riproporre: metti in snooze finché non clicca di nuovo manualmente
        const name = err?.name || '';
        const msg  = String(err?.message || '');
        if (name === 'NotAllowedError' || name === 'AbortError' || /timeout/i.test(msg)) {
          setBiometricSnooze();
        }
        // resta su PIN
      }
    } catch {
      // Se l'utente annulla durante la registrazione, non fare nulla e lascia il PIN
      setBioBusy(false);
    }
  };

  // Non ora (non riproporre il box)
  const denyBiometricsOffer = () => {
    setBiometricsOptOut(true);
    setShowEnableBox(false);
    // opzionale: metti in snooze la sessione per evitare proposte subito dopo
    setBiometricSnooze();
  };

  const handleSwitchUser = () => {
    setActiveEmail(null);
    setPin('');
    setError(null);
    autoStartedRef.current = false;
    // non tocchiamo lo snooze: è per sessione, coerente non riproporre subito
  };

  const renderContent = () => {
    // —— SCHERMATA EMAIL —— 
    if (!activeEmail) {
      return (
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Bentornato!</h2>
          <p className="text-slate-500 mb-6">Inserisci la tua email per continuare.</p>

          <LoginEmail onSubmit={handleEmailSubmit} />

          <div className="mt-3">
            <button
              onClick={onGoToForgotEmail}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Email dimenticata?
            </button>
          </div>

          <p className="text-sm text-slate-500 mt-4">
            Non hai un account?{' '}
            <button
              onClick={onGoToRegister}
              className="font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Registrati
            </button>
          </p>
        </div>
      );
    }

    // —— SCHERMATA PIN —— 
    return (
      <div className="text-center">
        <p className="text-sm text-slate-600 mb-2 truncate" title={activeEmail}>
          {activeEmail}
        </p>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Inserisci il PIN</h2>
        <p
          className={`h-10 flex items-center justify-center transition-colors ${
            error ? 'text-red-500' : 'text-slate-500'
          }`}
        >
          {isLoading ? (
            <SpinnerIcon className="w-6 h-6 text-indigo-600" />
          ) : (
            error || (bioEnabled && bioSupported ? 'Puoi anche usare l’impronta.' : 'Inserisci il tuo PIN di 4 cifre.')
          )}
        </p>

        <PinInput pin={pin} onPinChange={setPin} />

        {/* Box abilitazione biometria (solo se disponibile, non abilitata, non opt-out) */}
        {showEnableBox && (
          <div className="mt-4 p-3 rounded-lg border border-slate-200 bg-slate-50 text-left">
            <p className="text-sm text-slate-700">
              Vuoi abilitare lo sblocco con impronta / FaceID su questo dispositivo?
            </p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={enableBiometricsNow}
                disabled={bioBusy}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-indigo-300"
              >
                {bioBusy ? 'Attivo…' : 'Abilita ora'}
              </button>
              <button
                onClick={denyBiometricsOffer}
                disabled={bioBusy}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Non ora
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <button
            onClick={handleSwitchUser}
            className="text-sm font-semibold text-slate-500 hover:text-slate-800"
          >
            Cambia Utente
          </button>
          <div className="flex gap-4">
            <button
              onClick={onGoToForgotPassword}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
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
