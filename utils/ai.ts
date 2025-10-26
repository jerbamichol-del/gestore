// utils/ai.ts
import {
  GoogleGenAI,
  Type,
  FunctionDeclaration,
  LiveSession,
  Modality,
  Blob as GenAIBlob,
  LiveServerMessage,
} from '@google/genai';
import { CATEGORIES, Expense } from '../types';

// ✅ Con Vite le env sono in import.meta.env e DEVONO iniziare per VITE_
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

// ✅ Inizializzazione "lazy": niente new ... a top-level
let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!_ai && API_KEY) {
    _ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return _ai;
}

// --- Image Parsing Logic ---

const expenseSchema = {
  type: Type.OBJECT,
  properties: {
    description: { type: Type.STRING, description: 'Breve descrizione della spesa. Es: "Cena da Mario", "Spesa Esselunga".' },
    amount: { type: Type.NUMBER, description: 'Importo totale numerico della spesa.' },
    date: { type: Type.STRING, description: 'Data della spesa in formato YYYY-MM-DD. Se non trovata, usa la data odierna.' },
    category: { type: Type.STRING, description: `Categoria della spesa. Scegli tra: ${Object.keys(CATEGORIES).join(', ')}.` },
    subcategory: { type: Type.STRING, description: 'Sottocategoria della spesa, se applicabile. Deve appartenere alla categoria scelta.' },
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
  mimeType: string
): Promise<Partial<Expense>[]> {
  const ai = getAI();
  if (!ai) {
    // Nessuna chiave: non bloccare l’app
    return [];
  }

  const imagePart = {
    inlineData: { mimeType, data: base64Image },
  };
  const textPart = {
    text: `Analizza questa immagine di una ricevuta o scontrino e estrai TUTTE le informazioni sulle spese presenti. Se ci sono più spese, restituiscile come un array di oggetti.
Le categorie e sottocategorie disponibili sono:
${getCategoryPrompt()}
Se una categoria o sottocategoria non è chiara, imposta la categoria su "Altro" e lascia vuota la sottocategoria.
Formatta la data come YYYY-MM-DD. Se non trovi una data, usa la data di oggi: ${new Date().toISOString().split('T')[0]}.
Estrai una descrizione concisa per ogni spesa.
Fornisci il risultato esclusivamente in formato JSON, anche se trovi una sola spesa (in quel caso, sarà un array con un solo elemento). Se non trovi nessuna spesa valida, restituisci un array vuoto.`,
  };

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [imagePart, textPart] },
    config: {
      responseMimeType: 'application/json',
      responseSchema: multiExpenseSchema,
    },
  });

  const jsonStr = (response.text || '').trim?.() || '';
  if (!jsonStr) return [];

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return parsed as Partial<Expense>[];
  } catch {
    return [];
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

export function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function createBlob(data: Float32Array): GenAIBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export async function createLiveSession(callbacks: {
  onopen?: () => void;
  onmessage?: (message: LiveServerMessage) => void;
  onerror?: (e: ErrorEvent) => void;
  onclose?: (e: CloseEvent) => void;
}): Promise<LiveSession> {
  const ai = getAI();
  if (!ai) {
    // Nessuna chiave → fallo sapere al chiamante
    return Promise.reject(new Error('VITE_GEMINI_API_KEY mancante'));
  }

  return ai.live.connect({
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
}

