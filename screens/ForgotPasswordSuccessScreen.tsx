import React from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import { EnvelopeIcon } from '../components/icons/EnvelopeIcon';

interface ForgotPasswordSuccessScreenProps {
  email: string;
  onBackToLogin: () => void;
}

const ForgotPasswordSuccessScreen: React.FC<ForgotPasswordSuccessScreenProps> = ({ email, onBackToLogin }) => {
  return (
    <AuthLayout>
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-4">
          <EnvelopeIcon className="h-6 w-6 text-green-600" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Controlla la tua Email</h2>
        <p className="text-slate-500 mb-6">
          Abbiamo inviato un link per il reset del PIN a <br />
          <strong className="text-slate-700">{email}</strong>.
          <br /><br />
          Apri il link per continuare. Se non lo trovi, controlla la cartella spam.
        </p>
        <button
          onClick={onBackToLogin}
          className="w-full px-4 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
        >
          Torna al Login
        </button>
      </div>
    </AuthLayout>
  );
};

export default ForgotPasswordSuccessScreen;
