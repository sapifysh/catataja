import React from 'react';
import {
  Briefcase,
  Building2,
  Car,
  CircleDollarSign,
  Coffee,
  CreditCard,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  MoreHorizontal,
  Phone,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  Smile,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
} from 'lucide-react';

interface CategoryIconProps {
  name: string;
  className?: string;
  size?: number;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ name, className = 'w-4 h-4', size = 16 }) => {
  const normalized = (name || '').toLowerCase().trim();

  // Pick suitable Lucide icon
  if (normalized.includes('makan') || normalized.includes('kopi') || normalized.includes('resto') || normalized.includes('utensils')) {
    return <Utensils size={size} className={className} />;
  }
  if (normalized.includes('transport') || normalized.includes('grab') || normalized.includes('gojek') || normalized.includes('bensin') || normalized.includes('mrt') || normalized.includes('car')) {
    return <Car size={size} className={className} />;
  }
  if (normalized.includes('belanja') || normalized.includes('shopping')) {
    return <ShoppingBag size={size} className={className} />;
  }
  if (normalized.includes('tagihan') || normalized.includes('listrik') || normalized.includes('wifi') || normalized.includes('receipt')) {
    return <Receipt size={size} className={className} />;
  }
  if (normalized.includes('hiburan') || normalized.includes('netflix') || normalized.includes('film') || normalized.includes('game') || normalized.includes('nonton')) {
    return <Film size={size} className={className} />;
  }
  if (normalized.includes('kesehatan') || normalized.includes('obat') || normalized.includes('dokter') || normalized.includes('medis')) {
    return <HeartPulse size={size} className={className} />;
  }
  if (normalized.includes('pendidikan') || normalized.includes('buku') || normalized.includes('kursus') || normalized.includes('kuliah')) {
    return <GraduationCap size={size} className={className} />;
  }
  if (normalized.includes('jalan') || normalized.includes('travel') || normalized.includes('hotel') || normalized.includes('pesawat')) {
    return <Plane size={size} className={className} />;
  }
  if (normalized.includes('gaji') || normalized.includes('salary')) {
    return <Briefcase size={size} className={className} />;
  }
  if (normalized.includes('freelance') || normalized.includes('proyek')) {
    return <Laptop size={size} className={className} />;
  }
  if (normalized.includes('bisnis') || normalized.includes('usaha')) {
    return <Building2 size={size} className={className} />;
  }
  if (normalized.includes('investasi') || normalized.includes('saham') || normalized.includes('crypto')) {
    return <TrendingUp size={size} className={className} />;
  }
  if (normalized.includes('hadiah') || normalized.includes('bonus')) {
    return <Gift size={size} className={className} />;
  }
  if (normalized.includes('pulsa') || normalized.includes('kuota')) {
    return <Phone size={size} className={className} />;
  }
  if (normalized.includes('rumah') || normalized.includes('kost')) {
    return <Home size={size} className={className} />;
  }

  return <CircleDollarSign size={size} className={className} />;
};
