import React, { useState } from 'react';
import { resetPin } from '../utils/api';

type ResetPinScreenProps = {
  email: string;
  token: string;
  onResetSuccess: () => void;
};

const ResetPinScreen: React.FC<ResetPinScreenProps> = ({
  email,
  token,
  onResetSuccess,
}) => {
  const [step, setStep] = useState<'new_pin' | 'confirm_pin'>('new_pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const normalizedEmail = (email || '').trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();

    if (!/^\d{4}$/.test(cleanPin)) {
      setError('Inserisci un PIN di 4 cifre.');
      return;
    }

    if (step === 'new_pin') {
      // Prima fase: chiediamo solo il nuovo PIN, poi passiamo alla conferma
      setStep('confirm_pin');
      return;
    }

    // step === 'confirm_pin'
    if (cleanPin !== cleanConfirm) {
      setError('I PIN non coincidono. Riprova.');
      return;
    }

    if (!normalizedEmail) {
      setError('Email non valida nel link. Richiedi di nuovo il reset.');
      return;
    }

    try {
      setIsLoading(true);
      const res = await resetPin(normalizedEmail, token || '', cleanPin);
      setIsLoading(false);

      if (!res.success) {
        setError(res.message || 'Errore durante il reset del PIN.');
        return;
      }

      setSuccessMessage('PIN aggiornato con successo.');
      // Mostra il messaggio per un attimo, poi torna al login
      setTimeout(() => {
        onResetSuccess();
      }, 800);
    } catch (err) {
      console.error('[ResetPin] Errore inatteso:', err);
      setIsLoading(false);
      setError('Errore imprevisto durante il reset del PIN.');
    }
  };

  const title =
    step === 'new_pin' ? 'Imposta un nuovo PIN' : 'Conferma il nuovo PIN';

  const description =
    step === 'new_pin'
      ? `Stai reimpostando il PIN per l’account ${normalizedEmail || email}. Scegli un nuovo PIN a 4 cifre.`
      : 'Reinserisci il nuovo PIN per conferma.';

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{title}</h1>
        <p className="text-sm text-slate-500 mb-4">{description}</p>

        <p className="text-xs text-slate-400 mb-6 break-all">
          Email: <span className="font-mono text-slate-700">{normalizedEmail || '(sconosciuta)'}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 'new_pin' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nuovo PIN (4 cifre)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center tracking-[0.5em] text-lg"
                autoFocus
              />
            </div>
          )}

          {step === 'confirm_pin' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nuovo PIN (4 cifre)
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) =>
                    setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center tracking-[0.5em] text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Conferma PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(
                      e.target.value.replace(/\D/g, '').slice(0, 4)
                    )
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center tracking-[0.5em] text-lg"
                  autoFocus
                />
              </div>
            </>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2">
              {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading
              ? 'Salvataggio...'
              : step === 'new_pin'
              ? 'Continua'
              : 'Salva PIN'}
          </button>

          <button
            type="button"
            onClick={onResetSuccess}
            disabled={isLoading}
            className="w-full text-sm text-slate-500 hover:text-slate-700 mt-2"
          >
            Annulla e torna al login
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPinScreen;