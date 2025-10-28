import React, { useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import { findEmailByPhoneNumber } from '../utils/api';
import { PhoneIcon } from '../components/icons/PhoneIcon';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';

interface ForgotEmailScreenProps {
  onBackToLogin: () => void;
}

const ForgotEmailScreen: React.FC<ForgotEmailScreenProps> = ({ onBackToLogin }) => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!phoneNumber) return;
        setIsLoading(true);
        const response = await findEmailByPhoneNumber(phoneNumber);
        setMessage(response.message);
        setIsLoading(false);
    };
    
    const inputStyles = "block w-full rounded-md border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm";

    return (
        <AuthLayout>
            <div className="text-center">
                 <h2 className="text-xl font-bold text-slate-800 mb-2">Recupera Email</h2>
                 {message ? (
                     <>
                        <p className="text-slate-500 mb-6 min-h-[40px]">{message}</p>
                        <button
                          onClick={onBackToLogin}
                          className="w-full px-4 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                        >
                          Torna al Login
                        </button>
                     </>
                 ) : (
                     <>
                        <p className="text-slate-500 mb-6">Inserisci il tuo numero di telefono. Ti invieremo un SMS con l'email associata.</p>
                        <form onSubmit={handleSubmit}>
                           <div className="mb-4">
                               <label htmlFor="phone-recover" className="sr-only">Numero di Telefono</label>
                               <div className="relative">
                                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                      <PhoneIcon className="h-5 w-5 text-slate-400" aria-hidden="true" />
                                  </div>
                                  <input
                                      type="tel"
                                      id="phone-recover"
                                      autoComplete="tel"
                                      value={phoneNumber}
                                      onChange={(e) => setPhoneNumber(e.target.value)}
                                      className={inputStyles}
                                      placeholder="Il tuo numero di telefono"
                                      required
                                      disabled={isLoading}
                                  />
                               </div>
                           </div>
                           <button
                               type="submit"
                               disabled={isLoading || !phoneNumber}
                               className="w-full px-4 py-3 text-sm font-semibold text-white bg-indigo-600 rounded-lg shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:bg-indigo-300 flex justify-center items-center"
                           >
                               {isLoading ? <SpinnerIcon className="w-5 h-5"/> : 'Trova la mia Email'}
                           </button>
                        </form>
                        <button
                          onClick={onBackToLogin}
                          className="mt-6 w-full text-center text-sm font-semibold text-indigo-600 hover:text-indigo-500"
                        >
                          Annulla
                        </button>
                     </>
                 )}
            </div>
        </AuthLayout>
    );
};

export default ForgotEmailScreen;