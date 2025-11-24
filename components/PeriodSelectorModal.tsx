
import React, { useState, useEffect } from 'react';
import { XMarkIcon } from './icons/XMarkIcon';
import { CalendarIcon } from './icons/CalendarIcon';

export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

interface PeriodSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (type: PeriodType, date: Date, customRange?: { start: Date; end: Date }) => void;
  initialType: PeriodType;
  initialDate: Date;
  initialCustomRange?: { start: Date; end: Date };
}

const PeriodSelectorModal: React.FC<PeriodSelectorModalProps> = ({
  isOpen,
  onClose,
  onApply,
  initialType,
  initialDate,
  initialCustomRange
}) => {
  const [activeTab, setActiveTab] = useState<PeriodType>(initialType);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [isAnimating, setIsAnimating] = useState(false);

  // Helper per formattare date per input type="date" (YYYY-MM-DD) o "month" (YYYY-MM)
  const toInputFormat = (date: Date, type: 'date' | 'month' = 'date') => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return type === 'month' ? `${y}-${m}` : `${y}-${m}-${d}`;
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialType);
      setSelectedDate(toInputFormat(initialDate, initialType === 'monthly' ? 'month' : 'date'));
      
      if (initialCustomRange) {
        setCustomStart(toInputFormat(initialCustomRange.start));
        setCustomEnd(toInputFormat(initialCustomRange.end));
      } else {
        const today = new Date();
        setCustomStart(toInputFormat(today));
        setCustomEnd(toInputFormat(today));
      }

      const timer = setTimeout(() => setIsAnimating(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen, initialType, initialDate, initialCustomRange]);

  const handleApply = () => {
    let dateObj = new Date();
    let range: { start: Date; end: Date } | undefined = undefined;

    if (activeTab === 'custom') {
      if (!customStart || !customEnd) return; // Validazione base
      const start = new Date(customStart);
      const end = new Date(customEnd);
      // Imposta orari fine giornata per end
      end.setHours(23, 59, 59, 999);
      range = { start, end };
    } else {
      if (!selectedDate) return;
      if (activeTab === 'monthly') {
         const [y, m] = selectedDate.split('-').map(Number);
         dateObj = new Date(y, m - 1, 1);
      } else if (activeTab === 'yearly') {
         // L'input type="number" per anno o simile
         // Qui semplifico usando la data completa ma considerando solo l'anno
         dateObj = new Date(selectedDate); 
      } else {
         dateObj = new Date(selectedDate);
      }
    }

    onApply(activeTab, dateObj, range);
    handleClose();
  };

  const handleClose = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  if (!isOpen && !isAnimating) return null;

  const tabs: { id: PeriodType; label: string }[] = [
    { id: 'daily', label: 'Giorno' },
    { id: 'weekly', label: 'Sett.' },
    { id: 'monthly', label: 'Mese' },
    { id: 'yearly', label: 'Anno' },
    { id: 'custom', label: 'Range' },
  ];

  return (
    <div
      className={`fixed inset-0 z-[60] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-slate-900/60 backdrop-blur-sm`}
      onClick={handleClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm transform transition-all duration-300 ease-in-out ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Seleziona Periodo</h2>
          <button onClick={handleClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-500">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4">
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="space-y-4">
            {activeTab === 'daily' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Seleziona Giorno</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="block w-full rounded-xl border-slate-300 bg-slate-50 border p-3 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            {activeTab === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Seleziona un giorno della settimana</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="block w-full rounded-xl border-slate-300 bg-slate-50 border p-3 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-2">Verrà mostrata l'intera settimana che include questo giorno.</p>
              </div>
            )}

            {activeTab === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Seleziona Mese</label>
                <input
                  type="month"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="block w-full rounded-xl border-slate-300 bg-slate-50 border p-3 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            {activeTab === 'yearly' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Seleziona Anno</label>
                {/* Hack semplice per input anno: usiamo date e prendiamo l'anno, oppure number */}
                <div className="flex gap-2 items-center">
                    <button 
                        onClick={() => {
                            const d = new Date(selectedDate);
                            d.setFullYear(d.getFullYear() - 1);
                            setSelectedDate(toInputFormat(d));
                        }}
                        className="p-3 bg-slate-100 rounded-lg font-bold text-slate-600"
                    >-</button>
                    <div className="flex-1 text-center p-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-lg text-slate-800">
                        {new Date(selectedDate).getFullYear()}
                    </div>
                    <button 
                        onClick={() => {
                            const d = new Date(selectedDate);
                            d.setFullYear(d.getFullYear() + 1);
                            setSelectedDate(toInputFormat(d));
                        }}
                        className="p-3 bg-slate-100 rounded-lg font-bold text-slate-600"
                    >+</button>
                </div>
              </div>
            )}

            {activeTab === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dal</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="block w-full rounded-xl border-slate-300 bg-slate-50 border p-3 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Al</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="block w-full rounded-xl border-slate-300 bg-slate-50 border p-3 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={handleApply}
            className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-colors w-full sm:w-auto"
          >
            Applica Filtro
          </button>
        </div>
      </div>
    </div>
  );
};

export default PeriodSelectorModal;
