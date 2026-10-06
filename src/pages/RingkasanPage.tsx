import React, { useState } from 'react';
import { ArrowUpRight, Plus, ChevronRight } from 'lucide-react';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { SpendingChart, SpendingPeriod } from '../components/common/SpendingChart';
import { useFinance } from '../context/FinanceContext';
import { formatFullIndonesianDate, formatRupiah, formatSignedRupiah } from '../utils/formatters';

export const RingkasanPage: React.FC = () => {
  const {
    totalBalance,
    totalIncome,
    totalExpense,
    netDifference,
    transactions,
    accounts,
    accountBalances,
    setActiveTab,
    setIsAddModalOpen,
    setEditingTransaction,
  } = useFinance();

  const [period, setPeriod] = useState<SpendingPeriod>('bulan_ini');

  const todayFormatted = formatFullIndonesianDate(new Date());

  // Recent 5 transactions
  const recentTransactions = transactions.slice(0, 5);

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      {/* Header Zone */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Ringkasan
        </h1>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
          {todayFormatted}
        </p>
      </div>

      {/* Main Financial Balance Anchor */}
      <div className="pt-2">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          Total saldo
        </p>
        <div className="mt-1 text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-neutral-900 dark:text-white tabular-nums">
          {formatRupiah(totalBalance)}
        </div>

        {/* Lightweight 3 Metrics (Pemasukan, Pengeluaran, Selisih) - No heavy card boxiness */}
        <div className="mt-6 pt-5 border-t border-neutral-200/70 dark:border-neutral-800/70 grid grid-cols-3 gap-2 sm:gap-6">
          {/* Pemasukan */}
          <div>
            <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 block">
              Pemasukan
            </span>
            <span className="text-sm sm:text-base font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5 block">
              {formatSignedRupiah(totalIncome, 'income')}
            </span>
          </div>

          {/* Pengeluaran */}
          <div>
            <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 block">
              Pengeluaran
            </span>
            <span className="text-sm sm:text-base font-semibold text-rose-600 dark:text-rose-400 tabular-nums mt-0.5 block">
              {formatSignedRupiah(totalExpense, 'expense')}
            </span>
          </div>

          {/* Selisih */}
          <div>
            <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 block">
              Selisih
            </span>
            <span
              className={`text-sm sm:text-base font-semibold tabular-nums mt-0.5 block ${
                netDifference >= 0
                  ? 'text-neutral-900 dark:text-white'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {netDifference >= 0
                ? `+ ${formatRupiah(netDifference)}`
                : formatSignedRupiah(netDifference, 'expense')}
            </span>
          </div>
        </div>
      </div>

      {/* Sumber Dana / Saldo Akun (Unboxed clean row) */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Sumber dana
          </h2>
          <button
            type="button"
            onClick={() => setActiveTab('pengaturan')}
            className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
          >
            Kelola
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {accounts.map((acc) => {
            const currentBal = accountBalances[acc.name] ?? accountBalances[acc.id] ?? acc.initialBalance;
            return (
              <div
                key={acc.id}
                className="p-3 bg-white/70 dark:bg-neutral-900/50 rounded-lg border border-neutral-200/60 dark:border-neutral-800/60"
              >
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium truncate">
                  {acc.name}
                </div>
                <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums mt-1">
                  {formatRupiah(currentBal)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spending Chart Section */}
      <div className="pt-2">
        <SpendingChart
          transactions={transactions}
          selectedPeriod={period}
          onPeriodChange={setPeriod}
        />
      </div>

      {/* Recent Transactions Section */}
      <div className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Transaksi terbaru
          </h2>
          <button
            type="button"
            onClick={() => setActiveTab('transaksi')}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors flex items-center gap-0.5"
          >
            <span>Lihat semua</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Clean list with subtle dividers */}
        {recentTransactions.length > 0 ? (
          <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
            {recentTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              return (
                <div
                  key={tx.id}
                  onClick={() => setEditingTransaction(tx)}
                  role="button"
                  tabIndex={0}
                  className="flex items-center justify-between py-3 hover:bg-neutral-100/50 dark:hover:bg-neutral-900/40 rounded-lg px-2 -mx-2 transition-colors cursor-pointer group"
                >
                  {/* Left: Icon & Info */}
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
                      </div>
                    </div>
                  </div>

                  {/* Right: Amount */}
                  <div className="text-right pl-3 shrink-0">
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        isIncome
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isIncome ? `+ ${formatRupiah(tx.amount)}` : `− ${formatRupiah(tx.amount)}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="py-12 text-center">
            <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              Mulai catat keuanganmu.
            </h3>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-xs mx-auto mt-1 mb-4">
              Tambahkan transaksi pertama untuk mulai melihat kondisi keuanganmu.
            </p>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 rounded-lg text-xs font-medium transition-colors"
            >
              <Plus size={14} />
              <span>Tambah transaksi</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
