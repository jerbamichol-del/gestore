import { hashPinWithSalt, verifyPin } from './auth';

// --- MOCK USER DATABASE in localStorage ---
// In una vera applicazione, questo sarebbe un database lato server.
// NOTA: Salvare dati sensibili nel localStorage non è sicuro per app in produzione.
// Questo è solo a scopo dimostrativo.

const getUsers = () => {
    try {
        return JSON.parse(localStorage.getItem('users_db') || '{}');
    } catch (e) {
        return {};
    }
};
const saveUsers = (users: any) => localStorage.setItem('users_db', JSON.stringify(users));

// --- MOCK API FUNCTIONS ---
// Queste funzioni simulano richieste di rete con un ritardo.
// Sostituiscile con chiamate fetch() reali al tuo backend.

/**
 * Registra un nuovo utente.
 */
export const register = async (email: string, pin: string, phoneNumber?: string): Promise<{ success: boolean; message: string }> => {
    return new Promise(resolve => {
        setTimeout(async () => {
            const users = getUsers();
            const normalizedEmail = email.toLowerCase();
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

/**
 * Autentica un utente e restituisce un token di sessione fittizio.
 */
export const login = async (email: string, pin: string): Promise<{ success: boolean; message: string; token?: string }> => {
     return new Promise(resolve => {
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
 * Invokes a Google App Script to send a password reset email.
 */
export const forgotPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec';
    const normalizedEmail = email.toLowerCase();
    
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: normalizedEmail }),
        });

        if (!response.ok) {
           // Log server-side errors for debugging, but don't expose them to the user.
           console.warn(`Password reset script returned a non-OK response: ${response.status}`);
        }

    } catch (error) {
        // This catches network errors (e.g., offline, DNS, CORS issues).
        console.error('Network error calling the password reset script:', error);
        // It's crucial to inform the user about a potential connection issue.
        return { success: false, message: 'Impossibile inviare la richiesta. Controlla la tua connessione e riprova.' };
    }
    
    // For security reasons, always return a generic success message to prevent attackers
    // from checking which emails are registered in the system (email enumeration).
    return { success: true, message: 'Se l\'email è registrata, riceverai un link per il reset.' };
};

/**
 * Simula la ricerca di un'email tramite numero di telefono e l'invio di un SMS.
 */
export const findEmailByPhoneNumber = async (phoneNumber: string): Promise<{ success: boolean; message: string }> => {
    return new Promise(resolve => {
        setTimeout(() => {
            const users = getUsers();
            const foundUser = Object.values(users).find((user: any) => user.phoneNumber === phoneNumber);
            
            if (foundUser) {
                console.log(`(SIMULAZIONE) SMS inviato a ${phoneNumber} con l'email: ${(foundUser as any).email}`);
            } else {
                console.log(`(SIMULAZIONE) Tentativo di recupero per numero non registrato: ${phoneNumber}`);
            }
            // Per sicurezza, restituisci sempre un messaggio generico.
            resolve({ success: true, message: 'Se il numero è associato a un account, riceverai un SMS con la tua email.' });
        }, 1500);
    });
};

/**
 * Reimposta il PIN di un utente dopo aver "verificato" un token.
 */
export const resetPin = async (email: string, token: string, newPin: string): Promise<{ success: boolean; message: string }> => {
    return new Promise(resolve => {
        setTimeout(async () => {
            const users = getUsers();
            const normalizedEmail = email.toLowerCase();
            const user = users[normalizedEmail];

            if (!user) {
                resolve({ success: false, message: 'Utente non trovato o link non valido.' });
                return;
            }

            // In una vera applicazione, il token verrebbe validato con un backend.
            // Per questa demo, la presenza di un token e di un'email valida è sufficiente.
            if (!token) {
                 resolve({ success: false, message: 'Token di reset mancante o non valido.' });
                 return;
            }
            
            const { hash, salt } = await hashPinWithSalt(newPin);
            users[normalizedEmail].pinHash = hash;
            users[normalizedEmail].pinSalt = salt;
            saveUsers(users);

            resolve({ success: true, message: 'PIN aggiornato con successo.' });
        }, 1000);
    });
};