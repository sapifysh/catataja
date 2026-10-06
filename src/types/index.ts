export type TransactionType = 'expense' | 'income';

export type AccountType = 'cash' | 'bank' | 'ewallet' | 'credit';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  initialBalance: number;
  accountNumber?: string;
  color?: string;
  createdAt?: string;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType | 'both';
  icon: string;
  createdAt?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  date: string; // YYYY-MM-DD
  account: string; // Account name or ID
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  created_at?: string; // alias for compatibility
}

export interface Budget {
  id: string;
  category: string;
  amount: number;
  period: 'monthly';
  createdAt?: string;
  updatedAt?: string;
}

export interface AppSettings {
  currency: string;
  locale: string;
  theme: 'light' | 'dark' | 'system';
  createdAt?: string;
  updatedAt?: string;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  category: string;
  account: string;
  frequency: RecurringFrequency;
  next_date: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type ActiveTab = 'ringkasan' | 'transaksi' | 'laporan' | 'anggaran' | 'pengaturan';

