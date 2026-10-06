import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { parseRupiahInput } from '../../utils/formatters';

interface AddBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddBudgetModal: React.FC<AddBudgetModalProps> = ({ isOpen, onClose }) => {
  const { addBudget, categories, budgets } = useFinance();
  const [category, setCategory] = useState<string>('Makanan');
  const [rawAmount, setRawAmount] = useState<string>('1000000');

  if (!isOpen) return null;

  const expenseCategories = categories.filter((c) => c.type === 'expense' || c.type === 'both');
  const numericAmount = parseRupiahInput(rawAmount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) return;

    // Check if budget for category already exists
    const existing = budgets.find((b) => b.category.toLowerCase() === category.toLowerCase());
    if (existing) {
      // Prompt user or handle nicely
    }

    addBudget({
      category,
      amount: numericAmount,
      period: 'monthly',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm bg-[#FAFAFA] dark:bg-[#121316] rounded-xl shadow-2xl border border-neutral-200/80 dark:border-neutral-800 p-5 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Buat Anggaran Bulanan
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300 rounded-md"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Kategori
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
            >
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.name} className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Batas Maksimal Bulanan (Rp)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={numericAmount > 0 ? numericAmount.toLocaleString('id-ID') : ''}
              onChange={(e) => setRawAmount(e.target.value)}
              placeholder="Contoh: 1.500.000"
              className="w-full px-3 py-2 text-sm font-medium tabular-nums bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={numericAmount <= 0}
              className="py-2 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 disabled:opacity-40 rounded-lg text-xs font-medium transition-colors"
            >
              Simpan Anggaran
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
