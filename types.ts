
export interface Account {
  id: string;
  name: string;
  icon?: string;
}

export interface Expense {
  id:string;
  type: 'expense' | 'income' | 'transfer' | 'adjustment'; // Added adjustment
  description: string;
  amount: number;
  date: string; 
  time?: string;
  category: string;
  subcategory?: string;
  accountId: string;
  toAccountId?: string; // Added for transfers
  tags?: string[];
  receipts?: string[];
  frequency?: 'single' | 'recurring';
  recurrence?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  monthlyRecurrenceType?: 'dayOfMonth' | 'dayOfWeek';
  recurrenceInterval?: number;
  recurrenceDays?: number[];
  recurrenceEndType?: 'forever' | 'date' | 'count';
  recurrenceEndDate?: string;
  recurrenceCount?: number;
  recurringExpenseId?: string;
  lastGeneratedDate?: string;
}

export const CATEGORIES: Record<string, string[]> = {
  'Alimentari': ['Ristorante', 'Bar', 'Autogrill'],
  'Trasporti': ['Mezzi Pubblici', 'Carburante', 'Taxi', 'Assicurazione',  'Manutenzione Auto', 'Pedaggio'],
  'Casa': ['Affitto/Mutuo', 'Bollette', 'Manutenzione', 'Arredamento'],
  'Shopping': ['Supermercato', 'Abbigliamento', 'Elettronica', 'Libri', 'Regali'],
  'Tempo Libero': ['Cinema', 'Concerti', 'Sport', 'Viaggi'],
  'Salute': ['Farmacia', 'Visite Mediche', 'Assicurazione'],
  'Istruzione': ['Corsi', 'Libri', 'Tasse Scolastiche'],
  'Lavoro': ['Pasti', 'Materiale Ufficio'],
  'Beneficienza': ['Donazione', 'Adozione a distanza', 'Elemosina'],
  'Altro': [],
};
