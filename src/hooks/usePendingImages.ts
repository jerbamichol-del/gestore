
import { useState, useCallback, useRef } from 'react';
import { getQueuedImages, OfflineImage, addImageToQueue } from '../utils/db';
import { processImageFile, pickImage } from '../utils/fileHelper';

export type ExtendedOfflineImage = OfflineImage & { _isShared?: boolean };

export const usePendingImages = (isOnline: boolean, showToast: any) => {
  const [pendingImages, setPendingImages] = useState<OfflineImage[]>([]);
  const [syncingImageId, setSyncingImageId] = useState<string | null>(null);
  const [imageForAnalysis, setImageForAnalysis] = useState<ExtendedOfflineImage | null>(null);
  
  const pendingImagesCountRef = useRef(0);
  const sharedImageIdRef = useRef<string | null>(null);

  const refreshPendingImages = useCallback(async () => {
    try {
      const images = await getQueuedImages();
      setPendingImages(images || []);
      pendingImagesCountRef.current = (images || []).length;
    } catch (e) {
      setPendingImages([]);
    }
  }, []);

  const handleSharedFile = async (file: File) => {
      try {
          showToast({ message: 'Elaborazione immagine condivisa...', type: 'info' });
          const { base64: base64Image, mimeType } = await processImageFile(file);
          const newImage: OfflineImage = { id: crypto.randomUUID(), base64Image, mimeType, timestamp: Date.now() };
          if (isOnline) {
              setImageForAnalysis(newImage); 
          } else {
              await addImageToQueue(newImage);
              refreshPendingImages();
              showToast({ message: 'Salvata in coda (offline).', type: 'info' });
          }
      } catch (e) {
          console.error(e);
          showToast({ message: "Errore file condiviso.", type: 'error' });
      }
  };

  const handleImagePick = async (source: 'camera' | 'gallery') => {
    try { window.history.replaceState({ modal: 'home' }, ''); } catch(e) {}
    sessionStorage.setItem('preventAutoLock', 'true');
    try {
      const file = await pickImage(source);
      const { base64: base64Image, mimeType } = await processImageFile(file);
      const newImage: OfflineImage = { id: crypto.randomUUID(), base64Image, mimeType, timestamp: Date.now() };
      if (isOnline) setImageForAnalysis(newImage);
      else {
        await addImageToQueue(newImage);
        refreshPendingImages();
      }
    } catch (error) { /* Ignora */ } 
    finally { setTimeout(() => sessionStorage.removeItem('preventAutoLock'), 2000); }
  };

  return {
    pendingImages,
    setPendingImages,
    syncingImageId,
    setSyncingImageId,
    imageForAnalysis,
    setImageForAnalysis,
    refreshPendingImages,
    handleSharedFile,
    handleImagePick,
    sharedImageIdRef
  };
};
