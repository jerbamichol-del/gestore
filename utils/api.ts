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

// URL per lo script di Google Apps (ID EXEC corretto)
const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec';

// Redirect ufficiale della tua pagina /reset su gh-pages
const RESET_REDIRECT =
  'https://jerbamichol-del.github.io/gestore/reset/';

/**
 * Registra un nuovo utente.
 */
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

/**
 * Autentica un utente e restituisce un token di sessione fittizio.
 */
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
 * Invio e-mail reset PIN — usa l’endpoint GET?action=request del tuo Apps Script.
 * (È lo stesso che usava il mio overlay, ed è quello che al momento funziona di sicuro.)
 */
export const forgotPassword = async (
  email: string
): Promise<{ success: boolean; message: string }> => {
  const normalizedEmail = email.toLowerCase();

  try {
    // Chiamata compatibile con il tuo doGet?action=request
    const url =
      `${SCRIPT_URL}?action=request` +
      `&email=${encodeURIComponent(normalizedEmail)}` +
      `&redirect=${encodeURIComponent(RESET_REDIRECT)}`;

    // no-cors: fire-and-forget; lo Script invia la mail e noi proseguiamo
    await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
    });
  } catch (error) {
    console.error('Errore di rete durante la richiesta di reset PIN:', error);
    // Anche in errore rete continuiamo a mostrare la schermata di conferma,
    // come desideri per UX coerente.
  }

  return {
    success: true,
    message: "Se l'email è registrata, riceverai un link per il reset.",
  };
};

/**
 * Simula la ricerca di un'email tramite numero di telefono e l'invio di un SMS.
 */
export const findEmailByPhoneNumber = async (
  phoneNumber: string
): Promise<{ success: boolean; message: string }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const users = getUsers();
      const foundUser = Object.values(users).find(
        (user: any) => (user as any).phoneNumber === phoneNumber
      );

      if (foundUser) {
        console.log(
          `(SIMULAZIONE) SMS a ${phoneNumber} con l'email: ${(foundUser as any).email}`
        );
      } else {
        console.log(
          `(SIMULAZIONE) Tentativo di recupero per numero non registrato: ${phoneNumber}`
        );
      }
      resolve({
        success: true,
        message:
          'Se il numero è associato a un account, riceverai un SMS con la tua email.',
      });
    }, 1500);
  });
};

/**
 * Reimposta il PIN: POST JSON al tuo Apps Script (azione "resetPin").
 * Per compatibilità inviamo sia "token" sia "resetToken".
 */
export const resetPin = async (
  email: string,
  token: string,
  newPin: string
): Promise<{ success: boolean; message: string }> => {
  const normalizedEmail = email.toLowerCase();

  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // JSON canonico
      },
      body: JSON.stringify({
        action: 'resetPin',
        email: normalizedEmail,
        token,             // alcuni script leggono "token"
        resetToken: token, // altri leggono "resetToken" → inviamo entrambi
        newPin,
      }),
    });

    // Se lo Script è pubblicato come Web App e risponde JSON:
    const result = await response
      .json()
      .catch(() => ({ ok: false, success: false, message: 'BAD_JSON' }));

    if (response.ok && (result.ok || result.success)) {
      return { success: true, message: result.message || 'PIN aggiornato con successo.' };
    } else {
      return {
        success: false,
        message: result.message || 'Token non valido o scaduto.',
      };
    }
  } catch (error) {
    console.error('Errore di rete durante il reset del PIN:', error);
    return {
      success: false,
      message:
        'Impossibile completare la richiesta. Controlla la tua connessione e riprova.',
    };
  }
};
