import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Expense, Account, CATEGORIES } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { getQueuedImages, deleteImageFromQueue, OfflineImage, addImageToQueue } from './utils/db';
import { DEFAULT_ACCOUNTS } from './utils/defaults';
import { processImageFile, pickImage } from './utils/fileHelper';
import { saveToCloud } from './utils/cloud';
import { getUsers } from './utils/api';

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

const App: React.FC<{ onLogout: () => void; currentEmail: string }> = ({ onLogout, currentEmail }) => {
  const [expenses, setExpenses] = useLocalStorage<Expense[]>('expenses_v2', []);
  const [recurringExpenses, setRecurringExpenses] = useLocalStorage<Expense[]>('recurring_expenses_v1', []);
  const [accounts, setAccounts] = useLocalStorage<Account[]>('accounts_v1', DEFAULT_ACCOUNTS);
  const safeAccounts = accounts || [];

  // --- UI State ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCalculatorContainerOpen, setIsCalculatorContainerOpen] = useState(false);
  const [isImageSourceModalOpen, setIsImageSourceModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [isMultipleExpensesModalOpen, setIsMultipleExpensesModalOpen] = useState(false);
  const [isParsingImage, setIsParsingImage] = useState(false);
  const [isRecurringScreenOpen, setIsRecurringScreenOpen] = useState(false);
  const [isHistoryScreenOpen, setIsHistoryScreenOpen] = useState(false);
  const [isHistoryClosing, setIsHistoryClosing] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
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
  const lastBackPressTime = useRef(0);

  const refreshPendingImages = useCallback(async () => {
    try {
      const images = await getQueuedImages();
      setPendingImages(images || []);
      pendingImagesCountRef.current = (images || []).length;
    } catch (e) {
      setPendingImages([]);
    }
  }, []);

  const sanitizeExpenseData = (data: any, imageBase64?: string): Partial<Omit<Expense, 'id'>> => {
    if (!data) return {}; 
    let category = data.category || 'Altro';
    if (!CATEGORIES[category]) category = 'Altro';
    let amount = data.amount;
    if (typeof amount === 'string') amount = parseFloat(amount.replace(',', '.'));
    if (typeof amount !== 'number' || isNaN(amount)) amount = 0;
    const safeAccounts = accounts || [];

    return {
        description: data.description || '',
        amount: amount,
        category: category,
        date: data.date || new Date().toISOString().split('T')[0],
        tags: Array.isArray(data.tags) ? data.tags : [],
        // Se imageBase64 è undefined, receipts sarà vuoto (corretto per spese multiple)
        receipts: Array.isArray(data.receipts) ? data.receipts : (imageBase64 ? [imageBase64] : []),
        accountId: data.accountId || (safeAccounts.length > 0 ? safeAccounts[0].id : '')
    };
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

  const handleImportFile = async (file: File) => {
      try {
          showToast({ message: 'Elaborazione file...', type: 'info' });
          const { processFileToImage } = await import('./utils/fileHelper');
          const { base64: base64Image, mimeType } = await processFileToImage(file);
          const newImage: OfflineImage = { id: crypto.randomUUID(), base64Image, mimeType, timestamp: Date.now() };
          
          if (isOnline) {
              setImageForAnalysis(newImage); 
          } else {
              await addImageToQueue(newImage);
              refreshPendingImages();
              showToast({ message: 'File salvato in coda (offline).', type: 'info' });
          }
      } catch (e) {
          showToast({ message: "Errore importazione file.", type: 'error' });
      }
  };

  const handleImagePick = async (source: 'camera' | 'gallery') => {
    try { window.history.replaceState({ modal: 'home' }, ''); } catch(e) {}
    setIsImageSourceModalOpen(false);
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

  const handleAnalyzeImage = async (image: OfflineImage) => {
    if (!isOnline) { showToast({ message: 'Connettiti a internet per analizzare.', type: 'error' }); return; }
    setSyncingImageId(image.id);
    setIsParsingImage(true);
    try {
      const { parseExpensesFromImage } = await import('./utils/ai');
      const parsedData = await parseExpensesFromImage(image.base64Image, image.mimeType);
      
      if (parsedData?.length === 1) {
        // SPESA SINGOLA: Passiamo l'immagine così viene allegata
        setPrefilledData(sanitizeExpenseData(parsedData[0], image.base64Image));
        window.history.replaceState({ modal: 'form' }, ''); 
        setIsFormOpen(true);
      } else if (parsedData?.length > 1) {
        // SPESE MULTIPLE: Passiamo undefined come immagine, così le ricevute vengono tolte
        setMultipleExpensesData(parsedData.map(item => sanitizeExpenseData(item, undefined)));
        window.history.replaceState({ modal: 'multiple' }, ''); 
        setIsMultipleExpensesModalOpen(true);
      } else {
        showToast({ message: "Nessuna spesa trovata.", type: 'info' });
      }
      await deleteImageFromQueue(image.id);
      refreshPendingImages();
    } catch (error) {
      showToast({ message: "Errore analisi immagine. Riprova.", type: 'error' });
    } finally {
      setIsParsingImage(false);
      setSyncingImageId(null);
    }
  };

  const handleVoiceParsed = (data: Partial<Omit<Expense, 'id'>>) => {
    try { window.history.replaceState({ modal: 'form' }, ''); } catch(e) {} 
    setIsVoiceModalOpen(false);
    const safeData = sanitizeExpenseData(data);
    setPrefilledData(safeData);
    setIsFormOpen(true);
  };

  useEffect(() => {
    if (!currentEmail || !isOnline) return;
    const timer = setTimeout(() => {
        const allUsers = getUsers();
        const currentUser = allUsers[currentEmail.toLowerCase()];
        if (currentUser) {
            console.log("☁️ Backup Cloud per:", currentEmail);
            saveToCloud(
                currentEmail, 
                { expenses, recurringExpenses, accounts },
                currentUser.pinHash, 
                currentUser.pinSalt
            ).then(ok => {
                if (ok) console.log("✅ Backup completato");
            }).catch(e => console.warn("Cloud error", e));
        }
    }, 5000);
    return () => clearTimeout(timer);
  }, [expenses, recurringExpenses, accounts, currentEmail, isOnline]);

  useEffect(() => {
    if (!isSharedStart.current) refreshPendingImages();
  }, [refreshPendingImages]);

  useEffect(() => {
    const checkForSharedFile = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('shared') === 'true' || isSharedStart.current) {
        try { window.history.replaceState({ modal: 'home' }, '', window.location.pathname); } catch (e) { try { window.history.replaceState({ modal: 'home' }, ''); } catch(e) {} }
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
            } else { setPendingImages([]); }
        } catch (e) { console.error("Error checking shared file", e); }
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
    if (!window.history.state?.modal) {
        window.history.replaceState({ modal: 'exit_guard' }, ''); 
        window.history.pushState({ modal: 'home' }, '');
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('install') === 'true') {
        setTimeout(() => setIsInstallModalOpen(true), 500);
    }
  }, []);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setInstallPromptEvent(e); };
    window.addEventListener('beforeinstallprompt', handler);
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

  const closeAllModals = () => {
      setIsFormOpen(false); setIsCalculatorContainerOpen(false); setIsImageSourceModalOpen(false);
      setIsVoiceModalOpen(false); setIsMultipleExpensesModalOpen(false); setIsQrModalOpen(false);
      setIsHistoryScreenOpen(false); setIsHistoryFilterOpen(false); setIsRecurringScreenOpen(false);
      setImageForAnalysis(null);
  };

  const forceNavigateHome = () => {
      try { window.history.replaceState({ modal: 'home' }, '', window.location.pathname); } catch (e) {}
      window.dispatchEvent(new PopStateEvent('popstate', { state: { modal: 'home' } }));
  };

  const closeModalWithHistory = () => {
      if (window.history.state?.modal === 'history') { setIsHistoryScreenOpen(false); setIsHistoryClosing(false); }
      if (window.history.state?.modal && window.history.state.modal !== 'home' && window.history.state.modal !== 'exit_guard') window.history.back();
      else forceNavigateHome();
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const modal = event.state?.modal;
      if (modal === 'exit_guard') {
          const now = Date.now();
          if (now - lastBackPressTime.current < 2000) { window.history.back(); return; } 
          else {
              lastBackPressTime.current = now;
              showToast({ message: 'Premi di nuovo indietro per uscire', type: 'info' });
              window.history.pushState({ modal: 'home' }, ''); 
              closeAllModals();
          }
          return;
      }
      if (modal !== 'form') setIsFormOpen(false);
      if (modal !== 'voice') setIsVoiceModalOpen(false);
      if (modal !== 'source') setIsImageSourceModalOpen(false);
      if (modal !== 'multiple') setIsMultipleExpensesModalOpen(false);
      if (modal !== 'qr') setIsQrModalOpen(false);
      if (modal !== 'calculator' && modal !== 'calculator_details') setIsCalculatorContainerOpen(false);

      if (!modal || modal === 'home') {
        setIsHistoryScreenOpen(false);
        setIsHistoryClosing(false); 
        setIsHistoryFilterOpen(false); 
        setIsRecurringScreenOpen(false);
        setImageForAnalysis(null);
      } else if (modal === 'history') {
        setIsHistoryScreenOpen(true);
        if (isHistoryClosing) setIsHistoryClosing(false);
        setIsRecurringScreenOpen(false);
      } else if (modal === 'recurring') {
        setIsRecurringScreenOpen(true);
        setIsHistoryScreenOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showToast, isHistoryClosing]);

  const handleAddExpense = (data: Omit<Expense, 'id'> | Expense) => {
      if ('id' in data) { 
          setExpenses(p => p.map(e => e.id === data.id ? data : e));
          setRecurringExpenses(p => p.map(e => e.id === data.id ? data : e));
      } else { 
          const newItem = { ...data, id: crypto.randomUUID() } as Expense;
          if (data.frequency === 'recurring') setRecurringExpenses(p => [newItem, ...p]);
          else setExpenses(p => [newItem, ...p]);
      }
      setShowSuccessIndicator(true); setTimeout(() => setShowSuccessIndicator(false), 2000);
      
      // FIX NAVIGAZIONE: Se il form era aperto (es. da storico), torna indietro invece di andare alla home
      if (isFormOpen) {
          closeModalWithHistory();
      } else {
          forceNavigateHome();
      }
  };

  const handleDeleteRequest = (id: string) => { setExpenseToDeleteId(id); setIsConfirmDeleteModalOpen(true); };
  const confirmDelete = () => {
    setExpenses(p => p.filter(e => e.id !== expenseToDeleteId));
    setExpenseToDeleteId(null); setIsConfirmDeleteModalOpen(false);
    showToast({ message: 'Spesa eliminata.', type: 'info' });
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

  const fabStyle = (isHistoryScreenOpen && !isHistoryClosing) ? { bottom: `calc(90px + env(safe-area-inset-bottom, 0px))` } : undefined;

  return (
    <div className="h-full w-full bg-slate-100 flex flex-col font-sans" style={{ touchAction: 'pan-y' }}>
      <div className="flex-shrink-0 z-20">
        <Header 
            pendingSyncs={pendingImages.length} 
            isOnline={isOnline} 
            onInstallClick={handleInstallClick} 
            installPromptEvent={installPromptEvent} 
            onLogout={onLogout} 
            onShowQr={() => { window.history.pushState({ modal: 'qr' }, ''); setIsQrModalOpen(true); }} 
        />
      </div>

      <main className="flex-grow bg-slate-100">
        <div className="w-full h-full overflow-y-auto space-y-6" style={{ touchAction: 'pan-y' }}>
           <Dashboard 
              expenses={expenses || []} 
              recurringExpenses={recurringExpenses || []} 
              onNavigateToRecurring={() => { window.history.pushState({ modal: 'recurring' }, ''); setIsRecurringScreenOpen(true); }}
              onNavigateToHistory={() => { window.history.pushState({ modal: 'history' }, ''); setIsHistoryClosing(false); setIsHistoryScreenOpen(true); }}
              onReceiveSharedFile={handleSharedFile} 
              onImportFile={handleImportFile}
           />
           <PendingImages images={pendingImages} onAnalyze={handleAnalyzeImage} onDelete={async (id) => { await deleteImageFromQueue(id); refreshPendingImages(); }} isOnline={isOnline} syncingImageId={syncingImageId} />
        </div>
      </main>

      {!isCalculatorContainerOpen && !isHistoryFilterOpen && (
         <FloatingActionButton 
            onAddManually={() => { window.history.pushState({ modal: 'calculator' }, ''); setIsCalculatorContainerOpen(true); }}
            onAddFromImage={() => { window.history.pushState({ modal: 'source' }, ''); setIsImageSourceModalOpen(true); }}
            onAddFromVoice={() => { window.history.pushState({ modal: 'voice' }, ''); setIsVoiceModalOpen(true); }}
            style={fabStyle}
         />
      )}
      
      <SuccessIndicator show={showSuccessIndicator} />

      <CalculatorContainer isOpen={isCalculatorContainerOpen} onClose={closeModalWithHistory} onSubmit={handleAddExpense} accounts={safeAccounts} expenses={expenses} onEditExpense={(e) => { setEditingExpense(e); window.history.pushState({ modal: 'form' }, ''); setIsFormOpen(true); }} onDeleteExpense={(id) => { setExpenseToDeleteId(id); setIsConfirmDeleteModalOpen(true); }} onMenuStateChange={() => {}} />
      <ExpenseForm isOpen={isFormOpen} onClose={closeModalWithHistory} onSubmit={handleAddExpense} initialData={editingExpense || editingRecurringExpense} prefilledData={prefilledData} accounts={safeAccounts} isForRecurringTemplate={!!editingRecurringExpense} />

      {isImageSourceModalOpen && (
        <div className="fixed inset-0 z-[5200] flex justify-center items-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={closeModalWithHistory}>
          <div className="bg-slate-50 rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ImageSourceCard icon={<CameraIcon className="w-8 h-8"/>} title="Scatta Foto" description="Usa la fotocamera." onClick={() => handleImagePick('camera')} />
              <ImageSourceCard icon={<ComputerDesktopIcon className="w-8 h-8"/>} title="Galleria" description="Carica da file." onClick={() => handleImagePick('gallery')} />
            </div>
          </div>
        </div>
      )}

      <VoiceInputModal isOpen={isVoiceModalOpen} onClose={closeModalWithHistory} onParsed={handleVoiceParsed} />

      <ConfirmationModal isOpen={isConfirmDeleteModalOpen} onClose={() => setIsConfirmDeleteModalOpen(false)} onConfirm={confirmDelete} title="Conferma Eliminazione" message="Azione irreversibile." variant="danger" />
      
      <ConfirmationModal
        isOpen={!!imageForAnalysis}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
        title="Analizza Immagine"
        message="Vuoi analizzare subito questa immagine?"
        confirmButtonText="Sì, analizza"
        cancelButtonText="No, in coda"
      />

      <MultipleExpensesModal isOpen={isMultipleExpensesModalOpen} onClose={closeModalWithHistory} expenses={multipleExpensesData} accounts={safeAccounts} onConfirm={(d) => { d.forEach(handleAddExpense); forceNavigateHome(); }} />

      {isHistoryScreenOpen && <HistoryScreen expenses={expenses} accounts={safeAccounts} onClose={closeModalWithHistory} onCloseStart={() => setIsHistoryClosing(true)} onEditExpense={(e) => { setEditingExpense(e); window.history.pushState({ modal: 'form' }, ''); setIsFormOpen(true); }} onDeleteExpense={handleDeleteRequest} onDeleteExpenses={(ids) => { setExpenses(prev => (prev || []).filter(e => !ids.includes(e.id))); }} isEditingOrDeleting={isFormOpen || isConfirmDeleteModalOpen} isOverlayed={false} onDateModalStateChange={() => {}} onFilterPanelOpenStateChange={setIsHistoryFilterOpen} />}
      {isRecurringScreenOpen && <RecurringExpensesScreen recurringExpenses={recurringExpenses} expenses={expenses} accounts={safeAccounts} onClose={closeModalWithHistory} onEdit={(e) => { setEditingRecurringExpense(e); window.history.pushState({ modal: 'form' }, ''); setIsFormOpen(true); }} onDelete={(id) => setRecurringExpenses(prev => (prev || []).filter(e => e.id !== id))} onDeleteRecurringExpenses={(ids) => setRecurringExpenses(prev => (prev || []).filter(e => !ids.includes(e.id)))} />}
      <ShareQrModal isOpen={isQrModalOpen} onClose={closeModalWithHistory} />
      <InstallPwaModal isOpen={isInstallModalOpen} onClose={() => setIsInstallModalOpen(false)} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {isParsingImage && <div className="fixed inset-0 bg-white/80 z-[100] flex items-center justify-center"><SpinnerIcon className="w-12 h-12 text-indigo-600"/></div>}
    </div>
  );
};

export default App;
