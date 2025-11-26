
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { Expense } from '../types';
import { formatCurrency } from './icons/formatters';
import { getCategoryStyle } from '../utils/categoryStyles';
import { useTapBridge } from '../hooks/useTapBridge';
import { CloudArrowUpIcon } from './icons/CloudArrowUpIcon';
// Import components from HistoryFilterCard
import { 
    QuickFilterControl, 
    PeriodNavigator, 
    CustomDateRangeInputs,
    DateFilter,
    PeriodType
} from './HistoryFilterCard';
import { useSwipe } from '../hooks/useSwipe';

const categoryHexColors: Record<string, string> = {
    'Alimentari': '#16a34a', // green-600
    'Trasporti': '#2563eb', // blue-600
    'Casa': '#ea580c', // orange-600
    'Shopping': '#db2777', // pink-600
    'Tempo Libero': '#9333ea', // purple-600
    'Salute': '#dc2626', // red-600
    'Istruzione': '#ca8a04', // yellow-600
    'Lavoro': '#4f46e5', // indigo-600
    'Altro': '#4b5563', // gray-600
};
const DEFAULT_COLOR = '#4b5563';

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
  onImportFile: (file: File) => void;
}

const parseLocalYYYYMMDD = (s: string): Date => {
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
};

const toYYYYMMDD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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

const Dashboard: React.FC<DashboardProps> = ({ expenses, recurringExpenses, onNavigateToRecurring, onNavigateToHistory, onImportFile }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  // View State for Filter Swiper (0: Quick, 1: Period, 2: Custom)
  const [activeViewIndex, setActiveViewIndex] = useState(1); // Default to Period view (middle)
  
  // Filter States
  const [quickFilter, setQuickFilter] = useState<DateFilter>('30d');
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [periodDate, setPeriodDate] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
  
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false);
  const [isSwipeAnimating, setIsSwipeAnimating] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const tapBridge = useTapBridge();
  const activeIndex = selectedIndex;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerContainerRef = useRef<HTMLDivElement>(null);

  const handleLegendItemClick = (index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedIndex(current => (current === index ? null : index));
  };
  
  const handleChartBackgroundClick = () => {
    setSelectedIndex(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          onImportFile(e.target.files[0]);
      }
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };

  // Swipe Handler for Header
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

  // Reset menu when swiping
  useEffect(() => {
      setIsPeriodMenuOpen(false);
  }, [activeViewIndex]);

  const { totalExpenses, dailyTotal, categoryData, recurringCountInPeriod, periodLabel, dateRangeLabel } = useMemo(() => {
    const validExpenses = expenses.filter(e => e.amount != null && !isNaN(Number(e.amount)));
    const now = new Date();
    
    // Daily total (always relative to today for the small text)
    const todayString = toYYYYMMDD(now);
    const daily = validExpenses
        .filter(expense => expense.date === todayString)
        .reduce((acc, expense) => acc + Number(expense.amount), 0);

    let start: Date, end: Date, label: string, rangeLabel = '';

    // Filter Logic based on Active View
    if (activeViewIndex === 0) { // Quick Filters
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

    } else if (activeViewIndex === 2) { // Custom Range
        if (customRange.start && customRange.end) {
            start = parseLocalYYYYMMDD(customRange.start);
            end = parseLocalYYYYMMDD(customRange.end);
            end.setHours(23, 59, 59, 999);
            label = "Periodo Personalizzato";
            const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
            const yOpts: Intl.DateTimeFormatOptions = { year: '2-digit' };
            rangeLabel = `${start.toLocaleDateString('it-IT', opts)} - ${end.toLocaleDateString('it-IT', opts)} '${end.toLocaleDateString('it-IT', yOpts)}`;
        } else {
            // Fallback if range not set
            start = new Date();
            end = new Date();
            label = "Seleziona Date";
            rangeLabel = "-";
        }
    } else { // Period View (Default)
        start = new Date(periodDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(periodDate);
        end.setHours(23, 59, 59, 999);

        if (periodType === 'day') {
            const isToday = toYYYYMMDD(start) === toYYYYMMDD(now);
            label = isToday ? "Spesa di Oggi" : "Spesa Giornaliera";
            rangeLabel = start.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' });
        } else if (periodType === 'week') { // Changed 'weekly' to 'week' to match PeriodType
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            label = "Spesa Settimanale";
            rangeLabel = `${start.getDate()} ${start.toLocaleString('it-IT', { month: 'short' })} - ${end.getDate()} ${end.toLocaleString('it-IT', { month: 'short' })}`;
        } else if (periodType === 'month') { // 'month'
            start.setDate(1);
            end = new Date(start);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
            end.setHours(23, 59, 59, 999);
            label = "Spesa Mensile";
            rangeLabel = start.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
        } else { // 'year'
            start.setMonth(0, 1);
            end = new Date(start);
            end.setFullYear(end.getFullYear() + 1);
            end.setMonth(0, 0);
            end.setHours(23, 59, 59, 999);
            label = "Spesa Annuale";
            rangeLabel = start.getFullYear().toString();
        }
    }
    
    const periodExpenses = validExpenses.filter(e => {
        const expenseDate = parseLocalYYYYMMDD(e.date);
        return expenseDate >= start && expenseDate <= end;
    });
        
    const total = periodExpenses.reduce((acc, expense) => acc + Number(expense.amount), 0);
    
    // Recurring count logic
    let recurringCount = 0;
    // Only calc if valid dates
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        recurringExpenses.forEach(template => {
            if (!template.date) return;
            const totalGenerated = expenses.filter(e => e.recurringExpenseId === template.id).length;
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
        totalExpenses: total, 
        dailyTotal: daily,
        categoryData: sortedCategoryData,
        recurringCountInPeriod: recurringCount,
        periodLabel: label,
        dateRangeLabel: rangeLabel
    };
  }, [expenses, recurringExpenses, activeViewIndex, quickFilter, periodType, periodDate, customRange]);
  
  const listTx = -activeViewIndex * (100 / 3);
  
  return (
    <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 flex flex-col gap-4">
                {/* Modificato: Rimosso overflow-hidden dalla card principale */}
                <div className="bg-white p-6 rounded-2xl shadow-lg flex flex-col justify-between relative">
                    
                    {/* Totals Section (Spostata SOPRA i filtri) */}
                    <div className="text-center mb-2 relative z-10">
                        <h3 className="text-lg font-bold text-black leading-tight uppercase tracking-wide">{periodLabel}</h3>
                        <p className="text-sm font-medium text-slate-400 capitalize mb-1">{dateRangeLabel}</p>
                        
                        {/* Importo Centrato con Euro accanto */}
                        <div className="relative flex justify-center items-center text-indigo-600 mt-1">
                            <div className="relative flex items-baseline">
                                <span className="absolute right-full mr-2 text-3xl font-semibold opacity-80 top-1/2 -translate-y-1/2">€</span>
                                <span className="text-5xl font-extrabold tracking-tight">
                                    {formatCurrency(totalExpenses).replace('€', '').trim()}
                                </span>
                            </div>
                            
                            {/* Recurring indicator - Right Edge Square */}
                            {recurringCountInPeriod > 0 && (
                                <div className="absolute right-0 top-1/2 -translate-y-1/2">
                                     <span className="w-8 h-8 flex items-center justify-center text-xs font-bold text-slate-900 bg-amber-100 border border-amber-400 rounded-lg shadow-sm" title="Spese programmate in arrivo">
                                        {recurringCountInPeriod}P
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Filter Container - (Spostata SOTTO l'importo) */}
                    <div className="mb-2 relative z-20 mx-5" ref={headerContainerRef} style={{ touchAction: 'pan-y' }}>
                        {/* Modificato: overflow-hidden diventa condizionale */}
                        <div className={`relative ${isPeriodMenuOpen ? 'overflow-visible' : 'overflow-hidden'}`}>
                            <div 
                                className="w-[300%] flex transition-transform duration-300 ease-out"
                                style={{ 
                                    transform: `translateX(${listTx}%)` 
                                }}
                            >
                                {/* Page 0: Quick Filters - Nascondi se menu aperto */}
                                <div className={`w-1/3 px-1 ${isPeriodMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                    <QuickFilterControl 
                                        isActive={activeViewIndex === 0}
                                        currentValue={quickFilter}
                                        onSelect={(v) => { setQuickFilter(v); setActiveViewIndex(0); }}
                                        compact={true}
                                        tapBridge={tapBridge}
                                    />
                                </div>
                                {/* Page 1: Period Navigator - Sempre visibile (è quello col menu) */}
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
                                        isPanelOpen={true} // Always drop down in dashboard
                                        compact={true}
                                        tapBridge={tapBridge}
                                    />
                                </div>
                                {/* Page 2: Custom Range - Nascondi se menu aperto */}
                                <div className={`w-1/3 px-1 ${isPeriodMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                                    <CustomDateRangeInputs 
                                        isActive={activeViewIndex === 2}
                                        range={customRange}
                                        onChange={(r) => { setCustomRange(r); setActiveViewIndex(2); }}
                                        compact={true}
                                        tapBridge={tapBridge}
                                    />
                                </div>
                            </div>
                        </div>
                        
                        {/* Dots */}
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
                        <div>
                            <h4 className="text-sm font-medium text-slate-500">Spesa Oggi</h4>
                            <p className="text-xl font-bold text-slate-800">{formatCurrency(dailyTotal)}</p>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <button
                                onClick={onNavigateToRecurring}
                                style={{ touchAction: 'manipulation' }}
                                className="flex items-center justify-center py-2 px-3 text-center font-semibold text-slate-900 bg-amber-100 rounded-xl hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all border border-amber-400"
                                {...tapBridge}
                            >
                                <span className="text-sm">S. Programmate</span>
                            </button>

                            <button
                                onClick={onNavigateToHistory}
                                style={{ touchAction: 'manipulation' }}
                                className="flex items-center justify-center py-2 px-3 text-center font-semibold text-slate-900 bg-amber-100 rounded-xl hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-all border border-amber-400"
                                {...tapBridge}
                            >
                                <span className="text-sm">Storico Spese</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Pulsante Importa File */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileChange}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-indigo-5 text-indigo-700 font-bold rounded-2xl border border-indigo-100 shadow-sm hover:bg-indigo-100 transition-colors"
                    {...tapBridge}
                >
                    <CloudArrowUpIcon className="w-6 h-6" />
                    Importa Estratto Conto (CSV/Excel)
                </button>
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-lg flex flex-col">
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
                                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.bgColor}`}>
                                        <style.Icon className={`w-6 h-6 ${style.color}`} />
                                    </span>
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

        <div className="bg-white p-6 rounded-2xl shadow-lg">
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
                            style={{ touchAction: 'manipulation' }}
                            data-legend-item
                            className={`flex items-center gap-3 p-2 rounded-full text-left transition-all duration-200 bg-slate-100 hover:bg-slate-200`}
                        >
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${style.bgColor}`}>
                                <style.Icon className={`w-4 h-4 ${style.color}`} />
                            </span>
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
    </div>
  );
};

export default Dashboard;
