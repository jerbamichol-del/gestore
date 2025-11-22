// src/utils/ai.ts
import { GoogleGenAI, Type } from '@google/genai';
import { CATEGORIES, Expense } from '../types';

// ======================================================
// 🔑 API KEY
// METTI QUI la TUA chiave NUOVA di Gemini (quella valida, NON la vecchia scaduta)
// Esempio: const API_KEY = 'AIza...';
const API_KEY: string = 'AIzaSyDOI3eiPbETfS8GBHvljhSH4mfcy0sLAmc';

// ======================================================

if (!API_KEY || API_KEY === 'INSERISCI_QUI_LA_TUA_CHIAVE_GEMINI') {
  console.error(
    '[AI] API_KEY non impostata in src/utils/ai.ts. ' +
      'Le funzioni AI (immagini e voce) non funzioneranno.'
  );
}

const ai = new GoogleGenAI({
  apiKey: API_KEY,
});

// ====================== HELPERS BASE64 ======================

const toYYYYMMDD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Converte un File immagine in base64 **senza** prefisso data:...
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Impossibile leggere il file come stringa.'));
        return;
      }
      const commaIndex = result.indexOf(',');
      if (commaIndex >= 0) {
        resolve(result.slice(commaIndex + 1)); // solo base64
      } else {
        resolve(result);
      }
    };

    reader.onerror = () => {
      reject(reader.error || new Error('Errore durante la lettura del file.'));
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Converte un Blob (audio) in base64 **senza** prefisso.
 */
async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ====================== SCHEMI JSON ======================

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
      description: 'Importo totale numerico della spesa (in euro).',
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

// ====================== IMMAGINI → SPESE ======================

export async function parseExpensesFromImage(
  base64Image: string,
  mimeType: string
): Promise<Partial<Expense>[]> {
  if (!API_KEY || API_KEY === 'INSERISCI_QUI_LA_TUA_CHIAVE_GEMINI') {
    console.error('[AI] parseExpensesFromImage chiamata senza API_KEY.');
    throw new Error('API non configurata');
  }

  // Se per errore arriva ancora un data URL, lo puliamo qui.
  const cleanedBase64 = base64Image.startsWith('data:')
    ? base64Image.substring(base64Image.indexOf(',') + 1)
    : base64Image;

  const imagePart = {
    inlineData: {
      mimeType,
      data: cleanedBase64,
    },
  };

  const textPart = {
    text: `Analizza questa immagine di una ricevuta o scontrino e estrai TUTTE le informazioni sulle spese presenti.
Se ci sono più spese, restituiscile come un array di oggetti.

Le categorie e sottocategorie disponibili sono:
${getCategoryPrompt()}

Se una categoria o sottocategoria non è chiara, imposta la categoria su "Altro" e lascia vuota la sottocategoria.
Formatta la data come YYYY-MM-DD. Se non trovi una data, usa la data di oggi: ${toYYYYMMDD(
      new Date()
    )}.
Estrai una descrizione concisa per ogni spesa.

Fornisci il risultato **esclusivamente** in formato JSON:
- sempre un array (anche se c'è una sola spesa)
- se non trovi nessuna spesa valida, restituisci un array vuoto: []`,
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

    const jsonStr = (response.text || '').trim();
    if (!jsonStr) {
      return [];
    }

    const parsed = JSON.parse(jsonStr);

    if (Array.isArray(parsed)) {
      return parsed as Partial<Expense>[];
    }

    if (parsed && typeof parsed === 'object') {
      return [parsed as Partial<Expense>];
    }

    return [];
  } catch (err) {
    console.error('[AI] Errore durante l’analisi dell’immagine:', err);
    throw err;
  }
}

// ====================== AUDIO → SPESA ======================

/**
 * Prende un blob audio (registrato dal browser) e fa parsare a Gemini
 * amount / description / category. Restituisce un oggetto parziale Expense.
 */
export async function parseExpenseFromAudio(
  audioBlob: Blob
): Promise<Partial<Expense> | null> {
  if (!API_KEY || API_KEY === 'INSERISCI_QUI_LA_TUA_CHIAVE_GEMINI') {
    console.error('[AI] parseExpenseFromAudio chiamata senza API_KEY.');
    throw new Error('API non configurata');
  }

  const base64Audio = await blobToBase64(audioBlob);

  const categoriesList = Object.keys(CATEGORIES).join(', ');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: audioBlob.type || 'audio/webm',
            data: base64Audio,
          },
        },
        {
          text: `L'utente ha dettato una spesa (in italiano o altra lingua).
Dal contenuto dell'audio estrai:

- amount: numero in euro (usa il punto per i decimali, niente simbolo €)
- description: frase breve che descrive la spesa
- category: una delle seguenti categorie: ${categoriesList}

Rispondi **solo** con un JSON, senza testo extra, ad esempio:
{"amount": 25.5, "description": "Cena al ristorante", "category": "Ristorante"}

Se non riesci a ricavare una spesa valida, restituisci:
{"amount": null, "description": "", "category": ""}`,
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = (response.text || '').trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      ('amount' in parsed || 'description' in parsed || 'category' in parsed)
    ) {
      return parsed as Partial<Expense>;
    }
    return null;
  } catch (e) {
    console.error('[AI] Errore nel parse JSON della risposta audio:', e, text);
    return null;
  }
}
