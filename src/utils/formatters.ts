import { Product } from '../types';

export function formatMoney(val: number | string | null | undefined, currency = 'NGN'): string {
  const num = Number(val) || 0;
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    const symbol = currency === 'USD' ? '$' : currency === 'GHS' ? '₵' : currency === 'KES' ? 'KSh' : '₦';
    return `${symbol}${num.toLocaleString('en-US')}`;
  }
}

export function dayDiff(dateStr: string | null | undefined): number {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 9999;
  const expiry = new Date(`${dateStr}T23:59:59`);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function monthLabel(m: string | null | undefined): string {
  if (!m || !/^\d{4}-\d{2}$/.test(m)) return 'Unassigned month';
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export interface StatusBadge {
  label: string;
  pillClass: string;
}

export function getProductStatus(p: Product): StatusBadge {
  if (p.status === 'quarantined') {
    return { label: 'Quarantined', pillClass: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' };
  }
  const diff = dayDiff(p.expiry);
  if (p.expiry && diff < 0) {
    return { label: 'Expired', pillClass: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' };
  }
  if (p.expiry && diff <= 30) {
    return { label: 'Expiring soon', pillClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' };
  }
  if (p.quantity <= 0) {
    return { label: 'Out of stock', pillClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' };
  }
  if (p.quantity <= (p.minStock || 0)) {
    return { label: 'Low stock', pillClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' };
  }
  return { label: 'In stock', pillClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' };
}
