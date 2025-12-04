import { Expense, Account } from '../types';

// Sostituisci con il tuo URL se è cambiato, altrimenti lascia quello che hai
const CLOUD_API_URL = 'https://script.google.com/macros/s/AKfycbzuAtweyuib21-BX4dQszoxEL5BW-nzVN2Vyum4UZvWH-TzP3GLZB5He1jFkrO6242JPA/exec'; 

export interface AppData {
  expenses: Expense[];
  recurringExpenses: Expense[];
  accounts: Account[];
}

export interface CloudResponse {
  data: AppData;
  pinHash: string;
  pinSalt: string;
}

// Controlla se l'utente esiste già nel cloud
export const checkUserInCloud = async (email: string): Promise<boolean> => {
  try {
    const response = await fetch(CLOUD_API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'checkUser',
        email: email
      })
    });

    if (!response.ok) return false;
    const json = await response.json();
    return !!json.exists;
  } catch (e) {
    console.error("Errore check user:", e);
    return false; // Se c'è errore, assumiamo che non esista per non bloccare, o gestisci diversamente
  }
};

export const saveToCloud = async (
  email: string, 
  data: AppData, 
  pinHash: string, 
  pinSalt: string
): Promise<boolean> => {
  try {
    await fetch(CLOUD_API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'save',
        email,
        data,
        pinHash,
        pinSalt
      })
    });
    return true; 
  } catch (e) {
    console.error("Errore save cloud:", e);
    return false;
  }
};

export const loadFromCloud = async (email: string): Promise<CloudResponse | null> => {
  try {
    const response = await fetch(CLOUD_API_URL, {
      method: 'POST',
      redirect: 'follow', 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'load',
        email
      })
    });

    if (!response.ok) throw new Error("Errore rete");

    const json = await response.json();
    if (json.success && json.data) {
      return {
        data: json.data,
        pinHash: json.pinHash,
        pinSalt: json.pinSalt
      };
    }
    return null;
  } catch (e) {
    console.error("Errore load cloud:", e);
    return null;
  }
};
