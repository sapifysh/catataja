import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { AccountType } from '../../types';
import { parseRupiahInput } from '../../utils/formatters';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({ isOpen, onClose }) => {
  const { addAccount } = useFinance();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [rawBalance, setRawBalance] = useState('0');

  if (!isOpen) return null;

  const numericBalance = parseRupiahInput(rawBalance);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    addAccount({
      name: name.trim(),
      type,
      balance: numericBalance,
      initialBalance: numericBalance,
    });
    setName('');
    setRawBalance('0');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm bg-[#FAFAFA] dark:bg-[#121316] rounded-xl shadow-2xl border border-neutral-200/80 dark:border-neutral-800 p-5 z-10 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Tambah Sumber Dana
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
              Nama Akun / Dompet
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: BRI, OVO, Dompet Saku"
              className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Jenis Sumber Dana
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
            >
              <option value="bank" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">Bank (Transfer / Rekening)</option>
              <option value="cash" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">Tunai (Uang Fisik)</option>
              <option value="ewallet" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">E-Wallet (GoPay, OVO, DANA)</option>
              <option value="credit" className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white">Kartu Kredit</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300 block mb-1">
              Saldo Awal (Rp)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={numericBalance > 0 ? numericBalance.toLocaleString('id-ID') : ''}
              onChange={(e) => setRawBalance(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 text-xs tabular-nums bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-neutral-900 dark:text-white focus:outline-hidden"
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
              disabled={!name.trim()}
              className="py-2 px-4 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 disabled:opacity-40 rounded-lg text-xs font-medium transition-colors"
            >
              Simpan Sumber Dana
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
