import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { RecurringFrequency, TransactionType } from '../../types';
import { getTodayString, parseRupiahInput } from '../../utils/formatters';

interface AddRecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddRecurringModal: React.FC<AddRecurringModalProps> = ({ isOpen, onClose }) => {
  const { addRecurring, categories, accounts } = useFinance();
  const [type, setType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [rawAmount, setRawAmount] = useState('150000');
  const [category, setCategory] = useState('Tagihan');
  const [account, setAccount] = useState('BCA');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [nextDate, setNextDate] = useState(getTodayString());

  if (!isOpen) return null;

  const numericAmount = parseRupiahInput(rawAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0 || !description.trim()) return;

    addRecurring({
      type,
      description: description.trim(),
      amount: numericAmount,
      category,
      account,
      frequency,
      next_date: nextDate,
      active: true,
    });

    setDescription('');
    onClose();
  };

  const filteredCategories = categories.filter((c) => c.type === type || c.type === 'both');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm bg-[#FAFAFA] dark:bg-[#121316] rounded-xl shadow-2xl border border-neutral-200/80 dark:border-neutral-800 p-5 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Tambah Transaksi Rutin
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300 rounded-md"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex-1 py-1 rounded-md font-medium transition-colors ${
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
              className={`flex-1 py-1 rounded-md font-medium transition-colors ${
                type === 'income'
                  ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              Pemasukan
            </button>
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Keterangan
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Netflix, Internet WiFi, Gaji"
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Nominal (Rp)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={numericAmount > 0 ? numericAmount.toLocaleString('id-ID') : ''}
              onChange={(e) => setRawAmount(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-1.5 text-xs tabular-nums bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                Kategori
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
              >
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.name} className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                Frekuensi
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full px-2 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
              >
                <option value="daily" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">Harian</option>
                <option value="weekly" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">Mingguan</option>
                <option value="monthly" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">Bulanan</option>
                <option value="yearly" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">Tahunan</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={numericAmount <= 0 || !description.trim()}
              className="py-1.5 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 disabled:opacity-40 rounded-lg text-xs font-medium transition-colors"
            >
              Simpan Rutinitas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
