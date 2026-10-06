import React from 'react';
import {
  BarChart3,
  Moon,
  PieChart,
  Plus,
  Receipt,
  Settings,
  Sun,
  Wallet,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { ActiveTab } from '../../types';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    setIsAddModalOpen,
    isDark,
    toggleTheme,
    currentUser,
    loginWithGoogle,
  } = useFinance();

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'ringkasan', label: 'Ringkasan', icon: <Wallet size={16} /> },
    { id: 'transaksi', label: 'Transaksi', icon: <Receipt size={16} /> },
    { id: 'laporan', label: 'Laporan', icon: <BarChart3 size={16} /> },
    { id: 'anggaran', label: 'Anggaran', icon: <PieChart size={16} /> },
  ];

  return (
    <aside className="hidden md:flex flex-col w-56 lg:w-60 h-screen sticky top-0 border-r border-neutral-200/70 dark:border-neutral-800/70 bg-[#FAFAFA] dark:bg-[#0c0d0e] p-5 select-none z-30 shrink-0">
      {/* Brand Header */}
      <div className="mb-6">
        <h1 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          CATAT
        </h1>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 font-normal mt-0.5">
          Keuangan Pribadi
        </p>
      </div>

      {/* Primary Action Button */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 rounded-lg text-xs font-medium transition-colors shadow-xs active:scale-[0.99]"
        >
          <Plus size={15} />
          <span>Tambah transaksi</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 space-y-6">
        {/* Keuangan Section */}
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-2 block mb-1.5">
            Keuangan
          </span>
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left ${
                    isActive
                      ? 'bg-neutral-200/60 dark:bg-neutral-800/80 text-neutral-900 dark:text-white'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/70 dark:hover:bg-neutral-900/50'
                  }`}
                >
                  <span className={isActive ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 dark:text-neutral-500'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Pengaturan Section */}
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500 px-2 block mb-1.5">
            Pengaturan
          </span>
          <nav className="space-y-0.5">
            <button
              type="button"
              onClick={() => setActiveTab('pengaturan')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left ${
                activeTab === 'pengaturan'
                  ? 'bg-neutral-200/60 dark:bg-neutral-800/80 text-neutral-900 dark:text-white'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100/70 dark:hover:bg-neutral-900/50'
              }`}
            >
              <Settings
                size={16}
                className={activeTab === 'pengaturan' ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 dark:text-neutral-500'}
              />
              <span>Pengaturan</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Bottom Profile & Theme */}
      <div className="pt-4 border-t border-neutral-200/70 dark:border-neutral-800/70 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          {currentUser?.photoURL ? (
            <img
              src={currentUser.photoURL}
              alt={currentUser.displayName || 'Pengguna'}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover shrink-0 border border-neutral-300 dark:border-neutral-700"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center text-xs font-medium shrink-0">
              {currentUser?.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : 'KP'}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
              {currentUser?.displayName || 'Pengguna Catat'}
            </p>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate">
              {currentUser ? (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                  <span>Cloud Terhubung</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="flex items-center gap-1 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
                  title="Klik untuk menghubungkan akun Google Anda"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block shrink-0" />
                  <span className="underline decoration-dotted">Masuk Google</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Mode terang' : 'Mode gelap'}
          title={isDark ? 'Ubah ke mode terang' : 'Ubah ke mode gelap'}
          className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300 rounded-md transition-colors shrink-0"
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </aside>
  );
};
