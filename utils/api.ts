import { hashPinWithSalt, verifyPin } from './auth';

// --- MOCK USER DATABASE in localStorage ---
export const getUsers = () => {
  try {
    return JSON.parse(localStorage.getItem('users_db') || '{}');
  } catch {
    return {};
  }
};
export const saveUsers = (users: any) =>
  localStorage.setItem('users_db', JSON.stringify(users));

// === Google Apps Script endpoints ===
const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec';
const RESET_REDIRECT = 'https://jerbamichol-del.github.io/gestore/reset/';

// --- MOCK API FUNCTIONS ---

/** Registra un nuovo utente. */
export const register = async (
  email: string,
  pin: string,
  phoneNumber?: string
): Promise<{ success: boolean; message: string }> => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const users = getUsers();
      const normalizedEmail = email.toLowerCase();
      if (users[normalizedEmail]) {
        resolve({ success: false, message: 'Un utente con questa email esiste già.' });
        return;
      }
      const { hash, salt } = await hashPinWithSalt(pin);
      users[normalizedEmail] = {
        email: normalizedEmail,
        pinHash: hash,
        pinSalt: salt,
        phoneNumber: phoneNumber || null,
      };
      saveUsers(users);
      resolve({ success: true, message: 'Registrazione completata.' });
    }, 1000);
  });
};

/** Login fittizio. */
export const login = async (
  email: string,
  pin: string
): Promise<{ success: boolean; message: string; token?: string }> => {
  return new Promise((resolve) => {
    setTimeout(async () => {
      const users = getUsers();
      const normalizedEmail = email.toLowerCase();
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
 * Invia l’email di reset usando Apps Script.
 * Nessun overlay: la tua UI mostra subito la pagina "Controlla la tua email".
 */
export const forgotPassword = async (
  email: string
): Promise<{ success: boolean; message: string }> => {
  const normalizedEmail = email.toLowerCase();

  // Apps Script: azione "request" + redirect alla pagina /reset del sito
  const url =
    `${SCRIPT_URL}?action=request` +
    `&email=${encodeURIComponent(normalizedEmail)}` +
    `&redirect=${encodeURIComponent(RESET_REDIRECT)}`;

  // Fire-and-forget per evitare problemi CORS (non leggiamo la risposta)
  try {
    await fetch(url, { method: 'GET', cache: 'no-store', mode: 'no-cors' });
  } catch {
    // anche se fallisce la fetch (offline, ecc.), mostriamo comunque la tua schermata di conferma
  }

  return {
    success: true,
    message: "Se l'email è registrata, riceverai un link per il reset.",
  };
};

/** Simulazione recupero email via telefono. */
export const findEmailByPhoneNumber = async (
  phoneNumber: string
): Promise<{ success: boolean; message: string }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const users = getUsers();
      const foundUser = Object.values(users).find(
        (user: any) => user.phoneNumber === phoneNumber
      );

      if (foundUser) {
        console.log(`(SIMULAZIONE) SMS a ${phoneNumber}: email ${(foundUser as any).email}`);
      } else {
        console.log(`(SIMULAZIONE) Numero non registrato: ${phoneNumber}`);
      }
      resolve({
        success: true,
        message:
          "Se il numero è associato a un account, riceverai un SMS con la tua email.",
      });
    }, 1500);
  });
};

/**
 * Reimposta il PIN validando il token su Apps Script.
 * ATTENZIONE: Apps Script risponde con { ok: true } (o { success: true }).
 */
export const resetPin = async (
  email: string,
  token: string,
  newPin: string
): Promise<{ success: boolean; message: string }> => {
  const normalizedEmail = email.toLowerCase();

  try {
    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // NB: Apps Script (doPost) deve leggere: action, resetToken, email, newPin
      body: JSON.stringify({
        action: 'resetPin',
        resetToken: token, // usare "resetToken" (non "token") per compatibilità con lo script
        email: normalizedEmail,
        newPin,
      }),
    });

    let out: any = null;
    try {
      out = await res.json();
    } catch {
      out = null;
    }

    const okFlag = !!(out && (out.ok === true || out.success === true));

    if (res.ok && okFlag) {
      return { success: true, message: 'PIN aggiornato con successo.' };
    }

    if (out && (out.error || out.message)) {
      return { success: false, message: String(out.error || out.message) };
    }

    return {
      success: false,
      message: `Si è verificato un errore sul server (${res.status}). Riprova.`,
    };
  } catch (error) {
    console.error('Errore di rete durante resetPin:', error);
    return {
      success: false,
      message: 'Impossibile completare la richiesta. Controlla la connessione e riprova.',
    };
  }
};
