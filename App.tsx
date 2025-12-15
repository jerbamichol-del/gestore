
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Expense, Account, CATEGORIES } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { deleteImageFromQueue, OfflineImage, addImageToQueue, getQueuedImages } from './utils/db';
import { DEFAULT_ACCOUNTS } from './utils/defaults';
import { toYYYYMMDD } from './utils/date';
import { processImageFile } from './utils/fileHelper';

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
import AccountsScreen from './screens/AccountsScreen';
import ImageSourceCard from './components/ImageSourceCard';
import ShareQrModal from './components/ShareQrModal';
import InstallPwaModal from './components/InstallPwaModal';
import { CameraIcon } from './components/icons/CameraIcon';
import { ComputerDesktopIcon } from './components/icons/ComputerDesktopIcon';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import CalculatorContainer from './components/CalculatorContainer';
import SuccessIndicator from './components/SuccessIndicator';
import PinVerifierModal from './components/PinVerifierModal';

// Custom Hooks
import { useRecurringExpenseGenerator } from './hooks/useRecurringExpenseGenerator';
import { useCloudSync } from './hooks/useCloudSync';
import { usePendingImages } from './hooks/usePendingImages';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { usePrivacyGate } from './hooks/usePrivacyGate';
import { useBackNavigation } from './hooks/useBackNavigation';

type ToastMessage = { message: string; type: 'success' | 'info' | 'error' };

const App: React.FC<{ onLogout: () => void; currentEmail: string }> = ({ onLogout, currentEmail }) => {
  // --- Data State ---
  const [expenses, setExpenses] = useLocalStorage<Expense[]>('expenses_v2', []);
  const [recurringExpenses, setRecurringExpenses] = useLocalStorage<Expense[]>('recurring_expenses_v1', []);
  const [accounts, setAccounts] = useLocalStorage<Account[]>('accounts_v1', DEFAULT_ACCOUNTS);
  const safeAccounts = accounts || [];

  // --- UI Utilities ---
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = useCallback((msg: ToastMessage) => setToast(msg), []);
  const [showSuccessIndicator, setShowSuccessIndicator] = useState(false);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [isParsingImage, setIsParsingImage] = useState(false);
  const [expenseToDeleteId, setExpenseToDeleteId] = useState<string | null>(null);
  
  // --- Editing Data ---
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [editingRecurringExpense, setEditingRecurringExpense] = useState<Expense | undefined>(undefined);
  const [prefilledData, setPrefilledData] = useState<Partial<Omit<Expense, 'id'>> | undefined>(undefined);
  const [multipleExpensesData, setMultipleExpensesData] = useState<Partial<Omit<Expense, 'id'>>[]>([]);

  // --- Online Status ---
  const isOnline = useOnlineStatus();

  // --- Custom Hooks Integration ---
  
  // 1. Install Prompt
  const { installPromptEvent, isInstallModalOpen, setIsInstallModalOpen, handleInstallClick } = useInstallPrompt();

  // 2. Privacy Gate
  const { isBalanceVisible, isPinVerifierOpen, setIsPinVerifierOpen, handleToggleBalanceVisibility, handlePinVerified } = usePrivacyGate();

  // 3. Pending Images
  const { 
      pendingImages, setPendingImages, 
      syncingImageId, setSyncingImageId, 
      imageForAnalysis, setImageForAnalysis, 
      refreshPendingImages, handleSharedFile, handleImagePick, sharedImageIdRef
  } = usePendingImages(isOnline, showToast);

  // 4. Cloud Sync
  const { handleSyncFromCloud } = useCloudSync(
      currentEmail, isOnline, 
      expenses, setExpenses, 
      recurringExpenses, setRecurringExpenses, 
      accounts, setAccounts, 
      showToast
  );

  // 5. Recurring Generator
  useRecurringExpenseGenerator(expenses, setExpenses, recurringExpenses, setRecurringExpenses);

  // 6. Navigation
  const nav = useBackNavigation(showToast, setImageForAnalysis);

  // --- Additional Logic ---

  // Check shared file logic on mount
  const isSharedStart = useRef(new URLSearchParams(window.location.search).get('shared') === 'true');
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
               const flaggedImage = { ...latestImage, _isShared: true };
               setImageForAnalysis(flaggedImage);
               setPendingImages(safeImages.filter(img => img.id !== latestImage.id));
            } else { setPendingImages([]); }
        } catch (e) { console.error("Error checking shared file", e); }
      }
    };
    checkForSharedFile();
  }, [setImageForAnalysis, setPendingImages]);

  const hasRunMigrationRef = useRef(false);
  useEffect(() => {
      if (hasRunMigrationRef.current) return;
      hasRunMigrationRef.current = true;
  }, []);

  // --- Handlers ---

  const sanitizeExpenseData = (data: any, imageBase64?: string): Partial<Omit<Expense, 'id'>> => {
    if (!data) return {}; 
    let category = data.category || 'Altro';
    if (!CATEGORIES[category]) category = 'Altro';
    let amount = data.amount;
    if (typeof amount === 'string') amount = parseFloat(amount.replace(',', '.'));
    if (typeof amount !== 'number' || isNaN(amount)) amount = 0;
    const safeAccounts = accounts || [];

    return {
        type: data.type || 'expense', 
        description: data.description || '',
        amount: amount,
        category: category,
        date: data.date || new Date().toISOString().split('T')[0],
        tags: Array.isArray(data.tags) ? data.tags : [],
        receipts: Array.isArray(data.receipts) ? data.receipts : (imageBase64 ? [imageBase64] : []),
        accountId: data.accountId || (safeAccounts.length > 0 ? safeAccounts[0].id : '')
    };
  };

  const handleImportFile = async (file: File) => {
      try {
          showToast({ message: 'Elaborazione file...', type: 'info' });
          if (file.type === 'application/json' || file.name.toLowerCase().endsWith('.json')) {
              try {
                  const text = await file.text();
                  const data = JSON.parse(text);
                  if (Array.isArray(data)) {
                      setExpenses(prev => [...prev, ...data]);
                      showToast({ message: `${data.length} spese importate da JSON.`, type: 'success' });
                      return;
                  }
              } catch (e) {
                  showToast({ message: "File JSON non valido.", type: 'error' });
                  return;
              }
          }
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

  const handleAnalyzeImage = async (image: OfflineImage) => {
    if (!isOnline) { showToast({ message: 'Connettiti a internet per analizzare.', type: 'error' }); return; }
    setSyncingImageId(image.id);
    setIsParsingImage(true);
    try {
      const { parseExpensesFromImage } = await import('./utils/ai');
      const parsedData = await parseExpensesFromImage(image.base64Image, image.mimeType);
      
      if (parsedData?.length === 1) {
        setPrefilledData(sanitizeExpenseData(parsedData[0], image.base64Image));
        window.history.replaceState({ modal: 'form' }, ''); 
        nav.setIsFormOpen(true);
      } else if (parsedData?.length > 1) {
        setMultipleExpensesData(parsedData.map(item => sanitizeExpenseData(item, undefined)));
        window.history.replaceState({ modal: 'multiple' }, ''); 
        nav.setIsMultipleExpensesModalOpen(true);
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
    nav.setIsVoiceModalOpen(false);
    const safeData = sanitizeExpenseData(data);
    setPrefilledData(safeData);
    nav.setIsFormOpen(true);
  };

  const handleAddExpense = (data: Omit<Expense, 'id'> | Expense) => {
      let finalData = { ...data };
      if (!finalData.type) finalData.type = 'expense';
      const todayStr = toYYYYMMDD(new Date());

      if (
          finalData.frequency === 'recurring' &&
          finalData.recurrenceEndType === 'count' &&
          finalData.recurrenceCount === 1 &&
          finalData.date <= todayStr
      ) {
          finalData.frequency = 'single';
          finalData.recurrence = undefined;
          finalData.recurrenceInterval = undefined;
          finalData.recurrenceDays = undefined;
          finalData.recurrenceEndType = undefined;
          finalData.recurrenceEndDate = undefined;
          finalData.recurrenceCount = undefined;
          finalData.monthlyRecurrenceType = undefined;
      }

      if ('id' in finalData) { 
          const updatedExpense = finalData as Expense;
          setExpenses(p => p.map(e => e.id === updatedExpense.id ? updatedExpense : e));
          if (updatedExpense.frequency === 'single') {
             setRecurringExpenses(p => p.filter(e => e.id !== updatedExpense.id));
          } else {
             setRecurringExpenses(p => p.map(e => e.id === updatedExpense.id ? updatedExpense : e));
          }
      } else { 
          const newItem = { ...finalData, id: crypto.randomUUID() } as Expense;
          if (finalData.frequency === 'recurring') setRecurringExpenses(p => [newItem, ...p]);
          else setExpenses(p => [newItem, ...p]);
      }
      setShowSuccessIndicator(true); setTimeout(() => setShowSuccessIndicator(false), 2000);
      
      if (nav.isFormOpen) {
          window.history.back();
      } else if (nav.isCalculatorContainerOpen) {
          nav.closeModalWithHistory();
      } else if (nav.isAccountsScreenOpen) {
          // Do nothing, balance adjustment logic handles its own close
      } else {
          nav.forceNavigateHome();
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

  const fabStyle = (nav.isHistoryScreenOpen && !nav.isHistoryClosing) || (nav.isIncomeHistoryOpen && !nav.isIncomeHistoryClosing) ? { bottom: `calc(90px + env(safe-area-inset-bottom, 0px))` } : undefined;

  return (
    <div className="h-full w-full bg-slate-100 flex flex-col font-sans" style={{ touchAction: 'pan-y' }}>
      <div className="flex-shrink-0 z-20">
        <Header 
            pendingSyncs={pendingImages.length} 
            isOnline={isOnline} 
            onInstallClick={handleInstallClick} 
            installPromptEvent={installPromptEvent} 
            onLogout={onLogout} 
            onShowQr={() => { window.history.pushState({ modal: 'qr' }, ''); nav.setIsQrModalOpen(true); }} 
        />
      </div>

      <main className="flex-grow bg-slate-100">
        <div className="w-full h-full overflow-y-auto space-y-6" style={{ touchAction: 'pan-y' }}>
           <Dashboard 
              expenses={expenses || []} 
              recurringExpenses={recurringExpenses || []} 
              onNavigateToRecurring={() => { window.history.pushState({ modal: 'recurring' }, ''); nav.setIsRecurringScreenOpen(true); }}
              onNavigateToHistory={() => { window.history.pushState({ modal: 'history' }, ''); nav.setIsHistoryClosing(false); nav.setIsHistoryScreenOpen(true); }}
              onNavigateToIncomes={() => {
                  if (!isBalanceVisible) {
                      setIsPinVerifierOpen(true);
                  } else {
                      window.history.pushState({ modal: 'income_history' }, ''); 
                      nav.setIsIncomeHistoryClosing(false); 
                      nav.setIsIncomeHistoryOpen(true);
                  }
              }}
              onNavigateToAccounts={() => {
                  if (!isBalanceVisible) {
                      setIsPinVerifierOpen(true);
                  } else {
                      window.history.pushState({ modal: 'accounts' }, ''); 
                      nav.setIsAccountsScreenOpen(true);
                  }
              }}
              onReceiveSharedFile={handleSharedFile} 
              onImportFile={handleImportFile}
              onSync={() => handleSyncFromCloud(false)}
              isBalanceVisible={isBalanceVisible}
              onToggleBalanceVisibility={handleToggleBalanceVisibility}
           />
           <PendingImages images={pendingImages} onAnalyze={handleAnalyzeImage} onDelete={async (id) => { await deleteImageFromQueue(id); refreshPendingImages(); }} isOnline={isOnline} syncingImageId={syncingImageId} />
        </div>
      </main>

      {!nav.isCalculatorContainerOpen && !nav.isHistoryFilterOpen && (
         <FloatingActionButton 
            onAddManually={() => { window.history.pushState({ modal: 'calculator' }, ''); nav.setIsCalculatorContainerOpen(true); }}
            onAddFromImage={() => { window.history.pushState({ modal: 'source' }, ''); nav.setIsImageSourceModalOpen(true); }}
            onAddFromVoice={() => { window.history.pushState({ modal: 'voice' }, ''); nav.setIsVoiceModalOpen(true); }}
            style={fabStyle}
         />
      )}
      
      <SuccessIndicator show={showSuccessIndicator} />

      <CalculatorContainer isOpen={nav.isCalculatorContainerOpen} onClose={nav.closeModalWithHistory} onSubmit={handleAddExpense} accounts={safeAccounts} expenses={expenses} onEditExpense={(e) => { setEditingExpense(e); window.history.pushState({ modal: 'form' }, ''); nav.setIsFormOpen(true); }} onDeleteExpense={(id) => { setExpenseToDeleteId(id); setIsConfirmDeleteModalOpen(true); }} onMenuStateChange={() => {}} />
      <ExpenseForm isOpen={nav.isFormOpen} onClose={nav.closeModalWithHistory} onSubmit={handleAddExpense} initialData={editingExpense || editingRecurringExpense} prefilledData={prefilledData} accounts={safeAccounts} isForRecurringTemplate={!!editingRecurringExpense} />

      {nav.isImageSourceModalOpen && (
        <div className="fixed inset-0 z-[5200] flex justify-center items-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={nav.closeModalWithHistory}>
          <div className="bg-slate-50 rounded-lg shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ImageSourceCard icon={<CameraIcon className="w-8 h-8"/>} title="Scatta Foto" description="Usa la fotocamera." onClick={() => { nav.setIsImageSourceModalOpen(false); handleImagePick('camera'); }} />
              <ImageSourceCard icon={<ComputerDesktopIcon className="w-8 h-8"/>} title="Galleria" description="Carica da file." onClick={() => { nav.setIsImageSourceModalOpen(false); handleImagePick('gallery'); }} />
            </div>
          </div>
        </div>
      )}

      <VoiceInputModal isOpen={nav.isVoiceModalOpen} onClose={nav.closeModalWithHistory} onParsed={handleVoiceParsed} />

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

      <MultipleExpensesModal isOpen={nav.isMultipleExpensesModalOpen} onClose={nav.closeModalWithHistory} expenses={multipleExpensesData} accounts={safeAccounts} onConfirm={(d) => { d.forEach(handleAddExpense); nav.forceNavigateHome(); }} />

      {/* History Screen - Expenses Only */}
      {nav.isHistoryScreenOpen && (
        <HistoryScreen 
            expenses={expenses} 
            accounts={safeAccounts} 
            onClose={nav.closeModalWithHistory} 
            onCloseStart={() => nav.setIsHistoryClosing(true)} 
            onEditExpense={(e) => { setEditingExpense(e); window.history.pushState({ modal: 'form' }, ''); nav.setIsFormOpen(true); }} 
            onDeleteExpense={handleDeleteRequest} 
            onDeleteExpenses={(ids) => { setExpenses(prev => (prev || []).filter(e => !ids.includes(e.id))); }} 
            isEditingOrDeleting={nav.isFormOpen || isConfirmDeleteModalOpen} 
            isOverlayed={nav.isFormOpen || isConfirmDeleteModalOpen} 
            onDateModalStateChange={() => {}} 
            onFilterPanelOpenStateChange={nav.setIsHistoryFilterOpen} 
            filterType="expense"
        />
      )}

      {/* History Screen - Income Only */}
      {nav.isIncomeHistoryOpen && (
        <HistoryScreen 
            expenses={expenses} 
            accounts={safeAccounts} 
            onClose={nav.closeModalWithHistory} 
            onCloseStart={() => nav.setIsIncomeHistoryClosing(true)} 
            onEditExpense={(e) => { setEditingExpense(e); window.history.pushState({ modal: 'form' }, ''); nav.setIsFormOpen(true); }} 
            onDeleteExpense={handleDeleteRequest} 
            onDeleteExpenses={(ids) => { setExpenses(prev => (prev || []).filter(e => !ids.includes(e.id))); }} 
            isEditingOrDeleting={nav.isFormOpen || isConfirmDeleteModalOpen} 
            isOverlayed={nav.isFormOpen || isConfirmDeleteModalOpen} 
            onDateModalStateChange={() => {}} 
            onFilterPanelOpenStateChange={nav.setIsHistoryFilterOpen} 
            filterType="income"
        />
      )}
      
      {(nav.isRecurringScreenOpen || nav.isRecurringClosing) && (
        <RecurringExpensesScreen 
            recurringExpenses={recurringExpenses} 
            expenses={expenses} 
            accounts={safeAccounts} 
            onClose={nav.closeModalWithHistory}
            onCloseStart={() => nav.setIsRecurringClosing(true)} 
            onEdit={(e) => { setEditingRecurringExpense(e); window.history.pushState({ modal: 'form' }, ''); nav.setIsFormOpen(true); }} 
            onDelete={(id) => setRecurringExpenses(prev => (prev || []).filter(e => e.id !== id))} 
            onDeleteRecurringExpenses={(ids) => setRecurringExpenses(prev => (prev || []).filter(e => !ids.includes(e.id)))} 
        />
      )}

      {nav.isAccountsScreenOpen && (
          <AccountsScreen 
            accounts={safeAccounts}
            expenses={expenses || []}
            onClose={nav.closeModalWithHistory}
            onAddTransaction={handleAddExpense}
            onDeleteTransaction={handleDeleteRequest}
            onDeleteTransactions={(ids) => { setExpenses(prev => (prev || []).filter(e => !ids.includes(e.id))); }}
          />
      )}
      
      <ShareQrModal isOpen={nav.isQrModalOpen} onClose={nav.closeModalWithHistory} />
      <InstallPwaModal isOpen={isInstallModalOpen} onClose={() => setIsInstallModalOpen(false)} />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {isParsingImage && <div className="fixed inset-0 bg-white/80 z-[100] flex items-center justify-center"><SpinnerIcon className="w-12 h-12 text-indigo-600"/></div>}
      
      <PinVerifierModal 
          isOpen={isPinVerifierOpen}
          onClose={() => setIsPinVerifierOpen(false)}
          onSuccess={handlePinVerified}
          email={currentEmail}
      />
    </div>
  );
};

export default App;
