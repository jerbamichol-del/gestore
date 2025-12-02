import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Expense, Account, CATEGORIES } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { getQueuedImages, deleteImageFromQueue, OfflineImage, addImageToQueue } from './utils/db';
import { DEFAULT_ACCOUNTS } from './utils/defaults';

import Header from './components/Header';
import Dashboard from './components/Dashboard';
import ExpenseForm from './components/ExpenseForm';
import FloatingActionButton from './components/FloatingActionButton';
import VoiceInputModal from './components/VoiceInputModal';
import ConfirmationModal from './components/ConfirmationModal';
import MultipleExpensesModal from './components/MultipleExpensesModal';
import PendingImages from './components/PendingImages';
import Toast from './components/Toast';
import HistoryScreen from './screens/HistoryScreen';
import RecurringExpensesScreen from './screens/RecurringExpensesScreen';
import ImageSourceCard from './components/ImageSourceCard';
import ShareQrModal from './components/ShareQrModal';
import InstallPwaModal from './components/InstallPwaModal';
import { CameraIcon } from './components/icons/CameraIcon';
import { ComputerDesktopIcon } from './components/icons/ComputerDesktopIcon';
import { XMarkIcon } from './components/icons/XMarkIcon';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import CalculatorContainer from './components/CalculatorContainer';
import SuccessIndicator from './components/SuccessIndicator';

type ToastMessage = { message: string; type: 'success' | 'info' | 'error' };

type ExtendedOfflineImage = OfflineImage & { _isShared?: boolean };

// --- HELPER FUNCTIONS ---
const processImageFile = (file: File): Promise<{ base64: string; mimeType: string }> => {
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

const pickImage = (source: 'camera' | 'gallery'): Promise<File> => {
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

const calculateNextDueDate = (template: Expense, fromDate: Date): Date | null => {
  if (template.frequency !== 'recurring' || !template.recurrence) return null;
  const interval = template.recurrenceInterval || 1;
  const nextDate = new Date(fromDate);
  switch (template.recurrence) {
    case 'daily': nextDate.setDate(nextDate.getDate() + interval); break;
    case 'weekly': nextDate.setDate(nextDate.getDate() + 7 * interval); break;
    case 'monthly': nextDate.setMonth(nextDate.getMonth() + interval); break;
    case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + interval); break;
  }
  return nextDate;
};

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const App: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [expenses, setExpenses] = useLocalStorage<Expense[]>('expenses_v2', []);
  const [recurringExpenses, setRecurringExpenses] = useLocalStorage<Expense[]>('recurring_expenses_v1', []);
  const [accounts, setAccounts] = useLocalStorage<Account[]>('accounts_v1', DEFAULT_ACCOUNTS);

  // --- UI State ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCalculatorContainerOpen, setIsCalculatorContainerOpen] = useState(false);
  const [isImageSourceModalOpen, setIsImageSourceModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [isMultipleExpensesModalOpen, setIsMultipleExpensesModalOpen] = useState(false);
  const [isParsingImage, setIsParsingImage] = useState(false);
  
  // Navigazione principale
  const [isRecurringScreenOpen, setIsRecurringScreenOpen] = useState(false);
  const [isHistoryScreenOpen, setIsHistoryScreenOpen] = useState(false);
  const [isHistoryClosing, setIsHistoryClosing] = useState(false);
  
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  
  // Track History Filter Panel state to hide FAB
  const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false);

  // --- Data ---
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [editingRecurringExpense, setEditingRecurringExpense] = useState<Expense | undefined>(undefined);
  const [prefilledData, setPrefilledData] = useState<Partial<Omit<Expense, 'id'>> | undefined>(undefined);
  const [expenseToDeleteId, setExpenseToDeleteId] = useState<string | null>(null);
  const [multipleExpensesData, setMultipleExpensesData] = useState<Partial<Omit<Expense, 'id'>>[]>([]);
  const [imageForAnalysis, setImageForAnalysis] = useState<ExtendedOfflineImage | null>(null);

  // --- Sync ---
  const isOnline = useOnlineStatus();
  const [pendingImages, setPendingImages] = useState<OfflineImage[]>([]);
  const [syncingImageId, setSyncingImageId] = useState<string | null>(null);
  
  // --- Toast & Install ---
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = useCallback((msg: ToastMessage) => setToast(msg), []);
  const [showSuccessIndicator, setShowSuccessIndicator] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const pendingImagesCountRef = useRef(0);
  
  // --- Shared Logic ---
  const sharedImageIdRef = useRef<string | null>(null);
  const isSharedStart = useRef(new URLSearchParams(window.location.search).get('shared') === 'true');

  // --- EXIT GUARD REF ---
  const lastBackPressTime = useRef(0);

  // --- RESET STATE EFFECT ---
  // Se lo storico è chiuso, assicuriamoci che il filtro sia resettato
  useEffect(() => {
    if (!isHistoryScreenOpen) {
      setIsHistoryFilterOpen(false);
    }
  }, [isHistoryScreenOpen]);

  // --- INITIALIZATION ---
  useEffect(() => {
    if (!window.history.state || !window.history.state.modal) {
        window.history.replaceState({ modal: 'exit_guard' }, ''); 
        window.history.pushState({ modal: 'home' }, '');
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('install') === 'true') {
        const newUrl = window.location.pathname;
        window.history.replaceState({ modal: 'home' }, '', newUrl); 
        setTimeout(() => setIsInstallModalOpen(true), 500);
    }
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPromptEvent(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      installPromptEvent.userChoice.then((choiceResult: any) => {
        setInstallPromptEvent(null);
      });
    } else {
      setIsInstallModalOpen(true);
    }
  };

  const closeAllModals = () => {
      setIsFormOpen(false);
      setIsCalculatorContainerOpen(false);
      setIsImageSourceModalOpen(false);
      setIsVoiceModalOpen(false);
      setIsMultipleExpensesModalOpen(false);
      setIsQrModalOpen(false);
      setIsHistoryScreenOpen(false);
      setIsHistoryFilterOpen(false);
      setIsRecurringScreenOpen(false);
      setImageForAnalysis(null);
  };

  // --- HISTORY MANAGEMENT ---
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      const modal = state?.modal;

      if (modal === 'exit_guard') {
          const now = Date.now();
          if (now - lastBackPressTime.current < 2000) {
              window.history.back(); 
              return;
          } else {
              lastBackPressTime.current = now;
              showToast({ message: 'Premi di nuovo indietro per uscire', type: 'info' });
              window.history.pushState({ modal: 'home' }, ''); 
              closeAllModals();
              return;
          }
      }

      // Chiudi modali semplici
      if (modal !== 'form') setIsFormOpen(false);
      if (modal !== 'voice') setIsVoiceModalOpen(false);
      if (modal !== 'source') setIsImageSourceModalOpen(false);
      if (modal !== 'multiple') setIsMultipleExpensesModalOpen(false);
      if (modal !== 'qr') setIsQrModalOpen(false);

      // Gestione Calcolatrice
      if (modal !== 'calculator' && modal !== 'calculator_details') {
          setIsCalculatorContainerOpen(false);
      }

      // Gestione Schermate Principali (Home/Storico/Ricorrenti)
      if (!modal || modal === 'home') {
        setIsHistoryScreenOpen(false);
        setIsHistoryClosing(false); // Reset pulito quando siamo sicuri di essere a casa
        setIsHistoryFilterOpen(false); // Reset esplicito anche qui
        setIsRecurringScreenOpen(false);
        setImageForAnalysis(null);
      } else if (modal === 'history') {
        setIsHistoryScreenOpen(true);
        setIsHistoryClosing(false); // Reset pulito all'apertura
        setIsRecurringScreenOpen(false);
      } else if (modal === 'recurring') {
        setIsRecurringScreenOpen(true);
        setIsHistoryScreenOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showToast]);

  const openModalWithHistory = (modalName: string, opener: () => void) => {
      window.history.pushState({ modal: modalName }, '');
      opener();
  };

  const closeModalWithHistory = () => {
      // Verifica esplicita dello stato per evitare di chiudere troppo (es. exit_guard)
      if (window.history.state && window.history.state.modal && window.history.state.modal !== 'home' && window.history.state.modal !== 'exit_guard') {
          window.history.back();
      } else {
          // Fallback di sicurezza: se per qualche motivo lo stato è perso, forza la home
          window.history.replaceState({ modal: 'home' }, '', window.location.pathname);
          // Forza l'aggiornamento dello stato React simulando un evento popstate
          window.dispatchEvent(new PopStateEvent('popstate', { state: { modal: 'home' } }));
      }
  };

  const refreshPendingImages = useCallback(async () => {
    try {
      const images = await getQueuedImages();
      const safeImages = Array.isArray(images) ? images : [];
      setPendingImages(safeImages);
      pendingImagesCountRef.current = safeImages.length;
      if ('setAppBadge' in navigator && typeof (navigator as any).setAppBadge === 'function') {
        if (safeImages.length > 0) (navigator as any).setAppBadge(safeImages.length);
        else (navigator as any).clearAppBadge();
      }
    } catch (e) {
      console.error("Failed to refresh pending images", e);
      setPendingImages([]);
    }
  }, []);

  useEffect(() => {
    if (!isSharedStart.current) refreshPendingImages();
  }, [refreshPendingImages]);

  useEffect(() => {
    const checkForSharedFile = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('shared') === 'true' || isSharedStart.current) {
        window.history.replaceState({ modal: 'home' }, '', window.location.pathname);
        try {
            const images = await getQueuedImages();
            const safeImages = Array.isArray(images) ? images : [];
            if (safeImages.length > 0) {
               safeImages.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
               const latestImage = safeImages[0];
               sharedImageIdRef.current = latestImage.id;
               const flaggedImage: ExtendedOfflineImage = { ...latestImage, _isShared: true };
               setImageForAnalysis(flaggedImage);
               setPendingImages(safeImages.filter(img => img.id !== latestImage.id));
            } else {
                setPendingImages([]);
            }
        } catch (e) {
            console.error("Error checking shared file", e);
        }
      }
    };
    checkForSharedFile();
  }, []);

  const hasRunMigrationRef = useRef(false);
  useEffect(() => {
      if (hasRunMigrationRef.current) return;
      hasRunMigrationRef.current = true;
  }, []);

  useEffect(() => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const newExpenses: Expense[] = [];
      const templatesToUpdate: Expense[] = [];
      const safeRecurringExpenses = Array.isArray(recurringExpenses) ? recurringExpenses : [];
      safeRecurringExpenses.forEach(template => {
         if (!template.date) return;
         const cursorDateString = template.lastGeneratedDate || template.date;
         const p = cursorDateString.split('-').map(Number);
         let cursor = new Date(p[0], p[1] - 1, p[2]);
         if (isNaN(cursor.getTime())) return;
         let nextDue = !template.lastGeneratedDate ? new Date(p[0], p[1] - 1, p[2]) : calculateNextDueDate(template, cursor);
         let updatedTemplate = { ...template };
         let safetyCounter = 0;
         while (nextDue && nextDue <= today && safetyCounter < 1000) {
             safetyCounter++;
             const nextDueDateString = toISODate(nextDue);
             const instanceExists = (expenses || []).some(e => e.recurringExpenseId === template.id && e.date === nextDueDateString) || newExpenses.some(e => e.recurringExpenseId === template.id && e.date === nextDueDateString);
             if (!instanceExists) {
                 newExpenses.push({ ...template, id: crypto.randomUUID(), date: nextDueDateString, frequency: 'single', recurringExpenseId: template.id, lastGeneratedDate: undefined });
             }
             cursor = nextDue;
             updatedTemplate.lastGeneratedDate = toISODate(cursor);
             nextDue = calculateNextDueDate(template, cursor);
         }
         if (updatedTemplate.lastGeneratedDate !== template.lastGeneratedDate) templatesToUpdate.push(updatedTemplate);
      });
      if (newExpenses.length > 0) setExpenses(prev => [...newExpenses, ...(prev || [])]);
      if (templatesToUpdate.length > 0) setRecurringExpenses(prev => (prev || []).map(t => templatesToUpdate.find(ut => ut.id === t.id) || t));
  }, [recurringExpenses, expenses, setExpenses, setRecurringExpenses]);

  const safeAccounts = accounts || [];
  const sanitizeExpenseData = (data: any, imageBase64?: string): Partial<Omit<Expense, 'id'>> => {
    if (!data) return {}; 
    let category = data.category || 'Altro';
    if (!CATEGORIES[category]) category = 'Altro';
    
    let amount = data.amount;
    if (typeof amount === 'string') {
        amount = parseFloat(amount.replace(',', '.'));
    }
    if (typeof amount !== 'number' || isNaN(amount)) amount = 0;

    return {
        description: data.description || '',
        amount: amount,
        category: category,
        date: data.date || toISODate(new Date()),
        tags: Array.isArray(data.tags) ? data.tags : [],
        receipts: Array.isArray(data.receipts) ? data.receipts : (imageBase64 ? [imageBase64] : []),
        accountId: data.accountId || (safeAccounts.length > 0 ? safeAccounts[0].id : '')
    };
  };

  const handleAnalyzeImage = async (image: OfflineImage) => {
    if (!isOnline) {
      showToast({ message: 'Connettiti a internet per analizzare.', type: 'error' });
      return;
    }
    setSyncingImageId(image.id);
    setIsParsingImage(true);
    try {
      const { parseExpensesFromImage } = await import('./utils/ai');
      const parsedData = await parseExpensesFromImage(image.base64Image, image.mimeType);
      if (!parsedData || parsedData.length === 0) {
        showToast({ message: "Nessuna spesa trovata.", type: 'info' });
      } else if (parsedData.length === 1) {
        const safeData = sanitizeExpenseData(parsedData[0], image.base64Image);
        setPrefilledData(safeData);
        window.history.replaceState({ modal: 'form' }, ''); 
        setIsFormOpen(true);
      } else {
        const safeMultipleData = parsedData.map(item => sanitizeExpenseData(item, image.base64Image));
        setMultipleExpensesData(safeMultipleData);
        window.history.replaceState({ modal: 'multiple' }, ''); 
        setIsMultipleExpensesModalOpen(true);
      }
      setPendingImages(prev => prev.filter(img => img.id !== image.id));
      await deleteImageFromQueue(image.id);
      refreshPendingImages();
    } catch (error) {
      console.error('AI Error:', error);
      showToast({ message: "Errore analisi immagine. Riprova.", type: 'error' });
    } finally {
      setIsParsingImage(false);
      setSyncingImageId(null);
    }
  };

  const handleVoiceParsed = (data: Partial<Omit<Expense, 'id'>>) => {
    window.history.replaceState({ modal: 'form' }, '');
    setIsVoiceModalOpen(false);
    const safeData = sanitizeExpenseData(data);
    setPrefilledData(safeData);
    setIsFormOpen(true);
  };

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
    window.history.replaceState({ modal: 'home' }, '');
    setIsImageSourceModalOpen(false);
    sessionStorage.setItem('preventAutoLock', 'true');
    try {
      const file = await pickImage(source);
      const { base64: base64Image, mimeType } = await processImageFile(file);
      const newImage: OfflineImage = { id: crypto.randomUUID(), base64Image, mimeType, timestamp: Date.now() };
      if (isOnline) {
        setImageForAnalysis(newImage);
      } else {
        await addImageToQueue(newImage);
        refreshPendingImages();
      }
    } catch (error) {
      // Ignora
    } finally {
      setTimeout(() => sessionStorage.removeItem('preventAutoLock'), 2000);
    }
  };

  const addExpense = (newExpense: Omit<Expense, 'id'>) => {
      if (newExpense.frequency === 'recurring') {
          setRecurringExpenses(prev => [{ ...newExpense, id: crypto.randomUUID() } as Expense, ...(prev || [])]);
      } else {
          setExpenses(prev => [{ ...newExpense, id: crypto.randomUUID() } as Expense, ...(prev || [])]);
      }
      setShowSuccessIndicator(true); setTimeout(() => setShowSuccessIndicator(false), 2000);
  };
  
  const updateExpense = (updated: Expense) => {
      setExpenses(prev => {
          const exists = (prev || []).some(e => e.id === updated.id);
          if (exists) return prev.map(e => e.id === updated.id ? updated : e);
          return prev;
      });
      setRecurringExpenses(prev => {
          const exists = (prev || []).some(e => e.id === updated.id);
          if (exists) return prev.map(e => e.id === updated.id ? updated : e);
          return prev;
      });
      setShowSuccessIndicator(true); setTimeout(() => setShowSuccessIndicator(false), 2000);
  };
  
  const handleDeleteRequest = (id: string) => { setExpenseToDeleteId(id); setIsConfirmDeleteModalOpen(true); };
  const confirmDelete = () => {
    if (expenseToDeleteId) {
      setExpenses(prev => (prev || []).filter(e => e.id !== expenseToDeleteId));
      setExpenseToDeleteId(null); setIsConfirmDeleteModalOpen(false);
      showToast({ message: 'Spesa eliminata.', type: 'info' });
    }
  };

  const handleModalConfirm = async () => {
      if (!imageForAnalysis) return;
      if (imageForAnalysis.id === sharedImageIdRef.current) sharedImageIdRef.current = null;
      handleAnalyzeImage(imageForAnalysis); 
      setImageForAnalysis(null);
  };

  const handleModalClose = async () => {
      if (!imageForAnalysis) return;
      let existsInDb = !!(imageForAnalysis._isShared) || (sharedImageIdRef.current === imageForAnalysis.id);
      if (!existsInDb) {
          const dbImages = await getQueuedImages();
          existsInDb = dbImages.some(img => img.id === imageForAnalysis.id);
      }
      if (!existsInDb) await addImageToQueue(imageForAnalysis);
      if (imageForAnalysis.id === sharedImageIdRef.current) sharedImageIdRef.current = null;
      refreshPendingImages();
      setImageForAnalysis(null);
  };

  // --- CALCOLA BOTTOM POSITION PER FAB ---
  // MODIFICATO: Logica più robusta per evitare che il FAB "salti" in alto quando lo storico è chiuso
  const fabStyle = (isHistoryScreenOpen && !isHistoryClosing) 
      ? { bottom: `calc(90px + env(safe-area-inset-bottom, 0px))` } 
      : undefined;

  // --- RENDER ---
  return (
    <div className="h-full w-full bg-slate-100 flex flex-col font-sans" style={{ touchAction: 'pan-y' }}>
      <div className="flex-shrink-0 z-20">
        <Header 
            pendingSyncs={pendingImages.length} 
            isOnline={isOnline} 
            onInstallClick={handleInstallClick} 
            installPromptEvent={installPromptEvent} 
            onLogout={onLogout} 
            onShowQr={() => openModalWithHistory('qr', () => setIsQrModalOpen(true))} 
        />
      </div>

      <main className="flex-grow bg-slate-100">
        <div className="w-full h-full overflow-y-auto space-y-6" style={{ touchAction: 'pan-y' }}>
           <Dashboard 
              expenses={expenses || []} 
              recurringExpenses={recurringExpenses || []} 
              onNavigateToRecurring={() => openModalWithHistory('recurring', () => setIsRecurringScreenOpen(true))}
              onNavigateToHistory={() => openModalWithHistory('history', () => {
                  setIsHistoryClosing(false); // Reset preventivo
                  setIsHistoryScreenOpen(true);
              })}
              onReceiveSharedFile={handleSharedFile} 
              onImportFile={(file) => { /* Logica import */ }}
           />
           
           <PendingImages 
              images={pendingImages} 
              onAnalyze={(img) => handleAnalyzeImage(img)}
              onDelete={async (id) => { await deleteImageFromQueue(id); refreshPendingImages(); }} 
              isOnline={isOnline}
              syncingImageId={syncingImageId}
           />
        </div>
      </main>

      {!isCalculatorContainerOpen && !isHistoryFilterOpen && (
         <FloatingActionButton 
            onAddManually={() => openModalWithHistory('calculator', () => setIsCalculatorContainerOpen(true))}
            onAddFromImage={() => openModalWithHistory('source', () => setIsImageSourceModalOpen(true))}
            onAddFromVoice={() => openModalWithHistory('voice', () => setIsVoiceModalOpen(true))}
            style={fabStyle}
         />
      )}
      
      <SuccessIndicator show={showSuccessIndicator} />

      <CalculatorContainer 
         isOpen={isCalculatorContainerOpen}
         onClose={closeModalWithHistory}
         onSubmit={(data) => { if('id' in data) updateExpense(data as Expense); else addExpense(data); closeModalWithHistory(); }}
         accounts={safeAccounts} 
         expenses={expenses || []}
         onEditExpense={(e) => { setEditingExpense(e); openModalWithHistory('form', () => setIsFormOpen(true)); }}
         onDeleteExpense={handleDeleteRequest}
         onMenuStateChange={() => {}}
      />

      <ExpenseForm
        isOpen={isFormOpen}
        onClose={() => { closeModalWithHistory(); setEditingExpense(undefined); setEditingRecurringExpense(undefined); setPrefilledData(undefined); }}
        onSubmit={(data) => { if('id' in data) { updateExpense(data as Expense); } else { addExpense(data); } closeModalWithHistory(); }}
        initialData={editingExpense || editingRecurringExpense}
        prefilledData={prefilledData}
        accounts={safeAccounts} 
        isForRecurringTemplate={!!editingRecurringExpense}
      />

      {isImageSourceModalOpen && (
        <div className="fixed inset-0 z-[5200] flex justify-center items-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={closeModalWithHistory}>
          <div className="bg-slate-50 rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <header className="flex justify-between items-center p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Aggiungi da Immagine</h2>
              <button onClick={closeModalWithHistory} className="p-1 rounded-full hover:bg-slate-200"><XMarkIcon className="w-6 h-6"/></button>
            </header>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ImageSourceCard icon={<CameraIcon className="w-8 h-8"/>} title="Scatta Foto" description="Usa la fotocamera." onClick={() => handleImagePick('camera')} />
              <ImageSourceCard icon={<ComputerDesktopIcon className="w-8 h-8"/>} title="Galleria" description="Carica da file." onClick={() => handleImagePick('gallery')} />
            </div>
          </div>
        </div>
      )}

      <VoiceInputModal isOpen={isVoiceModalOpen} onClose={closeModalWithHistory} onParsed={handleVoiceParsed} />

      <ConfirmationModal
        isOpen={isConfirmDeleteModalOpen}
        onClose={() => { setIsConfirmDeleteModalOpen(false); setExpenseToDeleteId(null); }}
        onConfirm={confirmDelete}
        title="Conferma Eliminazione"
        message="Azione irreversibile."
        variant="danger"
      />
      
      <ConfirmationModal
        isOpen={!!imageForAnalysis}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
        title="Analizza Immagine"
        message="Vuoi analizzare subito questa immagine?"
        confirmButtonText="Sì, analizza"
        cancelButtonText="No, in coda"
      />

      <MultipleExpensesModal
        isOpen={isMultipleExpensesModalOpen}
        onClose={closeModalWithHistory}
        expenses={multipleExpensesData}
        accounts={safeAccounts} 
        onConfirm={(data) => { data.forEach(d => addExpense(d)); closeModalWithHistory(); }}
      />

      {isHistoryScreenOpen && (
        <HistoryScreen 
          expenses={expenses || []} accounts={safeAccounts} 
          onClose={() => { 
              closeModalWithHistory(); 
              // FIX: Non resettare isHistoryClosing qui! Lascia che l'unmount/popstate lo gestiscano
          }} 
          onCloseStart={() => setIsHistoryClosing(true)} 
          onEditExpense={(e) => { setEditingExpense(e); openModalWithHistory('form', () => setIsFormOpen(true)); }} 
          onDeleteExpense={handleDeleteRequest}
          onDeleteExpenses={(ids) => { setExpenses(prev => (prev || []).filter(e => !ids.includes(e.id))); }}
          isEditingOrDeleting={isFormOpen || isConfirmDeleteModalOpen}
          isOverlayed={false}
          onDateModalStateChange={() => {}} 
          onFilterPanelOpenStateChange={setIsHistoryFilterOpen}
        />
      )}
      
      {isRecurringScreenOpen && (
        <RecurringExpensesScreen 
          recurringExpenses={recurringExpenses || []} expenses={expenses || []} accounts={safeAccounts}
          onClose={closeModalWithHistory}
          onEdit={(e) => { setEditingRecurringExpense(e); openModalWithHistory('form', () => setIsFormOpen(true)); }}
          onDelete={(id) => setRecurringExpenses(prev => (prev || []).filter(e => e.id !== id))}
          onDeleteRecurringExpenses={(ids) => setRecurringExpenses(prev => (prev || []).filter(e => !ids.includes(e.id)))}
        />
      )}

      <ShareQrModal isOpen={isQrModalOpen} onClose={closeModalWithHistory} />

      <InstallPwaModal isOpen={isInstallModalOpen} onClose={() => setIsInstallModalOpen(false)} />

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {isParsingImage && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-[100]">
           <SpinnerIcon className="w-12 h-12 text-indigo-600" />
           <p className="mt-4 font-semibold text-slate-700">Analisi in corso...</p>
        </div>
      )}
    </div>
  );
};

export default App;
