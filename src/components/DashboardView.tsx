import React, { useState } from 'react';
import { Package, Banknote, ShoppingCart, AlertTriangle, ArrowUpRight, Clock, Plus, Upload } from 'lucide-react';
import { AppState, Product } from '../types';
import { formatMoney, dayDiff, getProductStatus } from '../utils/formatters';

interface DashboardViewProps {
  state: AppState;
  onNavigate: (page: string) => void;
  onOpenAddMedicine: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  onNavigate,
  onOpenAddMedicine,
}) => {
  const [chartPeriod, setChartPeriod] = useState<7 | 14>(7);

  const activeProducts = state.products.filter(
    (p) => p.status !== 'quarantined' && p.status !== 'archived'
  );

  const stockVal = activeProducts.reduce(
    (acc, p) => acc + (p.quantity || 0) * (p.purchasePrice || 0),
    0
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const salesToday = state.sales.filter((s) => s.date === todayStr);
  const revenueToday = salesToday.reduce((acc, s) => acc + (s.total || 0), 0);

  const lowStock = activeProducts.filter(
    (p) => p.quantity > 0 && p.quantity <= (p.minStock || state.settings.defaultMin || 0)
  );
  const outOfStock = activeProducts.filter((p) => p.quantity <= 0);
  const expiringSoon = activeProducts.filter((p) => {
    const diff = dayDiff(p.expiry);
    return diff >= 0 && diff <= 30;
  });
  const expired = state.products.filter((p) => {
    const diff = dayDiff(p.expiry);
    return diff < 0 && p.quantity > 0;
  });

  const totalAlerts = lowStock.length + outOfStock.length + expiringSoon.length + expired.length;

  // Chart computation
  const getDaysArray = (numDays: number) => {
    const days: string[] = [];
    const end = new Date();
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  };

  const currentDays = getDaysArray(chartPeriod);
  const currentSalesByDay = currentDays.map((date) => {
    return state.sales
      .filter((s) => (s.date || '').slice(0, 10) === date)
      .reduce((acc, s) => acc + (s.total || 0), 0);
  });

  const priorDays = currentDays.map((date) => {
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - chartPeriod);
    return d.toISOString().slice(0, 10);
  });

  const priorSalesByDay = priorDays.map((date) => {
    return state.sales
      .filter((s) => (s.date || '').slice(0, 10) === date)
      .reduce((acc, s) => acc + (s.total || 0), 0);
  });

  const maxSales = Math.max(...currentSalesByDay, ...priorSalesByDay, 100);

  // Recently updated stock (latest 5)
  const recentProducts = [...state.products]
    .sort((a, b) => new Date(b.updated || 0).getTime() - new Date(a.updated || 0).getTime())
    .slice(0, 5);

  const formattedToday = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="text-[11px] font-extrabold tracking-wider text-[#176b50] uppercase">
            {formattedToday}
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--pharma-text)] sm:text-3xl">
            Welcome to {state.settings.name || 'your pharmacy'} <span>✦</span>
          </h1>
          <p className="mt-1 text-xs text-[var(--pharma-muted)]">
            Here’s what’s happening in your stock and operations today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('imports')}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] px-3.5 py-2 text-xs font-bold text-[var(--pharma-text)] shadow-xs transition hover:bg-[var(--pharma-panel2)]"
          >
            <Upload className="h-3.5 w-3.5" /> Import stock
          </button>
          <button
            onClick={onOpenAddMedicine}
            className="flex items-center gap-1.5 rounded-xl bg-[#176b50] px-4 py-2 text-xs font-bold text-white shadow-md transition hover:bg-[#104c34]"
          >
            <Plus className="h-3.5 w-3.5" /> Add medicine
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--pharma-muted)]">
            <span>Products tracked</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-[#176b50] dark:bg-emerald-950/60 dark:text-emerald-300">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-[var(--pharma-text)]">
            {activeProducts.length.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">
            Across active inventory
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--pharma-muted)]">
            <span>Current stock value</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-[#176b50] dark:bg-emerald-950/60 dark:text-emerald-300">
              <Banknote className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-[var(--pharma-text)]">
            {formatMoney(stockVal, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">
            At recorded purchase cost
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--pharma-muted)]">
            <span>Sales today</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-[#176b50] dark:bg-emerald-950/60 dark:text-emerald-300">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-[var(--pharma-text)]">
            {formatMoney(revenueToday, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">
            {salesToday.length} transaction(s) recorded
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--pharma-muted)]">
            <span>Stock alerts</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-[var(--pharma-text)]">
            {totalAlerts}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">
            {outOfStock.length} out of stock · {expiringSoon.length} near expiry
          </div>
        </div>
      </div>

      {/* Middle row: Sales chart & Attention alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Sales Chart */}
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs lg:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--pharma-text)]">Sales overview</h2>
              <p className="text-xs text-[var(--pharma-muted)]">
                Revenue performance · last {chartPeriod} days
              </p>
            </div>
            <select
              value={chartPeriod}
              onChange={(e) => setChartPeriod(Number(e.target.value) as 7 | 14)}
              className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-2.5 py-1.5 text-xs font-semibold text-[var(--pharma-text)] outline-none"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
            </select>
          </div>

          {/* Bar chart */}
          <div className="flex h-48 items-end gap-2 border-b border-[var(--pharma-line)] pb-2 pt-6">
            {currentDays.map((d, i) => {
              const currentVal = currentSalesByDay[i];
              const priorVal = priorSalesByDay[i];
              const currentH = Math.max(4, Math.round((currentVal / maxSales) * 100));
              const priorH = Math.max(4, Math.round((priorVal / maxSales) * 100));
              const label = new Date(`${d}T12:00:00`).toLocaleDateString('en-US', {
                weekday: 'short',
                day: chartPeriod === 14 ? 'numeric' : undefined,
              });

              return (
                <div key={d} className="flex h-full flex-1 flex-col items-center justify-end">
                  <div className="flex w-full items-end justify-center gap-1">
                    <div
                      style={{ height: `${priorH}%` }}
                      title={`Prior period: ${formatMoney(priorVal, state.settings.currency)}`}
                      className="w-1/2 max-w-[14px] rounded-t-sm bg-[#a6d4bb] dark:bg-[#20523e]"
                    />
                    <div
                      style={{ height: `${currentH}%` }}
                      title={`Sales: ${formatMoney(currentVal, state.settings.currency)}`}
                      className="w-1/2 max-w-[14px] rounded-t-sm bg-[#176b50]"
                    />
                  </div>
                  <span className="mt-2 text-[10px] text-[var(--pharma-muted)]">{label}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--pharma-muted)]">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-[#176b50]" />
              <span>Sales revenue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-[#a6d4bb] dark:bg-[#20523e]" />
              <span>Previous period</span>
            </div>
          </div>
        </div>

        {/* Needs attention alerts */}
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs lg:col-span-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[var(--pharma-text)]">Needs attention</h2>
              <p className="text-xs text-[var(--pharma-muted)]">Critical inventory safeguards</p>
            </div>
            <button
              onClick={() => onNavigate('expiry')}
              className="text-xs font-bold text-[#176b50] hover:underline"
            >
              View all →
            </button>
          </div>

          <div className="space-y-2.5">
            {expired.slice(0, 2).map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-3 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-3 text-xs"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-100 font-bold text-red-700">
                  !
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[var(--pharma-text)] truncate">{p.name}</div>
                  <div className="text-[11px] text-red-700 dark:text-red-400">
                    Expired {Math.abs(dayDiff(p.expiry))} days ago · {p.quantity} units
                  </div>
                </div>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">
                  Expired
                </span>
              </div>
            ))}

            {expiringSoon.slice(0, 2).map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-3 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-3 text-xs"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 font-bold text-amber-700">
                  ◷
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[var(--pharma-text)] truncate">{p.name}</div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">
                    Expires in {dayDiff(p.expiry)} day(s) · Batch {p.batch}
                  </div>
                </div>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Expiry
                </span>
              </div>
            ))}

            {outOfStock.slice(0, 2).map((p) => (
              <div
                key={p.id}
                className="flex items-start gap-3 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-3 text-xs"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-100 font-bold text-rose-700">
                  ⚑
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[var(--pharma-text)] truncate">{p.name}</div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-400">
                    Out of stock — reorder required
                  </div>
                </div>
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                  Stock
                </span>
              </div>
            ))}

            {totalAlerts === 0 && (
              <div className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-6 text-center text-xs text-[var(--pharma-muted)]">
                All clear — no stock or expiry alerts currently.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: Recently updated stock */}
      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--pharma-text)]">Recently updated stock</h2>
            <p className="text-xs text-[var(--pharma-muted)]">Latest inventory changes</p>
          </div>
          <button
            onClick={() => onNavigate('inventory')}
            className="text-xs font-bold text-[#176b50] hover:underline"
          >
            View inventory →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--pharma-line)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--pharma-muted)]">
                <th className="pb-3 pr-4">Medicine</th>
                <th className="pb-3 pr-4">Batch</th>
                <th className="pb-3 pr-4">Stock</th>
                <th className="pb-3 pr-4">Expiry</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pharma-line)]">
              {recentProducts.length > 0 ? (
                recentProducts.map((p) => {
                  const status = getProductStatus(p);
                  return (
                    <tr key={p.id} className="hover:bg-[var(--pharma-panel2)] transition">
                      <td className="py-3 pr-4 font-semibold text-[var(--pharma-text)]">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[#176b50] dark:bg-emerald-950/60 dark:text-emerald-300">
                            ✚
                          </div>
                          <div>
                            <div>{p.name}</div>
                            <div className="text-[10px] font-normal text-[var(--pharma-muted)]">
                              {p.generic || p.category || 'Medicine'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-[11px] text-[var(--pharma-muted)]">
                        {p.batch}
                      </td>
                      <td className="py-3 pr-4 font-bold text-[var(--pharma-text)]">
                        {p.stockCountLabel || p.quantity}
                      </td>
                      <td className="py-3 pr-4 text-[var(--pharma-muted)]">
                        {p.expiry || 'Not recorded'}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${status.pillClass}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 text-[var(--pharma-muted)]">
                        {p.updated ? new Date(p.updated).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[var(--pharma-muted)]">
                    <div className="space-y-2">
                      <p>No medicines yet. Add your first medicine or import a stock spreadsheet.</p>
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={onOpenAddMedicine}
                          className="rounded-lg bg-[#176b50] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#104c34]"
                        >
                          ＋ Add medicine
                        </button>
                        <button
                          onClick={() => onNavigate('imports')}
                          className="rounded-lg border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-1.5 text-xs font-bold text-[var(--pharma-text)] hover:bg-[var(--pharma-line)]"
                        >
                          ⇧ Import spreadsheet
                        </button>
                      </div>
                    </div>
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
