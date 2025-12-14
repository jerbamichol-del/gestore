
import { useState, useEffect } from 'react';

export const useInstallPrompt = () => {
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPromptEvent(e); };
    window.addEventListener('beforeinstallprompt', handler);
    
    // Check for install query param
    const params = new URLSearchParams(window.location.search);
    if (params.get('install') === 'true') {
        setTimeout(() => setIsInstallModalOpen(true), 500);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      installPromptEvent.userChoice.then((choiceResult: any) => { setInstallPromptEvent(null); });
    } else {
      setIsInstallModalOpen(true);
    }
  };

  return {
    installPromptEvent,
    isInstallModalOpen,
    setIsInstallModalOpen,
    handleInstallClick
  };
};
