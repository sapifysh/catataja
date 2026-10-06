import React, { useMemo, useState } from 'react';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { useFinance } from '../context/FinanceContext';
import { formatRupiah } from '../utils/formatters';

type ReportPeriod = 'this_month' | 'last_month' | 'all_time';

export const LaporanPage: React.FC = () => {
  const { transactions } = useFinance();
  const [period, setPeriod] = useState<ReportPeriod>('this_month');

  // Filter transactions based on period
  const { filteredTx, periodLabel } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let txList = [...transactions];
    let label = 'Bulan ini';

    if (period === 'this_month') {
      const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
      txList = txList.filter((t) => t.date.startsWith(monthPrefix));
      label = 'Bulan ini';
    } else if (period === 'last_month') {
      const prevDate = new Date(currentYear, currentMonth - 1, 1);
      const prevPrefix = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      txList = txList.filter((t) => t.date.startsWith(prevPrefix));
      label = 'Bulan lalu';
    } else {
      label = 'Semua waktu';
    }

    return { filteredTx: txList, periodLabel: label };
  }, [transactions, period]);

  // Financial aggregates
  const { incomeTotal, expenseTotal, difference, categoryBreakdown } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    const catMap = new Map<string, number>();

    filteredTx.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'income') {
        inc += amt;
      } else {
        exp += amt;
        catMap.set(tx.category, (catMap.get(tx.category) || 0) + amt);
      }
    });

    // Sort category breakdown descending
    const breakdown = Array.from(catMap.entries())
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: exp > 0 ? Math.round((amount / exp) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      incomeTotal: inc,
      expenseTotal: exp,
      difference: inc - exp,
      categoryBreakdown: breakdown,
    };
  }, [filteredTx]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Laporan
          </h1>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-normal mt-0.5">
            Analisis arus kas dan pengeluaran berkala.
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex items-center p-0.5 bg-neutral-100 dark:bg-neutral-800/80 rounded-lg text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setPeriod('this_month')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              period === 'this_month'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            Bulan ini
          </button>
          <button
            type="button"
            onClick={() => setPeriod('last_month')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              period === 'last_month'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            Bulan lalu
          </button>
          <button
            type="button"
            onClick={() => setPeriod('all_time')}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              period === 'all_time'
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            Semua waktu
          </button>
        </div>
      </div>

      {/* Primary Financial Overview Row */}
      <div className="pt-2 border-t border-neutral-200/70 dark:border-neutral-800/70 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div>
          <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
            Total pemasukan
          </span>
          <div className="text-xl sm:text-2xl font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">
            {formatRupiah(incomeTotal)}
          </div>
        </div>

        <div>
          <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
            Total pengeluaran
          </span>
          <div className="text-xl sm:text-2xl font-semibold text-rose-600 dark:text-rose-400 tabular-nums mt-0.5">
            {formatRupiah(expenseTotal)}
          </div>
        </div>

        <div>
          <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium">
            Selisih
          </span>
          <div
            className={`text-xl sm:text-2xl font-semibold tabular-nums mt-0.5 ${
              difference >= 0 ? 'text-neutral-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {difference >= 0 ? `+ ${formatRupiah(difference)}` : formatRupiah(difference)}
          </div>
        </div>
      </div>

      {/* Category Breakdown Section */}
      <div className="pt-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Pengeluaran berdasarkan kategori
          </h2>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 font-normal mt-0.5">
            Persentase dan total pengeluaran untuk periode {periodLabel.toLowerCase()}.
          </p>
        </div>

        {categoryBreakdown.length > 0 ? (
          <div className="space-y-4 pt-1">
            {categoryBreakdown.map((item) => (
              <div key={item.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-200">
                    <CategoryIcon name={item.name} size={14} className="text-neutral-500 dark:text-neutral-400" />
                    <span>{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatRupiah(item.amount)}
                    </span>
                    <span className="text-[11px] text-neutral-400 dark:text-neutral-500 tabular-nums w-8 text-right">
                      {item.percentage}%
                    </span>
                  </div>
                </div>

                {/* Subtle horizontal progress bar */}
                <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-neutral-800 dark:bg-neutral-200 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-xs text-neutral-400 dark:text-neutral-500">
            Belum ada catatan pengeluaran pada periode ini.
          </div>
        )}
      </div>

      {/* Arus Kas Rasio Tabungan Quick Insight */}
      {incomeTotal > 0 && (
        <div className="p-4 bg-white/70 dark:bg-neutral-900/50 rounded-xl border border-neutral-200/60 dark:border-neutral-800/60 flex items-center justify-between text-xs">
          <div>
            <span className="font-medium text-neutral-800 dark:text-neutral-200 block">
              Rasio Tabungan
            </span>
            <span className="text-neutral-400 dark:text-neutral-500 mt-0.5 block">
              Persentase pemasukan yang berhasil Anda simpan
            </span>
          </div>
          <div className="text-right">
            <span className="text-base font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
              {Math.max(0, Math.round(((incomeTotal - expenseTotal) / incomeTotal) * 100))}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
