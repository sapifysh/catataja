import React from 'react';
import { Check } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';

export const Toast: React.FC = () => {
  const { toastMessage } = useFinance();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-200">
      <div className="flex items-center gap-2 bg-neutral-900/95 dark:bg-neutral-100/95 text-white dark:text-neutral-950 px-4 py-2.5 rounded-full shadow-lg backdrop-blur-xs text-xs font-medium tracking-normal animate-in fade-in zoom-in-95">
        <Check size={14} className="text-emerald-400 dark:text-emerald-600 shrink-0" />
        <span>{toastMessage}</span>
      </div>
    </div>
  );
};
