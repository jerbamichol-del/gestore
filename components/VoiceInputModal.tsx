
// src/components/VoiceInputModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Expense } from '../types';
import { parseExpenseFromAudio } from '../utils/ai';
import { XMarkIcon } from './icons/XMarkIcon';
import { MicrophoneIcon } from './icons/MicrophoneIcon';

interface VoiceInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onParsed: (data: Partial<Omit<Expense, 'id'>>) => void;
}

type Status = 'idle' | 'listening' | 'processing' | 'error';

const VoiceInputModal: React.FC<VoiceInputModalProps> = ({
  isOpen,
  onClose,
  onParsed,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Registrazione audio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Ref per tracciare se l'utente ha annullato l'operazione
  const isCancelledRef = useRef(false);

  // Visualizzazione onda
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const visualizerBarRef = useRef<HTMLDivElement | null>(null);

  const stopVisualization = () => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    dataArrayRef.current = null;
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
  };

  const cleanUp = () => {
    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== 'inactive'
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch (e) {
      console.warn('Errore nello stop del MediaRecorder:', e);
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];

    stopVisualization();
  };

  const startVisualization = async (stream: MediaStream) => {
    try {
      const AudioContextCtor =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) {
        console.warn('AudioContext non supportato: niente visualizzazione onda.');
        return;
      }

      const audioCtx = new AudioContextCtor();
      audioContextRef.current = audioCtx;

      if (audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume();
        } catch {
          // può fallire su alcune policy, pazienza
        }
      }

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      sourceNode.connect(analyser);

      analyserRef.current = analyser;
      const bufferLength = analyser.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);

      const visualize = () => {
        if (
          !analyserRef.current ||
          !dataArrayRef.current ||
          !visualizerBarRef.current
        ) {
          return;
        }

        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArrayRef.current[i];
          sum += Math.abs(v - 128);
        }
        const amplitude = sum / bufferLength / 128; // ~0–1
        const scale = 0.2 + amplitude * 1.8; // minimo 0.2, max ~2.0

        visualizerBarRef.current.style.transform = `scaleY(${scale})`;

        animationFrameRef.current = requestAnimationFrame(visualize);
      };

      visualize();
    } catch (e) {
      console.warn('Errore inizializzando la visualizzazione audio:', e);
    }
  };

  const startRecording = async () => {
    setError(null);
    setTranscript('');
    isCancelledRef.current = false; // Reset dello stato di cancellazione

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported(
        'audio/webm;codecs=opus'
      )
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Se l'utente ha annullato (chiuso il modale), non facciamo nulla
        if (isCancelledRef.current) return;

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        setStatus('processing');

        try {
          const parsed = await parseExpenseFromAudio(audioBlob);
          // Controllo ulteriore post-await nel caso l'utente chiuda durante il processing
          if (isCancelledRef.current) return;

          if (
            parsed &&
            typeof parsed.amount === 'number' &&
            !Number.isNaN(parsed.amount)
          ) {
            setTranscript(parsed.description ?? '');
            onParsed({
              description: parsed.description ?? '',
              amount: parsed.amount,
              category: (parsed.category as string) || undefined,
            });
          } else if (parsed && parsed.description) {
            // Ha capito almeno la descrizione, ti faccio precompilare
            setTranscript(parsed.description);
            onParsed({
              description: parsed.description,
              amount: parsed.amount as number | undefined,
              category: (parsed.category as string) || undefined,
            });
          } else {
            setError(
              'Non sono riuscito a capire la spesa. Prova a dire, ad esempio: "25 euro per spesa al supermercato, categoria Spesa".'
            );
            setStatus('error');
            return;
          }
        } catch (e) {
          if (isCancelledRef.current) return;
          console.error('[Voice] Errore durante analisi audio:', e);
          setError("Si è verificato un errore durante l'analisi vocale.");
          setStatus('error');
          return;
        } finally {
          cleanUp();
        }
      };

      mediaRecorder.start();
      setStatus('listening');

      // Avvia anche la visualizzazione onda
      await startVisualization(stream);
    } catch (err) {
      console.error('[Voice] Accesso microfono fallito:', err);
      setError(
        'Accesso al microfono negato. Controlla le autorizzazioni del browser / PWA.'
      );
      setStatus('error');
    }
  };

  const handleStopClick = () => {
    if (status !== 'listening') return;

    // NON settiamo isCancelledRef qui, perché vogliamo che onstop proceda
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  const handleClose = () => {
    // Segnaliamo che l'operazione è annullata, così onstop non farà nulla
    isCancelledRef.current = true;
    cleanUp();
    setStatus('idle');
    setError(null);
    setTranscript('');
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsAnimating(true), 10);
      startRecording();

      return () => {
        clearTimeout(timer);
        // Anche nel cleanup dell'effect, assicuriamoci di annullare
        isCancelledRef.current = true;
        cleanUp();
      };
    } else {
      setIsAnimating(false);
      setStatus('idle');
      setError(null);
      setTranscript('');
      isCancelledRef.current = true;
      cleanUp();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getStatusContent = () => {
    switch (status) {
      case 'listening':
        return {
          icon: (
            <button
              type="button"
              onClick={handleStopClick}
              className="relative w-28 h-28 flex items-center justify-center focus:outline-none"
              aria-label="Termina registrazione e analizza"
            >
              {/* alone “glow” esterno */}
              <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
              {/* cerchio principale con icona microfono */}
              <div className="relative w-24 h-24 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                <MicrophoneIcon className="w-12 h-12 text-white" />
              </div>
              {/* barra visualizzatore a destra */}
              <div className="absolute -right-6 h-20 w-3 rounded-full bg-red-200 overflow-hidden flex items-end">
                <div
                  ref={visualizerBarRef}
                  className="w-full bg-red-600 origin-bottom"
                  style={{ transform: 'scaleY(0.2)' }}
                />
              </div>
            </button>
          ),
          text: 'In ascolto...',
          subtext:
            'Parla vicino al microfono. Quando hai finito, tocca il cerchio rosso per analizzare la spesa.',
        };
      case 'processing':
        return {
          icon: (
            <div className="w-24 h-24 rounded-full bg-indigo-500 flex items-center justify-center">
              <div className="w-12 h-12 animate-spin rounded-full border-4 border-t-transparent border-white" />
            </div>
          ),
          text: 'Elaborazione...',
          subtext: 'Sto analizzando la tua registrazione.',
        };
      case 'error':
        return {
          icon: (
            <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center">
              <XMarkIcon className="w-12 h-12 text-red-500" />
            </div>
          ),
          text: 'Errore',
          subtext: error || 'Qualcosa è andato storto.',
        };
      default:
        return { icon: null, text: '', subtext: '' };
    }
  };

  const { icon, text, subtext } = getStatusContent();

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${
        isAnimating ? 'opacity-100' : 'opacity-0'
      } bg-slate-900/50 backdrop-blur-sm`}
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-slate-50 rounded-lg shadow-xl w-full max-w-lg transform transition-all duration-300 ease-in-out ${
          isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Aggiungi con Voce</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-500 hover:text-slate-800 transition-colors p-1 rounded-full hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Chiudi"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
          {icon}
          <p className="text-xl font-semibold text-slate-800 mt-6">{text}</p>
          <p className="text-slate-500 mt-2">{subtext}</p>

          {transcript && (
            <div className="mt-6 p-3 bg-slate-100 rounded-md w-full text-left">
              <p className="text-sm text-slate-600 font-medium">
                Descrizione rilevata:
              </p>
              <p className="text-slate-800 break-words">{transcript}</p>
            </div>
          )}

          {status === 'error' && (
            <button
              type="button"
              onClick={startRecording}
              className="mt-6 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
            >
              Riprova registrazione
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceInputModal;
