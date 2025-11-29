import { Expense } from '../types';

// --- URL HARDCODED: Per evitare problemi di configurazione env/vite ---
const AI_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyZpH2rET4JNs35Ye_tewdpszsHLLRfLr6C-7qFKH_Xe1zg_vhHB8kaRyWQjAqG7-frVg/exec';

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
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        // text/plain evita il preflight CORS (opzione OPTIONS) di Google Apps Script
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
    console.error("AI Call Error:", e);
    throw e;
  }
}

// Helper base64
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
    throw new Error(result.error || "Errore analisi immagine.");
  }

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
    throw new Error(result.error || "Errore analisi vocale.");
  }

  return result.expense || null;
}
