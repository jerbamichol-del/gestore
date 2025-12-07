
import * as XLSX from 'xlsx';
import { Expense } from '../types';

/**
 * Converte una stringa di testo in un'immagine base64 (PNG).
 * Usato per passare dati testuali (CSV) all'AI che accetta immagini.
 */
const textToImage = (text: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas context not available');
      }

      const lines = text.split('\n');
      const fontSize = 14;
      const lineHeight = 18;
      const padding = 20;
      const fontFamily = 'Courier New, monospace'; // Monospace per allineamento migliore

      // Calcola dimensioni
      ctx.font = `${fontSize}px ${fontFamily}`;
      let maxWidth = 0;
      lines.forEach(line => {
        const width = ctx.measureText(line).width;
        if (width > maxWidth) maxWidth = width;
      });

      // Limiti dimensioni per evitare canvas giganti
      const finalWidth = Math.min(Math.max(maxWidth + padding * 2, 600), 2000);
      // Tagliamo se troppe righe per evitare errori AI o memory, 
      // ma Gemini gestisce bene immagini alte. Limitiamo a ~300 righe per sicurezza performance
      const maxLines = 300; 
      const renderLines = lines.slice(0, maxLines);
      const finalHeight = renderLines.length * lineHeight + padding * 2;

      canvas.width = finalWidth;
      canvas.height = finalHeight;

      // Sfondo bianco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Testo nero
      ctx.fillStyle = '#000000';
      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.textBaseline = 'top';

      renderLines.forEach((line, index) => {
        ctx.fillText(line, padding, padding + index * lineHeight);
      });

      if (lines.length > maxLines) {
          ctx.fillStyle = '#666666';
          ctx.fillText(`... e altre ${lines.length - maxLines} righe ...`, padding, padding + maxLines * lineHeight);
      }

      // Export
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl.split(',')[1]);
    } catch (error) {
      reject(error);
    }
  });
};

export const processFileToImage = async (file: File): Promise<{ base64: string; mimeType: string }> => {
  let textContent = '';

  if (file.name.endsWith('.csv')) {
    textContent = await file.text();
  } else if (file.name.match(/\.(xlsx|xls)$/i)) {
    // Leggi Excel usando SheetJS
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Converti in CSV per semplicità di rappresentazione testuale
    textContent = XLSX.utils.sheet_to_csv(sheet);
  } else {
    // Se è già un'immagine, la processiamo standard
    if (file.type.startsWith('image/')) {
        return processImageFile(file);
    }
    throw new Error('Formato file non supportato. Usa CSV, Excel o Immagini.');
  }

  // Se il contenuto è vuoto
  if (!textContent.trim()) {
    throw new Error('Il file sembra vuoto.');
  }

  // Converti il testo CSV in un'immagine "screenshot"
  const base64Image = await textToImage(textContent);
  
  return {
    base64: base64Image,
    mimeType: 'image/png',
  };
};

export const processImageFile = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;
            const MAX = 1024; 
            if (width > height && width > MAX) { height = Math.round((height * MAX) / width); width = MAX; }
            else if (height >= width && height > MAX) { width = Math.round((width * MAX) / height); height = MAX; }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            if(ctx) { 
                ctx.drawImage(img, 0, 0, width, height);
                const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                resolve({ base64: canvas.toDataURL(mime, 0.8).split(',')[1], mimeType: mime });
            } else reject(new Error('Canvas error'));
        };
        img.onerror = () => reject(new Error('Image load error'));
        img.src = url;
    });
};

export const pickImage = (source: 'camera' | 'gallery'): Promise<File> => {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if(source === 'camera') input.capture = 'environment';
        input.onchange = (e: any) => {
            if(e.target.files && e.target.files[0]) resolve(e.target.files[0]);
            else reject(new Error('Nessun file'));
        };
        input.click();
    });
};

export const exportExpenses = (expenses: Expense[], format: 'excel' | 'json' = 'excel') => {
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'excel') {
        // 1. Esporta in Excel
        try {
            const rows = expenses.map(e => ({
                Data: e.date,
                Ora: e.time || '',
                Importo: e.amount,
                Descrizione: e.description,
                Categoria: e.category,
                Sottocategoria: e.subcategory || '',
                Conto: e.accountId,
                Tags: e.tags ? e.tags.join(', ') : '',
                Frequenza: e.frequency === 'recurring' ? 'Ricorrente' : 'Singola'
            }));

            const worksheet = XLSX.utils.json_to_sheet(rows);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Spese");
            XLSX.writeFile(workbook, `Spese_Export_${dateStr}.xlsx`);
        } catch (e) {
            console.error("Export Excel failed", e);
        }
    } else if (format === 'json') {
        // 2. Esporta in JSON
        try {
            const jsonStr = JSON.stringify(expenses, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Spese_Export_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Export JSON failed", e);
        }
    }
};
