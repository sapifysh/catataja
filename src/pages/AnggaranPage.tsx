import React, { useMemo, useState } from 'react';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { AddBudgetModal } from '../components/modals/AddBudgetModal';
import { useFinance } from '../context/FinanceContext';
import { formatRupiah } from '../utils/formatters';

export const AnggaranPage: React.FC = () => {
  const { budgets, transactions, deleteBudget } = useFinance();
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);

  // Compute current month's spending for each budgeted category
  const { budgetItems, totalBudgetAmount, totalSpentAmount } = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let totalBudget = 0;
    let totalSpent = 0;

    const items = budgets.map((b) => {
      // Sum expenses for this category in current month
      const spent = transactions
        .filter((tx) => {
          if (tx.type !== 'expense') return false;
          if (tx.category.toLowerCase() !== b.category.toLowerCase()) return false;
          return tx.date.startsWith(currentMonthKey);
        })
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

      const percent = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      totalBudget += b.amount;
      totalSpent += spent;

      return {
        ...b,
        spent,
        percent,
        remaining: b.amount - spent,
      };
    });

    return {
      budgetItems: items,
      totalBudgetAmount: totalBudget,
      totalSpentAmount: totalSpent,
    };
  }, [budgets, transactions]);

  const overallPercent =
    totalBudgetAmount > 0 ? Math.round((totalSpentAmount / totalBudgetAmount) * 100) : 0;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Anggaran
          </h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-normal mt-0.5">
            Atur batas pengeluaran bulanan Anda.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddBudgetOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-950 rounded-lg transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus size={13} />
          <span>Buat anggaran</span>
        </button>
      </div>

      {/* Monthly Budget Summary Banner */}
      {totalBudgetAmount > 0 && (
        <div className="p-4 bg-white/70 dark:bg-neutral-900/50 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Total Penggunaan Anggaran Bulan Ini
            </span>
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
              {formatRupiah(totalSpentAmount)} / {formatRupiah(totalBudgetAmount)} ({overallPercent}%)
            </span>
          </div>

          <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                overallPercent > 100
                  ? 'bg-rose-500'
                  : overallPercent >= 80
                  ? 'bg-amber-500'
                  : 'bg-neutral-800 dark:bg-neutral-200'
              }`}
              style={{ width: `${Math.min(overallPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Budget Items List */}
      <div className="space-y-5 pt-2">
        {budgetItems.length > 0 ? (
          budgetItems.map((item) => {
            const isExceeded = item.percent > 100;
            const isWarning = item.percent >= 80 && !isExceeded;

            return (
              <div
                key={item.id}
                className="space-y-2 p-3.5 bg-white/50 dark:bg-neutral-900/30 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 transition-colors"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-300">
                      <CategoryIcon name={item.category} size={14} />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        {item.category}
                      </h3>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                        {isExceeded
                          ? `Melebihi ${formatRupiah(Math.abs(item.remaining))}`
                          : `Tersisa ${formatRupiah(item.remaining)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                        {formatRupiah(item.spent)}{' '}
                        <span className="font-normal text-neutral-400 dark:text-neutral-500">
                          / {formatRupiah(item.amount)}
                        </span>
                      </div>
                      <div
                        className={`text-[10px] font-medium tabular-nums ${
                          isExceeded
                            ? 'text-rose-600 dark:text-rose-400'
                            : isWarning
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        {item.percent}%
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => deleteBudget(item.id)}
                      className="p-1 text-neutral-300 hover:text-rose-500 dark:text-neutral-600 dark:hover:text-rose-400 transition-colors"
                      title="Hapus anggaran"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Subtle progress bar */}
                <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isExceeded
                        ? 'bg-rose-500'
                        : isWarning
                        ? 'bg-amber-500'
                        : 'bg-neutral-800 dark:bg-neutral-200'
                    }`}
                    style={{ width: `${Math.min(item.percent, 100)}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center">
            <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
              Belum ada anggaran bulanan yang dibuat.
            </p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 mb-4">
              Tentukan batas belanja untuk makanan, transportasi, dan kebutuhan lainnya.
            </p>
            <button
              type="button"
              onClick={() => setIsAddBudgetOpen(true)}
              className="inline-flex items-center gap-1.5 py-2 px-3.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 rounded-lg text-xs font-medium transition-colors"
            >
              <Plus size={13} />
              <span>Buat anggaran</span>
            </button>
          </div>
        )}
      </div>

      <AddBudgetModal
        isOpen={isAddBudgetOpen}
        onClose={() => setIsAddBudgetOpen(false)}
      />
    </div>
  );
};
