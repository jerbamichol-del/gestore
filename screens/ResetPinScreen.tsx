import React, { useEffect, useMemo, useState } from 'react';
import AuthLayout from '../components/auth/AuthLayout';
import PinInput from '../components/auth/PinInput';
import { getUsers, saveUsers } from '../utils/api';
import { hashPinWithSalt } from '../utils/auth';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';

interface ResetPinScreenProps {
  email?: string;       // ora opzionali: se mancano li leggiamo dall’URL
  token?: string;
  onResetSuccess: () => void;
}

/** URL del tuo Apps Script (EXEC) */
const EXEC_URL =
  'https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec';

/** Piccolo helper JSONP */
function jsonp<T = any>(url: string): Promise<T> {
  return new Promise((resolve) => {
    const cb = '__rp_' + Date.now() + Math.random().toString(36).slice(2);
    (window as any)[cb] = (data: T) => {
      try {
        delete (window as any)[cb];
      } catch {}
      s.remove();
      resolve(data);
    };
    const s = document.createElement('script');
    s.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + cb;
    s.onerror = () => {
      try {
        delete (window as any)[cb];
      } catch {}
      s.remove();
      resolve({ ok: false, error: 'NETWORK' } as any);
    };
    document.head.appendChild(s);
  });
}

const ResetPinScreen: React.FC<ResetPinScreenProps> = ({ email, token, onResetSuccess }) => {
  // 1) Prendi i parametri da URL se non passati via props
  const { urlEmail, urlToken } = useMemo(() => {
    const u = new URL(window.location.href);
    return {
      urlEmail: (u.searchParams.get('email') || '').trim(),
      urlToken:
        (u.searchParams.get('resetToken') ||
          u.searchParams.get('t') ||
          u.searchParams.get('token') ||
          u.searchParams.get('code') ||
          u.searchParams.get('k') ||
          ''
        ).trim(),
    };
  }, []);

  const effectiveEmail = (email || urlEmail || '').toLowerCase();
  const effectiveToken = (token || urlToken || '').trim();

  // 2) Stati UI
  const [phase, setPhase] = useState<'checking' | 'ready' | 'bad'>('checking');
  const [step, setStep] = useState<'new_pin' | 'confirm_pin'>('new_pin');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 3) All’ingresso: valida il token (senza consumarlo)
  useEffect(() => {
    (async () => {
      if (!effectiveToken) {
        setErr('Link non valido: token mancante.');
        setPhase('bad');
        return;
      }
      const v = await jsonp<{ ok: boolean; email?: string }>(
        `${EXEC_URL}?action=validate&t=${encodeURIComponent(effectiveToken)}`
      );
      if (v && v.ok) {
        // Se Apps Script conosce l’email del token, usala come fallback
        if (!effectiveEmail && v.email) {
          // aggiorna l’URL pulito con l’email, senza ricaricare
          const u = new URL(window.location.href);
          u.searchParams.set('email', v.email);
          window.history.replaceState({}, '', u.toString());
        }
        setPhase('ready');
      } else {
        setErr('Token non valido o scaduto.');
        setPhase('bad');
      }
    })();
  }, [effectiveToken, effectiveEmail]);

  // 4) Avanza automaticamente tra i 2 inserimenti PIN
  useEffect(() => {
    if (phase !== 'ready') return;
    if (step === 'new_pin' && pin.length === 4) setStep('confirm_pin');
  }, [phase, step, pin]);

  // 5) Conferma PIN → consuma token → salva PIN locale → success
  useEffect(() => {
    if (phase !== 'ready') return;
    if (step !== 'confirm_pin') return;
    if (confirmPin.length !== 4) return;

    if (pin !== confirmPin) {
      setErr('I PIN non corrispondono. Riprova.');
      setTimeout(() => {
        setErr(null);
        setPin('');
        setConfirmPin('');
        setStep('new_pin');
      }, 1300);
      return;
    }

    (async () => {
      setBusy(true);
      setErr(null);

      // 5.a) Consuma il token (JSONP)
      const c = await jsonp<{ ok: boolean; error?: string }>(
        `${EXEC_URL}?action=consume&t=${encodeURIComponent(effectiveToken)}`
      );
      if (!(c && c.ok)) {
        setBusy(false);
        setErr('Token non valido o scaduto.');
        return;
      }

      // 5.b) Aggiorna il DB locale (crea l’utente se non esiste)
      try {
        const users = getUsers();
        const normalizedEmail = effectiveEmail;
        const { hash, salt } = await hashPinWithSalt(pin);
        const existing = users[normalizedEmail] || { email: normalizedEmail, phoneNumber: null };
        users[normalizedEmail] = { ...existing, pinHash: hash, pinSalt: salt };
        saveUsers(users);
      } catch (e) {
        console.error('Local PIN update failed', e);
        setBusy(false);
        setErr('Errore durante l’aggiornamento del PIN sul dispositivo.');
        return;
      }

      // 5.c) Feedback + navigazione
      setMsg('PIN aggiornato con successo!');
      setBusy(false);
      setTimeout(() => {
        try {
          onResetSuccess();
        } catch {
          // fallback: torna alla home dell’app
          const scopeGuess = '/gestore/';
          window.location.replace(scopeGuess);
        }
      }, 1000);
    })();
  }, [phase, step, confirmPin, pin, effectiveToken, effectiveEmail, onResetSuccess]);

  // 6) UI
  if (phase === 'checking') {
    return (
      <AuthLayout>
        <div className="text-center min-h-[300px] flex flex-col justify-center items-center">
          <SpinnerIcon className="w-12 h-12 text-indigo-600 mx-auto" />
          <p className="mt-4 text-slate-500">Verifica del link…</p>
        </div>
      </AuthLayout>
    );
  }

  if (phase === 'bad') {
    return (
      <AuthLayout>
        <div className="text-center min-h-[300px] flex flex-col justify-center items-center">
          <p className="text-red-600 font-semibold">Token non valido o scaduto.</p>
          <p className="mt-2 text-slate-500">Richiedi un nuovo link di reset dall’app.</p>
        </div>
      </AuthLayout>
    );
  }

  // phase === 'ready'
  const isConfirming = step === 'confirm_pin';
  return (
    <AuthLayout>
      {busy ? (
        <div className="text-center min-h-[300px] flex flex-col justify-center items-center">
          <SpinnerIcon className="w-12 h-12 text-indigo-600 mx-auto" />
          <p className="mt-4 text-slate-500">Aggiornamento PIN in corso…</p>
        </div>
      ) : msg ? (
        <div className="text-center min-h-[300px] flex flex-col justify-center items-center">
          <p className="text-lg font-semibold text-green-600">{msg}</p>
          <p className="mt-2 text-slate-500">Reindirizzamento…</p>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            {isConfirming ? 'Conferma il nuovo PIN' : 'Crea un nuovo PIN'}
          </h2>
          <p
            className={`text-slate-500 h-10 flex items-center justify-center transition-colors ${
              err ? 'text-red-500' : ''
            }`}
          >
            {err || (isConfirming ? 'Inseriscilo di nuovo per conferma.' : 'Il tuo nuovo PIN di 4 cifre.')}
          </p>
          <PinInput pin={isConfirming ? confirmPin : pin} onPinChange={isConfirming ? setConfirmPin : setPin} />
        </div>
      )}
    </AuthLayout>
  );
};

export default ResetPinScreen;
