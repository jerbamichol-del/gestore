// src/screens/LoginScreen.tsx
import React, { useState, useEffect } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import PinInput from '../components/auth/PinInput';
import { login } from '../utils/api';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { useLocalStorage } from '../hooks/useLocalStorage';
import LoginEmail from '../components/auth/LoginEmail';
import ChangePinScreen from './ChangePinScreen';

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

  // Nuovo: flusso “Cambia PIN” locale (nessuna email)
  const [showChangePin, setShowChangePin] = useState(false);

  useEffect(() => {
    if (pin.length === 4 && activeEmail) {
      handlePinVerify();
    }
  }, [pin, activeEmail]);

  const handleEmailSubmit = (email: string) => {
    if (email) {
      setActiveEmail(email.toLowerCase());
      setError(null);
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

  const handleSwitchUser = () => {
    setActiveEmail(null);
    setPin('');
    setError(null);
  };

  // Se sto aprendo il flusso “Cambia PIN”, mostro direttamente quella schermata (ha già il suo AuthLayout)
  if (showChangePin && activeEmail) {
    return (
      <ChangePinScreen
        email={activeEmail}
        onSuccess={() => {
          // Torno alla schermata login “pulita” (pin svuotato)
          setShowChangePin(false);
          setPin('');
          setError(null);
        }}
        onCancel={() => {
          setShowChangePin(false);
        }}
      />
    );
  }

  const renderContent = () => {
    if (!activeEmail) {
      return (
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Bentornato!</h2>
          <p className="text-slate-500 mb-6">Inserisci la tua email per continuare.</p>
          <LoginEmail onSubmit={handleEmailSubmit} />
          <p className="text-sm text-slate-500 mt-6">
            Non hai un account?{' '}
            <button onClick={onGoToRegister} className="font-semibold text-indigo-600 hover:text-indigo-500">
              Registrati
            </button>
          </p>
        </div>
      );
    }

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
          {isLoading ? <SpinnerIcon className="w-6 h-6 text-indigo-600" /> : error || 'Inserisci il tuo PIN di 4 cifre.'}
        </p>
        <PinInput pin={pin} onPinChange={setPin} />

        <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-2">
          <button onClick={handleSwitchUser} className="text-sm font-semibold text-slate-500 hover:text-slate-800">
            Cambia Utente
          </button>

          <div className="flex gap-4">
            <button
              onClick={onGoToForgotEmail}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Email dimenticata?
            </button>
            <button
              onClick={onGoToForgotPassword}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              PIN dimenticato?
            </button>
            {/* Nuovo: cambia PIN locale senza email (verifica PIN attuale nella schermata dedicata) */}
            <button
              onClick={() => setShowChangePin(true)}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Cambia PIN
            </button>
          </div>
        </div>
      </div>
    );
  };

  return <AuthLayout>{renderContent()}</AuthLayout>;
};

export default LoginScreen;
