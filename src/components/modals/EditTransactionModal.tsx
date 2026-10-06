import React, { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { TransactionType } from '../../types';
import { parseRupiahInput } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';

export const EditTransactionModal: React.FC = () => {
  const {
    editingTransaction,
    setEditingTransaction,
    updateTransaction,
    deleteTransaction,
    categories,
    accounts,
  } = useFinance();

  const [type, setType] = useState<TransactionType>('expense');
  const [rawAmount, setRawAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [account, setAccount] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isConfirmDelete, setIsConfirmDelete] = useState<boolean>(false);

  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setRawAmount(editingTransaction.amount.toString());
      setDescription(editingTransaction.description);
      setCategory(editingTransaction.category);
      setAccount(editingTransaction.account);
      setDate(editingTransaction.date);
      setNotes(editingTransaction.notes || '');
      setIsConfirmDelete(false);
    }
  }, [editingTransaction]);

  if (!editingTransaction) return null;

  const numericAmount = parseRupiahInput(rawAmount);
  const formattedDisplay = numericAmount > 0 ? numericAmount.toLocaleString('id-ID') : '';

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setRawAmount(val);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) return;

    updateTransaction(editingTransaction.id, {
      type,
      amount: numericAmount,
      description: description.trim() || 'Transaksi',
      category: category || 'Lainnya',
      account: account || 'Tunai',
      date,
      notes: notes.trim() || undefined,
    });

    setEditingTransaction(null);
  };

  const handleDelete = () => {
    deleteTransaction(editingTransaction.id);
    setEditingTransaction(null);
  };

  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === 'both'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity duration-200">
      <div
        className="fixed inset-0"
        onClick={() => setEditingTransaction(null)}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-[#FAFAFA] dark:bg-[#121316] rounded-t-2xl sm:rounded-xl shadow-2xl border border-neutral-200/80 dark:border-neutral-800 p-5 sm:p-6 z-10 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Detail Transaksi
          </h2>
          <button
            type="button"
            onClick={() => setEditingTransaction(null)}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300 rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Toggle Type */}
          <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-lg">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                type === 'expense'
                  ? 'bg-white dark:bg-neutral-700 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                type === 'income'
                  ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Pemasukan
            </button>
          </div>

          {/* Amount */}
          <div className="py-2 text-center border-b border-neutral-200/70 dark:border-neutral-800/70">
            <label className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 block mb-1">
              Nominal
            </label>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-xl sm:text-2xl font-light text-neutral-400 dark:text-neutral-500">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={formattedDisplay}
                onChange={handleAmountChange}
                className="w-full text-center text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900 dark:text-white bg-transparent outline-hidden tabular-nums"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Keterangan
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
            />
          </div>

          {/* Category Chips */}
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1.5">
              Kategori
            </label>
            <div className="grid grid-cols-3 gap-1.5 max-h-32 overflow-y-auto p-1 bg-white/50 dark:bg-neutral-850/40 rounded-lg border border-neutral-200/60 dark:border-neutral-800/60">
              {filteredCategories.map((c) => {
                const isSelected = category.toLowerCase() === c.name.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.name)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors text-left truncate ${
                      isSelected
                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 font-medium'
                        : 'bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <CategoryIcon
                      name={c.name}
                      size={12}
                      className={isSelected ? 'text-white dark:text-neutral-950' : 'text-neutral-500 dark:text-neutral-400'}
                    />
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Account */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                Tanggal
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                Sumber dana
              </label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.name} className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Catatan
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tambahkan catatan..."
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center gap-2">
            {!isConfirmDelete ? (
              <button
                type="button"
                onClick={() => setIsConfirmDelete(true)}
                className="py-2.5 px-3 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-xs font-medium transition-colors"
                title="Hapus transaksi"
              >
                <Trash2 size={15} />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="py-2 px-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  Yakin Hapus?
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmDelete(false)}
                  className="py-2 px-2 text-neutral-500 hover:text-neutral-700 text-xs font-medium"
                >
                  Batal
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={numericAmount <= 0}
              className="flex-1 py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 rounded-lg text-xs font-medium transition-colors shadow-xs"
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
