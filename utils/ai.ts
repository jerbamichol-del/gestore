// src/utils/ai.ts
import {
  GoogleGenAI,
  Type,
  FunctionDeclaration,
  Modality,
  LiveServerMessage,
} from '@google/genai';
import { CATEGORIES, Expense } from '../types';

// 👉 API key direttamente in chiaro, come richiesto
const GEMINI_API_KEY = 'AIzaSyD4FUDFh6Q_6PlVLVqJ0He-K6P7YJy-D44';

// Non usare process.env / import.meta.env: siamo in browser / GitHub Pages
if (!GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY non impostata: le funzionalità AI non funzioneranno.');
}

// Istanza singleton del client
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const toYYYYMMDD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ================== IMAGE PARSING ==================

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
      description: `Categoria della spesa. Scegli tra: ${Object.keys(CATEGORIES).join(', ')}.`,
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
      categoryDetails += `- ${category}: (sottocategorie: ${subcategories.join(', ')})\n`;
    } else {
      categoryDetails += `- ${category}\n`;
    }
  }
  return categoryDetails;
};

export async function parseExpensesFromImage(
  base64Image: string,
  mimeType: string,
): Promise<Partial<Expense>[]> {
  if (!GEMINI_API_KEY) {
    console.error('parseExpensesFromImage: GEMINI_API_KEY mancante');
    return [];
  }

  const imagePart = {
    inlineData: {
      mimeType,
      data: base64Image, // deve essere solo la parte base64, senza "data:image/..."
    },
  };

  const textPart = {
    text: `Analizza questa immagine di una ricevuta o scontrino e estrai TUTTE le informazioni sulle spese presenti. 
Se ci sono più spese, restituiscile come un array di oggetti.

Le categorie e sottocategorie disponibili sono:
${getCategoryPrompt()}

Se una categoria o sottocategoria non è chiara, imposta la categoria su "Altro" e lascia vuota la sottocategoria.
Formatta la data come YYYY-MM-DD. Se non trovi una data, usa la data di oggi: ${toYYYYMMDD(
      new Date(),
    )}.
Estrai una descrizione concisa per ogni spesa.
Fornisci il risultato esclusivamente in formato JSON, anche se trovi una sola spesa (in quel caso, sarà un array con un solo elemento).
Se non trovi nessuna spesa valida, restituisci un array vuoto.`,
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: multiExpenseSchema,
      },
    });

    const jsonStr = response.text.trim();
    if (!jsonStr) return [];

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.error('Errore in parseExpensesFromImage:', err);
    return [];
  }
}

// ================== VOICE PARSING (LIVE) ==================

export const addExpenseFunctionDeclaration: FunctionDeclaration = {
  name: 'addExpense',
  parameters: {
    type: Type.OBJECT,
    description: 'Registra una nuova spesa.',
    properties: {
      description: {
        type: Type.STRING,
        description: 'Descrizione della spesa. Es: "Caffè al bar", "Biglietto del cinema".',
      },
      amount: {
        type: Type.NUMBER,
        description: 'Importo della spesa.',
      },
      category: {
        type: Type.STRING,
        description: `Categoria della spesa. Scegli tra: ${Object.keys(CATEGORIES).join(', ')}.`,
      },
    },
    required: ['amount'],
  },
};

function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Tipo compatibile con quello che si aspetta ai.live
export type GenAiBlob = {
  data: string;
  mimeType: string;
};

export function createBlob(data: Float32Array): GenAiBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export function createLiveSession(callbacks: {
  onopen: () => void;
  onmessage: (message: LiveServerMessage) => void;
  onerror: (e: ErrorEvent) => void;
  onclose: (e: CloseEvent) => void;
}) {
  if (!GEMINI_API_KEY) {
    console.error('createLiveSession: GEMINI_API_KEY mancante, la voce non funzionerà.');
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
Sii conciso e non rispondere con audio a meno che non sia strettamente necessario per una domanda di chiarimento.
Il tuo output principale è la chiamata di funzione.`,
    },
  });

  return sessionPromise;
}
