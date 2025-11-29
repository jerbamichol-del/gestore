import { Expense } from '../types';

// Recuperiamo l'URL iniettato da Vite
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

  try {
      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: {
          // Text/plain evita il preflight CORS che Apps Script non gestisce bene
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`AI endpoint HTTP ${res.status}`);
      }

      const json = await res.json();
      return json as T;
  } catch (e) {
      console.error("AI Fetch Error:", e);
      throw e;
  }
}

// Helper per base64
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

// ====== IMMAGINE → SPESE ======
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
    throw new Error(result.error || "Errore generico durante l'analisi immagine.");
  }

  // Protezione: Se expenses è null/undefined, restituisci array vuoto
  return result.expenses || [];
}

// ====== AUDIO → 1 SPESA ======
export async function parseExpenseFromAudio(
  audioBlob: Blob
): Promise<Partial<Expense> | null> {
  const mimeType = audioBlob.type || 'audio/webm';
  const audioBase64 = await blobToBase64(audioBlob);

  const result = await callAiEndpoint<VoiceResponse>({
    action: 'parseVoice',
    audioBase64,
    mimeType,
  });

  if (!result.ok) {
    console.error('[AI] Errore parseVoice:', result.error);
    throw new Error(result.error || "Errore generico durante l'analisi vocale.");
  }

  return result.expense || null;
}
