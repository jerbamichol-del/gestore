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

// Timeout di sicurezza per le chiamate (30 secondi)
const FETCH_TIMEOUT = 30000;

async function callAiEndpoint<T>(payload: any): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    console.log(`[AI] Invio richiesta... Payload size: ${JSON.stringify(payload).length}`);

    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'omit', // Cruciale per evitare errori CORS con Google Apps Script
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[AI] Errore HTTP ${res.status}:`, errorText);
      throw new Error(`Errore server: ${res.status}`);
    }

    // Leggiamo prima il testo per poterlo loggare in caso di JSON non valido
    const text = await res.text();
    
    try {
        const json = JSON.parse(text);
        return json as T;
    } catch (e) {
        console.error('[AI] Errore parsing JSON. Risposta grezza:', text);
        throw new Error("Il server ha restituito una risposta non valida.");
    }

  } catch (e: any) {
    clearTimeout(timeoutId);
    console.error("AI Call Error:", e);
    
    if (e.name === 'AbortError') {
        throw new Error("Tempo scaduto. Il server ci sta mettendo troppo tempo.");
    }
    // Rilanciamo l'errore per farlo gestire alla UI (VoiceInputModal)
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
  // Controllo preventivo se il blob è vuoto
  if (!audioBlob || audioBlob.size === 0) {
      throw new Error("Registrazione vuota o non valida.");
  }

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
