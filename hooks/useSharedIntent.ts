import { useEffect, useRef } from 'react';

// Configurazione DB (Deve coincidere con il Service Worker)
const DB_NAME = 'expense-manager-db';
const STORE_NAME = 'offline-images';
const DB_VERSION = 1;

// Helper per convertire Base64 in File (visto che il SW salva in Base64)
const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeType });
  return new File([blob], filename, { type: mimeType });
};

export const useSharedIntent = (onFileLoaded: (file: File) => void) => {
  const processedRef = useRef(false);

  useEffect(() => {
    // Evita di eseguire due volte in React Strict Mode
    if (processedRef.current) return;

    const checkForSharedFile = async () => {
      const params = new URLSearchParams(window.location.search);
      const isShared = params.get('shared') === 'true';

      if (!isShared) return;

      console.log('Rilevato intento di condivisione...');
      processedRef.current = true;

      try {
        // 1. Apri IndexedDB (versione Vanilla JS per non richiedere dipendenze extra)
        const openRequest = indexedDB.open(DB_NAME, DB_VERSION);

        openRequest.onsuccess = (event: any) => {
          const db = event.target.result;
          
          if (!db.objectStoreNames.contains(STORE_NAME)) return;

          const transaction = db.transaction([STORE_NAME], 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          
          // Prendi tutti gli elementi (potrebbero essercene più di uno in teoria)
          const getAllRequest = store.getAll();

          getAllRequest.onsuccess = () => {
            const items = getAllRequest.result;
            if (items && items.length > 0) {
              // Prendi l'ultimo elemento (il più recente)
              const latestItem = items[items.length - 1];
              
              if (latestItem.base64Image) {
                console.log('Immagine trovata nel DB!');
                
                // Converti e passa al componente padre
                const file = base64ToFile(
                  latestItem.base64Image, 
                  `screenshot-${Date.now()}.png`, 
                  latestItem.mimeType || 'image/png'
                );
                
                onFileLoaded(file);

                // 2. Pulizia: Rimuovi l'immagine dal DB per non riprocessarla
                const deleteTx = db.transaction([STORE_NAME], 'readwrite');
                deleteTx.objectStore(STORE_NAME).clear();
              }
            }
          };
        };

        // 3. Pulizia URL: Rimuovi ?shared=true dalla barra degli indirizzi
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);

      } catch (error) {
        console.error("Errore nel recupero dello screenshot condiviso:", error);
      }
    };

    checkForSharedFile();
  }, [onFileLoaded]);
};
