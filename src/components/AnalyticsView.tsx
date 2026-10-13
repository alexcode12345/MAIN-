import React, { useState } from 'react';
import { PieChart, Download, Search, AlertCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { AppState, SnapshotRow } from '../types';
import { formatMoney, dayDiff, monthLabel } from '../utils/formatters';
import { downloadFile, escapeCsv } from '../utils/spreadsheet';

interface AnalyticsViewProps {
  state: AppState;
  onShowToast: (msg: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ state, onShowToast }) => {
  // Available snapshot months
  const snapshotMonths = [
    ...new Set([
      ...state.importedFiles
        .filter((f) => f.kind === 'stock' && f.snapshotRows && f.snapshotRows.length && f.month)
        .map((f) => f.month!),
      ...state.products
        .map((p) => p.stockMonth || (p.updated || '').slice(0, 7))
        .filter((m) => /^\d{4}-\d{2}$/.test(m)),
    ]),
  ]
    .sort()
    .reverse();

  const [selectedMonth, setSelectedMonth] = useState(snapshotMonths[0] || '');
  const [searchTerm, setSearchTerm] = useState('');

  const getLatestSnapshot = (m: string) => {
    return state.importedFiles
      .filter((f) => f.kind === 'stock' && f.month === m && f.snapshotRows && f.snapshotRows.length)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  const file = getLatestSnapshot(selectedMonth);

  // Rows for selected month
  const rows: SnapshotRow[] = file?.snapshotRows?.length
    ? file.snapshotRows
    : state.products
        .filter((p) => (p.stockMonth || (p.updated || '').slice(0, 7)) === selectedMonth)
        .map((p) => ({
          name: p.name,
          batch: p.batch,
          quantity: p.quantity,
          stockCountLabel: p.stockCountLabel,
          purchasePrice: p.purchasePrice,
          sellingPrice: p.sellingPrice,
          expiry: p.expiry,
          category: p.category,
          status: p.status,
        }));

  const batchKey = (r: { name: string; batch?: string }) =>
    `${(r.name || '').trim().toLowerCase()}|${(r.batch || 'Not recorded').trim().toLowerCase()}`;

  // Prior month for comparison
  const priorMonth = snapshotMonths.filter((m) => m < selectedMonth)[0];
  const priorFile = priorMonth ? getLatestSnapshot(priorMonth) : null;
  const priorMap = new Map<string, SnapshotRow>(
    (priorFile?.snapshotRows || []).map((r) => [batchKey(r), r])
  );

  let newBatches = 0;
  let increased = 0;
  let decreased = 0;
  let removed = 0;

  if (priorFile) {
    const curKeys = new Set(rows.map(batchKey));
    rows.forEach((r) => {
      const old = priorMap.get(batchKey(r));
      if (!old) newBatches++;
      else if (r.quantity > old.quantity) increased++;
      else if (r.quantity < old.quantity) decreased++;
    });
    (priorFile.snapshotRows || []).forEach((r) => {
      if (!curKeys.has(batchKey(r))) removed++;
    });
  }

  // KPIs
  const totalUnits = rows.reduce((acc, r) => acc + (r.quantity || 0), 0);
  const costVal = rows.reduce((acc, r) => acc + (r.quantity || 0) * (r.purchasePrice || 0), 0);
  const retailVal = rows.reduce((acc, r) => acc + (r.quantity || 0) * (r.sellingPrice || 0), 0);
  const uniqueBatches = new Set(rows.map(batchKey)).size;

  const exp90 = rows.filter((r) => r.expiry && dayDiff(r.expiry) >= 0 && dayDiff(r.expiry) <= 90 && r.quantity > 0).length;
  const expiredCount = rows.filter((r) => r.expiry && dayDiff(r.expiry) < 0 && r.quantity > 0).length;

  const monthSales = state.sales.filter((s) => (s.date || '').slice(0, 7) === selectedMonth);
  const monthRev = monthSales.reduce((acc, s) => acc + (s.total || 0), 0);
  const monthUnitsSold = monthSales.reduce((acc, s) => acc + (s.quantity || 0), 0);

  // Filtered rows for table
  const searchClean = searchTerm.trim().toLowerCase();
  const filteredRows = rows.filter((r) =>
    [(r.name || ''), (r.batch || ''), (r.category || '')].join(' ').toLowerCase().includes(searchClean)
  );

  const exportAnalyticsCsv = () => {
    if (!selectedMonth) return;
    const headers = ['Month', 'Medicine', 'Category', 'Batch', 'Quantity', 'PurchasePrice', 'SellingPrice', 'Expiry'];
    const csvRows = filteredRows.map((r) => [
      selectedMonth,
      r.name,
      r.category,
      r.batch,
      r.quantity,
      r.purchasePrice,
      r.sellingPrice,
      r.expiry,
    ]);
    const csv = [headers.join(','), ...csvRows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
    downloadFile(`pharmacore-analytics-${selectedMonth}.csv`, csv, 'text/csv');
    onShowToast('Analytics CSV exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="text-[11px] font-extrabold tracking-wider text-[#176b50] uppercase">
            Historical stock intelligence
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--pharma-text)] sm:text-3xl">
            Stock analytics
          </h1>
          <p className="mt-1 text-xs text-[var(--pharma-muted)]">
            Compare monthly stock snapshots without adding snapshot counts together.
          </p>
        </div>

        <button
          onClick={exportAnalyticsCsv}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] px-3.5 py-2 text-xs font-bold text-[var(--pharma-text)] shadow-xs hover:bg-[var(--pharma-panel2)]"
        >
          <Download className="h-3.5 w-3.5" /> Export analytics CSV
        </button>
      </div>

      {/* Toolbar: Month selector and Search */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-3 shadow-xs">
        <label className="text-xs font-bold text-[var(--pharma-muted)]">Stock month:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs font-semibold text-[var(--pharma-text)] outline-none"
        >
          {snapshotMonths.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
          {snapshotMonths.length === 0 && <option value="">No stock data yet</option>}
        </select>

        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--pharma-muted)]" />
          <input
            type="text"
            placeholder="Search medicine, category or batch…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] py-2 pl-9 pr-3 text-xs text-[var(--pharma-text)] outline-none"
          />
        </div>
      </div>

      {/* Source Info Banner */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
        <div>
          {file ? (
            <span>
              Saved snapshot: <strong>{file.name}</strong> · Imported{' '}
              {new Date(file.date).toLocaleDateString()}
            </span>
          ) : (
            <span>Live inventory view (No imported spreadsheet snapshot recorded for this month)</span>
          )}
        </div>
        <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">
          {rows.length.toLocaleString()} stock records in {monthLabel(selectedMonth)}.{' '}
          {priorFile
            ? `Compared with previous month: ${monthLabel(priorMonth)}.`
            : 'Movement comparison requires at least one prior snapshot.'}
        </div>
      </div>

      {/* KPI 4-grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Unique batches</span>
          <div className="mt-2 text-2xl font-black text-[var(--pharma-text)]">
            {uniqueBatches.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Selected month</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Units in stock</span>
          <div className="mt-2 text-2xl font-black text-[var(--pharma-text)]">
            {totalUnits.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">From snapshot records</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Stock cost value</span>
          <div className="mt-2 text-2xl font-black text-[var(--pharma-text)]">
            {formatMoney(costVal, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Recorded purchase cost</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Potential retail value</span>
          <div className="mt-2 text-2xl font-black text-[#176b50]">
            {formatMoney(retailVal, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">At listed selling prices</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Sales revenue</span>
          <div className="mt-2 text-2xl font-black text-[var(--pharma-text)]">
            {formatMoney(monthRev, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">{monthSales.length} saved sales</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Units sold</span>
          <div className="mt-2 text-2xl font-black text-[var(--pharma-text)]">
            {monthUnitsSold.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">In selected month</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Expiring in ≤90 days</span>
          <div className="mt-2 text-2xl font-black text-amber-600 dark:text-amber-400">
            {exp90}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Batches with positive stock</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Expired rows</span>
          <div className="mt-2 text-2xl font-black text-red-600 dark:text-red-400">
            {expiredCount}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Requires review/quarantine</div>
        </div>
      </div>

      {/* Movement stats */}
      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <h2 className="text-base font-bold text-[var(--pharma-text)]">Stock movement analysis</h2>
        <p className="mb-4 text-xs text-[var(--pharma-muted)]">
          Compared by medicine and batch, not by adding monthly counts together.
        </p>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-4 text-center">
            <span className="text-xs font-bold text-[var(--pharma-muted)]">New batches</span>
            <div className="mt-1 text-2xl font-black text-[var(--pharma-text)]">
              {priorFile ? newBatches : '—'}
            </div>
            <div className="text-[10px] text-[var(--pharma-muted)]">Not in prior snapshot</div>
          </div>

          <div className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-4 text-center">
            <span className="text-xs font-bold text-[var(--pharma-muted)]">Quantity increased</span>
            <div className="mt-1 text-2xl font-black text-emerald-600">
              {priorFile ? increased : '—'}
            </div>
            <div className="text-[10px] text-[var(--pharma-muted)]">Restocked items</div>
          </div>

          <div className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-4 text-center">
            <span className="text-xs font-bold text-[var(--pharma-muted)]">Quantity decreased</span>
            <div className="mt-1 text-2xl font-black text-amber-600">
              {priorFile ? decreased : '—'}
            </div>
            <div className="text-[10px] text-[var(--pharma-muted)]">Dispensed / sold</div>
          </div>

          <div className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-4 text-center">
            <span className="text-xs font-bold text-[var(--pharma-muted)]">Batches absent</span>
            <div className="mt-1 text-2xl font-black text-rose-600">
              {priorFile ? removed : '—'}
            </div>
            <div className="text-[10px] text-[var(--pharma-muted)]">Exhausted from prior month</div>
          </div>
        </div>
      </div>

      {/* Snapshot breakdown table */}
      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <h2 className="text-base font-bold text-[var(--pharma-text)]">
          Monthly stock records ({filteredRows.length.toLocaleString()})
        </h2>
        <p className="mb-4 text-xs text-[var(--pharma-muted)]">
          Search items within this monthly snapshot.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--pharma-line)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--pharma-muted)]">
                <th className="pb-3 pr-4">Medicine</th>
                <th className="pb-3 pr-4">Category</th>
                <th className="pb-3 pr-4">Batch</th>
                <th className="pb-3 pr-4">Qty</th>
                <th className="pb-3 pr-4">Cost</th>
                <th className="pb-3 pr-4">Retail</th>
                <th className="pb-3 pr-4">Expiry</th>
                <th className="pb-3">Movement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pharma-line)]">
              {filteredRows.length > 0 ? (
                filteredRows.map((r, i) => {
                  const old = priorMap.get(batchKey(r));
                  const delta = old ? r.quantity - old.quantity : null;

                  return (
                    <tr key={`${r.name}-${r.batch}-${i}`} className="hover:bg-[var(--pharma-panel2)] transition">
                      <td className="py-3 pr-4 font-bold text-[var(--pharma-text)]">{r.name}</td>
                      <td className="py-3 pr-4 text-[var(--pharma-muted)]">{r.category || 'Other'}</td>
                      <td className="py-3 pr-4 font-mono text-[var(--pharma-muted)]">
                        {r.batch || 'Not recorded'}
                      </td>
                      <td className="py-3 pr-4 font-bold text-[var(--pharma-text)]">
                        {r.stockCountLabel || r.quantity}
                      </td>
                      <td className="py-3 pr-4 font-mono">
                        {formatMoney(r.purchasePrice, state.settings.currency)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[#176b50]">
                        {formatMoney(r.sellingPrice, state.settings.currency)}
                      </td>
                      <td className="py-3 pr-4 text-[var(--pharma-muted)]">
                        {r.expiry || 'Not recorded'}
                      </td>
                      <td className="py-3">
                        {!priorFile ? (
                          <span className="text-[var(--pharma-muted)]">—</span>
                        ) : !old ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            New batch
                          </span>
                        ) : delta! > 0 ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            <ArrowUp className="h-3 w-3" /> +{delta}
                          </span>
                        ) : delta! < 0 ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                            <ArrowDown className="h-3 w-3" /> {delta}
                          </span>
                        ) : (
                          <span className="text-[var(--pharma-muted)]">No change</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-[var(--pharma-muted)]">
                    No matching stock items in this snapshot.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
