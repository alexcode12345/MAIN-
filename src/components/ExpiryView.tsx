import React, { useState } from 'react';
import { ClockAlert, ShieldAlert, Download, Search, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { AppState, Product } from '../types';
import { formatMoney, dayDiff, monthLabel } from '../utils/formatters';
import { downloadFile, escapeCsv } from '../utils/spreadsheet';

interface ExpiryViewProps {
  state: AppState;
  onQuarantineProduct: (product: Product) => void;
  onShowToast: (msg: string) => void;
}

const PAGE_SIZE = 25;

export const ExpiryView: React.FC<ExpiryViewProps> = ({
  state,
  onQuarantineProduct,
  onShowToast,
}) => {
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'expired' | 'expiring' | 'yet' | 'missing'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const activeStock = state.products.filter(
    (p) => p.status !== 'archived' && (p.quantity || 0) > 0
  );

  const hasDate = (p: Product) =>
    /^\d{4}-\d{2}-\d{2}$/.test(p.expiry || '') && !isNaN(new Date(`${p.expiry}T00:00:00`).getTime());

  const monthOf = (p: Product) => (hasDate(p) ? (p.expiry || '').slice(0, 7) : 'unassigned');

  // Unique expiry months
  const allMonths = [
    ...new Set(activeStock.map(monthOf)),
  ].sort((a, b) => (a === 'unassigned' ? 1 : b === 'unassigned' ? -1 : b.localeCompare(a)));

  const getExpiryClass = (p: Product): 'missing' | 'expired' | 'expiring' | 'yet' => {
    if (!hasDate(p)) return 'missing';
    const diff = dayDiff(p.expiry);
    if (diff < 0) return 'expired';
    if (diff <= 30) return 'expiring';
    return 'yet';
  };

  // KPI counts
  const expiredCount = activeStock.filter((p) => getExpiryClass(p) === 'expired').length;
  const expiringCount = activeStock.filter((p) => getExpiryClass(p) === 'expiring').length;
  const yetCount = activeStock.filter((p) => getExpiryClass(p) === 'yet').length;
  const missingCount = activeStock.filter((p) => getExpiryClass(p) === 'missing').length;

  const searchClean = searchTerm.trim().toLowerCase();
  const filtered = activeStock.filter((p) => {
    if (selectedMonth !== 'all' && monthOf(p) !== selectedMonth) return false;
    const cls = getExpiryClass(p);
    if (statusFilter !== 'all' && cls !== statusFilter) return false;
    const match = [p.name, p.generic, p.batch, p.supplier].join(' ').toLowerCase().includes(searchClean);
    return match;
  });

  // Sort by expiry asc (expired first), missing at end
  filtered.sort((a, b) => {
    const da = hasDate(a) ? a.expiry : '9999-12-31';
    const db = hasDate(b) ? b.expiry : '9999-12-31';
    return da.localeCompare(db);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const exportExpiryCsv = () => {
    const headers = ['Medicine', 'Batch', 'Quantity', 'Expiry date', 'Days remaining', 'Stock value', 'Status'];
    const rows = filtered.map((p) => {
      const diff = hasDate(p) ? dayDiff(p.expiry) : 'Missing';
      const val = (p.quantity || 0) * (p.purchasePrice || 0);
      return [p.name, p.batch, p.quantity, p.expiry || 'Not recorded', diff, val, p.status];
    });
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
    downloadFile(`pharmacore-expiry-report-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
    onShowToast('Expiry report exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="text-[11px] font-extrabold tracking-wider text-[#176b50] uppercase">
            Patient safety · Stock quality
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--pharma-text)] sm:text-3xl">
            Expiry centre
          </h1>
          <p className="mt-1 text-xs text-[var(--pharma-muted)]">
            Track batch expiry dates and safeguard stock before it becomes hazardous waste.
          </p>
        </div>

        <button
          onClick={exportExpiryCsv}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] px-3.5 py-2 text-xs font-bold text-[var(--pharma-text)] shadow-xs hover:bg-[var(--pharma-panel2)]"
        >
          <Download className="h-3.5 w-3.5" /> Export report
        </button>
      </div>

      {/* Warning Notice */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="leading-relaxed">
          <strong>Mandatory Dispensing Rule:</strong> Expired or quarantined medicines must never be dispensed under any circumstance. Verify physical batch markings and follow your region’s disposal regulations.
        </div>
      </div>

      {/* Expiry KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--pharma-muted)]">
            <span>Expired batches</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-100 text-red-700 font-bold dark:bg-red-950/60 dark:text-red-300">
              ⚑
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-red-600 dark:text-red-400">
            {expiredCount}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Requires immediate quarantine</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--pharma-muted)]">
            <span>Expiring in ≤30 days</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700 font-bold dark:bg-amber-950/60 dark:text-amber-300">
              ◷
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-amber-600 dark:text-amber-400">
            {expiringCount}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Prioritize sales rotation</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--pharma-muted)]">
            <span>Yet to expire (&gt;30d)</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-[#176b50] font-bold dark:bg-emerald-950/60 dark:text-emerald-300">
              ✓
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-[#176b50]">
            {yetCount}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Good shelf-life stability</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--pharma-muted)]">
            <span>Missing expiry dates</span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-700 font-bold dark:bg-neutral-800 dark:text-gray-300">
              ?
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-[var(--pharma-text)]">
            {missingCount}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Needs physical batch check</div>
        </div>
      </div>

      {/* Toolbar: Expiry month, status filter, search */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-3 shadow-xs">
        <select
          value={selectedMonth}
          onChange={(e) => {
            setSelectedMonth(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs font-semibold text-[var(--pharma-text)] outline-none"
        >
          <option value="all">All expiry dates</option>
          {allMonths.map((m) => (
            <option key={m} value={m}>
              {m === 'unassigned' ? 'Expiry date missing' : monthLabel(m)}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as any);
            setCurrentPage(1);
          }}
          className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs font-semibold text-[var(--pharma-text)] outline-none"
        >
          <option value="all">All expiry statuses</option>
          <option value="expired">Expired</option>
          <option value="expiring">Expiring within 30 days</option>
          <option value="yet">Yet to expire (&gt;30 days)</option>
          <option value="missing">Missing expiry date</option>
        </select>

        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--pharma-muted)]" />
          <input
            type="text"
            placeholder="Search medicine or batch…"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] py-2 pl-9 pr-3 text-xs text-[var(--pharma-text)] outline-none"
          />
        </div>
      </div>

      {/* Expiry Table Card */}
      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--pharma-line)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--pharma-muted)]">
                <th className="pb-3 pr-4">Medicine</th>
                <th className="pb-3 pr-4">Batch</th>
                <th className="pb-3 pr-4">Quantity</th>
                <th className="pb-3 pr-4">Expiry date</th>
                <th className="pb-3 pr-4">Expiry status</th>
                <th className="pb-3 pr-4">Time left</th>
                <th className="pb-3 pr-4">Stock value</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pharma-line)]">
              {pageItems.length > 0 ? (
                pageItems.map((p) => {
                  const known = hasDate(p);
                  const diff = known ? dayDiff(p.expiry) : null;
                  const cls = getExpiryClass(p);
                  const stockCostVal = (p.quantity || 0) * (p.purchasePrice || 0);

                  return (
                    <tr key={p.id} className="hover:bg-[var(--pharma-panel2)] transition">
                      <td className="py-3 pr-4 font-semibold text-[var(--pharma-text)]">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[#176b50] dark:bg-emerald-950/60 dark:text-emerald-300">
                            ✚
                          </div>
                          <div>
                            <div className="font-bold">{p.name}</div>
                            <div className="text-[10px] font-normal text-[var(--pharma-muted)]">
                              {p.generic || p.category || 'Medicine'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-[var(--pharma-muted)]">
                        {p.batch || 'Not recorded'}
                      </td>
                      <td className="py-3 pr-4 font-bold text-[var(--pharma-text)]">
                        {p.stockCountLabel || p.quantity}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[var(--pharma-text)]">
                        {known ? p.expiry : 'Not recorded'}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            cls === 'expired'
                              ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                              : cls === 'expiring'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : cls === 'missing'
                              ? 'bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}
                        >
                          {cls === 'expired'
                            ? 'Expired'
                            : cls === 'expiring'
                            ? 'Expiring soon'
                            : cls === 'missing'
                            ? 'Check date'
                            : 'Yet to expire'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {!known ? (
                          <span className="text-gray-500 font-semibold">Unknown</span>
                        ) : diff! < 0 ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                            {Math.abs(diff!)} days overdue
                          </span>
                        ) : (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              diff! <= 30
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {diff!} days
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 font-mono font-bold text-[var(--pharma-text)]">
                        {formatMoney(stockCostVal, state.settings.currency)}
                      </td>
                      <td className="py-3 text-right">
                        {p.status === 'quarantined' ? (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-800">
                            Quarantined
                          </span>
                        ) : (
                          <button
                            onClick={() => onQuarantineProduct(p)}
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
                          >
                            Quarantine
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-[var(--pharma-muted)]">
                    No matching batches to display.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {filtered.length > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-[var(--pharma-line)] pt-3 sm:flex-row">
            <div className="text-xs text-[var(--pharma-muted)]">
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length} batches
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 rounded-lg border border-[var(--pharma-line)] px-2.5 py-1 text-xs font-semibold text-[var(--pharma-text)] transition hover:bg-[var(--pharma-panel2)] disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="text-xs text-[var(--pharma-muted)]">
                Page {safePage} of {totalPages}
              </span>
              <button
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 rounded-lg border border-[var(--pharma-line)] px-2.5 py-1 text-xs font-semibold text-[var(--pharma-text)] transition hover:bg-[var(--pharma-panel2)] disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
