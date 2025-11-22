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
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const normalizedEmail = (email || '').trim().toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPin = pin.trim();
    const cleanConfirm = confirmPin.trim();

    if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      setError('Il PIN deve essere di 4 cifre.');
      return;
    }

    if (cleanPin !== cleanConfirm) {
      setError('I PIN non coincidono.');
      return;
    }

    if (!normalizedEmail) {
      setError('Email non valida nel link. Riprova a richiedere il reset.');
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

      // Reset riuscito → torniamo al login
      onResetSuccess();
    } catch (e) {
      console.error('[ResetPin] Errore inatteso:', e);
      setIsLoading(false);
      setError('Errore inatteso durante il reset del PIN.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Reimposta PIN
        </h1>
        <p className="text-sm text-slate-500 mb-4">
          Stai reimpostando il PIN per:
        </p>
        <p className="text-sm font-mono text-slate-800 mb-6 break-all">
          {normalizedEmail || '(email non riconosciuta)'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nuovo PIN (4 cifre)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPin(v);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center tracking-[0.3em] text-lg"
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
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                setConfirmPin(v);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center tracking-[0.3em] text-lg"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 inline-flex justify-center items-center px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Salvataggio in corso…' : 'Conferma nuovo PIN'}
          </button>
        </form>

        <button
          type="button"
          onClick={onResetSuccess}
          className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-700"
        >
          Torna al login senza modificare il PIN
        </button>
      </div>
    </div>
  );
};

export default ResetPinScreen;
