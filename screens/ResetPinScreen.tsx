import React, { useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import PinInput from '../components/auth/PinInput';
import { resetPin } from '../utils/api';

interface ResetPinScreenProps {
  email: string;
  token: string; // lo riceviamo ma NON lo usiamo più per validare lato server
  onResetSuccess: () => void; // chiamato quando il PIN è stato aggiornato
}

type Step = 'new_pin' | 'confirm_pin';

const ResetPinScreen: React.FC<ResetPinScreenProps> = ({
  email,
  token,
  onResetSuccess,
}) => {
  const [step, setStep] = useState<Step>('new_pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Controlli base sul PIN
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('Inserisci un PIN di 4 cifre.');
      return;
    }

    if (step === 'new_pin') {
      // Prima schermata → passa alla conferma
      setStep('confirm_pin');
      return;
    }

    // step === 'confirm_pin'
    if (pin !== confirmPin) {
      setError('I PIN non coincidono. Riprova.');
      return;
    }

    setIsLoading(true);
    try {
      // ❗ Qui NON chiamiamo più Apps Script.
      // resetPin è completamente locale (aggiorna l’utente in localStorage).
      const res = await resetPin(email, token, pin);

      if (!res.success) {
        setError(res.message || 'Errore durante il reset del PIN.');
        setIsLoading(false);
        return;
      }

      setSuccessMessage('PIN aggiornato con successo.');
      setIsLoading(false);

      // Piccola pausa per mostrare il messaggio e poi torni alla schermata di login
      setTimeout(() => {
        onResetSuccess();
      }, 800);
    } catch (err) {
      console.error('[ResetPin] Errore inatteso:', err);
      setError('Errore imprevisto durante il reset del PIN.');
      setIsLoading(false);
    }
  };

  const title =
    step === 'new_pin'
      ? 'Imposta un nuovo PIN'
      : 'Conferma il nuovo PIN';

  const description =
    step === 'new_pin'
      ? `Stai reimpostando il PIN per l’account ${email}. Scegli un nuovo PIN a 4 cifre.`
      : 'Reinserisci il nuovo PIN per conferma.';

  return (
    <AuthLayout
      title={title}
      description={description}
    >
      <form onSubmit={handleSubmit} className="space-y-6 mt-4">
        {step === 'new_pin' && (
          <PinInput
            label="Nuovo PIN"
            value={pin}
            onChange={setPin}
            disabled={isLoading}
            autoFocus
          />
        )}

        {step === 'confirm_pin' && (
          <>
            <PinInput
              label="Nuovo PIN"
              value={pin}
              onChange={setPin}
              disabled={isLoading}
            />
            <PinInput
              label="Conferma PIN"
              value={confirmPin}
              onChange={setConfirmPin}
              disabled={isLoading}
              autoFocus
            />
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
          {isLoading ? 'Salvataggio...' : step === 'new_pin' ? 'Continua' : 'Salva PIN'}
        </button>

        <button
          type="button"
          className="w-full text-sm text-slate-500 hover:text-slate-700 mt-2"
          onClick={onResetSuccess}
          disabled={isLoading}
        >
          Annulla e torna al login
        </button>
      </form>
    </AuthLayout>
  );
};

export default ResetPinScreen;
