import React, { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { TransactionType } from '../../types';
import { getTodayString, getYesterdayString, parseRupiahInput } from '../../utils/formatters';
import { CategoryIcon } from '../common/CategoryIcon';

export const AddTransactionModal: React.FC = () => {
  const { isAddModalOpen, setIsAddModalOpen, addTransaction, categories, accounts } = useFinance();

  const [type, setType] = useState<TransactionType>('expense');
  const [rawAmount, setRawAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<string>('Makanan');
  const [account, setAccount] = useState<string>('BCA');
  const [date, setDate] = useState<string>(getTodayString());
  const [notes, setNotes] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false);

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Reset form when opened
  useEffect(() => {
    if (isAddModalOpen) {
      setRawAmount('');
      setDescription('');
      setDate(getTodayString());
      setNotes('');
      setShowDatePicker(false);
      setIsCreatingCategory(false);
      if (type === 'expense') {
        setCategory('Makanan');
      } else {
        setCategory('Gaji');
      }
      if (accounts.length > 0) {
        setAccount(accounts[0].name);
      }
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
    }
  }, [isAddModalOpen]);

  // Update default category when type toggles
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'expense') {
      const firstExp = categories.find((c) => c.type === 'expense' || c.type === 'both');
      setCategory(firstExp ? firstExp.name : 'Makanan');
    } else {
      const firstInc = categories.find((c) => c.type === 'income' || c.type === 'both');
      setCategory(firstInc ? firstInc.name : 'Gaji');
    }
  };

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAddModalOpen) {
        setIsAddModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddModalOpen, setIsAddModalOpen]);

  if (!isAddModalOpen) return null;

  const numericAmount = parseRupiahInput(rawAmount);

  // Formatted display of amount input
  const formattedDisplay = numericAmount > 0 ? numericAmount.toLocaleString('id-ID') : '';

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setRawAmount(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numericAmount <= 0) {
      amountInputRef.current?.focus();
      return;
    }

    addTransaction({
      type,
      amount: numericAmount,
      description: description.trim() || (type === 'expense' ? 'Pengeluaran' : 'Pemasukan'),
      category: category || (type === 'expense' ? 'Lainnya' : 'Gaji'),
      account: account || 'Tunai',
      date: date || getTodayString(),
      notes: notes.trim() || undefined,
    });

    setIsAddModalOpen(false);
  };

  const filteredCategories = categories.filter(
    (c) => c.type === type || c.type === 'both'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity duration-200">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0"
        onClick={() => setIsAddModalOpen(false)}
        aria-hidden="true"
      />

      {/* Modal Dialog / Sheet */}
      <div className="relative w-full max-w-md bg-[#FAFAFA] dark:bg-[#121316] rounded-t-2xl sm:rounded-xl shadow-2xl border border-neutral-200/80 dark:border-neutral-800 p-5 sm:p-6 z-10 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Tambah transaksi
          </h2>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(false)}
            className="p-1 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300 rounded-md transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Segmented Toggle: Pengeluaran | Pemasukan */}
          <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-lg">
            <button
              type="button"
              onClick={() => handleTypeChange('expense')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                type === 'expense'
                  ? 'bg-white dark:bg-neutral-700 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('income')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                type === 'income'
                  ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
              }`}
            >
              Pemasukan
            </button>
          </div>

          {/* Prominent Amount Field */}
          <div className="py-2 text-center border-b border-neutral-200/70 dark:border-neutral-800/70">
            <label className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 block mb-1">
              Nominal
            </label>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-xl sm:text-2xl font-light text-neutral-400 dark:text-neutral-500">
                Rp
              </span>
              <input
                ref={amountInputRef}
                type="text"
                inputMode="numeric"
                value={formattedDisplay}
                onChange={handleAmountChange}
                placeholder="0"
                className="w-full text-center text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900 dark:text-white bg-transparent outline-hidden tabular-nums placeholder:text-neutral-300 dark:placeholder:text-neutral-700"
              />
            </div>
          </div>

          {/* Keterangan Field */}
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Keterangan
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={type === 'expense' ? 'Apa yang dibeli?' : 'Dari mana pemasukannya?'}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
            />
          </div>

          {/* Kategori Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Kategori
              </label>
            </div>

            {/* Quick Category Chips Grid */}
            <div className="grid grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 bg-white/50 dark:bg-neutral-850/40 rounded-lg border border-neutral-200/60 dark:border-neutral-800/60">
              {filteredCategories.map((c) => {
                const isSelected = category.toLowerCase() === c.name.toLowerCase();
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors text-left truncate ${
                      isSelected
                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 font-medium'
                        : 'bg-neutral-100/80 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-700/70'
                    }`}
                  >
                    <CategoryIcon
                      name={c.name}
                      size={13}
                      className={isSelected ? 'text-white dark:text-neutral-950' : 'text-neutral-500 dark:text-neutral-400'}
                    />
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tanggal & Sumber Dana in 2 Columns */}
          <div className="grid grid-cols-2 gap-3">
            {/* Tanggal */}
            <div>
              <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
                Tanggal
              </label>
              {!showDatePicker ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDate(getTodayString())}
                    className={`flex-1 py-1.5 px-2 text-[11px] font-medium rounded-md border text-center transition-colors ${
                      date === getTodayString()
                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 border-neutral-900 dark:border-neutral-100'
                        : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    Hari ini
                  </button>
                  <button
                    type="button"
                    onClick={() => setDate(getYesterdayString())}
                    className={`flex-1 py-1.5 px-2 text-[11px] font-medium rounded-md border text-center transition-colors ${
                      date === getYesterdayString()
                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 border-neutral-900 dark:border-neutral-100'
                        : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    Kemarin
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDatePicker(true)}
                    className="py-1.5 px-2 text-[11px] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-md border border-neutral-200 dark:border-neutral-700"
                    title="Pilih tanggal lain"
                  >
                    •••
                  </button>
                </div>
              ) : (
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
                />
              )}
            </div>

            {/* Sumber Dana */}
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

          {/* Catatan Field (Optional) */}
          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Catatan <span className="text-neutral-400 font-normal">(opsional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tambahkan catatan..."
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:border-neutral-400 dark:focus:border-neutral-500"
            />
          </div>

          {/* Primary Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={numericAmount <= 0}
              className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-colors shadow-xs active:scale-[0.99]"
            >
              Simpan transaksi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
