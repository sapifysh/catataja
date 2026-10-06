/**
 * Formatting utilities in natural Bahasa Indonesia
 */

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAYS_ID = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];

/**
 * Format numbers into Indonesian Rupiah format: "Rp 16.519.948"
 */
export function formatRupiah(amount: number, withPrefix = true): string {
  const isNegative = amount < 0;
  const absAmount = Math.round(Math.abs(amount));
  
  // Format with dot separators
  const formatted = absAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  if (!withPrefix) {
    return isNegative ? `− ${formatted}` : formatted;
  }
  
  return isNegative ? `− Rp ${formatted}` : `Rp ${formatted}`;
}

/**
 * Format number into positive/negative sign Rupiah: "+ Rp 8.500.000" or "− Rp 3.250.000"
 */
export function formatSignedRupiah(amount: number, type?: 'income' | 'expense'): string {
  const absAmount = Math.round(Math.abs(amount));
  const formatted = absAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  if (type === 'income' || amount > 0) {
    return `+ Rp ${formatted}`;
  } else if (type === 'expense' || amount < 0) {
    return `− Rp ${formatted}`;
  }
  return `Rp ${formatted}`;
}

/**
 * Parse raw string input into numeric value
 */
export function parseRupiahInput(value: string): number {
  const clean = value.replace(/[^0-9]/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

/**
 * Format a Date or YYYY-MM-DD string into Indonesian date
 * e.g., "Sabtu, 3 Oktober 2026"
 */
export function formatFullIndonesianDate(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00') : dateInput;
  if (isNaN(date.getTime())) return '';

  const dayName = DAYS_ID[date.getDay()];
  const dayNumber = date.getDate();
  const monthName = MONTHS_ID[date.getMonth()];
  const year = date.getFullYear();

  return `${dayName}, ${dayNumber} ${monthName} ${year}`;
}

/**
 * Format date for group headers (e.g. "HARI INI", "KEMARIN", or "3 OKTOBER 2026")
 */
export function formatDateGroupHeader(dateStr: string): string {
  const targetDate = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  
  // Normalize both to midnight
  const tYear = targetDate.getFullYear();
  const tMonth = targetDate.getMonth();
  const tDay = targetDate.getDate();

  const cYear = today.getFullYear();
  const cMonth = today.getMonth();
  const cDay = today.getDate();

  if (tYear === cYear && tMonth === cMonth && tDay === cDay) {
    return 'HARI INI';
  }

  // Check yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (tYear === yesterday.getFullYear() && tMonth === yesterday.getMonth() && tDay === yesterday.getDate()) {
    return 'KEMARIN';
  }

  const dayNumber = targetDate.getDate();
  const monthName = MONTHS_ID[targetDate.getMonth()].toUpperCase();
  const year = targetDate.getFullYear();

  if (tYear === cYear) {
    return `${dayNumber} ${monthName}`;
  }
  return `${dayNumber} ${monthName} ${year}`;
}

/**
 * Short date format e.g. "3 Okt 2026"
 */
export function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return dateStr;
  const day = date.getDate();
  const month = MONTHS_ID[date.getMonth()].slice(0, 3);
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Get current date string in YYYY-MM-DD
 */
export function getTodayString(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get yesterday date string in YYYY-MM-DD
 */
export function getYesterdayString(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
