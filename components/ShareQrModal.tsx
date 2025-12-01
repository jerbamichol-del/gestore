import React, { useState, useEffect } from 'react';
import QRCode from "react-qr-code";
import { XMarkIcon } from './icons/XMarkIcon';

interface ShareQrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShareQrModal: React.FC<ShareQrModalProps> = ({ isOpen, onClose }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  // Legge l'URL attuale del browser per generare il QR
  const url = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[6000] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-slate-900/60 backdrop-blur-sm`}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-white rounded-lg shadow-xl w-full max-w-sm transform transition-all duration-300 ease-in-out ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-800">Condividi App</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-full hover:bg-slate-200">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-8 flex flex-col items-center justify-center space-y-6">
            <div className="p-4 bg-white border-2 border-slate-100 rounded-xl shadow-sm">
                <QRCode 
                    value={url} 
                    size={200}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    viewBox={`0 0 256 256`}
                />
            </div>
            <p className="text-center text-slate-600 text-sm">
                Scansiona questo codice per aprire e installare l'app su un altro dispositivo.
            </p>
        </div>
      </div>
    </div>
  );
};

export default ShareQrModal;
