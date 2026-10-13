import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Upload, Download, Edit2, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppState, Product } from '../types';
import { formatMoney, dayDiff, getProductStatus, monthLabel } from '../utils/formatters';
import { downloadFile, escapeCsv } from '../utils/spreadsheet';

interface InventoryViewProps {
  state: AppState;
  onNavigate: (page: string) => void;
  onOpenAddMedicine: () => void;
  onOpenEditMedicine: (product: Product) => void;
  onOpenAdjustStock: (product: Product) => void;
  onQuickEditBatch: (product: Product) => void;
  onShowToast: (msg: string) => void;
}

const PAGE_SIZE = 25;

export const InventoryView: React.FC<InventoryViewProps> = ({
  state,
  onNavigate,
  onOpenAddMedicine,
  onOpenEditMedicine,
  onOpenAdjustStock,
  onQuickEditBatch,
  onShowToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'expiry'>('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthOf = (p: Product) =>
    p.stockMonth || (p.updated || '').slice(0, 7) || 'unassigned';

  // Available unique batches and months
  const allBatches = [...new Set(state.products.map((p) => p.batch || 'Not recorded'))].sort();
  const allMonths = [...new Set(state.products.map(monthOf))].sort().reverse();

  // Autocomplete matching
  const qClean = searchTerm.trim().toLowerCase();
  const matchingSuggestions = qClean
    ? state.products
        .filter((p) =>
          [p.name, p.generic, p.batch, p.supplier].join(' ').toLowerCase().includes(qClean)
        )
        .slice(0, 8)
    : [];

  // Filtered products
  let filtered = state.products.filter((p) => {
    const matchesSearch = [p.name, p.generic, p.batch, p.supplier]
      .join(' ')
      .toLowerCase()
      .includes(qClean);
    if (!matchesSearch) return false;

    if (batchFilter !== 'all' && (p.batch || 'Not recorded') !== batchFilter) return false;
    if (monthFilter !== 'all' && monthOf(p) !== monthFilter) return false;

    if (stockFilter === 'low') {
      return p.quantity > 0 && p.quantity <= (p.minStock || state.settings.defaultMin || 0);
    }
    if (stockFilter === 'out') {
      return p.quantity <= 0;
    }
    if (stockFilter === 'expiry') {
      const diff = dayDiff(p.expiry);
      return diff <= 30;
    }

    return true;
  });

  // Sort by stock month desc, then name asc
  filtered.sort((a, b) => {
    const ma = monthOf(a);
    const mb = monthOf(b);
    if (ma !== mb) return mb.localeCompare(ma);
    return a.name.localeCompare(b.name);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const handleExportCSV = () => {
    const headers = [
      'id',
      'name',
      'generic',
      'category',
      'batch',
      'quantity',
      'purchasePrice',
      'sellingPrice',
      'expiry',
      'minStock',
      'supplier',
      'status',
      'stockMonth',
    ];
    const rows = state.products.map((p) => [
      p.id,
      p.name,
      p.generic,
      p.category,
      p.batch,
      p.quantity,
      p.purchasePrice,
      p.sellingPrice,
      p.expiry,
      p.minStock,
      p.supplier,
      p.status,
      p.stockMonth,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
    downloadFile(
      `pharmacore-inventory-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
      'text/csv'
    );
    onShowToast('Inventory exported to CSV');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="text-[11px] font-extrabold tracking-wider text-[#176b50] uppercase">
            Stock control
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--pharma-text)] sm:text-3xl">
            Medicine inventory
          </h1>
          <p className="mt-1 text-xs text-[var(--pharma-muted)]">
            Manage product catalogue, batches, current quantities and reorder thresholds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('imports')}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] px-3.5 py-2 text-xs font-bold text-[var(--pharma-text)] shadow-xs transition hover:bg-[var(--pharma-panel2)]"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
          <button
            onClick={onOpenAddMedicine}
            className="flex items-center gap-1.5 rounded-xl bg-[#176b50] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:bg-[#104c34]"
          >
            <Plus className="h-3.5 w-3.5" /> Add medicine
          </button>
        </div>
      </div>

      {/* Toolbar: Search & Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-3 shadow-xs">
        {/* Autocomplete Search */}
        <div className="relative min-w-[240px] flex-1" ref={searchBoxRef}>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--pharma-muted)]" />
            <input
              type="text"
              placeholder="Search medicine, generic name, or batch…"
              value={searchTerm}
              onFocus={() => setShowSuggestions(true)}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
                setShowSuggestions(true);
              }}
              className="w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] py-2 pl-9 pr-3 text-xs text-[var(--pharma-text)] outline-none focus:border-[#176b50] focus:ring-1 focus:ring-[#176b50]"
            />
          </div>

          {showSuggestions && matchingSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-1.5 shadow-xl">
              {matchingSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSearchTerm(item.name);
                    setShowSuggestions(false);
                    setCurrentPage(1);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  <div>
                    <div className="font-bold text-[var(--pharma-text)]">{item.name}</div>
                    <div className="text-[10px] text-[var(--pharma-muted)]">
                      {item.generic || item.category || 'Medicine'} · Batch: {item.batch}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-[#176b50]">
                    {item.quantity} in stock
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stock Filter */}
        <select
          value={stockFilter}
          onChange={(e) => {
            setStockFilter(e.target.value as any);
            setCurrentPage(1);
          }}
          className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs font-semibold text-[var(--pharma-text)] outline-none"
        >
          <option value="all">All stock status</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
          <option value="expiry">Expiring soon (≤30d)</option>
        </select>

        {/* Batch Filter */}
        <select
          value={batchFilter}
          onChange={(e) => {
            setBatchFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs font-semibold text-[var(--pharma-text)] outline-none max-w-[160px]"
        >
          <option value="all">All batches</option>
          {allBatches.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>

        {/* Month Filter */}
        <select
          value={monthFilter}
          onChange={(e) => {
            setMonthFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs font-semibold text-[var(--pharma-text)] outline-none"
        >
          <option value="all">All stock months</option>
          {allMonths.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>

        {/* Export CSV button */}
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs font-bold text-[var(--pharma-text)] transition hover:bg-[var(--pharma-line)]"
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      </div>

      {/* Table Card */}
      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-4 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--pharma-line)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--pharma-muted)]">
                <th className="pb-3 pr-4">Medicine</th>
                <th className="pb-3 pr-4">Batch</th>
                <th className="pb-3 pr-4">Qty</th>
                <th className="pb-3 pr-4">Purchase (₦)</th>
                <th className="pb-3 pr-4">Selling (₦)</th>
                <th className="pb-3 pr-4">Expiry date</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pharma-line)]">
              {pageItems.length > 0 ? (
                pageItems.map((p) => {
                  const status = getProductStatus(p);
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
                              {p.generic || p.category || 'Medicine'} · ID: {p.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={() => onQuickEditBatch(p)}
                          className="group flex items-center gap-1 font-mono text-xs font-semibold text-[#176b50] hover:underline"
                          title="Click to change batch number"
                        >
                          <span>{p.batch || 'Not recorded'}</span>
                          <span className="opacity-0 group-hover:opacity-100 text-[10px]">✎</span>
                        </button>
                      </td>
                      <td className="py-3 pr-4 font-bold text-[var(--pharma-text)]">
                        {p.stockCountLabel || p.quantity}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[var(--pharma-text)]">
                        {formatMoney(p.purchasePrice, state.settings.currency)}
                      </td>
                      <td className="py-3 pr-4 font-mono font-bold text-[#176b50]">
                        {formatMoney(p.sellingPrice, state.settings.currency)}
                      </td>
                      <td className="py-3 pr-4 text-[var(--pharma-muted)]">
                        {p.expiry || 'Not recorded'}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${status.pillClass}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenAdjustStock(p)}
                            className="rounded-lg border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-2.5 py-1 text-[11px] font-bold text-[var(--pharma-text)] transition hover:bg-gray-200 dark:hover:bg-neutral-800"
                          >
                            Adjust
                          </button>
                          <button
                            onClick={() => onOpenEditMedicine(p)}
                            className="rounded-lg border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-2.5 py-1 text-[11px] font-bold text-[var(--pharma-text)] transition hover:bg-gray-200 dark:hover:bg-neutral-800"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-xs text-[var(--pharma-muted)]">
                    No matching medicine stock records found.
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
              Showing {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length} stock records
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
