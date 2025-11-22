// src/utils/api.ts
import { hashPinWithSalt, verifyPin } from './auth';

// =====================
// Tipi base (facoltativi ma utili)
// =====================
export interface StoredUser {
  email: string;
  pinHash: string;
  pinSalt: string;
  createdAt: string;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  message?: string;
}

export interface RegisterResult {
  success: boolean;
  message?: string;
}

export interface ForgotPasswordResult {
  success: boolean;
  message: string;
}

export interface ResetPinResult {
  success: boolean;
  message: string;
}

// =====================
// Helpers utente (localStorage)
// =====================

const USERS_KEY = 'users_db';

export const getUsers = (): Record<string, StoredUser> => {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const saveUsers = (users: Record<string, StoredUser>) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

// =====================
// Registrazione
// =====================

export const register = async (
  email: string,
  pin: string
): Promise<RegisterResult> => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return {
      success: false,
      message: 'Inserisci un indirizzo email valido.',
    };
  }

  if (!/^\d{4}$/.test(pin)) {
    return {
      success: false,
      message: 'Il PIN deve essere di 4 cifre numeriche.',
    };
  }

  const users = getUsers();
  if (users[normalizedEmail]) {
    return {
      success: false,
      message: 'Esiste già un utente registrato con questa email.',
    };
  }

  const { hash, salt } = await hashPinWithSalt(pin);

  const newUser: StoredUser = {
    email: normalizedEmail,
    pinHash: hash,
    pinSalt: salt,
    createdAt: new Date().toISOString(),
  };

  users[normalizedEmail] = newUser;
  saveUsers(users);

  return {
    success: true,
    message: 'Registrazione completata.',
  };
};

// =====================
// Login
// =====================

export const login = async (
  email: string,
  pin: string
): Promise<LoginResult> => {
  const normalizedEmail = normalizeEmail(email);
  const users = getUsers();
  const user = users[normalizedEmail];

  if (!user) {
    return {
      success: false,
      message: 'Credenziali non valide.',
    };
  }

  const isValid = await verifyPin(pin, user.pinHash, user.pinSalt);
  if (!isValid) {
    return {
      success: false,
      message: 'Credenziali non valide.',
    };
  }

  // Token solo “di sessione”, usato da AuthGate
  const token = `${normalizedEmail}:${Date.now()}`;

  return {
    success: true,
    token,
  };
};

// =====================
// Forgot password → invio email con link reset
// =====================

// ⚠️ METTI QUI il tuo URL di Apps Script (quello /exec)
const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec';

export const forgotPassword = async (
  email: string
): Promise<ForgotPasswordResult> => {
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

    // fire-and-forget — non ci interessa la risposta
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

// =====================
// Reset PIN locale
// =====================

export const resetPin = async (
  email: string,
  _token: string, // il token dal link non viene più verificato lato server
  newPin: string
): Promise<ResetPinResult> => {
  const normalizedEmail = normalizeEmail(email);
  const users = getUsers();
  const user = users[normalizedEmail];

  if (!user) {
    return {
      success: false,
      message: 'Utente non trovato nel database locale.',
    };
  }

  if (!/^\d{4}$/.test(newPin)) {
    return {
      success: false,
      message: 'Il nuovo PIN deve essere di 4 cifre.',
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
