// utils/api.ts
import { hashPinWithSalt, verifyPin } from './auth';

// --- MOCK USER DATABASE in localStorage ---
// (Solo demo: NON sicuro per produzione)
export const getUsers = () => {
  try {
    return JSON.parse(localStorage.getItem('users_db') || '{}');
  } catch {
    return {};
  }
};
export const saveUsers = (users: any) => localStorage.setItem('users_db', JSON.stringify(users));

// URL Apps Script (web app "exec")
const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec';

// ------ Helpers ------
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
function buildResetRedirect(): string {
  // La tua pagina /reset su GitHub Pages
  return 'https://jerbamichol-del.github.io/gestore/reset/';
}
async function postJSON<T = any>(url: string, data: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // JSON vero
    body: JSON.stringify(data),
  });
  // Apps Script risponde con JSON (ContentService JSON)
  const out = await res.json().catch(() => ({}));
  // uniforma shape: { ok:true } o { success:true }
  const ok = (out && (out.ok === true || out.success === true)) ? true : false;
  return { ...out, ok, success: ok } as T;
}

// ------ API MOCK + integrazioni ------

/** Registra un nuovo utente (mock locale). */
export const register = async (
  email: string,
  pin: string,
  phoneNumber?: string
): Promise<{ success: boolean; message: string }> => {
  return new Promise(resolve => {
    setTimeout(async () => {
      const users = getUsers();
      const normalizedEmail = normalizeEmail(email);
      if (users[normalizedEmail]) {
        resolve({ success: false, message: 'Un utente con questa email esiste già.' });
        return;
      }
      const { hash, salt } = await hashPinWithSalt(pin);
      users[normalizedEmail] = { email: normalizedEmail, pinHash: hash, pinSalt: salt, phoneNumber: phoneNumber || null };
      saveUsers(users);
      resolve({ success: true, message: 'Registrazione completata.' });
    }, 1000);
  });
};

/** Login (mock locale). */
export const login = async (
  email: string,
  pin: string
): Promise<{ success: boolean; message: string; token?: string }> => {
  return new Promise(resolve => {
    setTimeout(async () => {
      const users = getUsers();
      const normalizedEmail = normalizeEmail(email);
      const user = users[normalizedEmail];
      if (!user) {
        resolve({ success: false, message: 'Nessun account trovato per questa email.' });
        return;
      }
      const isPinValid = await verifyPin(pin, user.pinHash, user.pinSalt);
      if (isPinValid) {
        const mockToken = `mock_token_${Date.now()}`;
        resolve({ success: true, message: 'Login effettuato con successo.', token: mockToken });
      } else {
        resolve({ success: false, message: 'PIN errato.' });
      }
    }, 1000);
  });
};

/**
 * Invia l’email di reset PIN.
 * ⚠️ Il tuo Apps Script si aspetta **GET ?action=request&email=...&redirect=...**
 */
export const forgotPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
  const normalizedEmail = normalizeEmail(email);
  const redirect = buildResetRedirect();
  const url =
    `${SCRIPT_URL}?action=request` +
    `&email=${encodeURIComponent(normalizedEmail)}` +
    `&redirect=${encodeURIComponent(redirect)}`;

  try {
    // fire-and-forget; con JSONP lato server non serve leggere la risposta
    await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store' });
  } catch (err) {
    // errori di rete veri (offline, ecc.). Proseguiamo comunque con la UI di conferma.
    console.warn('forgotPassword (fire-and-forget) warning:', err);
  }
  return { success: true, message: "Se l'email è registrata, riceverai un link per il reset." };
};

/** Recupero email da telefono (mock). */
export const findEmailByPhoneNumber = async (
  phoneNumber: string
): Promise<{ success: boolean; message: string }> => {
  return new Promise(resolve => {
    setTimeout(() => {
      const users = getUsers();
      const foundUser = Object.values(users).find((user: any) => user.phoneNumber === phoneNumber);
      if (foundUser) {
        console.log(`(SIMULAZIONE) SMS a ${phoneNumber} con email: ${(foundUser as any).email}`);
      } else {
        console.log(`(SIMULAZIONE) Numero non registrato: ${phoneNumber}`);
      }
      resolve({ success: true, message: 'Se il numero è associato a un account, riceverai un SMS con la tua email.' });
    }, 1500);
  });
};

/**
 * Reimposta il PIN: chiama Apps Script (POST JSON action=resetPin)
 * Restituisce { success:true } se il token è valido e consumato lato server.
 */
export const resetPin = async (
  email: string,
  token: string,
  newPin: string
): Promise<{ success: boolean; message: string }> => {
  const normalizedEmail = normalizeEmail(email);

  try {
    const result: any = await postJSON(SCRIPT_URL, {
      action: 'resetPin',
      email: normalizedEmail,
      token,
      newPin,
    });

    if (result.success === true || result.ok === true) {
      return { success: true, message: 'PIN aggiornato con successo.' };
    }

    // Messaggio dal server o default
    const msg =
      result?.message ||
      result?.error ||
      'Token non valido o scaduto.';
    return { success: false, message: msg };
  } catch (error) {
    console.error('Errore di rete durante resetPin:', error);
    return { success: false, message: 'Impossibile completare la richiesta. Controlla la connessione e riprova.' };
  }
};
