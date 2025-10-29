import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Expense, Account } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useSwipe } from './hooks/useSwipe';
import { getQueuedImages, deleteImageFromQueue, OfflineImage, addImageToQueue } from './utils/db';
import { parseExpensesFromImage } from './utils/ai';
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
import ImageSourceCard from './components/ImageSourceCard';
import { CameraIcon } from './components/icons/CameraIcon';
import { ComputerDesktopIcon } from './components/icons/ComputerDesktopIcon';
import { XMarkIcon } from './components/icons/XMarkIcon';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import CalculatorContainer from './components/CalculatorContainer';
import SuccessIndicator from './components/SuccessIndicator';

type NavView = 'home' | 'history';

type ToastMessage = { message: string; type: 'success' | 'info' | 'error' };

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });
};

const pickImage = (source: 'camera' | 'gallery'): Promise<File> => {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        if (source === 'camera') {
            input.capture = 'environment';
        }

        const handleOnChange = (event: Event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            cleanup();
            if (file) {
                resolve(file);
            } else {
                reject(new Error('Nessun file selezionato.'));
            }
        };
        
        const handleCancel = () => {
             setTimeout(() => {
                if (document.body.contains(input)) {
                     cleanup();
                     reject(new Error('Selezione immagine annullata.'));
                }
            }, 300);
        };
        
        const cleanup = () => {
            input.removeEventListener('change', handleOnChange);
            window.removeEventListener('focus', handleCancel);
            if (document.body.contains(input)) {
                document.body.removeChild(input);
            }
        };

        input.addEventListener('change', handleOnChange);
        window.addEventListener('focus', handleCancel, { once: true });

        input.style.display = 'none';
        document.body.appendChild(input);
        input.click();
    });
};


const App: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const [expenses, setExpenses] = useLocalStorage<Expense[]>('expenses_v2', []);
  const [accounts, setAccounts] = useLocalStorage<Account[]>('accounts_v1', DEFAULT_ACCOUNTS);
  const [activeView, setActiveView] = useState<NavView>('home');
  
  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCalculatorContainerOpen, setIsCalculatorContainerOpen] = useState(false);
  const [isImageSourceModalOpen, setIsImageSourceModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [isMultipleExpensesModalOpen, setIsMultipleExpensesModalOpen] = useState(false);
  const [isParsingImage, setIsParsingImage] = useState(false);
  
  // Data for Modals
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);
  const [prefilledData, setPrefilledData] = useState<Partial<Omit<Expense, 'id'>> | undefined>(undefined);
  const [expenseToDeleteId, setExpenseToDeleteId] = useState<string | null>(null);
  const [multipleExpensesData, setMultipleExpensesData] = useState<Partial<Omit<Expense, 'id'>>[]>([]);
  const [imageForAnalysis, setImageForAnalysis] = useState<OfflineImage | null>(null);

  // Offline & Sync States
  const isOnline = useOnlineStatus();
  const [pendingImages, setPendingImages] = useState<OfflineImage[]>([]);
  const [syncingImageId, setSyncingImageId] = useState<string | null>(null);
  const prevIsOnlineRef = useRef<boolean | undefined>(undefined);

  // UI State
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const pendingImagesCountRef = useRef(0);
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const backPressExitTimeoutRef = useRef<number | null>(null);
  const [isHistoryItemOpen, setIsHistoryItemOpen] = useState(false);
  const [isHistoryItemInteracting, setIsHistoryItemInteracting] = useState(false);
  const [showSuccessIndicator, setShowSuccessIndicator] = useState(false);
  const successIndicatorTimerRef = useRef<number | null>(null);

  const triggerSuccessIndicator = useCallback(() => {
    if (successIndicatorTimerRef.current) {
        clearTimeout(successIndicatorTimerRef.current);
    }
    setShowSuccessIndicator(true);
    successIndicatorTimerRef.current = window.setTimeout(() => {
        setShowSuccessIndicator(false);
        successIndicatorTimerRef.current = null;
    }, 2000);
  }, []);

  const showToast = useCallback((toastMessage: ToastMessage) => {
    setToast(toastMessage);
  }, []);

  const handleNavigation = useCallback((targetView: NavView) => {
    if (activeView === targetView) return;
    setActiveView(targetView);
    window.history.pushState({ view: targetView }, '');
  }, [activeView]);

  // Back button handling logic
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        event.preventDefault();

        // Always push a new state to re-enable our listener for the next back press
        const pushStateAfterHandling = () => window.history.pushState({ view: activeView }, '');

        // Priorità 1: Chiudere le modali aperte
        if (!!imageForAnalysis) {
            setImageForAnalysis(null); // Chiude la modale di analisi
            pushStateAfterHandling();
            return;
        }
        if (isCalculatorContainerOpen) {
            setIsCalculatorContainerOpen(false);
            pushStateAfterHandling();
            return;
        }
        if (isFormOpen) {
            setIsFormOpen(false);
            pushStateAfterHandling();
            return;
        }
        if (isImageSourceModalOpen) {
            setIsImageSourceModalOpen(false);
            pushStateAfterHandling();
            return;
        }
        if (isVoiceModalOpen) {
            setIsVoiceModalOpen(false);
            pushStateAfterHandling();
            return;
        }
        if (isConfirmDeleteModalOpen) {
            setIsConfirmDeleteModalOpen(false);
            pushStateAfterHandling();
            return;
        }
        if (isMultipleExpensesModalOpen) {
            setIsMultipleExpensesModalOpen(false);
            pushStateAfterHandling();
            return;
        }

        // Priorità 2: Tornare alla Home se non ci siamo già
        if (activeView !== 'home') {
            handleNavigation('home');
            // handleNavigation already pushes state
            return;
        }

        // Priorità 3: Uscire dall'app se si è in Home
        if (backPressExitTimeoutRef.current) {
            clearTimeout(backPressExitTimeoutRef.current);
            backPressExitTimeoutRef.current = null;
            window.close(); // Tenta di chiudere la PWA
        } else {
            showToast({ message: 'Premi di nuovo per uscire.', type: 'info' });
            backPressExitTimeoutRef.current = window.setTimeout(() => {
                backPressExitTimeoutRef.current = null;
            }, 2000);
            pushStateAfterHandling();
        }
    };
    
    // Setup initial history state
    window.history.pushState({ view: 'home' }, '');
    window.addEventListener('popstate', handlePopState);

    return () => {
        window.removeEventListener('popstate', handlePopState);
        if (backPressExitTimeoutRef.current) {
            clearTimeout(backPressExitTimeoutRef.current);
        }
    };
}, [
    activeView, handleNavigation, showToast,
    isCalculatorContainerOpen, isFormOpen, isImageSourceModalOpen,
    isVoiceModalOpen, isConfirmDeleteModalOpen, isMultipleExpensesModalOpen,
    imageForAnalysis
]);


  const swipeContainerRef = useRef<HTMLDivElement>(null);
  
  const handleNavigateHome = useCallback(() => {
    if (activeView === 'history') {
        handleNavigation('home');
    }
  }, [activeView, handleNavigation]);

  const { progress, isSwiping } = useSwipe(
    swipeContainerRef,
    {
      onSwipeLeft: activeView === 'home' ? () => handleNavigation('history') : undefined,
      onSwipeRight: activeView === 'history' ? handleNavigateHome : undefined,
    },
    { 
      enabled: !isCalculatorContainerOpen && !isHistoryItemInteracting,
      threshold: 32,
      slop: 6,
      ignoreSelector: '[data-swipeable-item="true"]',
    }
  );
  
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setInstallPromptEvent(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

const handleInstallClick = async () => {
    if (!installPromptEvent) {
        return;
    }
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
    if (outcome === 'accepted') {
        showToast({ message: 'App installata!', type: 'success' });
    } else {
        showToast({ message: 'Installazione annullata.', type: 'info' });
    }
};

  // Funzione per caricare le immagini in coda e gestire le notifiche
  const refreshPendingImages = useCallback(() => {
    getQueuedImages().then(images => {
      setPendingImages(images);
      if (images.length > pendingImagesCountRef.current) {
        showToast({ message: 'Immagine salvata! Pronta per l\'analisi.', type: 'info' });
      }
      pendingImagesCountRef.current = images.length;
    });
  }, [showToast]);

  useEffect(() => {
    refreshPendingImages();
    // Ascolta eventi 'storage' per aggiornare se un'altra scheda (come lo share-target) modifica IndexedDB
    const handleStorageChange = () => {
        refreshPendingImages();
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refreshPendingImages]);

  // Sincronizzazione automatica quando si torna online
  useEffect(() => {
    // Mostra la notifica "Sei online!" solo quando si passa da offline a online.
    if (prevIsOnlineRef.current === false && isOnline && pendingImages.length > 0) {
      showToast({ message: `Sei online! ${pendingImages.length} immagini in attesa.`, type: 'info' });
    }
    // Aggiorna lo stato online precedente per il prossimo render.
    prevIsOnlineRef.current = isOnline;
  }, [isOnline, pendingImages.length, showToast]);

  const addExpense = (newExpense: Omit<Expense, 'id'>) => {
    const expenseWithId: Expense = {
      ...newExpense,
      id: crypto.randomUUID(),
    };
    setExpenses(prev => [expenseWithId, ...prev]);
    triggerSuccessIndicator();
  };

  const updateExpense = (updatedExpense: Expense) => {
    setExpenses(prev => prev.map(e => e.id === updatedExpense.id ? updatedExpense : e));
    triggerSuccessIndicator();
  };
  
  const handleFormSubmit = (data: Omit<Expense, 'id'> | Expense) => {
      if ('id' in data) {
          updateExpense(data);
      } else {
          addExpense(data);
      }
      setIsFormOpen(false);
      setIsCalculatorContainerOpen(false);
      setEditingExpense(undefined);
      setPrefilledData(undefined);
  };
  
  const handleMultipleExpensesSubmit = (expensesToAdd: Omit<Expense, 'id'>[]) => {
      const expensesWithIds: Expense[] = expensesToAdd.map(exp => ({
          ...exp,
          id: crypto.randomUUID(),
      }));
      setExpenses(prev => [...expensesWithIds, ...prev]);
      setIsMultipleExpensesModalOpen(false);
      setMultipleExpensesData([]);
      triggerSuccessIndicator();
  };

  const openEditForm = (expense: Expense) => {
    setEditingExpense(expense);
    setIsFormOpen(true);
  };
  
  const handleDeleteRequest = (id: string) => {
    setExpenseToDeleteId(id);
    setIsConfirmDeleteModalOpen(true);
  };
  
  const confirmDelete = () => {
    if (expenseToDeleteId) {
      setExpenses(prev => prev.filter(e => e.id !== expenseToDeleteId));
      setExpenseToDeleteId(null);
      setIsConfirmDeleteModalOpen(false);
      showToast({ message: 'Spesa eliminata.', type: 'info' });
    }
  };

  const handleImagePick = async (source: 'camera' | 'gallery') => {
    setIsImageSourceModalOpen(false);
    sessionStorage.setItem('preventAutoLock', 'true');
    try {
        const file = await pickImage(source);
        const base64Image = await fileToBase64(file);
        const newImage: OfflineImage = {
            id: crypto.randomUUID(),
            base64Image,
            mimeType: file.type,
        };

        if (isOnline) {
            setImageForAnalysis(newImage);
        } else {
            await addImageToQueue(newImage);
            refreshPendingImages();
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes('annullata')) {
             // L'utente ha annullato, non mostrare errore
        } else {
            console.error('Errore selezione immagine:', error);
            showToast({ message: 'Errore durante la selezione dell\'immagine.', type: 'error' });
        }
    } finally {
        setTimeout(() => sessionStorage.removeItem('preventAutoLock'), 2000); // safety clear
    }
  };
  
  const handleAnalyzeImage = async (image: OfflineImage, fromQueue: boolean = true) => {
      if (!isOnline) {
          showToast({ message: 'Connettiti a internet per analizzare le immagini.', type: 'error' });
          return;
      }
      setSyncingImageId(image.id);
      setIsParsingImage(true);

      try {
          const parsedData = await parseExpensesFromImage(image.base64Image, image.mimeType);
          
          if (parsedData.length === 0) {
              showToast({ message: 'Nessuna spesa trovata nell\'immagine.', type: 'info' });
          } else if (parsedData.length === 1) {
              setPrefilledData(parsedData[0]);
              setIsFormOpen(true);
          } else {
              setMultipleExpensesData(parsedData);
              setIsMultipleExpensesModalOpen(true);
          }
          if (fromQueue) {
            await deleteImageFromQueue(image.id);
            refreshPendingImages();
          }
      } catch (error) {
          console.error('Error durante l\'analisi AI:', error);
          showToast({ message: 'Errore durante l\'analisi dell\'immagine.', type: 'error' });
      } finally {
          setIsParsingImage(false);
          setSyncingImageId(null);
      }
  };

  const handleVoiceParsed = (data: Partial<Omit<Expense, 'id'>>) => {
      setIsVoiceModalOpen(false);
      setPrefilledData(data);
      setIsFormOpen(true);
  };
  
  const handleHistoryItemStateChange = useCallback(({ isOpen, isInteracting }: { isOpen: boolean; isInteracting: boolean; }) => {
    setIsHistoryItemOpen(isOpen);
    setIsHistoryItemInteracting(isInteracting);
  }, []);

  const isEditingOrDeletingInHistory = (isFormOpen && !!editingExpense) || isConfirmDeleteModalOpen;

  const mainContentClasses = isCalculatorContainerOpen
    ? 'pointer-events-none'
    : '';
  
  const baseTranslatePercent = activeView === 'home' ? 0 : -50;
  const dragTranslatePercent = progress * 50;
  const viewTranslate = baseTranslatePercent + dragTranslatePercent;

  return (
    <div className="h-full w-full bg-slate-100 flex flex-col font-sans overflow-hidden">
        <div className={`flex-shrink-0 z-20 ${mainContentClasses}`}>
            <Header
              pendingSyncs={pendingImages.length}
              isOnline={isOnline}
              activeView={activeView}
              onNavigate={handleNavigation}
              onInstallClick={handleInstallClick}
              installPromptEvent={installPromptEvent}
            />
        </div>
        
        <main 
          ref={swipeContainerRef}
          className={`flex-grow overflow-hidden ${mainContentClasses}`}
        >
            <div 
                className="w-[200%] h-full flex swipe-container"
                style={{
                  transform: `translateX(${viewTranslate}%)`,
                  transition: isSwiping ? 'none' : 'transform 0.12s ease-out',
                }}
            >
                <div className="w-1/2 h-full overflow-y-auto space-y-6 swipe-view" style={{ touchAction: 'pan-y' }}>
                    <Dashboard expenses={expenses} onLogout={onLogout} />
                    <PendingImages 
                        images={pendingImages}
                        onAnalyze={(image) => handleAnalyzeImage(image, true)}
                        onDelete={async (id) => {
                            await deleteImageFromQueue(id);
                            refreshPendingImages();
                        }}
                        isOnline={isOnline}
                        syncingImageId={syncingImageId}
                    />
                </div>
                <div className="w-1/2 h-full swipe-view">
                    <HistoryScreen 
                      expenses={expenses}
                      accounts={accounts}
                      onEditExpense={openEditForm}
                      onDeleteExpense={handleDeleteRequest}
                      onItemStateChange={handleHistoryItemStateChange}
                      isEditingOrDeleting={isEditingOrDeletingInHistory}
                      onNavigateHome={handleNavigateHome}
                      isActive={activeView === 'history'}
                    />
                </div>
            </div>
        </main>
      
        {!isCalculatorContainerOpen && (
            <FloatingActionButton
                onAddManually={() => setIsCalculatorContainerOpen(true)}
                onAddFromImage={() => setIsImageSourceModalOpen(true)}
                onAddFromVoice={() => setIsVoiceModalOpen(true)}
                style={{
                  transform: activeView === 'history' ? 'translateY(-70px)' : 'translateY(0)',
                  opacity: 1,
                  transition: 'transform 0.25s cubic-bezier(0.22, 0.61, 0.36, 1)',
                }}
            />
        )}
        
        <SuccessIndicator
            show={showSuccessIndicator}
            style={{
              transform: activeView === 'history' ? 'translateY(-70px)' : 'translateY(0)',
            }}
        />
        
        {toast && (
            <Toast 
                message={toast.message} 
                type={toast.type} 
                onClose={() => setToast(null)} 
            />
        )}
        
        <CalculatorContainer 
            isOpen={isCalculatorContainerOpen}
            onClose={() => setIsCalculatorContainerOpen(false)}
            onSubmit={handleFormSubmit}
            accounts={accounts}
            expenses={expenses}
            onEditExpense={openEditForm}
            onDeleteExpense={handleDeleteRequest}
        />
      
        <ExpenseForm 
            isOpen={isFormOpen}
            onClose={() => { setIsFormOpen(false); setEditingExpense(undefined); setPrefilledData(undefined); }}
            onSubmit={handleFormSubmit}
            initialData={editingExpense}
            prefilledData={prefilledData}
            accounts={accounts}
        />

        {isImageSourceModalOpen && (
           <div
              className={`fixed inset-0 z-50 flex justify-center items-end p-4 transition-opacity duration-300 ease-in-out bg-slate-900/60 backdrop-blur-sm`}
              onClick={() => setIsImageSourceModalOpen(false)}
              aria-modal="true"
              role="dialog"
            >
              <div
                className={`bg-slate-50 rounded-lg shadow-xl w-full max-w-lg transform transition-all duration-300 ease-in-out animate-fade-in-up`}
                onClick={(e) => e.stopPropagation()}
              >
                  <header className="flex justify-between items-center p-6 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">Aggiungi da Immagine</h2>
                     <button
                        type="button"
                        onClick={() => setIsImageSourceModalOpen(false)}
                        className="text-slate-500 hover:text-slate-800 transition-colors p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        aria-label="Chiudi"
                      >
                        <XMarkIcon className="w-6 h-6" />
                      </button>
                  </header>
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ImageSourceCard 
                        icon={<CameraIcon className="w-8 h-8"/>}
                        title="Scatta Foto"
                        description="Usa la fotocamera per una nuova ricevuta."
                        onClick={() => handleImagePick('camera')}
                      />
                      <ImageSourceCard 
                        icon={<ComputerDesktopIcon className="w-8 h-8"/>}
                        title="Scegli da Galleria"
                        description="Carica un'immagine già salvata sul dispositivo."
                        onClick={() => handleImagePick('gallery')}
                      />
                  </div>
              </div>
           </div>
        )}
        
        {isParsingImage && (
            <div className="fixed inset-0 bg-white/80 backdrop-blur-md flex flex-col items-center justify-center z-[100]">
                <SpinnerIcon className="w-12 h-12 text-indigo-600"/>
                <p className="mt-4 text-lg font-semibold text-slate-700 animate-pulse-subtle">Analisi in corso...</p>
            </div>
        )}

        <VoiceInputModal 
            isOpen={isVoiceModalOpen}
            onClose={() => setIsVoiceModalOpen(false)}
            onParsed={handleVoiceParsed}
        />

        <ConfirmationModal 
            isOpen={isConfirmDeleteModalOpen}
            onClose={() => setIsConfirmDeleteModalOpen(false)}
            onConfirm={confirmDelete}
            title="Conferma Eliminazione"
            message={<>Sei sicuro di voler eliminare questa spesa? <br/>L'azione è irreversibile.</>}
            variant="danger"
        />

        <ConfirmationModal
            isOpen={!!imageForAnalysis}
            onClose={() => {
                if (imageForAnalysis) {
                    addImageToQueue(imageForAnalysis).then(() => {
                        refreshPendingImages();
                        setImageForAnalysis(null);
                    });
                }
            }}
            onConfirm={() => {
                if (imageForAnalysis) {
                    handleAnalyzeImage(imageForAnalysis, false);
                    setImageForAnalysis(null);
                }
            }}
            title="Analizza Immagine"
            message="Vuoi analizzare subito questa immagine per rilevare le spese?"
            variant="info"
            confirmButtonText="Analizza Ora"
            cancelButtonText="Più Tardi"
        />
        
        <MultipleExpensesModal 
            isOpen={isMultipleExpensesModalOpen}
            onClose={() => setIsMultipleExpensesModalOpen(false)}
            expenses={multipleExpensesData}
            accounts={accounts}
            onConfirm={handleMultipleExpensesSubmit}
        />

    </div>
  );
};

export default App;