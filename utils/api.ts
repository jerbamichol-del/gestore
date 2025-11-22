// utils/api.ts
import { hashPinWithSalt, verifyPin } from './auth';

// --- MOCK USER DATABASE in localStorage (demo) ---
export const getUsers = () => {
  try {
    return JSON.parse(localStorage.getItem('users_db') || '{}');
  } catch {
    return {};
  }
};

export const saveUsers = (users: any) =>
  localStorage.setItem('users_db', JSON.stringify(users));

const normalizeEmail = (email: string) =>
  email.trim().toLowerCase();

// 👇 METTI QUI il link Web App Apps Script (quello che termina in /exec)
const SCRIPT_URL = 'https://script.google.com/macros/s/XXXXXXXXXXXX/exec';

// =================== FORGOT PASSWORD → invia EMAIL ===================

export const forgotPassword = async (email: string) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return {
      success: false,
      message: 'Inserisci un indirizzo email valido.',
    };
  }

  try {
    const redirect = 'https://jerbamichol-del.github.io/gestore/reset/';
    const url =
      `${SCRIPT_URL}?action=request` +
      `&email=${encodeURIComponent(normalizedEmail)}` +
      `&redirect=${encodeURIComponent(redirect)}`;

    // fire-and-forget: non ci interessa la risposta
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
    });
  } catch (err) {
    console.warn('forgotPassword (fire-and-forget) warning:', err);
  }

  return {
    success: true,
    message: "Se l'email è registrata, riceverai un link per il reset.",
  };
};

// =================== RESET PIN LOCALE ===================
// Il token viene usato solo per far partire la schermata, NON più per validare sul server.

export const resetPin = async (
  email: string,
  _token: string,      // ignorato: la mail serve solo a dimostrare che controlli l’account
  newPin: string
): Promise<{ success: boolean; message: string }> => {
  const normalizedEmail = normalizeEmail(email);
  const users = getUsers();
  const user = users[normalizedEmail];

  if (!user) {
    return {
      success: false,
      message: 'Utente non trovato nel database locale.',
    };
  }

  try {
    const { hash, salt } = await hashPinWithSalt(newPin);

    user.pinHash = hash;
    user.pinSalt = salt;
    users[normalizedEmail] = user;
    saveUsers(users);

    return {
      success: true,
      message: 'PIN aggiornato con successo.',
    };
  } catch (e) {
    console.error('Errore aggiornando il PIN locale:', e);
    return {
      success: false,
      message: 'Errore durante l’aggiornamento del PIN.',
    };
  }
};
