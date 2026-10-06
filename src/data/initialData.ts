import { Account, Budget, Category, RecurringTransaction, Transaction } from '../types';
import { getTodayString, getYesterdayString } from '../utils/formatters';

export const INITIAL_CATEGORIES: Category[] = [
  // Pengeluaran
  { id: 'cat-makanan', name: 'Makanan', type: 'expense', icon: 'Utensils' },
  { id: 'cat-transportasi', name: 'Transportasi', type: 'expense', icon: 'Car' },
  { id: 'cat-belanja', name: 'Belanja', type: 'expense', icon: 'ShoppingBag' },
  { id: 'cat-tagihan', name: 'Tagihan', type: 'expense', icon: 'Receipt' },
  { id: 'cat-hiburan', name: 'Hiburan', type: 'expense', icon: 'Film' },
  { id: 'cat-kesehatan', name: 'Kesehatan', type: 'expense', icon: 'HeartPulse' },
  { id: 'cat-pendidikan', name: 'Pendidikan', type: 'expense', icon: 'GraduationCap' },
  { id: 'cat-perjalanan', name: 'Perjalanan', type: 'expense', icon: 'Plane' },
  { id: 'cat-pengeluaran-lain', name: 'Lainnya', type: 'expense', icon: 'MoreHorizontal' },

  // Pemasukan
  { id: 'cat-gaji', name: 'Gaji', type: 'income', icon: 'Briefcase' },
  { id: 'cat-freelance', name: 'Freelance', type: 'income', icon: 'Laptop' },
  { id: 'cat-bisnis', name: 'Bisnis', type: 'income', icon: 'Building2' },
  { id: 'cat-investasi', name: 'Investasi', type: 'income', icon: 'TrendingUp' },
  { id: 'cat-hadiah', name: 'Hadiah', type: 'income', icon: 'Gift' },
  { id: 'cat-pemasukan-lain', name: 'Lainnya', type: 'income', icon: 'CircleDollarSign' },
];

export const INITIAL_ACCOUNTS: Account[] = [
  { id: 'acc-tunai', name: 'Tunai', type: 'cash', balance: 1830000, initialBalance: 1830000, color: '#16a34a', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'acc-bca', name: 'BCA', type: 'bank', balance: 7439948, initialBalance: 7439948, color: '#2563eb', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'acc-gopay', name: 'GoPay', type: 'ewallet', balance: 2000000, initialBalance: 2000000, color: '#059669', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'acc-kartu-kredit', name: 'Kartu Kredit', type: 'credit', balance: 0, initialBalance: 0, color: '#dc2626', createdAt: '2026-01-01T00:00:00.000Z' },
];

export function getInitialTransactions(): Transaction[] {
  const today = getTodayString();
  const yesterday = getYesterdayString();
  
  // Also calculate dates for 3, 5, 8, 12 days ago in this month
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  
  const d3 = `${year}-${month}-03`;
  const d5 = `${year}-${month}-02`;
  const d8 = `${year}-${month}-01`;

  return [
    {
      id: 'tx-1',
      type: 'expense',
      amount: 82000,
      description: 'GrabCar',
      category: 'Transportasi',
      account: 'BCA',
      date: today,
      notes: 'Ke kantor klien',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: 'tx-2',
      type: 'expense',
      amount: 35000,
      description: 'Kopi',
      category: 'Makanan',
      account: 'Tunai',
      date: today,
      notes: 'Kopi susu gula aren',
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    },
    {
      id: 'tx-3',
      type: 'income',
      amount: 1500000,
      description: 'Freelance',
      category: 'Freelance',
      account: 'BCA',
      date: yesterday,
      notes: 'Pelunasan landing page',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(),
    },
    {
      id: 'tx-4',
      type: 'expense',
      amount: 186000,
      description: 'Netflix',
      category: 'Hiburan',
      account: 'BCA',
      date: yesterday,
      notes: 'Langganan bulanan premium',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
    },
    {
      id: 'tx-5',
      type: 'income',
      amount: 7000000,
      description: 'Gaji',
      category: 'Gaji',
      account: 'BCA',
      date: d8,
      notes: 'Gaji pokok bulan ini',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
    {
      id: 'tx-6',
      type: 'expense',
      amount: 1250000,
      description: 'Belanja Bulanan',
      category: 'Belanja',
      account: 'BCA',
      date: d8,
      notes: 'Kebutuhan pokok dan dapur',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 52).toISOString(),
    },
    {
      id: 'tx-7',
      type: 'expense',
      amount: 650000,
      description: 'Listrik & WiFi',
      category: 'Tagihan',
      account: 'BCA',
      date: d5,
      notes: 'Token PLN & Indihome',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString(),
    },
    {
      id: 'tx-8',
      type: 'expense',
      amount: 720000,
      description: 'Makan Bersama Teman',
      category: 'Makanan',
      account: 'GoPay',
      date: d5,
      notes: 'Dinner di Senopati',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 74).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 74).toISOString(),
    },
    {
      id: 'tx-9',
      type: 'expense',
      amount: 140000,
      description: 'MRT & Bensin',
      category: 'Transportasi',
      account: 'GoPay',
      date: d3,
      notes: 'Isi saldo e-money',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 90).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 90).toISOString(),
    },
    {
      id: 'tx-10',
      type: 'expense',
      amount: 187000,
      description: 'Vitamin & Skincare',
      category: 'Kesehatan',
      account: 'Tunai',
      date: d3,
      notes: 'Apotek K-24',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 95).toISOString(),
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 95).toISOString(),
    },
  ];
}

export const INITIAL_BUDGETS: Budget[] = [
  { id: 'bgt-1', category: 'Makanan', amount: 1500000, period: 'monthly' },
  { id: 'bgt-2', category: 'Transportasi', amount: 1000000, period: 'monthly' },
  { id: 'bgt-3', category: 'Belanja', amount: 1500000, period: 'monthly' },
  { id: 'bgt-4', category: 'Tagihan', amount: 800000, period: 'monthly' },
  { id: 'bgt-5', category: 'Hiburan', amount: 500000, period: 'monthly' },
];

export const INITIAL_RECURRING: RecurringTransaction[] = [
  {
    id: 'rec-1',
    type: 'expense',
    amount: 186000,
    description: 'Netflix',
    category: 'Hiburan',
    account: 'BCA',
    frequency: 'monthly',
    next_date: '2026-11-01',
    active: true,
  },
  {
    id: 'rec-2',
    type: 'expense',
    amount: 350000,
    description: 'Internet & WiFi',
    category: 'Tagihan',
    account: 'BCA',
    frequency: 'monthly',
    next_date: '2026-11-05',
    active: true,
  },
  {
    id: 'rec-3',
    type: 'income',
    amount: 8000000,
    description: 'Gaji Bulanan',
    category: 'Gaji',
    account: 'BCA',
    frequency: 'monthly',
    next_date: '2026-10-25',
    active: true,
  },
];
