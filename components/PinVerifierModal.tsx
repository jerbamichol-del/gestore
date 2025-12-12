import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { BackspaceIcon } from './icons/BackspaceIcon';
import { FingerprintIcon } from './icons/FingerprintIcon'; 
import { verifyPin } from '../utils/auth';
// CORREZIONE QUI: Importiamo il nome giusto 'unlockWithBiometric'
import { unlockWithBiometric, isBiometricsAvailable } from '../services/biometrics'; 

interface PinVerifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  email: string; // La lasciamo nell'interfaccia per compatibilità, anche se unlockWithBiometric non la usa
}

const PinVerifierModal: React.FC<PinVerifierModalProps> = ({ isOpen, onClose, onSuccess, email }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isBioAvailable, setIsBioAvailable] = useState(false);

  // Reset stato quando si apre
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      checkBiometrics();
    }
  }, [isOpen]);

  // Controlla e avvia biometria
  const checkBiometrics = async () => {
    const available = await isBiometricsAvailable();
    setIsBioAvailable(available);
    
    if (available) {
      // Piccolo ritardo per dare tempo al modale di aprirsi graficamente
      setTimeout(() => {
        handleBiometricScan();
      }, 300);
    }
  };

  const handleBiometricScan = async () => {
    try {
      // CORREZIONE QUI: Chiamiamo la funzione con il nome giusto e senza parametri email
      const verified = await unlockWithBiometric();
      if (verified) {
        onSuccess();
        setPin('');
      }
    } catch (e) {
      console.log("Biometria non usata o fallita", e);
      // Non facciamo nulla, l'utente userà il PIN
    }
  };

  const handleDigitClick = (digit: number) => {
    if (pin.length < 5) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);
      
      if (newPin.length === 5) {
        // Verifica immediata al 5° numero
        setTimeout(() => validatePin(newPin), 100);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const validatePin = (inputPin: string) => {
    if (verifyPin(inputPin)) {
      onSuccess();
    } else {
      setError(true);
      // Vibrazione errore se su mobile
      if (navigator.vibrate) navigator.vibrate(200);
      setTimeout(() => setPin(''), 500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-end sm:justify-center bg-slate-900/90 backdrop-blur-sm animate-fade-in">
      
      {/* Area clickabile per chiudere (solo parte superiore) */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 pb-2">
          <div className="w-10"></div> {/* Spacer */}
          <h2 className="text-xl font-bold text-slate-800">Inserisci PIN</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 pt-2 flex flex-col items-center flex-grow">
          <p className="text-slate-500 text-sm mb-8 text-center">
            Per visualizzare i dati sensibili
          </p>

          {/* PIN Dots */}
          <div className="flex gap-4 mb-8">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                  i < pin.length 
                    ? error ? 'bg-red-500 scale-110' : 'bg-indigo-600 scale-110'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-red-500 text-sm font-medium mb-4 animate-shake">
              PIN non corretto
            </p>
          )}

          {/* Keypad */}
          <div className="w-full max-w-[280px] grid grid-cols-3 gap-y-6 gap-x-8 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleDigitClick(num)}
                className="w-16 h-16 rounded-full text-2xl font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center shadow-sm border border-slate-100"
              >
                {num}
              </button>
            ))}
            
            {/* Biometric Button (in basso a sinistra) */}
            <div className="flex items-center justify-center">
              {isBioAvailable && (
                <button 
                  onClick={handleBiometricScan}
                  className="w-16 h-16 rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors"
                  aria-label="Usa Biometria"
                >
                  <FingerprintIcon className="w-8 h-8" />
                </button>
              )}
            </div>

            <button
              onClick={() => handleDigitClick(0)}
              className="w-16 h-16 rounded-full text-2xl font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center shadow-sm border border-slate-100"
            >
              0
            </button>

            {/* Backspace */}
            <div className="flex items-center justify-center">
              <button
                onClick={handleDelete}
                className="w-16 h-16 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <BackspaceIcon className="w-7 h-7" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PinVerifierModal;
