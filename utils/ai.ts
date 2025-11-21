import { GoogleGenAI, Type, FunctionDeclaration, Modality, Blob, LiveServerMessage, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { CATEGORIES, Expense } from '../types';

// Robust API Key retrieval for Vite/CRA/Node environments
const getApiKey = () => {
  try {
    // @ts-ignore - Check for Vite environment variable
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_KEY) {
      // @ts-ignore
      return import.meta.env.VITE_API_KEY;
    }
  } catch (e) {}
  return process.env.API_KEY;
};

const API_KEY = getApiKey();

if (!API_KEY) {
    console.error("API_KEY environment variable is not set. AI features will not work.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || '' });

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
        description: { type: Type.STRING, description: 'Breve descrizione della spesa. Es: "Cena da Mario", "Spesa Esselunga".' },
        amount: { type: Type.NUMBER, description: 'Importo totale numerico della spesa.' },
        date: { type: Type.STRING, description: 'Data della spesa in formato YYYY-MM-DD. Se non trovata, usa la data odierna.' },
        category: { type: Type.STRING, description: `Categoria della spesa. Scegli tra: ${Object.keys(CATEGORIES).join(', ')}.` },
        subcategory: { type: Type.STRING, description: 'Sottocategoria della spesa, se applicabile. Deve appartenere alla categoria scelta.' },
    },
    required: ['amount', 'date']
};

const multiExpenseSchema = {
    type: Type.ARRAY,
    items: expenseSchema,
};


const getCategoryPrompt = () => {
    let categoryDetails = "";
    for (const [category, subcategories] of Object.entries(CATEGORIES)) {
        if(subcategories.length > 0) {
            categoryDetails += `- ${category}: (sottocategorie: ${subcategories.join(', ')})\n`;
        } else {
            categoryDetails += `- ${category}\n`;
        }
    }
    return categoryDetails;
}

export async function parseExpensesFromImage(base64Image: string, mimeType: string): Promise<Partial<Expense>[]> {
    if (!API_KEY) return [];
    
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
        Formatta la data come YYYY-MM-DD. Se non trovi una data, usa la data di oggi: ${toYYYYMMDD(new Date())}.
        Estrai una descrizione concisa per ogni spesa.
        Fornisci il risultato esclusivamente in formato JSON, anche se trovi una sola spesa (in quel caso, sarà un array con un solo elemento). Se non trovi nessuna spesa valida, restituisci un array vuoto.`
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: multiExpenseSchema,
            // Robustness: disable safety filters to prevent false positives on receipts
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE }
            ]
        }
    });

    let jsonStr = response.text?.trim();
    if (!jsonStr) {
        return [];
    }

    // Robustness cleanup: Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    }

    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse AI response:", e, jsonStr);
        return [];
    }
}

export async function parseExpenseFromText(text: string): Promise<Partial<Expense> | null> {
    if (!API_KEY) return null;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Estrai i dati di spesa da questo testo: "${text}".
        Oggi è ${new Date().toLocaleDateString('it-IT')}.
        Le categorie disponibili sono: ${Object.keys(CATEGORIES).join(', ')}.
        Se la categoria non è specificata, cerca di dedurla.
        Restituisci un JSON con: { description, amount (numero), category }.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: expenseSchema
        }
    });

    let jsonStr = response.text?.trim();
    if (!jsonStr) return null;

    if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(json)?/, '').replace(/```$/, '').trim();
    }

    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse text expense:", e);
        return null;
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
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Updated createBlob to handle downsampling to 16kHz
export function createBlob(data: Float32Array, inputSampleRate: number): Blob {
  const targetSampleRate = 16000;
  let outputData: Int16Array;

  if (inputSampleRate !== targetSampleRate) {
      // Downsample logic
      const ratio = inputSampleRate / targetSampleRate;
      const newLength = Math.ceil(data.length / ratio);
      outputData = new Int16Array(newLength);
      for (let i = 0; i < newLength; i++) {
          const offset = Math.floor(i * ratio);
          // Ensure we don't go out of bounds
          const val = data[Math.min(offset, data.length - 1)];
          outputData[i] = Math.max(-1, Math.min(1, val)) * 32768;
      }
  } else {
      const l = data.length;
      outputData = new Int16Array(l);
      for (let i = 0; i < l; i++) {
          outputData[i] = data[i] * 32768;
      }
  }

  return {
    data: encode(new Uint8Array(outputData.buffer)),
    mimeType: `audio/pcm;rate=${targetSampleRate}`,
  };
}

// FIX: Made callbacks required and removed async/return type as per Gemini API guidelines.
export function createLiveSession(callbacks: {
    onopen: () => void,
    onmessage: (message: LiveServerMessage) => void,
    onerror: (e: ErrorEvent) => void,
    onclose: (e: CloseEvent) => void
}) {
    if (!API_KEY) {
        throw new Error("API Key mancante");
    }
    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {},
            tools: [{functionDeclarations: [addExpenseFunctionDeclaration]}],
             systemInstruction: `Sei un assistente vocale per un'app di gestione spese. 
             Il tuo compito è capire la spesa descritta dall'utente e chiamare la funzione 'addExpense' con i dati corretti.
             Oggi è ${new Date().toLocaleDateString('it-IT')}.
             Le categorie disponibili sono: ${Object.keys(CATEGORIES).join(', ')}.
             Se la categoria non è specificata, cerca di dedurla dalla descrizione. Se non è possibile, non specificarla.
             Sii conciso e non rispondere con audio a meno che non sia strettamente necessario per una domanda di chiarimento. Il tuo output principale è la chiamata di funzione.`
        }
    });
    return sessionPromise;
}
