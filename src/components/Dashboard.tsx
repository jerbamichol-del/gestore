import React, { useMemo, useState, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { Expense } from '../types';
import { formatCurrency } from './icons/formatters';
import { getCategoryStyle } from '../utils/categoryStyles';
import { ArrowsUpDownIcon } from './icons/ArrowsUpDownIcon';
import { ArrowDownTrayIcon } from './icons/ArrowDownTrayIcon';
import { ArrowUpTrayIcon } from './icons/ArrowUpTrayIcon';
import { ArrowPathIcon } from './icons/ArrowPathIcon'; 
import { XMarkIcon } from './icons/XMarkIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ProgrammateDetailedIcon } from './icons/ProgrammateDetailedIcon'; 
import { ExpensesDetailedIcon } from './icons/ExpensesDetailedIcon'; 
import { IncomeDetailedIcon } from './icons/IncomeDetailedIcon'; 
import { AccountsDetailedIcon } from './icons/AccountsDetailedIcon';
import { exportExpenses } from '../utils/fileHelper';
import { useTapBridge } from '../hooks/useTapBridge';
import { parseLocalYYYYMMDD, toYYYYMMDD } from '../utils/date';
import { 
    QuickFilterControl, 
    PeriodNavigator, 
    CustomDateRangeInputs, 
    DateFilter, 
    PeriodType 
} from './HistoryFilterCard';
import { useSwipe } from '../hooks/useSwipe';
import { BudgetTrendChart } from './BudgetTrendChart';
import { EyeIcon } from './icons/EyeIcon';
import { EyeSlashIcon } from './icons/EyeSlashIcon';

const categoryHexColors: Record<string, string> = {
    'Trasporti': '#64748b',
    'Casa': '#1e3a8a',
    'Shopping': '#9333ea',
    'Alimentari': '#84cc16',
    'Salute': '#06b6d4',
    'Altro': '#78350f',
    'Beneficienza': '#dc2626',
    'Lavoro': '#2563eb',
    'Istruzione': '#16a34a',
    'Tempo Libero': '#eab308',
};
const DEFAULT_COLOR = '#78350f'; 

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;

  if (!payload) return null;

  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#1e293b" className="text-base font-bold">
        {payload.name}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill={fill} className="text-lg font-extrabold">
        {formatCurrency(payload.value)}
      </text>
      <text x={cx} y={cy + 32} textAnchor="middle" fill="#334155" className="text-sm font-bold">
        {`(${(percent * 100).toFixed(2)}%)`}
      </text>
      
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        stroke="none"
      />
    </g>
  );
};

interface DashboardProps {
  expenses: Expense[];
  recurringExpenses: Expense[];
  onNavigateToRecurring: () => void;
  onNavigateToHistory: () => void;
  onNavigateToIncomes?: () => void;
  onNavigateToAccounts?: () => void;
  onImportFile: (file: File) => void;
  onReceiveSharedFile?: (file: File) => void | Promise<void>;
  onSync: () => Promise<void> | void;
  isBalanceVisible: boolean;
  onToggleBalanceVisibility: () => void;
}

const calculateNextDueDate = (template: Expense, fromDate: Date): Date | null => {
  if (template.frequency !== 'recurring' || !template.recurrence) return null;
  const interval = template.recurrenceInterval || 1;
  const nextDate = new Date(fromDate);

  switch (template.recurrence) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7 * interval);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + interval);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + interval);
      break;
    default:
      return null;
  }
  return nextDate;
};

const Dashboard: React.FC<DashboardProps> = ({ 
    expenses, 
    recurringExpenses, 
    onNavigateToRecurring, 
    onNavigateToHistory, 
    onNavigateToIncomes, 
    onNavigateToAccounts,
    onImportFile, 
    onSync,
    isBalanceVisible,
    onToggleBalanceVisibility
}) => {
  const tapBridgeHandlers = useTapBridge();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeViewIndex, setActiveViewIndex] = useState(1); 
  const [quickFilter, setQuickFilter] = useState<DateFilter>('30d');
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [periodDate, setPeriodDate] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);
  const [isImportExportMenuOpen, setIsImportExportMenuOpen] = useState(false);
  const [showExportOptions, setShowExportOptions] = useState(false);

  const activeIndex = selectedIndex;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerContainerRef = useRef<HTMLDivElement>(null);

  const handleLegendItemClick = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedIndex(current => (current === index ? null : index));
  };
  
  const handleChartBackgroundClick = () => setSelectedIndex(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          onImportFile(e.target.files[0]);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleNavigateToRecurring = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.blur();
      onNavigateToRecurring();
  };

  const handleNavigateToHistory = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.blur();
      onNavigateToHistory();
  };

  const handleNavigateToIncomes = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.blur();
      onNavigateToIncomes?.();
  };

  const handleNavigateToAccounts = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.currentTarget.blur();
      onNavigateToAccounts?.();
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        const modal = event.state?.modal;
        if (modal === 'import_export_main') {
            setIsImportExportMenuOpen(true);
            setShowExportOptions(false);
        } else if (modal === 'import_export_format') {
            setIsImportExportMenuOpen(true);
            setShowExportOptions(true);
        } else {
            setIsImportExportMenuOpen(false);
            setShowExportOptions(false);
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const openImportExportMenu = () => {
      window.history.pushState({ modal: 'import_export_main' }, '');
      setIsImportExportMenuOpen(true);
      setShowExportOptions(false);
  };

  const openExportOptions = () => {
      window.history.pushState({ modal: 'import_export_format' }, '');
      setShowExportOptions(true);
  };

  const handleBackNavigation = () => window.history.back();

  const handleCloseNavigation = () => {
      if (showExportOptions) window.history.go(-2);
      else window.history.back();
  };

  const handleImportClick = () => {
      window.history.back();
      setTimeout(() => fileInputRef.current?.click(), 100);
  };

  const handleExportClick = (format: 'excel' | 'json') => {
      exportExpenses(expenses, format);
      window.history.go(-2);
  };
  
  const handleSyncClick = async () => {
      window.history.back();
      await onSync();
  };

  useEffect(() => {
      if (!isImportExportMenuOpen) setTimeout(() => setShowExportOptions(false), 300);
  }, [isImportExportMenuOpen]);

  const { progress } = useSwipe(headerContainerRef, {
      onSwipeLeft: () => {
          if (activeViewIndex < 2 && !isPeriodMenuOpen) {
              setActiveViewIndex(prev => prev + 1);
              setIsSwipeAnimating(true);
          }
      },
      onSwipeRight: () => {
          if (activeViewIndex > 0 && !isPeriodMenuOpen) {
              setActiveViewIndex(prev => prev - 1);
              setIsSwipeAnimating(true);
          }
      }
  }, { threshold: 40, slop: 10, enabled: !isPeriodMenuOpen });

  useEffect(() => {
      if (isSwipeAnimating) {
          const timer = setTimeout(() => setIsSwipeAnimating(false), 200);
          return () => clearTimeout(timer);
      }
  }, [isSwipeAnimating]);

  useEffect(() => {
      setIsPeriodMenuOpen(false);
  }, [activeViewIndex]);

  const { totalExpenses, totalIncome, netBudget, dailyTotal, categoryData, recurringCountInPeriod, periodLabel, dateRangeLabel } = useMemo(() => {
    const safeExpenses = expenses || [];
    const validExpenses = safeExpenses.filter(e => e.amount != null && !isNaN(Number(e.amount)));
    const now = new Date();
    
    const todayString = toYYYYMMDD(now);
    const daily = validExpenses
        .filter(expense => expense.date === todayString && expense.type === 'expense')
        .reduce((acc, expense) => acc + Number(expense.amount), 0);

    let start: Date, end: Date, label: string, rangeLabel = '';

    if (activeViewIndex === 0) { 
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        
        switch(quickFilter) {
            case '7d': start.setDate(start.getDate() - 6); label = "Ultimi 7 Giorni"; break;
            case '30d': start.setDate(start.getDate() - 29); label = "Ultimi 30 Giorni"; break;
            case '6m': start.setMonth(start.getMonth() - 6); label = "Ultimi 6 Mesi"; break;
            case '1y': start.setFullYear(start.getFullYear() - 1); label = "Ultimo Anno"; break;
            default: label = "Tutto"; start = new Date(0); break;
        }
        const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
        rangeLabel = `${start.toLocaleDateString('it-IT', opts)} - Oggi`;

    } else if (activeViewIndex === 2) { 
        if (customRange.start && customRange.end) {
            start = parseLocalYYYYMMDD(customRange.start);
            end = parseLocalYYYYMMDD(customRange.end);
            end.setHours(23, 59, 59, 999);
            label = "Periodo Personalizzato";
            const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
            const yOpts: Intl.DateTimeFormatOptions = { year: '2-digit' };
            rangeLabel = `${start.toLocaleDateString('it-IT', opts)} - ${end.toLocaleDateString('it-IT', yOpts)}`;
        } else {
            start = new Date();
            end = new Date();
            label = "Seleziona Date";
            rangeLabel = "-";
        }
    } else { 
        start = new Date(periodDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(periodDate);
        end.setHours(23, 59, 59, 999);

        if (periodType === 'day') {
            const isToday = toYYYYMMDD(start) === toYYYYMMDD(now);
            label = isToday ? "Spesa di Oggi" : "Spesa Giornaliera";
            rangeLabel = start.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' });
        } else if (periodType === 'week') {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            label = "Spesa Settimanale";
            rangeLabel = `${start.getDate()} ${start.toLocaleString('it-IT', { month: 'short' })} - ${end.getDate()} ${end.toLocaleString('it-IT', { month: 'short' })}`;
        } else if (periodType === 'month') {
            start.setDate(1);
            end = new Date(start);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
            end.setHours(23, 59, 59, 999);
            label = "Spesa Mensile";
            rangeLabel = start.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
        } else {
            start.setMonth(0, 1);
            end = new Date(start);
            end.setFullYear(end.getFullYear() + 1);
            end.setMonth(0, 0);
            end.setHours(23, 59, 59, 999);
            label = "Spesa Annuale";
            rangeLabel = start.getFullYear().toString();
        }
    }
    
    const periodTransactions = validExpenses.filter(e => {
        const expenseDate = parseLocalYYYYMMDD(e.date);
        return expenseDate >= start && expenseDate <= end;
    });
        
    const periodExpenses = periodTransactions.filter(e => e.type === 'expense');
    const periodIncome = periodTransactions.filter(e => e.type === 'income');
    const periodAdjustments = periodTransactions.filter(e => e.type === 'adjustment');

    const totalExp = periodExpenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const totalInc = periodIncome.reduce((acc, e) => acc + Number(e.amount), 0);
    const totalAdj = periodAdjustments.reduce((acc, e) => acc + Number(e.amount), 0);
    
    const budget = totalInc - totalExp + totalAdj;
    
    let recurringCount = 0;
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        recurringExpenses.forEach(template => {
            if (!template.date) return;
            const totalGenerated = safeExpenses.filter(e => e.recurringExpenseId === template.id).length;
            if (template.recurrenceEndType === 'count' && template.recurrenceCount && totalGenerated >= template.recurrenceCount) return;
            if (template.recurrenceEndType === 'date' && template.recurrenceEndDate && template.lastGeneratedDate && template.lastGeneratedDate >= template.recurrenceEndDate) return;

            let nextDue = parseLocalYYYYMMDD(template.date);
            let simulatedOccurrences = 0; 
            while (nextDue) {
                if (nextDue > end) break;
                if (template.recurrenceEndType === 'date' && template.recurrenceEndDate && toYYYYMMDD(nextDue) > template.recurrenceEndDate) break;
                if (template.recurrenceEndType === 'count' && template.recurrenceCount && simulatedOccurrences >= template.recurrenceCount) break; 

                if (nextDue >= start) recurringCount++;
                
                simulatedOccurrences++;
                nextDue = calculateNextDueDate(template, nextDue);
            }
        });
    }
        
    const categoryTotals = periodExpenses.reduce((acc: Record<string, number>, expense) => {
      const category = expense.category || 'Altro';
      acc[category] = (acc[category] || 0) + Number(expense.amount);
      return acc;
    }, {} as Record<string, number>);

    const sortedCategoryData = Object.entries(categoryTotals)
        .map(([name, value]) => ({ name, value: value as number }))
        .sort((a, b) => b.value - a.value);

    return { 
        totalExpenses: totalExp, 
        totalIncome: totalInc,
        netBudget: budget,
        dailyTotal: daily,
        categoryData: sortedCategoryData,
        recurringCountInPeriod: recurringCount,
        periodLabel: label,
        dateRangeLabel: rangeLabel
    };
  }, [expenses, recurringExpenses, activeViewIndex, quickFilter, periodType, periodDate, customRange]);
  
  const listTx = -activeViewIndex * (100 / 3);
  
  return (
    <>
        <div className="md:p-6 pb-32 md:pb-32 space-y-6" {...tapBridgeHandlers}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 flex flex-col gap-4">
                    <div className="bg-white p-6 md:rounded-2xl shadow-lg flex flex-col justify-between relative">
                        <div className="text-center mb-2 relative z-10">
                            <h3 className="text-lg font-bold text-black leading-tight uppercase tracking-wide">{periodLabel}</h3>
                            <p className="text-sm font-medium text-slate-400 capitalize mb-1">{dateRangeLabel}</p>
                            <div className="relative flex justify-center items-center text-indigo-600 mt-1">
                                <div className="relative flex items-baseline">
                                    <span className="absolute right-full mr-2 text-3xl font-semibold opacity-80 top-1/2 -translate-y-1/2">€</span>
                                    <span className="text-5xl font-extrabold tracking-tight">
                                        {formatCurrency(totalExpenses).replace('€', '').trim()}
                                    </span>
                                </div>
                                {recurringCountInPeriod > 0 && (
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                        <span className="w-8 h-8 flex items-center justify-center text-xs font-bold text-slate-900 bg-amber-100 border border-amber-400 rounded-lg shadow-sm" title="Spese programmate in arrivo">
                                            {recurringCountInPeriod}P
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mb-2 relative z-20 mx-5" ref={headerContainerRef} style={{ touchAction: 'pan-y' }}>
                            <div className={`relative ${isPeriodMenuOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
                                <div 
                                    className="w-[300%] flex transition-transform duration-300 ease-out"
                                    style={{ transform: `translateX(${listTx}%)` }}
                                >
                                    <div className={`w-1/3 px-1 ${isPeriodMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                        <QuickFilterControl 
                                            isActive={activeViewIndex === 0}
                                            currentValue={quickFilter}
                                            onSelect={(v) => { setQuickFilter(v); setActiveViewIndex(0); }}
                                            compact={true}
                                        />
                                    </div>
                                    <div className="w-1/3 px-1 relative z-20">
                                        <PeriodNavigator 
                                            isActive={activeViewIndex === 1}
                                            periodType={periodType}
                                            periodDate={periodDate}
                                            onTypeChange={setPeriodType}
                                            onDateChange={setPeriodDate}
                                            onActivate={() => setActiveViewIndex(1)}
                                            isMenuOpen={isPeriodMenuOpen}
                                            onMenuToggle={setIsPeriodMenuOpen}
                                            isPanelOpen={true}
                                            compact={true}
                                        />
                                    </div>
                                    <div className={`w-1/3 px-1 ${isPeriodMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                        <CustomDateRangeInputs 
                                            isActive={activeViewIndex === 2}
                                            range={customRange}
                                            onChange={(r) => { setCustomRange(r); setActiveViewIndex(2); }}
                                            compact={true}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-center items-center mt-3 gap-2">
                                {[0, 1, 2].map((i) => (
                                    <button
                                        key={i}
                                        onClick={() => setActiveViewIndex(i)}
                                        className={`w-2 h-2 rounded-full transition-colors ${activeViewIndex === i ? 'bg-indigo-600' : 'bg-slate-300 hover:bg-slate-400'}`}
                                        aria-label={`Vai alla pagina filtri ${i + 1}`}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-200 relative z-10">
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium text-slate-500">Spesa Oggi</h4>
                                    <p className="text-xl font-bold text-slate-800">{formatCurrency(dailyTotal)}</p>
                                </div>
                                <div className="w-px h-12 bg-slate-200" /> 
                                <div className="flex-1 flex flex-col">
                                    <div className="flex justify-between items-center mb-1">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); onToggleBalanceVisibility(); }}
                                            className="p-2 -ml-2 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            aria-label={isBalanceVisible ? "Nascondi saldo" : "Mostra saldo"}
                                        >
                                            {isBalanceVisible ? <EyeSlashIcon className="w-6 h-6" /> : <EyeIcon className="w-6 h-6" />}
                                        </button>
                                        <h4 className="text-sm font-medium text-slate-400 cursor-default select-none">Saldo</h4>
                                    </div>
                                    <p className={`text-xl font-bold text-right ${!isBalanceVisible ? 'text-slate-800' : netBudget >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {isBalanceVisible ? (
                                            <>
                                                {netBudget >= 0 ? '+' : ''}{formatCurrency(netBudget)}
                                            </>
                                        ) : (
                                            '******'
                                        )}
                                    </p>
                                </div>
                            </div>

                            <div 
                                className="mt-4 flex gap-3 overflow-x-auto py-2 -mx-6 px-6 no-scrollbar" 
                                style={{ 
                                    scrollbarWidth: 'none', 
                                    msOverflowStyle: 'none',
                                    WebkitOverflowScrolling: 'touch',
                                    touchAction: 'pan-x pan-y'
                                }}
                            >
                                <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
                                <button onClick={handleNavigateToRecurring} className="flex-none flex items-center justify-center gap-2 py-1 px-3 text-center font-semibold text-slate-900 bg-amber-100 rounded-full hover:bg-amber-200 focus:outline-none active:scale-95 active:bg-amber-200 active:ring-2 active:ring-offset-2 active:ring-amber-500 transition-all border border-amber-400">
                                    <ProgrammateDetailedIcon className="w-7 h-7" /> <span className="text-sm">Programmate</span>
                                </button>
                                <button onClick={handleNavigateToHistory} className="flex-none flex items-center justify-center gap-2 py-1 px-3 text-center font-semibold text-indigo-900 bg-indigo-100 rounded-full hover:bg-indigo-200 focus:outline-none active:scale-95 active:bg-indigo-200 active:ring-2 active:ring-offset-2 active:ring-indigo-500 transition-all border border-indigo-200">
                                    <ExpensesDetailedIcon className="w-7 h-7" /> <span className="text-sm">Spese</span>
                                </button>
                                <button onClick={handleNavigateToIncomes} className={`flex-none flex items-center justify-center gap-2 py-1 px-3 text-center font-semibold text-emerald-900 bg-emerald-100 rounded-full hover:bg-emerald-200 focus:outline-none active:scale-95 active:bg-emerald-200 active:ring-2 active:ring-offset-2 active:ring-emerald-500 transition-all border border-emerald-200 ${!isBalanceVisible ? 'opacity-50 grayscale' : ''}`}>
                                    <IncomeDetailedIcon className="w-7 h-7" /> <span className="text-sm">Entrate</span>
                                </button>
                                <button onClick={handleNavigateToAccounts} className={`flex-none flex items-center justify-center gap-2 py-1 px-3 text-center font-semibold text-sky-900 bg-sky-100 rounded-full hover:bg-sky-200 focus:outline-none active:scale-95 active:bg-sky-200 active:ring-2 active:ring-offset-2 active:ring-sky-500 transition-all border border-sky-200 ${!isBalanceVisible ? 'opacity-50 grayscale' : ''}`}>
                                    <AccountsDetailedIcon className="w-7 h-7" /> <span className="text-sm">Conti</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <input type="file" ref={fileInputRef} className="hidden" accept=".csv, .xlsx, .xls, .json" onChange={handleFileChange} />
                    <button onClick={openImportExportMenu} className="w-auto mx-4 md:mx-0 flex items-center justify-center gap-3 py-3 px-4 bg-indigo-50 text-indigo-700 font-bold rounded-2xl border border-indigo-100 shadow-sm hover:bg-indigo-100 transition-colors">
                        <ArrowsUpDownIcon className="w-6 h-6" /> Imp/Exp (CSV/Excel/JSON)
                    </button>
                </div>

                <div className="lg:col-span-2 flex flex-col gap-6">
                    <div className="bg-white p-6 md:rounded-2xl shadow-lg flex flex-col">
                        <div className="mb-4">
                            <h3 className="text-xl font-bold text-slate-700">Riepilogo Categorie</h3>
                            <p className="text-sm text-slate-500 font-medium capitalize">{dateRangeLabel}</p>
                        </div>
                        
                        {categoryData.length > 0 ? (
                            <div className="space-y-4 flex-grow">
                                {categoryData.map(cat => {
                                    const style = getCategoryStyle(cat.name);
                                    const percentage = totalExpenses > 0 ? (cat.value / totalExpenses) * 100 : 0;
                                    return (
                                        <div key={cat.name} className="flex items-center gap-4 text-base">
                                            <style.Icon className="w-10 h-10 flex-shrink-0" />
                                            <div className="flex-grow">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="font-semibold text-slate-700">{style.label}</span>
                                                    <span className="font-bold text-slate-800">{formatCurrency(cat.value)}</span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-2.5">
                                                    <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : <p className="text-center text-slate-500 flex-grow flex items-center justify-center">Nessuna spesa registrata in questo periodo.</p>}
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 md:rounded-2xl shadow-lg">
                <div className="mb-2 text-center">
                    <h3 className="text-xl font-bold text-slate-700">Spese per Categoria</h3>
                    <p className="text-sm text-slate-500 font-medium capitalize">{dateRangeLabel}</p>
                </div>
                
                {categoryData.length > 0 ? (
                    <div className="relative cursor-pointer" onClick={handleChartBackgroundClick}>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                            <Pie
                                data={categoryData}
                                cx="50%"
                                cy="50%"
                                innerRadius={68}
                                outerRadius={102}
                                fill="#8884d8"
                                paddingAngle={2}
                                dataKey="value"
                                nameKey="name"
                                {...({ activeIndex: activeIndex ?? undefined } as any)}
                                activeShape={renderActiveShape}
                            >
                                {categoryData.map((entry) => (
                                <Cell key={`cell-${entry.name}`} fill={categoryHexColors[entry.name] || DEFAULT_COLOR} />
                                ))}
                            </Pie>
                            </PieChart>
                        </ResponsiveContainer>
                        {activeIndex === null && (
                            <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
                                <span className="text-slate-800 text-base font-bold">Totale</span>
                                <span className="text-2xl font-extrabold text-slate-800 mt-1">
                                    {formatCurrency(totalExpenses)}
                                </span>
                            </div>
                        )}
                    </div>
                ) : <p className="text-center text-slate-500 py-16">Nessun dato da visualizzare.</p>}

                {categoryData.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex flex-wrap justify-center gap-x-4 gap-y-3">
                        {categoryData.map((entry, index) => {
                            const style = getCategoryStyle(entry.name);
                            return (
                            <button
                                key={`item-${index}`}
                                onClick={(e) => handleLegendItemClick(index, e)}
                                className={`flex items-center gap-3 p-2 rounded-full text-left transition-all duration-200 bg-slate-100 hover:bg-slate-200`}
                            >
                                <style.Icon className="w-8 h-8 flex-shrink-0" />
                                <div className="min-w-0 pr-2">
                                    <p className={`font-semibold text-sm truncate text-slate-700`}>{style.label}</p>
                                </div>
                            </button>
                            );
                        })}
                        </div>
                    </div>
                )}
            </div>

            <BudgetTrendChart 
                expenses={expenses}
                periodType={periodType}
                periodDate={periodDate}
                activeViewIndex={activeViewIndex}
                quickFilter={quickFilter}
                customRange={customRange}
            />
        </div>

        {isImportExportMenuOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={handleCloseNavigation}>
                <div 
                    className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in-up" 
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center p-4 border-b border-slate-100">
                        {showExportOptions && (
                            <button onClick={handleBackNavigation} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-500" aria-label="Indietro">
                                <ArrowLeftIcon className="w-5 h-5" />
                            </button>
                        )}
                        <h3 className={`text-lg font-bold text-slate-800 flex-1 text-center ${showExportOptions ? '' : 'pl-8'}`}>
                            {showExportOptions ? "Scegli Formato" : "Gestione Dati"}
                        </h3>
                        <button onClick={handleCloseNavigation} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="p-4 space-y-3">
                        {!showExportOptions ? (
                            <>
                                <button onClick={handleSyncClick} className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left group">
                                    <div className="w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600 group-hover:scale-110 transition-transform">
                                        <ArrowPathIcon className="w-6 h-6" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-700 text-lg">Sincronizza Cloud</span>
                                        <span className="text-xs text-slate-500">Scarica ultimi dati dal cloud</span>
                                    </div>
                                </button>
                                <button onClick={handleImportClick} className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left group">
                                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                                        <ArrowDownTrayIcon className="w-6 h-6" />
                                    </div>
                                    <span className="font-semibold text-slate-700 text-lg">Importa (CSV/Excel/JSON)</span>
                                </button>
                                <button onClick={openExportOptions} className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left group">
                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                        <ArrowUpTrayIcon className="w-6 h-6" />
                                    </div>
                                    <span className="font-semibold text-slate-700 text-lg">Esporta (Excel/JSON)</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => handleExportClick('excel')} className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left group">
                                    <div className="w-12 h-12 flex-shrink-0 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                                        <span className="font-bold text-sm">XLSX</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-700 text-lg">Excel (.xlsx)</span>
                                        <span className="text-xs text-slate-500">Le ricevute non verranno salvate</span>
                                    </div>
                                </button>
                                <button onClick={() => handleExportClick('json')} className="w-full flex items-center gap-4 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors text-left group">
                                    <div className="w-12 h-12 flex-shrink-0 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 group-hover:scale-110 transition-transform">
                                        <span className="font-bold text-sm">JSON</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-slate-700 text-lg">JSON (.json)</span>
                                        <span className="text-xs text-slate-500">Backup completo dell'app</span>
                                    </div>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default Dashboard;
