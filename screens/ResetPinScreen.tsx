import React, { useState, useEffect } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import PinInput from '../components/auth/PinInput';
import { resetPin, forgotPassword } from '../utils/api';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';

interface ResetPinScreenProps {
  email: string;
  token: string;
  onResetSuccess: () => void;
}

const ResetPinScreen: React.FC<ResetPinScreenProps> = ({
  email,
  token,
  onResetSuccess,
}) => {
  const [step, setStep] = useState<'new_pin' | 'confirm_pin'>('new_pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // stato per "reinvia mail"
  const [resendBusy, setResendBusy] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // countdown per il reinvio
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = window.setTimeout(
      () => setCooldownLeft((prev) => Math.max(prev - 1, 0)),
      1000
    );
    return () => window.clearTimeout(id);
  }, [cooldownLeft]);

  const isConfirming = step === 'confirm_pin';

  const handlePrimaryAction = async () => {
    setError(null);

    if (step === 'new_pin') {
      if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
        setError('Il PIN deve essere di 4 cifre.');
        return;
      }
      setStep('confirm_pin');
      return;
    }

    if (step === 'confirm_pin') {
      if (confirmPin !== pin) {
        setError('I due PIN non coincidono. Riprova.');
        setConfirmPin('');
        return;
      }

      setIsLoading(true);
      try {
        const resp = await resetPin(email, token, pin);

        if (!resp.success) {
          setError(resp.message || 'Errore durante il reset del PIN.');
          setIsLoading(false);
          return;
        }

        setSuccessMessage(resp.message || 'PIN aggiornato con successo.');
        setError(null);

        setTimeout(() => {
          onResetSuccess();
        }, 1500);
      } catch (e) {
        console.error('[ResetPin] Errore:', e);
        setError('Errore imprevisto durante il reset del PIN.');
        setIsLoading(false);
      }
    }
  };

  const handleResend = async () => {
    if (resendBusy || cooldownLeft > 0) return;

    setResendBusy(true);
    setResendDone(false);
    setError(null);

    try {
      const res = await forgotPassword(email);
      if (!res.success) {
        setError(res.message || 'Non sono riuscito a reinviare il link.');
      } else {
        setResendDone(true);
        // esempio: 60s di cooldown
        setCooldownLeft(60);
      }
    } catch (e) {
      console.error('[ResetPin] errore reinvio mail:', e);
      setError('Errore durante il reinvio del link.');
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <AuthLayout>
      <div className="max-w-sm mx-auto text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Reimposta il tuo PIN
        </h2>
        <p className="text-slate-500 mb-4">
          Stai reimpostando il PIN per{' '}
          <span className="font-semibold text-slate-800">{email}</span>.
        </p>

        <div className="mb-4">
          <p className="text-sm text-slate-500">
            {isConfirming
              ? 'Inserisci di nuovo il PIN per conferma.'
              : 'Scegli un nuovo PIN di 4 cifre.'}
          </p>
        </div>

        <div className="flex justify-center mb-4">
          <PinInput
            pin={isConfirming ? confirmPin : pin}
            onPinChange={isConfirming ? setConfirmPin : setPin}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-2 min-h-[1.5rem]">{error}</p>
        )}

        {successMessage && (
          <p className="text-sm text-green-600 mb-2 min-h-[1.5rem]">
            {successMessage}
          </p>
        )}

        <button
          type="button"
          onClick={handlePrimaryAction}
          disabled={isLoading}
          className="w-full mt-2 inline-flex items-center justify-center px-4 py-3 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading && (
            <SpinnerIcon className="w-5 h-5 mr-2 animate-spin text-white" />
          )}
          {isConfirming ? 'Conferma PIN' : 'Continua'}
        </button>

        <div className="mt-6 text-left">
          <p className="text-xs text-slate-500 mb-1">
            Link non arrivato o non ti fidi? Puoi richiederne un altro:
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendBusy || cooldownLeft > 0}
            className={`text-sm font-semibold transition-colors ${
              resendBusy || cooldownLeft > 0
                ? 'text-slate-400 cursor-not-allowed'
                : 'text-indigo-600 hover:text-indigo-500'
            }`}
          >
            {resendBusy
              ? 'Invio in corso…'
              : cooldownLeft > 0
              ? `Richiedi nuovo link (${cooldownLeft}s)`
              : 'Richiedi nuovo link'}
          </button>
          {resendDone && (
            <p className="mt-2 text-xs text-green-600">
              Se l&apos;email è registrata, riceverai a breve un nuovo link.
            </p>
          )}
        </div>
      </div>
    </AuthLayout>
  );
};

export default ResetPinScreen;
