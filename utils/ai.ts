import { Expense } from '../types';

// L'URL viene iniettato da Vite al momento della build
const AI_ENDPOINT = process.env.APPS_SCRIPT_URL || '';

type ImageResponse = {
  ok: boolean;
  expenses?: Partial<Expense>[];
  error?: string;
};

type VoiceResponse = {
  ok: boolean;
  expense?: Partial<Expense> | null;
  error?: string;
};

async function callAiEndpoint<T>(payload: any): Promise<T> {
  if (!AI_ENDPOINT) {
    throw new Error("URL AI mancante. Controlla la configurazione VITE_APPS_SCRIPT_URL.");
  }

  const res = await fetch(AI_ENDPOINT, {
    method: 'POST',
    // ⚠️ text/plain è fondamentale per evitare errori CORS (preflight) con Google Apps Script
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`AI endpoint HTTP ${res.status}`);
  }

  // Google Apps Script restituisce JSON puro
  return (await res.json()) as T;
}

// Helper: converte Blob in stringa base64 pura (senza "data:image/...")
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const commaIndex = result.indexOf(',');
      resolve(commaIndex === -1 ? result : result.slice(commaIndex + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ====== FUNZIONE 1: IMMAGINE → SPESE ======
export async function parseExpensesFromImage(
  base64Image: string,
  mimeType: string
): Promise<Partial<Expense>[]> {
  const result = await callAiEndpoint<ImageResponse>({
    action: 'parseImage',
    imageBase64: base64Image,
    mimeType,
  });

  if (!result.ok) {
    console.error('[AI] Errore parseImage:', result.error);
    throw new Error(result.error || "Errore durante l'analisi dell'immagine.");
  }

  return result.expenses || [];
}

// ====== FUNZIONE 2: AUDIO → 1 SPESA ======
export async function parseExpenseFromAudio(
  audioBlob: Blob
): Promise<Partial<Expense> | null> {
  // Default a webm se il tipo non è specificato
  const mimeType = audioBlob.type || 'audio/webm';
  const audioBase64 = await blobToBase64(audioBlob);

  const result = await callAiEndpoint<VoiceResponse>({
    action: 'parseVoice',
    audioBase64,
    mimeType,
  });

  if (!result.ok) {
    console.error('[AI] Errore parseVoice:', result.error);
    throw new Error(result.error || "Errore durante l'analisi vocale.");
  }

  return result.expense || null;
}
