import {
  GoogleGenAI,
  Type,
  FunctionDeclaration,
  Modality,
  LiveServerMessage,
} from '@google/genai';
import type { Blob as GenAIBlob } from '@google/genai';
import { CATEGORIES, Expense } from '../types';

// Helper per leggere le env sia in Vite che in Node/AI Studio
const getEnv = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) {
      return (import.meta as any).env[key];
    }
  } catch {
    // ignore
  }

  try {
    if (typeof process !== 'undefined' && process.env?.[key]) {
      return process.env[key];
    }
  } catch {
    // ignore
  }

  return undefined;
};

// Usa PRIMA la chiave che hai chiamato VITE_GEMINI_API_KEY
const API_KEY =
  getEnv('VITE_GEMINI_API_KEY') ||
  getEnv('VITE_API_KEY') ||
  getEnv('REACT_APP_API_KEY') ||
  getEnv('API_KEY');

if (!API_KEY) {
  console.error('API key Gemini mancante! Le funzionalità AI (voce/immagini) non funzioneranno.');
}

const ai = new GoogleGenAI({ apiKey: API_KEY ?? '' });

const toYYYYMMDD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- Image Parsing Logic ---

const expenseSchema = {
  type: Type.OBJECT,
  properties: {
    description: {
      type: Type.STRING,
      description:
        'Breve descrizione della spesa. Es: "Cena da Mario", "Spesa Esselunga".',
    },
    amount: {
      type: Type.NUMBER,
      description: 'Importo totale numerico della spesa.',
    },
    date: {
      type: Type.STRING,
      description:
        'Data della spesa in formato YYYY-MM-DD. Se non trovata, usa la data odierna.',
    },
    category: {
      type: Type.STRING,
      description: `Categoria della spesa. Scegli tra: ${Object.keys(
        CATEGORIES
      ).join(', ')}.`,
    },
    subcategory: {
      type: Type.STRING,
      description:
        'Sottocategoria della spesa, se applicabile. Deve appartenere alla categoria scelta.',
    },
  },
  required: ['amount', 'date'],
};

const multiExpenseSchema = {
  type: Type.ARRAY,
  items: expenseSchema,
};

const getCategoryPrompt = () => {
  let categoryDetails = '';
  for (const [category, subcategories] of Object.entries(CATEGORIES)) {
    if (subcategories.length > 0) {
      categoryDetails += `- ${category}: (sottocategorie: ${subcategories.join(
        ', '
      )})\n`;
    } else {
      categoryDetails += `- ${category}\n`;
    }
  }
  return categoryDetails;
};

export async function parseExpensesFromImage(
  base64Image: string,
  mimeType: string
): Promise<Partial<Expense>[]> {
  if (!API_KEY) {
    console.error('parseExpensesFromImage chiamato senza API_KEY.');
    throw new Error('API Gemini non configurata.');
  }

  const imagePart = {
    inlineData: {
      mimeType,
      data: base64Image,
    },
  };
  const textPart = {
    text: `Analizza questa immagine di una ricevuta o scontrino e estrai TUTTE le informazioni sulle spese presenti. Se ci sono più spese, restituiscile come un array di oggetti.
Le categorie e sottocategorie disponibili sono:
${getCategoryPrompt()}
Se una categoria o sottocategoria non è chiara, imposta la categoria su "Altro" e lascia vuota la sottocategoria.
Formatta la data come YYYY-MM-DD. Se non trovi una data, usa la data di oggi: ${toYYYYMMDD(
      new Date()
    )}.
Estrai una descrizione concisa per ogni spesa.
Fornisci il risultato esclusivamente in formato JSON, anche se trovi una sola spesa (in quel caso, sarà un array con un solo elemento). Se non trovi nessuna spesa valida, restituisci un array vuoto.`,
  };

  const response: any = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
    config: {
      responseMimeType: 'application/json',
      responseSchema: multiExpenseSchema,
    },
  });

  // La libreria espone text() nei sample; gestiamo sia funzione che property
  let raw: any = '';
  if (typeof response.text === 'function') {
    raw = response.text();
  } else if (typeof response.text === 'string') {
    raw = response.text;
  } else if (response.outputText) {
    raw = response.outputText;
  }

  const jsonStr = String(raw || '').trim();
  if (!jsonStr) {
    return [];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch (e) {
    console.error(
      'Risposta JSON non valida da parseExpensesFromImage:',
      e,
      jsonStr
    );
    throw new Error('Formato di risposta AI non valido.');
  }
}

// --- Voice Parsing Logic ---

export const addExpenseFunctionDeclaration: FunctionDeclaration = {
  name: 'addExpense',
  parameters: {
    type: Type.OBJECT,
    description: 'Registra una nuova spesa.',
    properties: {
      description: {
        type: Type.STRING,
        description:
          'Descrizione della spesa. Es: "Caffè al bar", "Biglietto del cinema".',
      },
      amount: {
        type: Type.NUMBER,
        description: 'Importo della spesa.',
      },
      category: {
        type: Type.STRING,
        description: `Categoria della spesa. Scegli tra: ${Object.keys(
          CATEGORIES
        ).join(', ')}.`,
      },
    },
    required: ['amount'],
  },
};

export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// data: Float32Array mono 32-bit
// sampleRateInHz: sample rate reale dell'AudioContext (es. 44100)
export function createBlob(
  data: Float32Array,
  sampleRateInHz: number
): GenAIBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    let s = data[i];
    if (s > 1) s = 1;
    if (s < -1) s = -1;
    int16[i] = s * 0x7fff;
  }

  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: `audio/pcm;rate=${sampleRateInHz}`,
  };
}

// FIX: callbacks richiesti; aggiunto controllo API_KEY
export function createLiveSession(callbacks: {
  onopen: () => void | Promise<void>;
  onmessage: (message: LiveServerMessage) => void;
  onerror: (e: any) => void;
  onclose: (e: CloseEvent) => void;
}) {
  if (!API_KEY) {
    console.error('createLiveSession chiamato senza API_KEY.');
    throw new Error('API Gemini non configurata.');
  }

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks,
    config: {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      tools: [{ functionDeclarations: [addExpenseFunctionDeclaration] }],
      systemInstruction: `Sei un assistente vocale per un'app di gestione spese. 
Il tuo compito è capire la spesa descritta dall'utente e chiamare la funzione 'addExpense' con i dati corretti.
Oggi è ${new Date().toLocaleDateString('it-IT')}.
Le categorie disponibili sono: ${Object.keys(CATEGORIES).join(', ')}.
Se la categoria non è specificata, cerca di dedurla dalla descrizione. Se non è possibile, non specificarla.
Sii conciso e non rispondere con audio a meno che non sia strettamente necessario per una domanda di chiarimento. Il tuo output principale è la chiamata di funzione.`,
    },
  });

  return sessionPromise;
}
