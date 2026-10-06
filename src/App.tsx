/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { MobileNav } from './components/layout/MobileNav';
import { Sidebar } from './components/layout/Sidebar';
import { Toast } from './components/layout/Toast';
import { AddTransactionModal } from './components/modals/AddTransactionModal';
import { EditTransactionModal } from './components/modals/EditTransactionModal';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { AnggaranPage } from './pages/AnggaranPage';
import { LaporanPage } from './pages/LaporanPage';
import { PengaturanPage } from './pages/PengaturanPage';
import { RingkasanPage } from './pages/RingkasanPage';
import { TransaksiPage } from './pages/TransaksiPage';

const AppContent: React.FC = () => {
  const { activeTab, isDark, toggleTheme } = useFinance();

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 flex flex-col md:flex-row antialiased selection:bg-neutral-900 selection:text-white dark:selection:bg-neutral-100 dark:selection:text-neutral-950 font-sans">
      {/* Desktop Fixed Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 px-4 sm:px-8 lg:px-12 py-6 sm:py-10 max-w-5xl overflow-x-hidden">
        {/* Mobile Top Brand Bar (Minimal & Quiet with Theme Toggle) */}
        <div className="md:hidden flex items-center justify-between pb-4 mb-4 border-b border-neutral-200/60 dark:border-neutral-800/60">
          <div>
            <span className="text-sm font-bold tracking-tight text-neutral-900 dark:text-white">
              CATAT
            </span>
            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 ml-2">
              Keuangan Pribadi
            </span>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Mode terang' : 'Mode gelap'}
            className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-md transition-colors"
          >
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>

        {/* Dynamic Page Views */}
        {activeTab === 'ringkasan' && <RingkasanPage />}
        {activeTab === 'transaksi' && <TransaksiPage />}
        {activeTab === 'laporan' && <LaporanPage />}
        {activeTab === 'anggaran' && <AnggaranPage />}
        {activeTab === 'pengaturan' && <PengaturanPage />}
      </main>

      {/* Mobile Bottom Navigation & Floating Add Action */}
      <MobileNav />

      {/* Global Modals & Notifications */}
      <AddTransactionModal />
      <EditTransactionModal />
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  );
}
