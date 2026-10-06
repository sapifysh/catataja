import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  INITIAL_ACCOUNTS,
  INITIAL_BUDGETS,
  INITIAL_CATEGORIES,
  INITIAL_RECURRING,
  getInitialTransactions,
} from '../data/initialData';
import {
  Account,
  ActiveTab,
  Budget,
  Category,
  RecurringTransaction,
  Transaction,
} from '../types';
import {
  auth,
  db,
  handleFirestoreError,
  logOut,
  OperationType,
  signInWithGoogle,
} from '../lib/firebase';

interface FinanceContextType {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  budgets: Budget[];
  recurring: RecurringTransaction[];
  theme: 'light' | 'dark' | 'system';
  isDark: boolean;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;

  // Authentication & Cloud Sync
  currentUser: User | null;
  isAuthLoading: boolean;
  isCloudSynced: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;

  // Modals & UI
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  editingTransaction: Transaction | null;
  setEditingTransaction: (tx: Transaction | null) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;

  // Actions
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt' | 'created_at'> & { id?: string }) => Promise<void>;
  updateTransaction: (id: string, updated: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  addBudget: (b: Omit<Budget, 'id'>) => Promise<void>;
  updateBudget: (id: string, updated: Partial<Budget>) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;

  addAccount: (acc: Omit<Account, 'id'>) => Promise<void>;
  updateAccount: (id: string, updated: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  addCategory: (cat: Omit<Category, 'id'>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  addRecurring: (rec: Omit<RecurringTransaction, 'id'>) => Promise<void>;
  updateRecurring: (id: string, updated: Partial<RecurringTransaction>) => Promise<void>;
  deleteRecurring: (id: string) => Promise<void>;
  applyRecurringTransaction: (rec: RecurringTransaction) => Promise<void>;

  // Reset & Export/Import
  resetToSampleData: () => Promise<void>;
  clearAllData: () => Promise<void>;
  exportJSON: () => void;
  importJSON: (jsonString: string) => boolean;
  exportCSV: () => void;

  // Financial Calculations
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  netDifference: number; // Selisih
  accountBalances: Record<string, number>;
  getCategorySpending: (categoryName: string, monthKey?: string) => number;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const STORAGE_KEYS = {
  TRANSACTIONS: 'catat_transactions_v2',
  CATEGORIES: 'catat_categories_v2',
  ACCOUNTS: 'catat_accounts_v2',
  BUDGETS: 'catat_budgets_v2',
  RECURRING: 'catat_recurring_v2',
  THEME: 'catat_theme_v2',
};

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('ringkasan');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<User | null>(() => auth.currentUser);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  // Theme Management
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
    return 'system';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemIsDark(e.matches);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const isDark = theme === 'system' ? systemIsDark : theme === 'dark';

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    let metaThemeColor = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.name = 'theme-color';
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.content = isDark ? '#0c0d0e' : '#fafafa';

    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  }, [theme, isDark]);

  const setTheme = (t: 'light' | 'dark' | 'system') => {
    setThemeState(t);
    // Sync settings to Firestore
    setDoc(doc(db, 'settings', 'general'), {
      id: 'general',
      currency: 'IDR',
      locale: 'id-ID',
      theme: t,
      updatedAt: new Date().toISOString(),
    }, { merge: true }).catch(() => {});
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const currentlyDark = prev === 'system' ? systemIsDark : prev === 'dark';
      const next = currentlyDark ? 'light' : 'dark';
      setDoc(doc(db, 'settings', 'general'), {
        id: 'general',
        currency: 'IDR',
        locale: 'id-ID',
        theme: next,
        updatedAt: new Date().toISOString(),
      }, { merge: true }).catch(() => {});
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 2800);
  };

  // Firebase Authentication listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithGoogle();
      showToast('Berhasil terhubung ke akun.');
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        showToast('Gagal terhubung.');
      }
    }
  };

  const logout = async () => {
    try {
      await logOut();
      showToast('Berhasil keluar akun.');
    } catch {
      showToast('Gagal keluar.');
    }
  };

  // State with initial fallback from localStorage
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return getInitialTransactions();
  });

  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_CATEGORIES;
  });

  const [accounts, setAccounts] = useState<Account[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_ACCOUNTS;
  });

  const [budgets, setBudgets] = useState<Budget[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BUDGETS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_BUDGETS;
  });

  const [recurring, setRecurring] = useState<RecurringTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.RECURRING);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_RECURRING;
  });

  // Local storage synchronization
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
  }, [budgets]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RECURRING, JSON.stringify(recurring));
  }, [recurring]);

  // Firestore Real-Time Synchronizer
  useEffect(() => {
    if (!currentUser) return;

    // 1. Transactions Listener
    const txCol = collection(db, 'transactions');
    const unsubTx = onSnapshot(
      txCol,
      (snapshot) => {
        setIsCloudSynced(true);
        if (!snapshot.empty) {
          const list: Transaction[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              type: data.type,
              amount: Number(data.amount) || 0,
              description: data.description || '',
              category: data.category || 'Lainnya',
              account: data.account || 'Tunai',
              date: data.date || '',
              notes: data.notes || '',
              createdAt: data.createdAt || data.created_at || new Date().toISOString(),
              created_at: data.createdAt || data.created_at || new Date().toISOString(),
              updatedAt: data.updatedAt,
            });
          });
          // Sort newest first
          list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setTransactions(list);
        } else {
          // If Firestore is empty on first run, seed initial transactions
          const initialTx = getInitialTransactions();
          const batch = writeBatch(db);
          initialTx.forEach((tx) => {
            const ref = doc(db, 'transactions', tx.id);
            batch.set(ref, {
              id: tx.id,
              type: tx.type,
              amount: tx.amount,
              description: tx.description,
              category: tx.category,
              account: tx.account,
              date: tx.date,
              notes: tx.notes || '',
              createdAt: tx.created_at,
              updatedAt: tx.created_at,
            });
          });
          batch.commit().catch((err) => handleFirestoreError(err, OperationType.WRITE, 'transactions'));
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'transactions');
      }
    );

    // 2. Categories Listener
    const catCol = collection(db, 'categories');
    const unsubCat = onSnapshot(
      catCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Category[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              name: data.name,
              type: data.type,
              icon: data.icon,
              createdAt: data.createdAt,
            });
          });
          setCategories(list);
        } else {
          const batch = writeBatch(db);
          INITIAL_CATEGORIES.forEach((cat) => {
            const ref = doc(db, 'categories', cat.id);
            batch.set(ref, {
              id: cat.id,
              name: cat.name,
              type: cat.type,
              icon: cat.icon,
              createdAt: new Date().toISOString(),
            });
          });
          batch.commit().catch((err) => handleFirestoreError(err, OperationType.WRITE, 'categories'));
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'categories');
      }
    );

    // 3. Accounts Listener
    const accCol = collection(db, 'accounts');
    const unsubAcc = onSnapshot(
      accCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Account[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const bal = Number(data.balance ?? data.initialBalance) || 0;
            list.push({
              id: docSnap.id,
              name: data.name,
              type: data.type,
              balance: bal,
              initialBalance: bal,
              color: data.color,
              createdAt: data.createdAt,
            });
          });
          setAccounts(list);
        } else {
          const batch = writeBatch(db);
          INITIAL_ACCOUNTS.forEach((acc) => {
            const ref = doc(db, 'accounts', acc.id);
            batch.set(ref, {
              id: acc.id,
              name: acc.name,
              type: acc.type,
              balance: acc.initialBalance,
              initialBalance: acc.initialBalance,
              color: acc.color,
              createdAt: new Date().toISOString(),
            });
          });
          batch.commit().catch((err) => handleFirestoreError(err, OperationType.WRITE, 'accounts'));
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'accounts');
      }
    );

    // 4. Budgets Listener
    const bgtCol = collection(db, 'budgets');
    const unsubBgt = onSnapshot(
      bgtCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: Budget[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              category: data.category,
              amount: Number(data.amount) || 0,
              period: data.period || 'monthly',
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            });
          });
          setBudgets(list);
        } else {
          const batch = writeBatch(db);
          INITIAL_BUDGETS.forEach((bgt) => {
            const ref = doc(db, 'budgets', bgt.id);
            batch.set(ref, {
              id: bgt.id,
              category: bgt.category,
              amount: bgt.amount,
              period: bgt.period,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          });
          batch.commit().catch((err) => handleFirestoreError(err, OperationType.WRITE, 'budgets'));
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'budgets');
      }
    );

    // 5. Settings Listener
    const settingsDoc = doc(db, 'settings', 'general');
    const unsubSettings = onSnapshot(
      settingsDoc,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.theme && (data.theme === 'light' || data.theme === 'dark' || data.theme === 'system')) {
            setThemeState(data.theme);
          }
        } else {
          setDoc(settingsDoc, {
            id: 'general',
            currency: 'IDR',
            locale: 'id-ID',
            theme,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }).catch(() => {});
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'settings/general');
      }
    );

    // 6. Recurring Listener
    const recCol = collection(db, 'recurring');
    const unsubRec = onSnapshot(
      recCol,
      (snapshot) => {
        if (!snapshot.empty) {
          const list: RecurringTransaction[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              type: data.type,
              amount: Number(data.amount) || 0,
              description: data.description,
              category: data.category,
              account: data.account,
              frequency: data.frequency,
              next_date: data.next_date,
              active: data.active ?? true,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            });
          });
          setRecurring(list);
        } else {
          const batch = writeBatch(db);
          INITIAL_RECURRING.forEach((rec) => {
            const ref = doc(db, 'recurring', rec.id);
            batch.set(ref, {
              id: rec.id,
              type: rec.type,
              amount: rec.amount,
              description: rec.description,
              category: rec.category,
              account: rec.account,
              frequency: rec.frequency,
              next_date: rec.next_date,
              active: rec.active,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          });
          batch.commit().catch((err) => handleFirestoreError(err, OperationType.WRITE, 'recurring'));
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'recurring');
      }
    );

    return () => {
      unsubTx();
      unsubCat();
      unsubAcc();
      unsubBgt();
      unsubSettings();
      unsubRec();
    };
  }, [currentUser]);

  // Financial aggregate calculations from Firestore state
  const { totalIncome, totalExpense, accountBalances, totalBalance } = useMemo(() => {
    let income = 0;
    let expense = 0;

    const balances: Record<string, number> = {};
    accounts.forEach((acc) => {
      const initial = Number(acc.balance ?? acc.initialBalance) || 0;
      balances[acc.name] = initial;
      balances[acc.id] = initial;
    });

    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        income += amt;
        if (balances[tx.account] !== undefined) {
          balances[tx.account] += amt;
        }
      } else {
        expense += amt;
        if (balances[tx.account] !== undefined) {
          balances[tx.account] -= amt;
        }
      }
    });

    let sumAccountBalances = 0;
    accounts.forEach((acc) => {
      sumAccountBalances += balances[acc.name] ?? balances[acc.id] ?? 0;
    });

    return {
      totalIncome: income,
      totalExpense: expense,
      accountBalances: balances,
      totalBalance: sumAccountBalances,
    };
  }, [transactions, accounts]);

  const netDifference = totalIncome - totalExpense;

  const getCategorySpending = (categoryName: string, monthKey?: string) => {
    return transactions
      .filter((tx) => {
        if (tx.type !== 'expense') return false;
        if (tx.category.toLowerCase() !== categoryName.toLowerCase()) return false;
        if (monthKey) {
          return tx.date.startsWith(monthKey);
        }
        return true;
      })
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  };

  // Firestore Mutations
  const addTransaction = async (
    txData: Omit<Transaction, 'id' | 'createdAt' | 'created_at'> & { id?: string }
  ) => {
    const nowIso = new Date().toISOString();
    const id = txData.id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newTx: Transaction = {
      ...txData,
      id,
      createdAt: nowIso,
      created_at: nowIso,
      updatedAt: nowIso,
    };

    // Instant local UI update
    setTransactions((prev) => [newTx, ...prev.filter((t) => t.id !== id)]);
    showToast('Transaksi berhasil disimpan.');

    if (currentUser) {
      try {
        await setDoc(doc(db, 'transactions', id), {
          id: newTx.id,
          type: newTx.type,
          amount: newTx.amount,
          category: newTx.category,
          description: newTx.description,
          account: newTx.account,
          date: newTx.date,
          notes: newTx.notes || '',
          createdAt: newTx.createdAt,
          updatedAt: newTx.updatedAt,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `transactions/${id}`);
      }
    }
  };

  const updateTransaction = async (id: string, updated: Partial<Transaction>) => {
    const nowIso = new Date().toISOString();
    setTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, ...updated, updatedAt: nowIso } : tx))
    );
    showToast('Perubahan transaksi disimpan.');

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'transactions', id), {
          ...updated,
          updatedAt: nowIso,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `transactions/${id}`);
      }
    }
  };

  const deleteTransaction = async (id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    showToast('Transaksi berhasil dihapus.');

    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'transactions', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `transactions/${id}`);
      }
    }
  };

  const addBudget = async (bData: Omit<Budget, 'id'>) => {
    const nowIso = new Date().toISOString();
    const id = `bgt-${Date.now()}`;
    const newBudget: Budget = {
      ...bData,
      id,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setBudgets((prev) => [...prev.filter((b) => b.id !== id), newBudget]);
    showToast('Anggaran baru berhasil ditambahkan.');

    if (currentUser) {
      try {
        await setDoc(doc(db, 'budgets', id), {
          id: newBudget.id,
          category: newBudget.category,
          amount: newBudget.amount,
          period: newBudget.period,
          createdAt: newBudget.createdAt,
          updatedAt: newBudget.updatedAt,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `budgets/${id}`);
      }
    }
  };

  const updateBudget = async (id: string, updated: Partial<Budget>) => {
    const nowIso = new Date().toISOString();
    setBudgets((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updated, updatedAt: nowIso } : b))
    );
    showToast('Anggaran berhasil diperbarui.');

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'budgets', id), {
          ...updated,
          updatedAt: nowIso,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `budgets/${id}`);
      }
    }
  };

  const deleteBudget = async (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
    showToast('Anggaran berhasil dihapus.');

    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'budgets', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `budgets/${id}`);
      }
    }
  };

  const addAccount = async (accData: Omit<Account, 'id'>) => {
    const id = `acc-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newAcc: Account = {
      ...accData,
      id,
      balance: accData.balance ?? accData.initialBalance,
      initialBalance: accData.initialBalance ?? accData.balance,
      createdAt: nowIso,
    };
    setAccounts((prev) => [...prev.filter((a) => a.id !== id), newAcc]);
    showToast('Sumber dana berhasil ditambahkan.');

    if (currentUser) {
      try {
        await setDoc(doc(db, 'accounts', id), {
          id: newAcc.id,
          name: newAcc.name,
          type: newAcc.type,
          balance: newAcc.balance,
          initialBalance: newAcc.initialBalance,
          createdAt: newAcc.createdAt,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `accounts/${id}`);
      }
    }
  };

  const updateAccount = async (id: string, updated: Partial<Account>) => {
    setAccounts((prev) =>
      prev.map((acc) => (acc.id === id ? { ...acc, ...updated } : acc))
    );
    showToast('Sumber dana diperbarui.');

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'accounts', id), updated);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `accounts/${id}`);
      }
    }
  };

  const deleteAccount = async (id: string) => {
    setAccounts((prev) => prev.filter((acc) => acc.id !== id));
    showToast('Sumber dana dihapus.');

    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'accounts', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `accounts/${id}`);
      }
    }
  };

  const addCategory = async (catData: Omit<Category, 'id'>) => {
    const id = `cat-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newCat: Category = {
      ...catData,
      id,
      createdAt: nowIso,
    };
    setCategories((prev) => [...prev.filter((c) => c.id !== id), newCat]);
    showToast('Kategori baru berhasil ditambahkan.');

    if (currentUser) {
      try {
        await setDoc(doc(db, 'categories', id), {
          id: newCat.id,
          name: newCat.name,
          type: newCat.type,
          icon: newCat.icon,
          createdAt: newCat.createdAt,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `categories/${id}`);
      }
    }
  };

  const deleteCategory = async (id: string) => {
    setCategories((prev) => prev.filter((cat) => cat.id !== id));
    showToast('Kategori dihapus.');

    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'categories', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `categories/${id}`);
      }
    }
  };

  const addRecurring = async (recData: Omit<RecurringTransaction, 'id'>) => {
    const id = `rec-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newRec: RecurringTransaction = {
      ...recData,
      id,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    setRecurring((prev) => [...prev.filter((r) => r.id !== id), newRec]);
    showToast('Transaksi rutin berhasil dibuat.');

    if (currentUser) {
      try {
        await setDoc(doc(db, 'recurring', id), {
          id: newRec.id,
          type: newRec.type,
          amount: newRec.amount,
          description: newRec.description,
          category: newRec.category,
          account: newRec.account,
          frequency: newRec.frequency,
          next_date: newRec.next_date,
          active: newRec.active,
          createdAt: newRec.createdAt,
          updatedAt: newRec.updatedAt,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `recurring/${id}`);
      }
    }
  };

  const updateRecurring = async (id: string, updated: Partial<RecurringTransaction>) => {
    const nowIso = new Date().toISOString();
    setRecurring((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updated, updatedAt: nowIso } : r))
    );
    showToast('Transaksi rutin diperbarui.');

    if (currentUser) {
      try {
        await updateDoc(doc(db, 'recurring', id), {
          ...updated,
          updatedAt: nowIso,
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `recurring/${id}`);
      }
    }
  };

  const deleteRecurring = async (id: string) => {
    setRecurring((prev) => prev.filter((r) => r.id !== id));
    showToast('Transaksi rutin dihapus.');

    if (currentUser) {
      try {
        await deleteDoc(doc(db, 'recurring', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `recurring/${id}`);
      }
    }
  };

  const applyRecurringTransaction = async (rec: RecurringTransaction) => {
    const today = new Date().toISOString().split('T')[0];
    await addTransaction({
      type: rec.type,
      amount: rec.amount,
      description: rec.description,
      category: rec.category,
      account: rec.account,
      date: today,
      notes: `Otomatis dari transaksi rutin (${rec.frequency})`,
    });
  };

  const resetToSampleData = async () => {
    const initialTx = getInitialTransactions();
    setTransactions(initialTx);
    setCategories(INITIAL_CATEGORIES);
    setAccounts(INITIAL_ACCOUNTS);
    setBudgets(INITIAL_BUDGETS);
    setRecurring(INITIAL_RECURRING);
    showToast('Data contoh berhasil dimuat.');

    if (currentUser) {
      try {
        const batch = writeBatch(db);
        initialTx.forEach((tx) => {
          batch.set(doc(db, 'transactions', tx.id), {
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            description: tx.description,
            category: tx.category,
            account: tx.account,
            date: tx.date,
            notes: tx.notes || '',
            createdAt: tx.created_at,
            updatedAt: tx.created_at,
          });
        });
        INITIAL_CATEGORIES.forEach((cat) => {
          batch.set(doc(db, 'categories', cat.id), cat);
        });
        INITIAL_ACCOUNTS.forEach((acc) => {
          batch.set(doc(db, 'accounts', acc.id), {
            id: acc.id,
            name: acc.name,
            type: acc.type,
            balance: acc.initialBalance,
            initialBalance: acc.initialBalance,
          });
        });
        INITIAL_BUDGETS.forEach((bgt) => {
          batch.set(doc(db, 'budgets', bgt.id), bgt);
        });
        INITIAL_RECURRING.forEach((rec) => {
          batch.set(doc(db, 'recurring', rec.id), rec);
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'batch-reset');
      }
    }
  };

  const clearAllData = async () => {
    const prevTx = [...transactions];
    const prevBgt = [...budgets];
    const prevRec = [...recurring];

    setTransactions([]);
    setBudgets([]);
    setRecurring([]);
    showToast('Semua transaksi dan anggaran berhasil dibersihkan.');

    if (currentUser) {
      try {
        const batch = writeBatch(db);
        prevTx.forEach((tx) => batch.delete(doc(db, 'transactions', tx.id)));
        prevBgt.forEach((b) => batch.delete(doc(db, 'budgets', b.id)));
        prevRec.forEach((r) => batch.delete(doc(db, 'recurring', r.id)));
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'batch-clear');
      }
    }
  };

  const exportJSON = () => {
    const data = {
      version: '2.0',
      exportDate: new Date().toISOString(),
      transactions,
      categories,
      accounts,
      budgets,
      recurring,
      settings: {
        currency: 'IDR',
        locale: 'id-ID',
        theme,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catat-cadangan-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Cadangan data berhasil diunduh.');
  };

  const importJSON = (jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
      }
      if (Array.isArray(data.categories)) {
        setCategories(data.categories);
      }
      if (Array.isArray(data.accounts)) {
        setAccounts(data.accounts);
      }
      if (Array.isArray(data.budgets)) {
        setBudgets(data.budgets);
      }
      if (Array.isArray(data.recurring)) {
        setRecurring(data.recurring);
      }
      showToast('Data cadangan berhasil dipulihkan.');

      // Push restored data to Firestore if logged in
      if (currentUser) {
        const batch = writeBatch(db);
        if (Array.isArray(data.transactions)) {
          data.transactions.forEach((tx: any) => {
            batch.set(doc(db, 'transactions', tx.id), {
              ...tx,
              updatedAt: new Date().toISOString(),
            });
          });
        }
        if (Array.isArray(data.categories)) {
          data.categories.forEach((cat: any) => {
            batch.set(doc(db, 'categories', cat.id), cat);
          });
        }
        if (Array.isArray(data.accounts)) {
          data.accounts.forEach((acc: any) => {
            batch.set(doc(db, 'accounts', acc.id), acc);
          });
        }
        if (Array.isArray(data.budgets)) {
          data.budgets.forEach((bgt: any) => {
            batch.set(doc(db, 'budgets', bgt.id), bgt);
          });
        }
        batch.commit().catch(() => {});
      }
      return true;
    } catch {
      showToast('Gagal memulihkan file cadangan.');
      return false;
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Tipe', 'Tanggal', 'Keterangan', 'Kategori', 'Sumber Dana', 'Nominal (Rp)', 'Catatan'];
    const rows = transactions.map((t) => [
      t.id,
      t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      t.date,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.account || '').replace(/"/g, '""')}"`,
      t.amount,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catat-transaksi-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Laporan CSV berhasil diunduh.');
  };

  return (
    <FinanceContext.Provider
      value={{
        activeTab,
        setActiveTab,
        transactions,
        categories,
        accounts,
        budgets,
        recurring,
        theme,
        isDark,
        setTheme,
        toggleTheme,
        currentUser,
        isAuthLoading,
        isCloudSynced,
        loginWithGoogle,
        logout,
        isAddModalOpen,
        setIsAddModalOpen,
        editingTransaction,
        setEditingTransaction,
        toastMessage,
        showToast,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addBudget,
        updateBudget,
        deleteBudget,
        addAccount,
        updateAccount,
        deleteAccount,
        addCategory,
        deleteCategory,
        addRecurring,
        updateRecurring,
        deleteRecurring,
        applyRecurringTransaction,
        resetToSampleData,
        clearAllData,
        exportJSON,
        importJSON,
        exportCSV,
        totalBalance,
        totalIncome,
        totalExpense,
        netDifference,
        accountBalances,
        getCategorySpending,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
}
