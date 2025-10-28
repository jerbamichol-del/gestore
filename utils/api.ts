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

// URL per lo script di Google Apps
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzmq-PTrMcMdrYqCRX29_S034zCaj5ttyc3tZhdhjV77wF6n99LKricFgzy7taGqKOo/exec';


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
    const normalizedEmail = email.toLowerCase();
    
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            // Aggiungo un'azione per aiutare lo script a distinguere le richieste
            body: JSON.stringify({ action: 'requestReset', email: normalizedEmail }), 
        });
        // Non controlliamo la risposta per motivi di sicurezza (email enumeration)
    } catch (error) {
        console.error('Network error calling the password reset script:', error);
        // L'utente vuole procedere alla schermata di successo anche se la rete fallisce.
        // Registriamo l'errore ma non blocchiamo il flusso dell'utente. Questo previene anche l'enumerazione delle email.
    }
    
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
            resolve({ success: true, message: 'Se il numero è associato a un account, riceverai un SMS con la tua email.' });
        }, 1500);
    });
};

/**
 * Reimposta il PIN di un utente inviando il token e il nuovo PIN allo script di Google per la validazione.
 */
export const resetPin = async (email: string, token: string, newPin: string): Promise<{ success: boolean; message: string }> => {
    const normalizedEmail = email.toLowerCase();

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
            },
            body: JSON.stringify({
                action: 'resetPin',
                email: normalizedEmail,
                token: token,
                newPin: newPin
            }),
        });

        if (!response.ok) {
            console.error(`Lo script di App Script ha restituito un errore: ${response.status}`);
            return { success: false, message: 'Si è verificato un errore sul server. Riprova più tardi.' };
        }

        const result = await response.json();

        if (result.success) {
            // L'aggiornamento del PIN è gestito dallo script.
            // La nostra DB locale mock potrebbe non essere sincronizzata, ma per la demo va bene.
            return { success: true, message: 'PIN aggiornato con successo.' };
        } else {
            // Restituisce il messaggio di errore specifico dallo script (es. "Token non valido")
            return { success: false, message: result.message || 'Token non valido o scaduto.' };
        }

    } catch (error) {
        console.error('Errore di rete durante il reset del PIN:', error);
        return { success: false, message: 'Impossibile completare la richiesta. Controlla la tua connessione e riprova.' };
    }
};