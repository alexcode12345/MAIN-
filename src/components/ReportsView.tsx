import React from 'react';
import { Download, TrendingUp, DollarSign, PackageCheck, AlertCircle } from 'lucide-react';
import { AppState } from '../types';
import { formatMoney } from '../utils/formatters';
import { downloadFile, escapeCsv } from '../utils/spreadsheet';

interface ReportsViewProps {
  state: AppState;
  onShowToast: (msg: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ state, onShowToast }) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const activeProducts = state.products.filter(
    (p) => p.status !== 'quarantined' && p.status !== 'archived'
  );

  const purchaseVal = activeProducts.reduce(
    (acc, p) => acc + (p.quantity || 0) * (p.purchasePrice || 0),
    0
  );
  const retailVal = activeProducts.reduce(
    (acc, p) => acc + (p.quantity || 0) * (p.sellingPrice || 0),
    0
  );

  const totalSalesRev = state.sales.reduce((acc, s) => acc + (s.total || 0), 0);
  const itemizedSales = state.sales.filter((s) => !s.aggregate && s.cost !== null);
  const estimatedProfit = itemizedSales.reduce(
    (acc, s) => acc + (s.total || 0) - (s.quantity || 0) * (s.cost || 0),
    0
  );

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  activeProducts.forEach((p) => {
    const cat = p.category || 'Other';
    categoryMap[cat] = (categoryMap[cat] || 0) + (p.quantity || 0) * (p.purchasePrice || 0);
  });

  const categoriesSorted = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
  const maxCatVal = Math.max(...categoriesSorted.map((c) => c[1]), 1);

  // Fast moving products (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  const recentSales = state.sales.filter(
    (s) => !s.aggregate && (s.date || '').slice(0, 10) >= cutoff
  );

  const productVolume: Record<string, { qty: number; revenue: number }> = {};
  recentSales.forEach((s) => {
    const key = s.name || 'Unnamed';
    if (!productVolume[key]) productVolume[key] = { qty: 0, revenue: 0 };
    productVolume[key].qty += s.quantity || 0;
    productVolume[key].revenue += s.total || 0;
  });

  const fastMovers = Object.entries(productVolume)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 6);

  // Daily totals table
  const daysMap: Record<string, { count: number; qty: number; revenue: number; profit: number }> =
    {};
  state.sales.forEach((s) => {
    const d = s.date || 'Unknown';
    if (!daysMap[d]) daysMap[d] = { count: 0, qty: 0, revenue: 0, profit: 0 };
    daysMap[d].count += s.aggregate ? s.transactions || 1 : 1;
    daysMap[d].qty += s.quantity || 0;
    daysMap[d].revenue += s.total || 0;
    if (!s.aggregate && s.cost !== null) {
      daysMap[d].profit += (s.total || 0) - (s.quantity || 0) * (s.cost || 0);
    }
  });

  const dailyReportRows = Object.entries(daysMap)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 14);

  const handleExportInventory = () => {
    const headers = ['Name', 'Category', 'Batch', 'Quantity', 'PurchasePrice', 'SellingPrice', 'Expiry'];
    const rows = state.products.map((p) => [
      p.name,
      p.category,
      p.batch,
      p.quantity,
      p.purchasePrice,
      p.sellingPrice,
      p.expiry,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
    downloadFile(`pharmacore-inventory-report-${todayStr}.csv`, csv, 'text/csv');
    onShowToast('Inventory report exported');
  };

  const handleExportSales = () => {
    const headers = ['Receipt', 'Date', 'Medicine', 'Batch', 'Quantity', 'Price', 'Total'];
    const rows = state.sales.map((s) => [
      s.receipt,
      s.date,
      s.name,
      s.batch,
      s.quantity,
      s.price,
      s.total,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
    downloadFile(`pharmacore-sales-report-${todayStr}.csv`, csv, 'text/csv');
    onShowToast('Sales report exported');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="text-[11px] font-extrabold tracking-wider text-[#176b50] uppercase">
            Business intelligence
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--pharma-text)] sm:text-3xl">
            Reports & analytics
          </h1>
          <p className="mt-1 text-xs text-[var(--pharma-muted)]">
            Understand stock valuation, fast-moving medicines, and estimated gross margin.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportInventory}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] px-3.5 py-2 text-xs font-bold text-[var(--pharma-text)] shadow-xs hover:bg-[var(--pharma-panel2)]"
          >
            <Download className="h-3.5 w-3.5" /> Export inventory
          </button>
          <button
            onClick={handleExportSales}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] px-3.5 py-2 text-xs font-bold text-[var(--pharma-text)] shadow-xs hover:bg-[var(--pharma-panel2)]"
          >
            <Download className="h-3.5 w-3.5" /> Export sales
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Stock purchase value</span>
          <div className="mt-2 text-2xl font-black text-[var(--pharma-text)]">
            {formatMoney(purchaseVal, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Cost of goods in stock</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Potential retail value</span>
          <div className="mt-2 text-2xl font-black text-[#176b50]">
            {formatMoney(retailVal, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">At current selling prices</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Recorded sales</span>
          <div className="mt-2 text-2xl font-black text-[var(--pharma-text)]">
            {formatMoney(totalSalesRev, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Across all saved records</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Estimated gross profit</span>
          <div className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {formatMoney(estimatedProfit, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Itemised sales only</div>
        </div>
      </div>

      {/* Valuation breakdown & Fast-moving items */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Category valuation */}
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
          <h2 className="text-base font-bold text-[var(--pharma-text)]">Stock valuation by category</h2>
          <p className="mb-4 text-xs text-[var(--pharma-muted)]">
            Current units valued at recorded purchase cost.
          </p>

          <div className="space-y-4">
            {categoriesSorted.length > 0 ? (
              categoriesSorted.map(([cat, val]) => {
                const percent = Math.round((val / maxCatVal) * 100);
                return (
                  <div key={cat}>
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold">
                      <span className="text-[var(--pharma-text)]">{cat}</span>
                      <span className="font-mono text-[#176b50]">
                        {formatMoney(val, state.settings.currency)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--pharma-panel2)]">
                      <div
                        style={{ width: `${percent}%` }}
                        className="h-full rounded-full bg-[#176b50]"
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-[var(--pharma-muted)]">Add products to see category valuation.</p>
            )}
          </div>
        </div>

        {/* Fast-moving products */}
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
          <h2 className="text-base font-bold text-[var(--pharma-text)]">Fast-moving products</h2>
          <p className="mb-4 text-xs text-[var(--pharma-muted)]">
            Highest recorded unit volume in the last 30 days.
          </p>

          <div className="divide-y divide-[var(--pharma-line)]">
            {fastMovers.length > 0 ? (
              fastMovers.map(([name, data], idx) => (
                <div key={name} className="flex items-center justify-between py-3">
                  <div>
                    <div className="text-xs font-bold text-[var(--pharma-text)]">
                      {idx + 1}. {name}
                    </div>
                    <div className="text-[10px] text-[var(--pharma-muted)]">
                      Revenue: {formatMoney(data.revenue, state.settings.currency)}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {data.qty.toLocaleString()} units sold
                  </span>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-[var(--pharma-muted)]">
                No itemised sales in the last 30 days.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily sales register summary table */}
      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <h2 className="text-base font-bold text-[var(--pharma-text)]">Daily sales register (Last 14 days)</h2>
        <p className="mb-4 text-xs text-[var(--pharma-muted)]">
          Completed transactions saved on this device.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--pharma-line)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--pharma-muted)]">
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Transactions</th>
                <th className="pb-3 pr-4">Units sold</th>
                <th className="pb-3 pr-4">Revenue</th>
                <th className="pb-3">Estimated gross profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pharma-line)]">
              {dailyReportRows.length > 0 ? (
                dailyReportRows.map(([date, d]) => (
                  <tr key={date} className="hover:bg-[var(--pharma-panel2)] transition">
                    <td className="py-3 pr-4 font-bold text-[var(--pharma-text)]">{date}</td>
                    <td className="py-3 pr-4">{d.count}</td>
                    <td className="py-3 pr-4">{d.qty}</td>
                    <td className="py-3 pr-4 font-bold text-[#176b50]">
                      {formatMoney(d.revenue, state.settings.currency)}
                    </td>
                    <td className="py-3 font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatMoney(d.profit, state.settings.currency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-[var(--pharma-muted)]">
                    Daily sales records will appear here as transactions are saved.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-[var(--pharma-muted)]">
        Estimated gross profit is computed as selling revenue minus purchase cost of sold items. It excludes operating expenses such as salaries, utilities, and premise rent.
      </p>
    </div>
  );
};
