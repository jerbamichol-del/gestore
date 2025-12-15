
import React, { useEffect } from 'react';
import { Expense } from '../types';
import { parseLocalYYYYMMDD, toYYYYMMDD } from '../utils/date';

export const useRecurringExpenseGenerator = (
  expenses: Expense[],
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>,
  recurringExpenses: Expense[],
  setRecurringExpenses: React.Dispatch<React.SetStateAction<Expense[]>>
) => {
  useEffect(() => {
    // Process recurring expenses inside a timer to debounce updates
    const timer = setTimeout(() => {
        if (!recurringExpenses || recurringExpenses.length === 0) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let expensesChanged = false;
        let recurringChanged = false;
        
        const newExpenses = [...(expenses || [])];
        const activeTemplates: Expense[] = [];

        recurringExpenses.forEach(template => {
            let currentTemplate = { ...template };
            let templateChanged = false;
            
            // 1. Determine starting point for check
            let nextDate: Date;
            if (currentTemplate.lastGeneratedDate) {
                // Next is based on last generated + interval
                nextDate = parseLocalYYYYMMDD(currentTemplate.lastGeneratedDate);
                const interval = currentTemplate.recurrenceInterval || 1;
                switch(currentTemplate.recurrence) {
                    case 'daily': nextDate.setDate(nextDate.getDate() + interval); break;
                    case 'weekly': nextDate.setDate(nextDate.getDate() + 7 * interval); break;
                    case 'monthly': nextDate.setMonth(nextDate.getMonth() + interval); break;
                    case 'yearly': nextDate.setFullYear(nextDate.getFullYear() + interval); break;
                    default: break;
                }
            } else {
                // First time ever
                nextDate = parseLocalYYYYMMDD(currentTemplate.date);
            }

            // 2. Loop to "catch up" missed periods up to today
            let loops = 0;
            // Count already generated items for this template ID
            let totalGenerated = (expenses || []).filter(e => e.recurringExpenseId === currentTemplate.id).length;
            
            // Loop while nextDate is today or in the past
            while (nextDate <= today && loops < 1000) {
                loops++;
                
                // Check Termination Conditions BEFORE generating
                let stop = false;
                
                // End Date check
                if (currentTemplate.recurrenceEndType === 'date' && currentTemplate.recurrenceEndDate) {
                    const end = parseLocalYYYYMMDD(currentTemplate.recurrenceEndDate);
                    if (nextDate > end) stop = true;
                }
                // Count check
                if (currentTemplate.recurrenceEndType === 'count' && currentTemplate.recurrenceCount) {
                    if (totalGenerated >= currentTemplate.recurrenceCount) stop = true;
                }

                if (stop) break;

                // GENERATE EXPENSE
                const newExpense: Expense = {
                    ...currentTemplate,
                    id: crypto.randomUUID(),
                    date: toYYYYMMDD(nextDate),
                    recurringExpenseId: currentTemplate.id,
                    frequency: 'single', // Converted to single instance in history
                    // Remove recurrence config properties from the instance to keep it clean
                    recurrence: undefined,
                    recurrenceInterval: undefined,
                    recurrenceDays: undefined,
                    recurrenceEndType: undefined,
                    recurrenceEndDate: undefined,
                    recurrenceCount: undefined,
                    monthlyRecurrenceType: undefined,
                    lastGeneratedDate: undefined
                };
                
                newExpenses.push(newExpense);
                expensesChanged = true;
                
                // Update Template
                currentTemplate.lastGeneratedDate = toYYYYMMDD(nextDate);
                templateChanged = true;
                totalGenerated++;

                // Calculate next date for loop continuation
                const interval = currentTemplate.recurrenceInterval || 1;
                const d = new Date(nextDate);
                switch(currentTemplate.recurrence) {
                    case 'daily': d.setDate(d.getDate() + interval); break;
                    case 'weekly': d.setDate(d.getDate() + 7 * interval); break;
                    case 'monthly': d.setMonth(d.getMonth() + interval); break;
                    case 'yearly': d.setFullYear(d.getFullYear() + interval); break;
                }
                nextDate = d;
            }

            // 3. Determine if template is FINISHED
            let isFinished = false;
            // Check based on the *next* potential date
            if (currentTemplate.recurrenceEndType === 'date' && currentTemplate.recurrenceEndDate) {
                 const end = parseLocalYYYYMMDD(currentTemplate.recurrenceEndDate);
                 if (nextDate > end) isFinished = true;
            }
            if (currentTemplate.recurrenceEndType === 'count' && currentTemplate.recurrenceCount) {
                if (totalGenerated >= currentTemplate.recurrenceCount) isFinished = true;
            }

            if (isFinished) {
                // If finished, we drop it from activeTemplates -> effectively deleting it from scheduled list
                recurringChanged = true; 
            } else {
                if (templateChanged) recurringChanged = true;
                activeTemplates.push(currentTemplate);
            }
        });

        // Batch updates
        if (expensesChanged) setExpenses(newExpenses);
        if (recurringChanged) setRecurringExpenses(activeTemplates);

    }, 1000); // 1s delay to be safe

    return () => clearTimeout(timer);
  }, [recurringExpenses, expenses, setExpenses, setRecurringExpenses]);
};
