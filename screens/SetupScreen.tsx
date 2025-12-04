import React, { useState, useEffect } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import PinInput from '../components/auth/PinInput';
import { register, login } from '../utils/api';
// NUOVO IMPORT
import { checkUserInCloud } from '../utils/cloud';
import { EnvelopeIcon } from '../components/icons/EnvelopeIcon';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { ExclamationTriangleIcon } from '../components/icons/ExclamationTriangleIcon';
import { XMarkIcon } from '../components/icons/XMarkIcon';
import {
  isBiometricsAvailable,
  registerBiometric,
  setBiometricsOptOut,
} from '../services/biometrics';

const BIO_SNOOZE_KEY = 'bio.snooze';
const clearBiometricSnooze = () => { try { sessionStorage.removeItem(BIO_SNOOZE_KEY); } catch {} };

interface SetupScreenProps {
  onSetupSuccess: (token: string, email: string) => void;
  onGoToLogin: () => void;
}

type Step = 'email' | 'pin_setup' | 'pin_confirm' | 'bio_offer' | 'processing';

const TelegramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.963 8.219-1.57 7.407c-.117.537-.442.67-.896.417l-2.48-1.828-1.197 1.152c-.132.133-.243.244-.496.244l.176-2.525 4.6-4.157c.2-.178-.043-.277-.31-.098l-5.685 3.58-2.45-.765c-.533-.166-.543-.533.112-.789l9.573-3.689c.444-.166.833.1.574.812z" />
  </svg>
);

const SetupScreen: React.FC<SetupScreenProps> = ({ onSetupSuccess, onGoToLogin }) => {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bioSupported, setBioSupported] = useState<boolean | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  
  const [hasOpenedTelegram, setHasOpenedTelegram] = useState(false);
  const [showTelegramWarning, setShowTelegramWarning] = useState(false);

  const getTelegramLink = () => {
    if (!email) return '#';
    try {
      const base64 = btoa(email);
      const urlSafe = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return `https://t.me/mailsendreset_bot?start=reg_${urlSafe}`;
    } catch {
      return '#';
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Inserisci un indirizzo email valido.');
        return;
    }

    // --- NUOVO CONTROLLO CLOUD ---
    setIsLoading(true);
    try {
        const userExists = await checkUserInCloud(email.toLowerCase());
        if (userExists) {
            setError("Email già registrata. Vai su 'Accedi' per recuperare i dati.");
            setIsLoading(false);
            return; // Blocca la registrazione
        }
    } catch (e) {
        console.error(e);
        // Se siamo offline o c'è un errore, potremmo decidere di bloccare o avvisare.
        // Per sicurezza, lasciamo passare ma con un console.log, 
        // oppure blocchiamo se è vitale. Qui lasciamo passare.
    }
    setIsLoading(false);
    // -----------------------------

    if (!hasOpenedTelegram && !showTelegramWarning) {
        setShowTelegramWarning(true);
    } else {
        setStep('pin_setup');
    }
  };

  const doRegisterAndLogin = async () => {
    setStep('processing');
    setIsLoading(true);
    setError(null);
    const normalizedEmail = email.toLowerCase();

    const regResponse = await register(normalizedEmail, pin);
    if (!regResponse.success) {
      setError(regResponse.message);
      setIsLoading(false);
      setTimeout(() => {
        setPin('');
        setConfirmPin('');
        setError(null);
        setStep('email');
      }, 2000);
      return;
    }

    const loginResponse = await login(normalizedEmail, pin);
    if (loginResponse.success && loginResponse.token) {
      onSetupSuccess(loginResponse.token, normalizedEmail);
    } else {
      setIsLoading(false);
      setError('Login automatico fallito. Vai alla pagina di login.');
      setTimeout(() => onGoToLogin(), 2000);
    }
  };

  useEffect(() => {
    if (step === 'pin_setup' && pin.length === 4) {
      setStep('pin_confirm');
    }
  }, [pin, step]);

  useEffect(() => {
    (async () => {
      if (step === 'pin_confirm' && confirmPin.length === 4) {
        if (pin === confirmPin) {
          setError(null);
          const supported = await isBiometricsAvailable();
          setBioSupported(supported);
          if (supported) {
            setStep('bio_offer');
          } else {
            await doRegisterAndLogin();
          }
        } else {
          setError('I PIN non corrispondono. Riprova.');
          setTimeout(() => {
            setPin('');
            setConfirmPin('');
            setError(null);
            setStep('pin_setup');
          }, 1500);
        }
      }
    })();
  }, [confirmPin, pin, step]);

  const inputStyles =
    'block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm';

  const renderContent = () => {
    if (step === 'processing' || isLoading) {
      return (
        <div className="text-center min-h-[300px] flex flex-col justify-center items-center">
          <SpinnerIcon className="w-12 h-12 text-indigo-600 mx-auto" />
          <p className="mt-4 text-slate-500">
             {step === 'processing' ? 'Creazione account...' : 'Verifica email...'}
          </p>
        </div>
      );
    }

    switch (step) {
      case 'email':
        return (
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Crea un Account</h2>
            <p className={`text-slate-500 mb-6 h-10 flex items-center justify-center ${error ? 'text-red-500 text-sm' : ''}`}>
                {error || 'Inizia inserendo i tuoi dati.'}
            </p>
            
            {showTelegramWarning && (
              <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-3 text-left animate-fade-in-up relative">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-5 w-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800">Attenzione</p>
                    <p className="text-sm text-amber-700 mt-1">Senza registrare la mail su Telegram non sarà possibile recuperarla.</p>
                  </div>
                  <button onClick={() => setStep('pin_setup')} className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors" title="Ignora e procedi">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label htmlFor="email-register" className="sr-only">Email</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <EnvelopeIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                  </div>
                  <input
                    type="email"
                    id="email-register"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputStyles}
                    placeholder="La tua email"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={!email}
                className="w-full px-4 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:bg-indigo-300"
              >
                Continua
              </button>
            </form>
            <p className="text-sm text-slate-500 mt-6">
              Hai già un account?{' '}
              <button onClick={onGoToLogin} className="font-semibold text-indigo-600 hover:text-indigo-500">
                Accedi
              </button>
            </p>

            <div className="mt-8 pt-6 border-t border-slate-200">
                <a 
                    href={getTelegramLink()}
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!email) {
                        e.preventDefault();
                        setError('Inserisci prima la tua email.');
                      } else {
                        setHasOpenedTelegram(true);
                      }
                    }}
                    className={`inline-flex items-center gap-2 text-sm font-medium transition-colors bg-sky-50 px-4 py-2 rounded-full hover:bg-sky-100 ${!email ? 'text-slate-400 cursor-not-allowed' : 'text-sky-600 hover:text-sky-700'}`}
                >
                    <TelegramIcon className="w-5 h-5" />
                    Registra mail su telegram
                </a>
            </div>
          </div>
        );

      case 'pin_setup':
      case 'pin_confirm': {
        const isConfirming = step === 'pin_confirm';
        return (
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {isConfirming ? 'Conferma il tuo PIN' : 'Crea un PIN di 4 cifre'}
            </h2>
            <p className={`text-slate-500 h-10 flex items-center justify-center transition-colors ${error ? 'text-red-500' : ''}`}>
              {error || (isConfirming ? 'Inseriscilo di nuovo per conferma.' : 'Servirà per accedere al tuo account.')}
            </p>
            <PinInput pin={isConfirming ? confirmPin : pin} onPinChange={isConfirming ? setConfirmPin : setPin} />
          </div>
        );
      }

      case 'bio_offer': {
        return (
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 mb-2">Vuoi abilitare l’impronta / FaceID?</h2>
            <p className="text-slate-500 h-10 flex items-center justify-center">Potrai sbloccare l’app senza inserire il PIN.</p>
            <div className="mt-4 p-3 rounded-lg border border-slate-200 bg-slate-50 text-left inline-block">
              <p className="text-sm text-slate-700">Abilita ora lo sblocco biometrico?</p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={async () => {
                    if (!bioSupported) { await doRegisterAndLogin(); return; }
                    try {
                      setBioBusy(true);
                      await registerBiometric('Profilo locale');
                      clearBiometricSnooze(); 
                      setBioBusy(false);
                    } catch { setBioBusy(false); } finally { await doRegisterAndLogin(); }
                  }}
                  disabled={bioBusy}
                  className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 disabled:bg-indigo-300"
                >
                  {bioBusy ? 'Attivo…' : 'Abilita e continua'}
                </button>
                <button
                  onClick={async () => { setBiometricsOptOut(true); await doRegisterAndLogin(); }}
                  disabled={bioBusy}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                >
                  Non ora
                </button>
              </div>
            </div>
          </div>
        );
      }
    }
  };

  return <AuthLayout>{renderContent()}</AuthLayout>;
};

export default SetupScreen;
