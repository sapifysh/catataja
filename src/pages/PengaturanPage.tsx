import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CreditCard,
  Download,
  Laptop,
  Mail,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { AddAccountModal } from '../components/modals/AddAccountModal';
import { AddRecurringModal } from '../components/modals/AddRecurringModal';
import { BcaPreviewModal } from '../components/modals/BcaPreviewModal';
import { useFinance } from '../context/FinanceContext';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  BcaCandidateTransaction,
  disconnectGmail,
  fetchBcaTransactionPreview,
  fetchGmailStatus,
  getGmailAuthUrl,
  GmailStatusData,
} from '../services/gmailService';
import { TransactionType } from '../types';
import { formatRupiah, formatSignedRupiah } from '../utils/formatters';

export const PengaturanPage: React.FC = () => {
  const {
    theme,
    setTheme,
    transactions,
    categories,
    addCategory,
    deleteCategory,
    accounts,
    deleteAccount,
    recurring,
    deleteRecurring,
    applyRecurringTransaction,
    resetToSampleData,
    clearAllData,
    exportJSON,
    importJSON,
    currentUser,
    loginWithGoogle,
    logout,
    showToast,
  } = useFinance();

  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);

  // Gmail Integration State (Backed persistently by Firestore)
  const [gmailStatus, setGmailStatus] = useState<GmailStatusData>({
    configured: false,
    connected: false,
    email: null,
    lastSyncAt: null,
    importedCount: 0,
  });
  const [isSyncingGmail, setIsSyncingGmail] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewCandidates, setPreviewCandidates] = useState<
    BcaCandidateTransaction[]
  >([]);

  const loadFirestoreSyncState = async () => {
    try {
      let firestoreLastSync: string | null = null;
      let firestoreCount = 0;

      // 1. Read persistent sync record from Firestore settings/gmail_sync
      try {
        const syncDoc = await getDoc(doc(db, 'settings', 'gmail_sync'));
        if (syncDoc.exists()) {
          const data = syncDoc.data();
          firestoreLastSync = data.lastSyncAt || null;
          firestoreCount = Number(data.importedCount || 0);
        }
      } catch (err) {
        console.warn('Could not read settings/gmail_sync:', err);
      }

      // 2. Cross-verify actual count from Firestore tracking collection
      try {
        const snap = await getDocs(collection(db, 'gmail_imported_messages'));
        if (snap.size > firestoreCount) {
          firestoreCount = snap.size;
        }
      } catch {
        // Fallback to transactions count if collection not yet created
        const txBcaCount = transactions.filter((t) => t.id.startsWith('tx-bca-')).length;
        if (txBcaCount > firestoreCount) {
          firestoreCount = txBcaCount;
        }
      }

      const status = await fetchGmailStatus(firestoreLastSync, firestoreCount);
      setGmailStatus(status);
    } catch {
      const fallback = await fetchGmailStatus();
      setGmailStatus(fallback);
    }
  };

  useEffect(() => {
    loadFirestoreSyncState();

    // Check URL parameters for Gmail OAuth redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected') === 'true') {
      showToast('Akun Gmail berhasil terhubung.');
      window.history.replaceState({}, '', window.location.pathname);
      loadFirestoreSyncState();
    } else if (params.get('gmail_error')) {
      showToast('Koneksi Gmail gagal: ' + params.get('gmail_error'));
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [currentUser]);

  const handleConnectGmail = async () => {
    try {
      const res = await getGmailAuthUrl();
      if (res.configured && res.authUrl) {
        window.location.href = res.authUrl;
      } else {
        showToast(res.message || 'Kredensial OAuth belum dikonfigurasi pada server Cloud Run.');
      }
    } catch {
      showToast('Gagal memproses otorisasi Gmail.');
    }
  };

  const handleDisconnectGmail = async () => {
    try {
      const res = await disconnectGmail();
      showToast(res.message || 'Integrasi Gmail diputuskan.');
      await loadFirestoreSyncState();
    } catch {
      showToast('Gagal memutuskan integrasi Gmail.');
    }
  };

  const handleSyncGmail = async () => {
    setIsSyncingGmail(true);
    try {
      const idToken = currentUser ? await currentUser.getIdToken() : undefined;
      const userId = currentUser?.uid;

      // 1. Query Firestore for already-imported message IDs (Persistent Source of Truth)
      const importedIds: string[] = [];
      try {
        const snap = await getDocs(collection(db, 'gmail_imported_messages'));
        snap.forEach((d) => importedIds.push(d.id));
      } catch {
        // ignore
      }

      // Also cross-reference any transactions with ID tx-bca-<msgId>
      transactions.forEach((tx) => {
        if (tx.id.startsWith('tx-bca-')) {
          const msgId = tx.id.replace('tx-bca-', '');
          if (!importedIds.includes(msgId)) {
            importedIds.push(msgId);
          }
        }
      });

      // 2. Fetch preview passing Firestore-backed imported IDs to prevent duplicates
      const res = await fetchBcaTransactionPreview(14, 20, importedIds, idToken, userId);

      if (res.candidates && res.candidates.length > 0) {
        setPreviewCandidates(res.candidates);
        setIsPreviewModalOpen(true);
        if (res.newCount > 0) {
          showToast(`Ditemukan ${res.newCount} transaksi BCA baru siap dipratinjau.`);
        } else {
          showToast('Semua transaksi BCA pada periode ini sudah tercatat di Firestore.');
        }
      } else {
        if (res.diagnosticStage === 'NO_GMAIL_MESSAGES_FOUND') {
          showToast('Pemeriksaan selesai: Tidak ditemukan notifikasi transaksi BCA dalam 14 hari terakhir.');
        } else if (res.diagnosticStage === 'ALL_REJECTED_BY_PARSER') {
          showToast(`Ditemukan ${res.bcaMessagesFound || 0} email BCA, namun semuanya bukan mutasi transaksi (promo/keamanan/saldo).`);
        } else if (res.diagnosticStage === 'GMAIL_AUTH_FAILED') {
          showToast('Otorisasi Gmail kedaluwarsa. Silakan putuskan dan hubungkan ulang Gmail.');
        } else {
          showToast(res.message || 'Belum ditemukan notifikasi transaksi BCA dalam 14 hari terakhir.');
        }
      }
      await loadFirestoreSyncState();
    } catch (err: any) {
      showToast(err.message || 'Kendala saat memeriksa notifikasi email BCA.');
    } finally {
      setIsSyncingGmail(false);
    }
  };

  // New category form
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>('expense');
  const [confirmClear, setConfirmClear] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    addCategory({
      name: newCatName.trim(),
      type: newCatType,
      icon: newCatType === 'expense' ? 'ShoppingBag' : 'CircleDollarSign',
    });
    setNewCatName('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        importJSON(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Pengaturan
        </h1>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 font-normal mt-0.5">
          Kelola preferensi, kategori, sumber dana, dan data aplikasi Anda.
        </p>
      </div>

      {/* Akun & Sinkronisasi Cloud (Firebase) */}
      <section className="space-y-3 pt-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Akun & Sinkronisasi Cloud
        </h2>
        <div className="p-4 bg-white/70 dark:bg-neutral-900/50 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'Akun'}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full border border-neutral-200 dark:border-neutral-700 object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center font-semibold text-neutral-700 dark:text-neutral-200 shrink-0">
                  {currentUser.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : 'KP'}
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  {currentUser.displayName || 'Pengguna'}
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {currentUser.email}
                </p>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Tersinkronisasi dengan Firebase Firestore</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                Mode Lokal (Tamu)
              </p>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Masuk dengan akun Google untuk menyinkronkan transaksi ke Firebase secara otomatis.
              </p>
            </div>
          )}

          <div>
            {currentUser ? (
              <button
                type="button"
                onClick={logout}
                className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg text-xs font-medium transition-colors"
              >
                Keluar Akun
              </button>
            ) : (
              <button
                type="button"
                onClick={loginWithGoogle}
                className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 rounded-lg text-xs font-medium transition-colors shadow-xs"
              >
                Masuk dengan Google
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Integrasi Gmail (BCA Notifications) */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Integrasi Gmail
            </h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
              Deteksi otomatis notifikasi transaksi email BCA dengan izin baca-saja (read-only).
            </p>
          </div>
          {gmailStatus.connected && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Terhubung
            </span>
          )}
        </div>

        <div className="p-4 bg-white/70 dark:bg-neutral-900/50 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-300 shrink-0 border border-neutral-200/60 dark:border-neutral-700/60">
                <Mail size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <span>Gmail</span>
                  <span className="text-[11px] font-normal text-neutral-400 dark:text-neutral-500">
                    {gmailStatus.connected
                      ? `Terhubung (${gmailStatus.email || 'hitamdimas6@gmail.com'})`
                      : 'Belum terhubung'}
                  </span>
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Scope: <code className="text-[10px] bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded">gmail.readonly</code> (hanya membaca notifikasi transaksi BCA)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {gmailStatus.connected ? (
                <>
                  <button
                    type="button"
                    onClick={handleSyncGmail}
                    disabled={isSyncingGmail}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 rounded-lg text-xs font-medium transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw size={13} className={isSyncingGmail ? 'animate-spin' : ''} />
                    <span>{isSyncingGmail ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGmail}
                    className="px-3 py-1.5 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    Putuskan Gmail
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectGmail}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 rounded-lg text-xs font-medium transition-colors shadow-xs cursor-pointer"
                >
                  <Mail size={14} />
                  <span>Hubungkan Gmail</span>
                </button>
              )}
            </div>
          </div>

          {/* Simple Status Area */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-neutral-200/50 dark:border-neutral-800/50 text-xs">
            <div className="p-2.5 rounded-lg bg-neutral-50/80 dark:bg-neutral-900/80 border border-neutral-200/50 dark:border-neutral-800/50">
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 block">Gmail</span>
              <span className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${gmailStatus.connected ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                {gmailStatus.connected ? 'Terhubung' : 'Belum terhubung'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-neutral-50/80 dark:bg-neutral-900/80 border border-neutral-200/50 dark:border-neutral-800/50">
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 block">Sinkronisasi terakhir</span>
              <span className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5 block truncate">
                {gmailStatus.lastSyncAt
                  ? new Date(gmailStatus.lastSyncAt).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : 'Belum pernah'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-neutral-50/80 dark:bg-neutral-900/80 border border-neutral-200/50 dark:border-neutral-800/50">
              <span className="text-[11px] text-neutral-400 dark:text-neutral-500 block">Transaksi dari Gmail</span>
              <span className="font-medium text-neutral-800 dark:text-neutral-200 mt-0.5 block tabular-nums">
                {gmailStatus.importedCount}
              </span>
            </div>
          </div>

          {/* Privacy and Security Note */}
          <div className="p-2.5 bg-neutral-100/60 dark:bg-neutral-800/40 rounded-lg text-[11px] text-neutral-500 dark:text-neutral-400 flex items-start gap-2">
            <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p>
              Aplikasi hanya meminta izin baca-saja (<code className="text-[10px]">gmail.readonly</code>) untuk notifikasi resmi BCA. Aplikasi tidak pernah meminta kata sandi email, PIN, atau kredensial perbankan Anda.
            </p>
          </div>
        </div>
      </section>

      {/* 1. Tampilan (Mode Tema) */}
      <section className="space-y-3 pt-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Tampilan
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
              theme === 'light'
                ? 'bg-white text-neutral-900 border-neutral-300 dark:bg-neutral-800 dark:text-white dark:border-neutral-500 shadow-xs'
                : 'text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Sun size={14} className={theme === 'light' ? 'text-amber-500' : ''} />
            <span>Terang</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
              theme === 'dark'
                ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-800 dark:border-neutral-500 shadow-xs'
                : 'text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Moon size={14} className={theme === 'dark' ? 'text-indigo-400' : ''} />
            <span>Gelap</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('system')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
              theme === 'system'
                ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-800 dark:border-neutral-500 shadow-xs'
                : 'text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Laptop size={14} />
            <span>Sistem (Otomatis)</span>
          </button>
        </div>
      </section>

      {/* 2. Sumber Dana / Rekening */}
      <section className="space-y-3 pt-4 border-t border-neutral-200/70 dark:border-neutral-800/70">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Sumber Dana & Dompet
            </h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
              Akun bank, dompet tunai, dan e-wallet yang aktif.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddAccountOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md transition-colors"
          >
            <Plus size={13} />
            <span>Tambah</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className="flex items-center justify-between p-3 bg-white/70 dark:bg-neutral-900/50 rounded-lg border border-neutral-200/60 dark:border-neutral-800/60"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 shrink-0">
                  {acc.type === 'cash' ? (
                    <Wallet size={14} />
                  ) : acc.type === 'credit' ? (
                    <CreditCard size={14} />
                  ) : (
                    <CreditCard size={14} />
                  )}
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate block">
                    {acc.name}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500 capitalize block">
                    {acc.type === 'cash' ? 'Tunai' : acc.type === 'ewallet' ? 'E-Wallet' : acc.type === 'credit' ? 'Kartu Kredit' : 'Bank'}
                  </span>
                </div>
              </div>

              {accounts.length > 1 && (
                <button
                  type="button"
                  onClick={() => deleteAccount(acc.id)}
                  className="p-1 text-neutral-300 hover:text-rose-500 dark:text-neutral-600 dark:hover:text-rose-400 transition-colors"
                  title="Hapus sumber dana"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 3. Transaksi Rutin / Berulang */}
      <section className="space-y-3 pt-4 border-t border-neutral-200/70 dark:border-neutral-800/70">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Transaksi Rutin
            </h2>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
              Langganan berkala seperti Netflix, Internet, atau Gaji.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddRecurringOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md transition-colors"
          >
            <Plus size={13} />
            <span>Tambah</span>
          </button>
        </div>

        <div className="space-y-2">
          {recurring.map((rec) => (
            <div
              key={rec.id}
              className="flex items-center justify-between p-3 bg-white/70 dark:bg-neutral-900/50 rounded-lg border border-neutral-200/60 dark:border-neutral-800/60 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 shrink-0">
                  <CategoryIcon name={rec.category} size={14} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {rec.description}
                  </p>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    Setiap {rec.frequency === 'monthly' ? 'bulan' : rec.frequency === 'weekly' ? 'minggu' : 'hari'} · {rec.account}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`font-semibold tabular-nums ${
                    rec.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {rec.type === 'income' ? `+ ${formatRupiah(rec.amount)}` : `− ${formatRupiah(rec.amount)}`}
                </span>
                <button
                  type="button"
                  onClick={() => applyRecurringTransaction(rec)}
                  className="px-2 py-1 text-[11px] bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded font-medium transition-colors"
                  title="Catat sekarang ke transaksi aktif"
                >
                  Catat Sekarang
                </button>
                <button
                  type="button"
                  onClick={() => deleteRecurring(rec.id)}
                  className="p-1 text-neutral-300 hover:text-rose-500 dark:text-neutral-600 dark:hover:text-rose-400 transition-colors"
                  title="Hapus transaksi rutin"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Kelola Kategori */}
      <section className="space-y-3 pt-4 border-t border-neutral-200/70 dark:border-neutral-800/70">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Kelola Kategori
          </h2>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
            Daftar kategori untuk memilah pengeluaran dan pemasukan Anda.
          </p>
        </div>

        {/* Add custom category inline form */}
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Tambah nama kategori baru..."
            className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
          />
          <select
            value={newCatType}
            onChange={(e) => setNewCatType(e.target.value as TransactionType)}
            className="px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
          >
            <option value="expense" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">Pengeluaran</option>
            <option value="income" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">Pemasukan</option>
          </select>
          <button
            type="submit"
            disabled={!newCatName.trim()}
            className="px-3 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 disabled:opacity-40 rounded-lg text-xs font-medium transition-colors"
          >
            Tambah
          </button>
        </form>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-2.5 bg-white/70 dark:bg-neutral-900/50 rounded-lg border border-neutral-200/60 dark:border-neutral-800/60 text-xs"
            >
              <div className="flex items-center gap-2 truncate">
                <CategoryIcon name={c.name} size={14} className="text-neutral-500 dark:text-neutral-400" />
                <span className="text-neutral-800 dark:text-neutral-200 truncate">{c.name}</span>
              </div>
              <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                {c.type === 'expense' ? 'Keluar' : c.type === 'income' ? 'Masuk' : 'Semua'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Cadangan & Pemulihan Data */}
      <section className="space-y-3 pt-4 border-t border-neutral-200/70 dark:border-neutral-800/70">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Cadangan & Pemulihan
          </h2>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
            Semua transaksi disimpan secara lokal di peramban Anda. Anda dapat mengunduh salinan berkas cadangan kapan saja.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {/* Export JSON */}
          <button
            type="button"
            onClick={exportJSON}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors"
          >
            <Download size={14} />
            <span>Cadangkan Data (JSON)</span>
          </button>

          {/* Import JSON */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-700/60 transition-colors"
          >
            <Upload size={14} />
            <span>Pulihkan Data (JSON)</span>
          </button>

          {/* Reset to initial sample data */}
          <button
            type="button"
            onClick={resetToSampleData}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-lg transition-colors"
          >
            <RefreshCw size={14} />
            <span>Muat Data Contoh</span>
          </button>
        </div>
      </section>

      {/* 6. Zona Berbahaya */}
      <section className="space-y-3 pt-4 border-t border-neutral-200/70 dark:border-neutral-800/70">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
            Zona Berbahaya
          </h2>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
            Tindakan ini akan menghapus seluruh data transaksi lokal.
          </p>
        </div>

        {!confirmClear ? (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
          >
            <Trash2 size={14} />
            <span>Bersihkan Semua Data</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                clearAllData();
                setConfirmClear(false);
              }}
              className="px-3 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
            >
              Ya, Hapus Semua
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="px-3 py-2 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              Batal
            </button>
          </div>
        )}
      </section>

      {/* Account Modal */}
      <AddAccountModal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
      />

      {/* Recurring Modal */}
      <AddRecurringModal
        isOpen={isAddRecurringOpen}
        onClose={() => setIsAddRecurringOpen(false)}
      />

      {/* BCA Transaction Preview & Confirmation Modal */}
      <BcaPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        candidates={previewCandidates}
        onImportComplete={() => {
          fetchGmailStatus().then(setGmailStatus);
        }}
      />
    </div>
  );
};
