import React, { useMemo, useState } from 'react';
import { Download, Filter, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { useFinance } from '../context/FinanceContext';
import { Transaction, TransactionType } from '../types';
import { formatDateGroupHeader, formatRupiah } from '../utils/formatters';

type FilterType = 'all' | 'income' | 'expense';
type SortOption = 'newest' | 'oldest' | 'largest' | 'smallest';

export const TransaksiPage: React.FC = () => {
  const { transactions, categories, accounts, setEditingTransaction, setIsAddModalOpen, exportCSV } =
    useFinance();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);

  // Filter and Sort Logic
  const filteredTransactions = useMemo(() => {
    let result = [...transactions];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.account.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter((t) => t.type === filterType);
    }

    // Category filter
    if (selectedCategory !== 'all') {
      result = result.filter(
        (t) => t.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Account filter
    if (selectedAccount !== 'all') {
      result = result.filter(
        (t) => t.account.toLowerCase() === selectedAccount.toLowerCase()
      );
    }

    // Sorting
    result.sort((a, b) => {
      const timeB = (b.createdAt || b.created_at || '');
      const timeA = (a.createdAt || a.created_at || '');
      if (sortOption === 'newest') {
        return new Date(b.date).getTime() - new Date(a.date).getTime() || timeB.localeCompare(timeA);
      }
      if (sortOption === 'oldest') {
        return new Date(a.date).getTime() - new Date(b.date).getTime() || timeA.localeCompare(timeB);
      }
      if (sortOption === 'largest') {
        return b.amount - a.amount;
      }
      if (sortOption === 'smallest') {
        return a.amount - b.amount;
      }
      return 0;
    });

    return result;
  }, [transactions, searchQuery, filterType, selectedCategory, selectedAccount, sortOption]);

  // Group by date
  const groupedTransactions = useMemo(() => {
    const groups: { date: string; header: string; items: Transaction[] }[] = [];
    const dateMap = new Map<string, Transaction[]>();

    filteredTransactions.forEach((tx) => {
      const key = tx.date;
      if (!dateMap.has(key)) {
        dateMap.set(key, []);
      }
      dateMap.get(key)!.push(tx);
    });

    dateMap.forEach((items, dateKey) => {
      groups.push({
        date: dateKey,
        header: formatDateGroupHeader(dateKey),
        items,
      });
    });

    return groups;
  }, [filteredTransactions]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Transaksi
          </h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-normal mt-0.5">
            Semua pemasukan dan pengeluaran Anda.
          </p>
        </div>

        {/* Quick CSV Export */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/80 rounded-lg transition-colors"
          >
            <Download size={13} />
            <span>Ekspor CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-950 rounded-lg transition-colors shadow-xs"
          >
            <Plus size={13} />
            <span>Tambah</span>
          </button>
        </div>
      </div>

      {/* Search & Segmented Filter Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari transaksi..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/80 rounded-lg text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-hidden focus:border-neutral-400 dark:focus:border-neutral-500"
            />
          </div>

          {/* Type Segmented Buttons */}
          <div className="flex items-center p-0.5 bg-neutral-100 dark:bg-neutral-800/80 rounded-lg text-xs shrink-0">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterType('income')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filterType === 'income'
                  ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              Pemasukan
            </button>
            <button
              type="button"
              onClick={() => setFilterType('expense')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filterType === 'expense'
                  ? 'bg-white dark:bg-neutral-700 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-200'
              }`}
            >
              Pengeluaran
            </button>
          </div>

          {/* Toggle Filter Dropdowns button */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg border text-xs flex items-center justify-center transition-colors ${
              showFilters
                ? 'bg-neutral-200 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white'
                : 'bg-white dark:bg-neutral-800/80 border-neutral-200/80 dark:border-neutral-700/80 text-neutral-600 dark:text-neutral-400'
            }`}
            title="Filter lanjutan"
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>

        {/* Extended Filters (Kategori, Sumber dana, Urutkan) */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-lg border border-neutral-200/60 dark:border-neutral-800/60 text-xs">
            {/* Category Filter */}
            <div>
              <label className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 block mb-1">
                Kategori
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-white focus:outline-hidden"
              >
                <option value="all">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Account Filter */}
            <div>
              <label className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 block mb-1">
                Sumber dana
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-white focus:outline-hidden"
              >
                <option value="all">Semua Sumber Dana</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.name}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Options */}
            <div>
              <label className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 block mb-1">
                Urutkan
              </label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md text-neutral-900 dark:text-white focus:outline-hidden"
              >
                <option value="newest">Terbaru</option>
                <option value="oldest">Terlama</option>
                <option value="largest">Nominal terbesar</option>
                <option value="smallest">Nominal terkecil</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Grouped Transactions List */}
      {groupedTransactions.length > 0 ? (
        <div className="space-y-6 pt-2">
          {groupedTransactions.map((group) => (
            <div key={group.date} className="space-y-1">
              {/* Group Date Header */}
              <div className="text-[11px] font-semibold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase px-1">
                {group.header}
              </div>

              {/* Transactions in Date Group */}
              <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                {group.items.map((tx) => {
                  const isIncome = tx.type === 'income';
                  return (
                    <div
                      key={tx.id}
                      onClick={() => setEditingTransaction(tx)}
                      role="button"
                      tabIndex={0}
                      className="flex items-center justify-between py-3 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/40 rounded-lg px-2 -mx-2 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 shrink-0">
                          <CategoryIcon name={tx.category} size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100 truncate">
                            {tx.description}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                            <span>{tx.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{tx.account}</span>
                            {tx.notes && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="truncate max-w-[140px] italic">
                                  {tx.notes}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right pl-3 shrink-0">
                        <span
                          className={`text-xs font-medium tabular-nums ${
                            isIncome
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isIncome
                            ? `+ ${formatRupiah(tx.amount)}`
                            : `− ${formatRupiah(tx.amount)}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="py-16 text-center">
          <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
            Tidak ada transaksi ditemukan.
          </p>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 mb-4">
            Coba sesuaikan kata kunci pencarian atau filter Anda.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterType('all');
              setSelectedCategory('all');
              setSelectedAccount('all');
            }}
            className="text-xs font-medium text-neutral-900 dark:text-white underline underline-offset-4"
          >
            Reset filter
          </button>
        </div>
      )}
    </div>
  );
};
