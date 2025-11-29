import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Expense, Account } from './types';
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
import { CameraIcon } from './components/icons/CameraIcon';
import { ComputerDesktopIcon } from './components/icons/ComputerDesktopIcon';
import { XMarkIcon } from './components/icons/XMarkIcon';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import CalculatorContainer from './components/CalculatorContainer';
import SuccessIndicator from './components/SuccessIndicator';
import { PEEK_PX } from './components/HistoryFilterCard';

type ToastMessage = { message: string; type: 'success' | 'info' | 'error' };

// ... Helper functions (processImageFile, pickImage, calculateNextDueDate, toISODate) rimangono uguali ...
// PER BREVITÀ LE OMETTO QUI MA TU NON CANCELLARLE DAL TUO FILE!
// Assicurati di includere le funzioni helper che c'erano prima (processImageFile, etc.)

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
            if(e.target.files[0]) resolve(e.target.files[0]);
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

  // --- Stati UI ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCalculatorContainerOpen, setIsCalculatorContainerOpen] = useState(false);
  const [isImageSourceModalOpen, setIsImageSourceModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [isMultipleExpensesModalOpen, setIsMultipleExpensesModalOpen] = useState(false);
  const [isParsingImage, setIsParsingImage] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isRecurringScreenOpen, setIsRecurringScreenOpen] = useState(false);
  const [isHistoryScreenOpen, setIsHistoryScreenOpen] = useState(false);
  const [isHistoryFilterPanelOpen, setIsHistoryFilterPanelOpen] = useState(false);

  // --- Dati ---
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [editingRecurringExpense, setEditingRecurringExpense] = useState<Expense | undefined>(undefined);
  const [prefilledData, setPrefilledData] = useState<Partial<Omit<Expense, 'id'>> | undefined>(undefined);
  const [expenseToDeleteId, setExpenseToDeleteId] = useState<string | null>(null);
  const [multipleExpensesData, setMultipleExpensesData] = useState<Partial<Omit<Expense, 'id'>>[]>([]);
  const [imageForAnalysis, setImageForAnalysis] = useState<OfflineImage | null>(null);

  // --- Sync ---
  const isOnline = useOnlineStatus();
  const [pendingImages, setPendingImages] = useState<OfflineImage[]>([]);
  const [syncingImageId, setSyncingImageId] = useState<string | null>(null);
  
  // --- Toast ---
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = useCallback((msg: ToastMessage) => setToast(msg), []);
  const [showSuccessIndicator, setShowSuccessIndicator] = useState(false);
  
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const pendingImagesCountRef = useRef(0);

  // ... (Logica migrazione e ricorrenza omesse per brevità, ma lasciale nel tuo codice se ci sono) ...
  // Assumiamo che la logica di migrazione sia già stata eseguita o non necessaria qui per il fix.
  
  // ================== HELPER DATI AI (FIX) ==================
  // Questa funzione prepara i dati per evitare crash (es. undefined arrays)
  const sanitizeExpenseData = (data: any, imageBase64?: string): Partial<Omit<Expense, 'id'>> => {
    return {
        description: data.description || '',
        amount: typeof data.amount === 'number' ? data.amount : 0,
        category: data.category || 'Altro',
        date: data.date || toISODate(new Date()),
        tags: Array.isArray(data.tags) ? data.tags : [],
        receipts: Array.isArray(data.receipts) ? data.receipts : (imageBase64 ? [imageBase64] : []),
        // Assicura che accountId non sia undefined se possibile, altrimenti ExpenseForm userà il default
        accountId: data.accountId || (accounts && accounts.length > 0 ? accounts[0].id : '')
    };
  };

  // ================== HANDLERS AI ==================

  const handleAnalyzeImage = async (image: OfflineImage, fromQueue: boolean = true) => {
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
        // Caso Singolo: Sanitizza e apri form
        const safeData = sanitizeExpenseData(parsedData[0], image.base64Image);
        setPrefilledData(safeData);
        setIsFormOpen(true);
      } else {
        // Caso Multiplo: Sanitizza TUTTI gli elementi dell'array
        const safeMultipleData = parsedData.map(item => sanitizeExpenseData(item, image.base64Image));
        setMultipleExpensesData(safeMultipleData);
        setIsMultipleExpensesModalOpen(true);
      }

      if (fromQueue) {
        await deleteImageFromQueue(image.id);
        refreshPendingImages();
      }

    } catch (error) {
      console.error('AI Error:', error);
      showToast({ message: "Errore analisi immagine. Riprova.", type: 'error' });
    } finally {
      setIsParsingImage(false);
      setSyncingImageId(null);
    }
  };

  const handleVoiceParsed = (data: Partial<Omit<Expense, 'id'>>) => {
    setIsVoiceModalOpen(false);
    // Sanitizza anche i dati vocali
    const safeData = sanitizeExpenseData(data);
    setPrefilledData(safeData);
    setIsFormOpen(true);
  };

  // ================== SHARE TARGET HANDLER ==================
  const handleSharedFile = async (file: File) => {
      try {
          showToast({ message: 'Elaborazione immagine condivisa...', type: 'info' });
          const { base64: base64Image, mimeType } = await processImageFile(file);
          const newImage: OfflineImage = { id: crypto.randomUUID(), base64Image, mimeType };

          if (isOnline) {
              setImageForAnalysis(newImage); // Apre il modale "Analizza ora?"
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

  // ... (Il resto delle funzioni CRUD: addExpense, updateExpense, delete... rimangono uguali) ...

  const addExpense = (newExpense: Omit<Expense, 'id'>) => {
      setExpenses(prev => [{ ...newExpense, id: crypto.randomUUID() }, ...prev]);
      setShowSuccessIndicator(true); setTimeout(() => setShowSuccessIndicator(false), 2000);
  };
  // (Aggiungi qui le altre funzioni CRUD se mancano nel copia/incolla, ho semplificato per leggibilità ma tu mantienile)
  // ...

  // ================== RENDER ==================
  // Layout essenziale per capire dove posizionare i componenti
  return (
    <div className="h-full w-full bg-slate-100 flex flex-col font-sans" style={{ touchAction: 'pan-y' }}>
      <div className="flex-shrink-0 z-20">
        <Header pendingSyncs={pendingImages.length} isOnline={isOnline} onInstallClick={() => {}} installPromptEvent={null} onLogout={onLogout} />
      </div>

      <main className="flex-grow bg-slate-100">
        <div className="w-full h-full overflow-y-auto space-y-6" style={{ touchAction: 'pan-y' }}>
           <Dashboard 
              expenses={expenses} 
              recurringExpenses={recurringExpenses} 
              onNavigateToRecurring={() => setIsRecurringScreenOpen(true)}
              onNavigateToHistory={() => setIsHistoryScreenOpen(true)}
              onReceiveSharedFile={handleSharedFile} 
              // onImportFile={} <-- Aggiungi se serve
           />
           
           <PendingImages 
              images={pendingImages} 
              onAnalyze={(img) => handleAnalyzeImage(img, true)}
              onDelete={async (id) => { await deleteImageFromQueue(id); refreshPendingImages(); }} 
              isOnline={isOnline}
              syncingImageId={syncingImageId}
           />
        </div>
      </main>

      {/* FAB e Modali */}
      {!isCalculatorContainerOpen && (
         <FloatingActionButton 
            onAddManually={() => setIsCalculatorContainerOpen(true)}
            onAddFromImage={() => setIsImageSourceModalOpen(true)}
            onAddFromVoice={() => setIsVoiceModalOpen(true)}
         />
      )}
      
      <SuccessIndicator show={showSuccessIndicator} />

      <CalculatorContainer 
         isOpen={isCalculatorContainerOpen}
         onClose={() => setIsCalculatorContainerOpen(false)}
         onSubmit={(data) => { /* Tua logica submit */ setIsCalculatorContainerOpen(false); }}
         accounts={accounts || []} // PROTEZIONE QUI
         expenses={expenses}
         onEditExpense={() => {}}
         onDeleteExpense={() => {}}
         onMenuStateChange={() => {}}
      />

      <ExpenseForm
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingExpense(undefined); setPrefilledData(undefined); }}
        onSubmit={(data) => { /* Tua logica submit */ if('id' in data) { /* update */ } else { addExpense(data); } setIsFormOpen(false); }}
        initialData={editingExpense}
        prefilledData={prefilledData}
        accounts={accounts || []} // PROTEZIONE QUI
      />

      {/* ... Altri modali (Voice, ImageSource, ConfirmDelete) ... */}
      
      <ConfirmationModal
        isOpen={!!imageForAnalysis}
        onClose={() => { if(imageForAnalysis) addImageToQueue(imageForAnalysis).then(() => { refreshPendingImages(); setImageForAnalysis(null); }); }}
        onConfirm={() => { if(imageForAnalysis) { handleAnalyzeImage(imageForAnalysis, false); setImageForAnalysis(null); } }}
        title="Analizza Immagine"
        message="Vuoi analizzare subito questa immagine?"
        confirmButtonText="Sì, analizza"
        cancelButtonText="No, in coda"
      />

      <MultipleExpensesModal
        isOpen={isMultipleExpensesModalOpen}
        onClose={() => setIsMultipleExpensesModalOpen(false)}
        expenses={multipleExpensesData} // Ora sono sanitizzati!
        accounts={accounts || []}       // PROTEZIONE QUI
        onConfirm={(data) => { data.forEach(d => addExpense(d)); setIsMultipleExpensesModalOpen(false); }}
      />

      {/* ... Schermate (History, Recurring) ... */}
      
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

// Helper per aggiornare la lista immagini (da rimettere nel corpo se serve)
// const refreshPendingImages = ... 

export default App;

