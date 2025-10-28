import React, { useState, useEffect } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import PinInput from '../components/auth/PinInput';
import { resetPin } from '../utils/api';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';

interface ResetPinScreenProps {
  email: string;
  token: string;
  onResetSuccess: () => void;
}

const ResetPinScreen: React.FC<ResetPinScreenProps> = ({ email, token, onResetSuccess }) => {
  const [step, setStep] = useState<'new_pin' | 'confirm_pin'>('new_pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleReset = async () => {
    setIsLoading(true);
    setError(null);
    const response = await resetPin(email, token, pin);
    if (response.success) {
        setSuccessMessage(response.message);
        setTimeout(() => {
            onResetSuccess();
        }, 2000);
    } else {
      setError(response.message);
      setIsLoading(false);
      setTimeout(() => {
          setPin('');
          setConfirmPin('');
          setError(null);
          setStep('new_pin');
      }, 2000);
    }
  };
  
  useEffect(() => {
    if (step === 'new_pin' && pin.length === 4) {
      setStep('confirm_pin');
    }
  }, [pin, step]);

  useEffect(() => {
    if (step === 'confirm_pin' && confirmPin.length === 4) {
      if (pin === confirmPin) {
        setError(null);
        handleReset();
      } else {
        setError('I PIN non corrispondono. Riprova.');
        setTimeout(() => {
            setPin('');
            setConfirmPin('');
            setError(null);
            setStep('new_pin');
        }, 1500);
      }
    }
  }, [confirmPin, pin, step]);
  
  const renderContent = () => {
    if (isLoading) {
        return (
             <div className="text-center min-h-[300px] flex flex-col justify-center items-center">
                <SpinnerIcon className="w-12 h-12 text-indigo-600 mx-auto" />
                <p className="mt-4 text-slate-500">Aggiornamento PIN in corso...</p>
             </div>
        );
    }

    if (successMessage) {
        return (
             <div className="text-center min-h-[300px] flex flex-col justify-center items-center">
                <p className="text-lg font-semibold text-green-600">{successMessage}</p>
                <p className="mt-2 text-slate-500">Verrai reindirizzato al login.</p>
             </div>
        );
    }
    
    const isConfirming = step === 'confirm_pin';
    return (
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">{isConfirming ? 'Conferma il nuovo PIN' : 'Crea un nuovo PIN'}</h2>
        <p className={`text-slate-500 h-10 flex items-center justify-center transition-colors ${error ? 'text-red-500' : ''}`}>
            {error || (isConfirming ? 'Inseriscilo di nuovo per conferma.' : 'Il tuo nuovo PIN di 4 cifre.')}
        </p>
        <PinInput 
            pin={isConfirming ? confirmPin : pin} 
            onPinChange={isConfirming ? setConfirmPin : setPin} 
        />
      </div>
    );
  };

  return <AuthLayout>{renderContent()}</AuthLayout>;
};

export default ResetPinScreen;
