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
 * Simula l'invio di un'email per il reset della password.
 */
export const forgotPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
     return new Promise(resolve => {
        setTimeout(() => {
            const users = getUsers();
            const normalizedEmail = email.toLowerCase();
            if (users[normalizedEmail]) {
                 // In una vera app, il backend genererebbe un token e invierebbe un'email.
                 console.log(`(SIMULAZIONE) Link di reset inviato a ${email}`);
                 resolve({ success: true, message: 'Se l\'email è registrata, riceverai un link per il reset.' });
            } else {
                // Inviamo lo stesso messaggio per motivi di sicurezza (per non rivelare le email esistenti).
                console.log(`(SIMULAZIONE) Tentativo di reset per email non registrata: ${email}`);
                resolve({ success: true, message: 'Se l\'email è registrata, riceverai un link per il reset.' });
            }
        }, 1500);
    });
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