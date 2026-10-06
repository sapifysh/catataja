import React from 'react';
import {
  BarChart3,
  PieChart,
  Plus,
  Receipt,
  Settings,
  Wallet,
} from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { ActiveTab } from '../../types';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, setIsAddModalOpen } = useFinance();

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: 'ringkasan', label: 'Ringkasan', icon: <Wallet size={19} /> },
    { id: 'transaksi', label: 'Transaksi', icon: <Receipt size={19} /> },
    { id: 'laporan', label: 'Laporan', icon: <BarChart3 size={19} /> },
    { id: 'anggaran', label: 'Anggaran', icon: <PieChart size={19} /> },
    { id: 'pengaturan', label: 'Pengaturan', icon: <Settings size={19} /> },
  ];

  return (
    <>
      {/* Floating Action Button (Native Mobile Feel) */}
      <div className="md:hidden fixed bottom-18 right-5 z-40">
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          aria-label="Tambah transaksi"
          className="w-13 h-13 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Bottom Sticky Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#FAFAFA]/95 dark:bg-[#0c0d0e]/95 backdrop-blur-md border-t border-neutral-200/80 dark:border-neutral-800/80 px-2 py-1.5 flex items-center justify-around select-none">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors min-w-[56px] ${
                isActive
                  ? 'text-neutral-900 dark:text-white font-medium'
                  : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
              }`}
            >
              <span className="mb-0.5">{item.icon}</span>
              <span className="text-[10px] leading-tight tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
