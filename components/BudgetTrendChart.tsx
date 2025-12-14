import React, { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Expense } from '../types';
import { formatCurrency } from './icons/formatters';

interface BudgetTrendChartProps {
  expenses: Expense[];
  periodType: 'day' | 'week' | 'month' | 'year';
  periodDate: Date;
  activeViewIndex: number; // 0: Quick, 1: Period, 2: Custom
  quickFilter: string;
  customRange: { start: string | null; end: string | null };
}

const parseLocalYYYYMMDD = (s: string) => {
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
};

const toYYYYMMDD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const dateLabel = (() => {
        const parts = label.split('-');
        if (parts.length === 3) {
            const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' });
        }
        return label;
    })();

    // Il valore nel grafico è negativo, lo mostriamo positivo nel tooltip
    const expensePositive = Math.abs(data.negExpense);

    return (
      <div className="bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-slate-100 text-sm z-50">
        <p className="text-slate-500 font-medium mb-2 border-b border-slate-100 pb-1">{dateLabel}</p>
        
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-4">
                <span className="text-indigo-600 font-bold">Saldo:</span>
                <span className="font-bold text-slate-800">{formatCurrency(data.balance)}</span>
            </div>
            
            {/* Mostra Rettifica solo se presente */}
            {data.adjustment !== 0 && (
                <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-500 font-medium">Rettifica:</span>
                    <span className={`font-semibold ${data.adjustment >= 0 ? "text-slate-700" : "text-red-400"}`}>
                        {data.adjustment > 0 ? '+' : ''}{formatCurrency(data.adjustment)}
                    </span>
                </div>
            )}

            <div className="flex items-center justify-between gap-4">
                <span className={data.net >= 0 ? "text-emerald-600" : "text-rose-600"}>
                    Flusso Netto:
                </span>
                <span className={`font-semibold ${data.net >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {data.net > 0 ? '+' : ''}{formatCurrency(data.net)}
                </span>
            </div>
            <div className="pt-2 mt-2 border-t border-slate-100 grid grid-cols-2 gap-x-4 text-xs">
                <div className="text-emerald-600 font-medium">
                    Entrate: {formatCurrency(data.income)}
                </div>
                <div className="text-rose-600 font-medium text-right">
                    Uscite: {formatCurrency(expensePositive)}
                </div>
            </div>
        </div>
      </div>
    );
  }
  return null;
};

export const BudgetTrendChart: React.FC<BudgetTrendChartProps> = ({
  expenses,
  periodType,
  periodDate,
  activeViewIndex,
  quickFilter,
  customRange
}) => {
  
  const chartData = useMemo(() => {
    // 1. Determine Date Range
    const now = new Date();
    let start = new Date();
    let end = new Date();
    
    if (activeViewIndex === 0) { // Quick
        end = new Date(now);
        start = new Date(now);
        start.setHours(0,0,0,0);
        switch(quickFilter) {
            case '7d': start.setDate(start.getDate() - 6); break;
            case '30d': start.setDate(start.getDate() - 29); break;
            case '6m': start.setMonth(start.getMonth() - 6); break;
            case '1y': start.setFullYear(start.getFullYear() - 1); break;
            default: start = new Date(0); break; // All
        }
    } else if (activeViewIndex === 2) { // Custom
        if (customRange.start && customRange.end) {
            start = parseLocalYYYYMMDD(customRange.start);
            end = parseLocalYYYYMMDD(customRange.end);
        }
    } else { // Period
        start = new Date(periodDate);
        end = new Date(periodDate);
        if (periodType === 'day') {
             const day = start.getDay();
             const diff = start.getDate() - day + (day === 0 ? -6 : 1);
             start.setDate(diff);
             end = new Date(start);
             end.setDate(start.getDate() + 6);
        } else if (periodType === 'week') {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
        } else if (periodType === 'month') {
            start.setDate(1);
            end.setMonth(end.getMonth() + 1);
            end.setDate(0);
        } else { // Year
            start.setMonth(0, 1);
            end.setFullYear(end.getFullYear() + 1);
            end.setMonth(0, 0);
        }
    }
    
    // Normalize times
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);

    // CLIP FUTURE DATES: Ensure chart never goes beyond today
    const todayEndOfDay = new Date();
    todayEndOfDay.setHours(23, 59, 59, 999);
    
    if (end > todayEndOfDay) {
        end = todayEndOfDay;
    }
    
    // Safety check: if start is after today (e.g. looking at next month), show nothing or just today
    if (start > end) {
       start = new Date(end);
       start.setHours(0,0,0,0);
    }

    // 2. Generate Buckets
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const dataMap = new Map<string, { date: string; income: number; expense: number; adjustment: number; net: number; balance: number }>();
    // Group by month only if range is huge AND we aren't zoomed into specific days near today
    const isYearly = diffDays > 60; 

    if (isYearly) {
        let curr = new Date(start);
        curr.setDate(1); 
        while (curr <= end) {
            const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
            const sortKey = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-01`;
            if (!dataMap.has(sortKey)) {
                dataMap.set(sortKey, { date: sortKey, income: 0, expense: 0, adjustment: 0, net: 0, balance: 0 });
            }
            curr.setMonth(curr.getMonth() + 1);
        }
    } else {
        let curr = new Date(start);
        while (curr <= end) {
            const key = toYYYYMMDD(curr);
            dataMap.set(key, { date: key, income: 0, expense: 0, adjustment: 0, net: 0, balance: 0 });
            curr.setDate(curr.getDate() + 1);
        }
    }

    // 3. Populate Data
    expenses.forEach(e => {
        const d = parseLocalYYYYMMDD(e.date);
        if (d >= start && d <= end) {
            let key = toYYYYMMDD(d);
            if (isYearly) {
                key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
            }
            
            if (dataMap.has(key)) {
                const entry = dataMap.get(key)!;
                const rawAmt = Number(e.amount) || 0;
                const absAmt = Math.abs(rawAmt);
                
                if (e.type === 'income') {
                    entry.income += absAmt;
                } else if (e.type === 'expense') {
                    entry.expense += absAmt;
                } else if (e.type === 'adjustment') {
                    // Adjustments don't count as income/expense bars, but they do affect the balance
                    // We keep the raw signed amount for adjustment
                    entry.adjustment += rawAmt;
                }
                
                // Net is strictly Income - Expense (for the bars/daily flow context)
                entry.net = entry.income - entry.expense;
            }
        }
    });

    // 4. Calculate Cumulative Balance & Prepare Chart Data
    let runningBalance = 0;
    
    // Sort keys to ensure chronological order
    const sortedKeys = Array.from(dataMap.keys()).sort();

    const result = sortedKeys.map(key => {
        const item = dataMap.get(key)!;
        // Balance = previous + (Income - Expense + Adjustments)
        runningBalance += (item.income - item.expense + item.adjustment);
        return { 
            ...item, 
            balance: runningBalance,
            // CRITICO: Convertiamo le spese in negativo per il grafico
            negExpense: -item.expense
        };
    });

    return result;

  }, [expenses, periodType, periodDate, activeViewIndex, quickFilter, customRange]);

  if (chartData.length === 0) return null;

  return (
    // Modified: removed horizontal padding (on mobile) and radius (on mobile)
    <div className="bg-white p-5 md:rounded-3xl shadow-lg border border-slate-100">
      <div className="mb-6 flex justify-between items-end">
        <div>
            <h3 className="text-lg font-bold text-slate-800">Andamento Saldo</h3>
            <p className="text-xs font-medium text-slate-400 mt-0.5">Saldo cumulativo e flusso giornaliero</p>
        </div>
      </div>
      
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          {/* stackOffset="sign" è FONDAMENTALE: separa positivi (su) e negativi (giù) dallo zero */}
          <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }} stackOffset="sign">
            <defs>
              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            
            <XAxis 
                dataKey="date" 
                tick={{fontSize: 10, fill: '#94a3b8'}} 
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => {
                    const parts = val.split('-');
                    if (parts.length === 3) {
                       const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                       if (chartData.length > 60) return d.toLocaleDateString('it-IT', { month: 'short' }); 
                       return d.getDate().toString();
                    }
                    return '';
                }}
                minTickGap={5} // RIDOTTO: Permette di mostrare più giorni (es. 10)
                dy={10}
            />
            
            <YAxis 
                tick={{fontSize: 10, fill: '#94a3b8'}} 
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => {
                    if (Math.abs(val) >= 1000) return `${(val/1000).toFixed(0)}k`;
                    return val;
                }}
            />
            
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
            
            <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />

            {/* Income Bars (Positive, Green) - Stacked con ID uguale a Expense */}
            <Bar 
                dataKey="income" 
                stackId="stack"
                barSize={12} 
                fill="#10b981" 
                fillOpacity={0.8} 
                radius={[0, 0, 0, 0]} 
            />
            
            {/* Expense Bars (Negative, Red) - Stacked con ID uguale a Income */}
            <Bar 
                dataKey="negExpense" 
                stackId="stack"
                barSize={12} 
                fill="#f43f5e" 
                fillOpacity={0.8} 
                radius={[0, 0, 0, 0]} 
            />

            {/* Cumulative Trend Area */}
            <Area 
                type="monotone" 
                dataKey="balance" 
                stroke="#6366f1" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#colorBalance)" 
                activeDot={{ r: 6, strokeWidth: 0, fill: '#4f46e5' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
