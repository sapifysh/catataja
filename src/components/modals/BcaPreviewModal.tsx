import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Mail,
  ShieldCheck,
  X,
} from 'lucide-react';
import { doc, getDoc, increment, setDoc } from 'firebase/firestore';
import { useFinance } from '../../context/FinanceContext';
import { db } from '../../lib/firebase';
import {
  BcaCandidateTransaction,
  confirmImportedTransactions,
} from '../../services/gmailService';
import { formatRupiah } from '../../utils/formatters';

interface BcaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidates: BcaCandidateTransaction[];
  onImportComplete: () => void;
}

export const BcaPreviewModal: React.FC<BcaPreviewModalProps> = ({
  isOpen,
  onClose,
  candidates,
  onImportComplete,
}) => {
  const { addTransaction, transactions, categories, showToast, currentUser } =
    useFinance();

  // State: selected message IDs (defaults to all new/unimported ones)
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    candidates.filter((c) => !c.alreadyImported).map((c) => c.messageId)
  );

  // State: category overrides per messageId
  const [categoryOverrides, setCategoryOverrides] = useState<
    Record<string, string>
  >({});

  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const newCandidates = candidates.filter((c) => !c.alreadyImported);
  const alreadyImportedCount = candidates.filter((c) => c.alreadyImported).length;

  const toggleSelect = (messageId: string) => {
    setSelectedIds((prev) =>
      prev.includes(messageId)
        ? prev.filter((id) => id !== messageId)
        : [...prev, messageId]
    );
  };

  const selectAllNew = () => {
    setSelectedIds(newCandidates.map((c) => c.messageId));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const handleCategoryChange = (messageId: string, category: string) => {
    setCategoryOverrides((prev) => ({ ...prev, [messageId]: category }));
  };

  const handleImport = async () => {
    const toImport = candidates.filter((c) => selectedIds.includes(c.messageId));
    if (toImport.length === 0) return;

    setIsSubmitting(true);
    const nowIso = new Date().toISOString();
    const userUid = currentUser?.uid || 'user-default';
    const userEmail = currentUser?.email || 'hitamdimas6@gmail.com';
    let newlyCreatedCount = 0;

    try {
      // 1. Transaction-Safe / Create-If-Not-Exists Import
      // If a transaction with tx-bca-${messageId} already exists, do NOT overwrite it!
      // This preserves all user-edited fields (category, notes, description, amount, date).
      for (const item of toImport) {
        const finalCategory = categoryOverrides[item.messageId] || item.category;
        const txDocId = `tx-bca-${item.messageId}`;

        let alreadyExists = false;

        // Check local state
        if (transactions.some((t) => t.id === txDocId)) {
          alreadyExists = true;
        }

        // Check Firestore document
        if (!alreadyExists && currentUser) {
          try {
            const existingSnap = await getDoc(doc(db, 'transactions', txDocId));
            if (existingSnap.exists()) {
              alreadyExists = true;
            }
          } catch (e) {
            console.warn(`Could not verify existence of ${txDocId}:`, e);
          }
        }

        if (alreadyExists) {
          // Transaction already exists! Preserve user edits and skip overwrite.
          console.log(`Preserving user-edited transaction ${txDocId}`);
        } else {
          // Create new transaction safely
          await addTransaction({
            id: txDocId,
            type: item.type,
            amount: item.amount,
            description: item.description,
            category: finalCategory,
            account: 'BCA',
            date: item.date,
            notes: item.notes || `Diimpor otomatis dari email BCA (${item.sender})`,
          });
          newlyCreatedCount++;
        }

        // 2. Ensure durable tracking in Firestore collection 'gmail_imported_messages'
        if (currentUser) {
          try {
            const trackerRef = doc(db, 'gmail_imported_messages', item.messageId);
            const trackerSnap = await getDoc(trackerRef);
            if (!trackerSnap.exists()) {
              await setDoc(trackerRef, {
                messageId: item.messageId,
                transactionId: txDocId,
                date: item.date,
                amount: item.amount,
                description: item.description,
                category: finalCategory,
                sender: item.sender,
                importedAt: nowIso,
                userId: userUid,
                userEmail: userEmail,
              });
            }
          } catch (e) {
            console.warn('Failed to record imported message in Firestore:', e);
          }
        }
      }

      // 3. Notify server-side for server-generated synchronization metadata
      await confirmImportedTransactions(
        toImport.map((i) => i.messageId),
        newlyCreatedCount
      );

      showToast(
        newlyCreatedCount > 0
          ? `Berhasil mencatat ${newlyCreatedCount} transaksi baru BCA ke Firestore.`
          : 'Semua transaksi BCA terpilih sudah ada sebelumnya dan data kustom Anda tetap aman.'
      );
      onImportComplete();
      onClose();
    } catch {
      showToast('Kendala saat menyimpan transaksi BCA.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/50">
              <Mail size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Pratinjau Transaksi BCA dari Gmail
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Tinjau notifikasi resmi BCA sebelum dicatat ke Firestore. Transaksi yang sudah ada dan telah diedit manual dijamin tidak akan tertimpa.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats bar & select all */}
        <div className="px-5 py-2.5 bg-neutral-50/80 dark:bg-neutral-900/80 border-b border-neutral-200/60 dark:border-neutral-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 text-neutral-500 dark:text-neutral-400">
            <span>
              Total: <strong className="text-neutral-800 dark:text-neutral-200">{candidates.length}</strong>
            </span>
            <span>•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {newCandidates.length} Baru
            </span>
            {alreadyImportedCount > 0 && (
              <>
                <span>•</span>
                <span className="text-neutral-400 dark:text-neutral-500">
                  {alreadyImportedCount} Sudah Dicatat di Firestore
                </span>
              </>
            )}
          </div>

          {newCandidates.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAllNew}
                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Pilih Semua Baru
              </button>
              <span className="text-neutral-300 dark:text-neutral-700">|</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-[11px] font-medium text-neutral-500 hover:underline cursor-pointer"
              >
                Batal Pilih
              </button>
            </div>
          )}
        </div>

        {/* Candidate List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {candidates.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 space-y-2">
              <AlertCircle size={32} className="mx-auto opacity-50" />
              <p className="text-sm font-medium">Tidak ada notifikasi transaksi BCA baru.</p>
              <p className="text-xs text-neutral-500">
                Pencarian hanya menyaring email resmi transaksi dari alamat pengirim allowlist BCA.
              </p>
            </div>
          ) : (
            candidates.map((item) => {
              const isSelected = selectedIds.includes(item.messageId);
              const isExpense = item.type === 'expense';
              const selectedCategory =
                categoryOverrides[item.messageId] || item.category;

              return (
                <div
                  key={item.messageId}
                  className={`p-3.5 rounded-xl border transition-all ${
                    item.alreadyImported
                      ? 'bg-neutral-50/50 dark:bg-neutral-900/30 border-neutral-200/50 dark:border-neutral-800/50 opacity-60'
                      : isSelected
                      ? 'bg-blue-50/30 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/70 shadow-xs'
                      : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="pt-0.5">
                      <input
                        type="checkbox"
                        disabled={item.alreadyImported}
                        checked={isSelected}
                        onChange={() => toggleSelect(item.messageId)}
                        className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isExpense
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                            }`}
                          >
                            {isExpense ? (
                              <ArrowDownLeft size={11} />
                            ) : (
                              <ArrowUpRight size={11} />
                            )}
                            {isExpense ? 'Pengeluaran' : 'Pemasukan'}
                          </span>

                          <span className="text-[10px] font-mono text-neutral-400 flex items-center gap-1">
                            <Clock size={10} />
                            {item.date} {item.time ? `• ${item.time} WIB` : ''}
                          </span>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              isExpense
                                ? 'text-neutral-900 dark:text-neutral-100'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isExpense ? '-' : '+'}
                            {formatRupiah(item.amount)}
                          </span>
                        </div>
                      </div>

                      {/* Description & Sender */}
                      <div className="mt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                          {item.description}
                        </p>
                        <span className="text-[10px] text-neutral-400 flex items-center gap-1 shrink-0">
                          <ShieldCheck size={11} className="text-blue-500" />
                          <span>{item.sender}</span>
                        </span>
                      </div>

                      {/* Category selector & status */}
                      <div className="mt-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-neutral-400">Kategori:</span>
                          <select
                            disabled={item.alreadyImported}
                            value={selectedCategory}
                            onChange={(e) =>
                              handleCategoryChange(item.messageId, e.target.value)
                            }
                            className="text-xs bg-neutral-100 dark:bg-neutral-800 border-none rounded px-2 py-0.5 text-neutral-700 dark:text-neutral-300 focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                          >
                            {categories
                              .filter(
                                (cat) =>
                                  cat.type === item.type || cat.type === 'both'
                              )
                              .map((cat) => (
                                <option key={cat.id} value={cat.name}>
                                  {cat.name}
                                </option>
                              ))}
                          </select>
                        </div>

                        {item.alreadyImported ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400">
                            <Check size={11} /> Sudah tercatat di Firestore
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <CheckCircle2 size={11} /> Siap dicatat
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 bg-neutral-50/50 dark:bg-neutral-900/50">
          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {selectedIds.length} dari {newCandidates.length} transaksi baru dipilih
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl text-xs font-medium transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0 || isSubmitting}
              onClick={handleImport}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-medium transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span>Menyimpan ke Firestore...</span>
              ) : (
                <span>Impor {selectedIds.length} Transaksi</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
