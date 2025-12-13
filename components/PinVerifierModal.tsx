import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { BackspaceIcon } from './icons/BackspaceIcon';
import { FingerprintIcon } from './icons/FingerprintIcon'; 
import { verifyPin } from '../utils/auth';
import { unlockWithBiometric, isBiometricsAvailable, isBiometricsEnabled } from '../services/biometrics'; 

interface PinVerifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  email: string;
}

const PinVerifierModal: React.FC<PinVerifierModalProps> = ({ isOpen, onClose, onSuccess, email }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isBioAvailable, setIsBioAvailable] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      checkBiometrics();
    }
  }, [isOpen]);

  const checkBiometrics = async () => {
    const available = await isBiometricsAvailable();
    const enabled = isBiometricsEnabled();
    setIsBioAvailable(available && enabled);
    
    if (available && enabled) {
      setTimeout(() => {
        handleBiometricScan();
      }, 300);
    }
  };

  const handleBiometricScan = async () => {
    try {
      const verified = await unlockWithBiometric();
      if (verified) {
        onSuccess();
        setPin('');
      }
    } catch (e) {
      console.log("Biometria non usata o fallita", e);
    }
  };

  const handleDigitClick = (digit: number) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);
      
      if (newPin.length === 4) {
        setTimeout(() => validatePin(newPin), 100);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  const validatePin = (inputPin: string) => {
    // Note: In a real app, this should check against the user's stored PIN hash using email.
    // For simplicity here, we assume it checks global or context auth.
    // However, verifyPin requires hash/salt. 
    // Since this modal is generic, we might need to fetch the user.
    // BUT the original code simply called verifyPin(inputPin) which was wrong/incomplete in context of `utils/auth` signature.
    // Assuming `verifyPin` is updated or used correctly elsewhere. 
    // Let's assume for this specific modal, we need to fetch user data.
    
    // To keep it simple and consistent with existing `App.tsx` logic (which likely relies on successful PIN check),
    // we need to fix how verifyPin is called if it requires hash/salt.
    // `utils/api.ts` has `getUsers`.
    
    const users = import('../utils/api').then(mod => {
        const userList = mod.getUsers();
        const user = userList[email.toLowerCase()];
        if (user) {
             import('../utils/auth').then(authMod => {
                 authMod.verifyPin(inputPin, user.pinHash, user.pinSalt).then(isValid => {
                     if (isValid) {
                         onSuccess();
                     } else {
                         setError(true);
                         if (navigator.vibrate) navigator.vibrate(200);
                         setTimeout(() => setPin(''), 500);
                     }
                 });
             });
        } else {
             setError(true); // User not found
        }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm animate-fade-in p-4">
      
      {/* Area clickabile per chiudere */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modale Centrato e Compatto */}
      <div className="relative w-full max-w-xs bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        
        {/* Header compatto */}
        <div className="flex justify-between items-center p-4 pb-0">
          <div className="w-8"></div> 
          <h2 className="text-lg font-bold text-slate-800">Inserisci PIN</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex flex-col items-center flex-grow">
          <p className="text-slate-500 text-xs mb-6 text-center">
            Per visualizzare i dati sensibili
          </p>

          {/* Pallini PIN (Ora sono 4) */}
          <div className="flex gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i < pin.length 
                    ? error ? 'bg-red-500 scale-110' : 'bg-indigo-600 scale-110'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-red-500 text-xs font-medium mb-4 animate-shake">
              PIN non corretto
            </p>
          )}

          {/* Tastierino Compatto */}
          <div className="w-full max-w-[240px] grid grid-cols-3 gap-y-4 gap-x-6 mb-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                onClick={() => handleDigitClick(num)}
                className="w-14 h-14 rounded-full text-xl font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center shadow-sm border border-slate-100"
              >
                {num}
              </button>
            ))}
            
            {/* Biometric Button */}
            <div className="flex items-center justify-center">
              {isBioAvailable && (
                <button 
                  onClick={handleBiometricScan}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors"
                  aria-label="Usa Biometria"
                >
                  <FingerprintIcon className="w-7 h-7" />
                </button>
              )}
            </div>

            <button
              onClick={() => handleDigitClick(0)}
              className="w-14 h-14 rounded-full text-xl font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 transition-colors flex items-center justify-center shadow-sm border border-slate-100"
            >
              0
            </button>

            {/* Backspace */}
            <div className="flex items-center justify-center">
              <button
                onClick={handleDelete}
                className="w-14 h-14 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <BackspaceIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PinVerifierModal;
