import React, { useState, useEffect } from 'react';
import PinInput from './auth/PinInput';
import { getUsers } from '../utils/api';
import { verifyPin } from '../utils/auth';
import { XMarkIcon } from './icons/XMarkIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { unlockWithBiometric, isBiometricsEnabled } from '../services/biometrics';

interface PinVerifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  email: string;
  title?: string;
  description?: string;
}

const PinVerifierModal: React.FC<PinVerifierModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  email,
  title = "Verifica Identità",
  description = "Inserisci il PIN per visualizzare i dati."
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
      setBioEnabled(isBiometricsEnabled());
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  const handlePinVerify = async (enteredPin: string) => {
    setIsLoading(true);
    setError(null);
    try {
        const users = getUsers();
        const user = users[email.toLowerCase()];
        
        if (!user) {
            setError("Utente non trovato.");
            setIsLoading(false);
            return;
        }

        const isValid = await verifyPin(enteredPin, user.pinHash, user.pinSalt);
        if (isValid) {
            onSuccess();
        } else {
            setError("PIN non valido.");
            setTimeout(() => {
                setPin('');
                setError(null);
            }, 1000);
        }
    } catch (e) {
        setError("Errore verifica.");
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
      if (pin.length === 4) {
          handlePinVerify(pin);
      }
  }, [pin]);

  const handleBiometric = async () => {
      try {
          const ok = await unlockWithBiometric(title);
          if (ok) onSuccess();
      } catch (e) {
          // ignore cancel
      }
  };

  const handleClose = () => {
      setIsAnimating(false);
      setTimeout(onClose, 300);
  };

  if (!isOpen && !isAnimating) return null;

  return (
    <div
      className={`fixed inset-0 z-[6000] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-slate-900/60 backdrop-blur-sm`}
      onClick={handleClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm transform transition-all duration-300 ease-in-out ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-500">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 text-center">
            <p className="text-slate-500 mb-6 text-sm">{description}</p>
            
            <div className={`flex items-center justify-center transition-all duration-200 overflow-hidden ${error || isLoading ? 'h-6 mb-4' : 'h-0'}`}>
                {isLoading ? (
                    <SpinnerIcon className="w-5 h-5 text-indigo-600" />
                ) : error ? (
                    <p className="text-sm text-red-500 font-medium">{error}</p>
                ) : null}
            </div>

            <PinInput 
                pin={pin} 
                onPinChange={setPin} 
                showBiometric={bioEnabled}
                onBiometric={handleBiometric}
            />
        </div>
      </div>
    </div>
  );
};

export default PinVerifierModal;
