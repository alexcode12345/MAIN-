import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ShoppingCart,
  Plus,
  Upload,
  Download,
  Search,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { AppState, Product, Sale, DailySalesSubmission } from '../types';
import { formatMoney, dayDiff } from '../utils/formatters';
import {
  parseCSV,
  rowsFromSheetMatrix,
  canonicalizeSaleRow,
  downloadFile,
  escapeCsv,
} from '../utils/spreadsheet';

interface SalesViewProps {
  state: AppState;
  onRecordManualSale: (sale: Sale, updatedProduct: Product) => void;
  onRecordEmployeeSubmission: (
    submissionId: string,
    mode: 'itemized' | 'summary',
    salesToInsert: Sale[],
    productsToUpdate: Product[]
  ) => void;
  onImportSales: (sales: Sale[], fileName: string) => void;
  onShowToast: (msg: string) => void;
}

const PAGE_SIZE = 25;

export const SalesView: React.FC<SalesViewProps> = ({
  state,
  onRecordManualSale,
  onRecordEmployeeSubmission,
  onImportSales,
  onShowToast,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Manual sale state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [saleDate, setSaleDate] = useState(todayStr);
  const [quantity, setQuantity] = useState<number>(1);
  const [price, setPrice] = useState<number | string>('');
  const [cost, setCost] = useState<number | string>('0');
  const [discount, setDiscount] = useState<number | string>('0');
  const [payment, setPayment] = useState('Cash');
  const [receipt, setReceipt] = useState('');
  const [manualFeedback, setManualFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(
    null
  );

  // Sales register search and pagination
  const [salesSearch, setSalesSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Sales upload preview state
  const [salesUploadPreview, setSalesUploadPreview] = useState<{
    fileName: string;
    items: any[];
    validCount: number;
  } | null>(null);

  // Available medicines for manual sale (in stock, not quarantined, not expired)
  const availableMedicines = state.products.filter(
    (p) =>
      p.quantity > 0 &&
      p.status !== 'quarantined' &&
      p.status !== 'archived' &&
      (!p.expiry || dayDiff(p.expiry) >= 0)
  );

  const handleProductSelect = (pId: string) => {
    setSelectedProductId(pId);
    setManualFeedback(null);
    const prod = state.products.find((p) => p.id === pId);
    if (prod) {
      setPrice(prod.sellingPrice || 0);
      setCost(prod.purchasePrice || 0);
      setManualFeedback({
        type: 'success',
        text: `Selected ${prod.name} · Batch ${prod.batch || 'Not recorded'} · ${prod.quantity} unit(s) available.`,
      });
    }
  };

  const handleManualSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setManualFeedback(null);

    const prod = state.products.find((p) => p.id === selectedProductId);
    if (!prod) {
      setManualFeedback({ type: 'error', text: 'Please choose a medicine and batch.' });
      return;
    }

    const q = Number(quantity);
    const p = Number(price);
    const c = Number(cost) || 0;
    const d = Number(discount) || 0;

    if (!Number.isFinite(q) || q <= 0) {
      setManualFeedback({ type: 'error', text: 'Quantity must be at least 1.' });
      return;
    }
    if (prod.quantity < q) {
      setManualFeedback({
        type: 'error',
        text: `Insufficient stock in batch ${prod.batch}. Requested ${q}, available ${prod.quantity}.`,
      });
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      setManualFeedback({ type: 'error', text: 'Please enter a valid selling price.' });
      return;
    }
    if (d < 0 || d > q * p) {
      setManualFeedback({ type: 'error', text: 'Discount cannot exceed the total price.' });
      return;
    }

    const total = q * p - d;
    const rcpt = receipt.trim() || `MAN-${Date.now().toString().slice(-8)}`;

    const saleItem: Sale = {
      id: `SALE-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      receipt: rcpt,
      productId: prod.id,
      name: prod.name,
      batch: prod.batch || 'Not recorded',
      quantity: q,
      price: p,
      cost: c || prod.purchasePrice || 0,
      discount: d,
      payment,
      total,
      date: saleDate,
      time: new Date().toISOString(),
      manual: true,
      stockDeducted: true,
    };

    const updatedProd: Product = {
      ...prod,
      quantity: prod.quantity - q,
      stockCountLabel: String(prod.quantity - q),
      updated: new Date().toISOString(),
    };

    onRecordManualSale(saleItem, updatedProd);
    onShowToast(`Sale saved & inventory deducted · Receipt ${rcpt}`);

    // Reset fields
    setSelectedProductId('');
    setQuantity(1);
    setPrice('');
    setCost('0');
    setDiscount('0');
    setReceipt('');
    setManualFeedback({ type: 'success', text: `Sale successfully completed: ${rcpt}` });
  };

  // Sales upload handler
  const handleSalesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        let rows: Record<string, unknown>[] = [];
        if (ext === 'csv') {
          const raw = parseCSV(event.target?.result as string);
          rows = rowsFromSheetMatrix(raw).rows;
        } else if (ext === 'xlsx' || ext === 'xls') {
          const wb = XLSX.read(event.target?.result, { type: 'array', cellDates: true });
          let best = { rows: [] as Record<string, unknown>[], score: 0 };
          for (const sn of wb.SheetNames) {
            const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sn], {
              header: 1,
              defval: '',
              raw: true,
            }) as unknown[][];
            const parsed = rowsFromSheetMatrix(matrix);
            if (parsed.score > best.score) best = parsed;
          }
          rows = best.rows;
        } else {
          throw new Error('Please upload an Excel or CSV file.');
        }

        const parsed = rows.map(canonicalizeSaleRow);
        const valid = parsed.filter((r) => r.isValid);

        if (valid.length === 0) {
          throw new Error('No valid sales rows found in the file.');
        }

        setSalesUploadPreview({
          fileName: file.name,
          items: parsed,
          validCount: valid.length,
        });
        onShowToast(`Sales file analysed: ${valid.length} valid rows`);
      } catch (err: any) {
        alert(err.message || 'Could not process sales file');
      }
    };

    if (ext === 'csv') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!salesUploadPreview) return;
    const validRows = salesUploadPreview.items.filter((r) => r.isValid);

    const newSales: Sale[] = validRows.map((r) => ({
      id: `SALE-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      receipt: r.receipt,
      name: r.name,
      batch: r.batch,
      quantity: r.quantity,
      price: r.price,
      cost: r.cost,
      discount: r.discount,
      payment: r.payment,
      total: r.total,
      date: r.date,
      time: r.time,
      stockDeducted: false,
    }));

    onImportSales(newSales, salesUploadPreview.fileName);
    setSalesUploadPreview(null);
    onShowToast(`Imported ${newSales.length} historical sales`);
  };

  // Compile employee submission
  const handleApproveSubmission = (sub: DailySalesSubmission) => {
    if (sub.saleItems && sub.saleItems.length > 0) {
      // Check if stock can be deducted for each item
      const plans: { item: any; prod: Product; qty: number }[] = [];
      const remainingStock = new Map<string, number>();

      for (const item of sub.saleItems) {
        const itemKey = item.name.trim().toLowerCase();
        const matches = state.products
          .filter(
            (p) =>
              p.name.trim().toLowerCase() === itemKey &&
              p.status !== 'quarantined' &&
              p.status !== 'archived'
          )
          .sort((a, b) => (a.expiry || '9999').localeCompare(b.expiry || '9999'));

        const q = Number(item.quantity);
        const chosen = matches.find((p) => {
          const current = remainingStock.has(p.id) ? remainingStock.get(p.id)! : p.quantity;
          return current >= q;
        });

        if (!chosen) {
          const totalAvail = matches.reduce((sum, p) => {
            const current = remainingStock.has(p.id) ? remainingStock.get(p.id)! : p.quantity;
            return sum + current;
          }, 0);
          alert(
            `Cannot compile submission: "${item.name}" requires ${q} units, but only ${totalAvail} units are available in inventory. Please adjust inventory or reject submission.`
          );
          return;
        }

        const curStock = remainingStock.has(chosen.id)
          ? remainingStock.get(chosen.id)!
          : chosen.quantity;
        remainingStock.set(chosen.id, curStock - q);
        plans.push({ item, prod: chosen, qty: q });
      }

      if (
        !confirm(
          `Record ${sub.saleItems.length} itemized sale lines for ${sub.employee}? Corresponding batches will be deducted from inventory.`
        )
      ) {
        return;
      }

      const salesToAdd: Sale[] = plans.map(({ item, prod, qty }) => ({
        id: `SALE-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        receipt: item.receipt || `DAY-${sub.id.slice(-6)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        productId: prod.id,
        name: prod.name,
        batch: prod.batch,
        quantity: qty,
        price: item.price || 0,
        cost: item.cost || prod.purchasePrice || 0,
        discount: item.discount || 0,
        payment: item.payment || sub.payment || 'Mixed',
        total: item.total || qty * (item.price || 0),
        date: item.date || sub.date,
        time: new Date().toISOString(),
        sourceDailySalesId: sub.id,
        stockDeducted: true,
      }));

      const productsToUpdate: Product[] = plans.map(({ prod, qty }) => {
        const remaining = remainingStock.get(prod.id)!;
        return {
          ...prod,
          quantity: remaining,
          stockCountLabel: String(remaining),
          updated: new Date().toISOString(),
        };
      });

      onRecordEmployeeSubmission(sub.id, 'itemized', salesToAdd, productsToUpdate);
      onShowToast(`Recorded ${sub.employee}'s itemized sales & deducted stock`);
    } else {
      // Summary only
      if (
        !confirm(
          `This submission contains daily totals only (${formatMoney(sub.revenue, state.settings.currency)}). Inventory will NOT be deducted because individual items are not specified. Record as daily summary?`
        )
      ) {
        return;
      }

      const summarySale: Sale = {
        id: `SALE-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
        receipt: `SUM-${sub.id.slice(-6)}`,
        name: `Daily sales summary — ${sub.employee}`,
        batch: sub.shift,
        quantity: sub.units,
        price: 0,
        cost: null,
        discount: 0,
        payment: sub.payment,
        total: sub.revenue,
        date: sub.date,
        time: new Date().toISOString(),
        aggregate: true,
        transactions: sub.transactions,
        sourceDailySalesId: sub.id,
        stockDeducted: false,
      };

      onRecordEmployeeSubmission(sub.id, 'summary', [summarySale], []);
      onShowToast(`Recorded daily sales summary for ${sub.employee}`);
    }
  };

  // Grouped daily register
  const dailyRegisterMap = new Map<
    string,
    { date: string; transactions: number; units: number; revenue: number; profit: number }
  >();

  state.sales.forEach((s) => {
    const d = (s.date || 'Unknown').slice(0, 10);
    const existing = dailyRegisterMap.get(d) || {
      date: d,
      transactions: 0,
      units: 0,
      revenue: 0,
      profit: 0,
    };
    existing.transactions += s.aggregate ? s.transactions || 1 : 1;
    existing.units += s.quantity || 0;
    existing.revenue += s.total || 0;
    if (!s.aggregate && s.cost !== null) {
      existing.profit += (s.total || 0) - (s.quantity || 0) * (s.cost || 0);
    }
    dailyRegisterMap.set(d, existing);
  });

  const dailyRegister = Array.from(dailyRegisterMap.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  // Search filtered sales
  const searchClean = salesSearch.trim().toLowerCase();
  const filteredSales = state.sales.filter((s) =>
    [s.receipt, s.name, s.batch, s.payment, s.date].join(' ').toLowerCase().includes(searchClean)
  );

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const pageSales = filteredSales.slice(startIdx, startIdx + PAGE_SIZE);

  // Stats
  const totalRev = state.sales.reduce((acc, s) => acc + (s.total || 0), 0);
  const totalUnits = state.sales.reduce((acc, s) => acc + (s.quantity || 0), 0);
  const itemizedSales = state.sales.filter((s) => !s.aggregate && s.cost !== null);
  const totalProfit = itemizedSales.reduce(
    (acc, s) => acc + (s.total || 0) - (s.quantity || 0) * (s.cost || 0),
    0
  );

  const exportDailyRegisterCsv = () => {
    const headers = ['Date', 'Transactions', 'Units sold', 'Revenue', 'Estimated gross profit'];
    const rows = dailyRegister.map((r) => [r.date, r.transactions, r.units, r.revenue, r.profit]);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
    downloadFile(`pharmacore-daily-register-${todayStr}.csv`, csv, 'text/csv');
    onShowToast('Daily register exported');
  };

  const exportAllSalesCsv = () => {
    const headers = ['Receipt', 'Date', 'Time', 'Medicine', 'Batch', 'Quantity', 'Price', 'Cost', 'Discount', 'Payment', 'Total'];
    const rows = state.sales.map((s) => [
      s.receipt,
      s.date,
      s.time,
      s.name,
      s.batch,
      s.quantity,
      s.price,
      s.cost,
      s.discount,
      s.payment,
      s.total,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\r\n');
    downloadFile(`pharmacore-sales-${todayStr}.csv`, csv, 'text/csv');
    onShowToast('Sales exported to CSV');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-[11px] font-extrabold tracking-wider text-[#176b50] uppercase">
          Point of sale
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--pharma-text)] sm:text-3xl">
          Sales & POS
        </h1>
        <p className="mt-1 text-xs text-[var(--pharma-muted)]">
          Record counter sales, approve daily employee registers, or import sales spreadsheets.
        </p>
      </div>

      {/* Top row: Manual sales entry & Import sales register */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Manual Sales Entry */}
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs lg:col-span-7">
          <h2 className="text-base font-bold text-[var(--pharma-text)]">Manual counter sale</h2>
          <p className="mb-4 text-xs text-[var(--pharma-muted)]">
            Record a sale. Matching inventory batch quantity is deducted automatically.
          </p>

          <form onSubmit={handleManualSaleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-[var(--pharma-text)]">
                Medicine / batch to sell from *
              </label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => handleProductSelect(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs text-[var(--pharma-text)] outline-none focus:border-[#176b50]"
              >
                <option value="">Choose medicine and batch</option>
                {availableMedicines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · Batch: {p.batch} · {p.quantity} available
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold text-[var(--pharma-text)]">
                  Sale date *
                </label>
                <input
                  type="date"
                  required
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs text-[var(--pharma-text)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--pharma-text)]">
                  Quantity *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs text-[var(--pharma-text)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--pharma-text)]">
                  Unit selling price ({state.settings.currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs text-[var(--pharma-text)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--pharma-text)]">
                  Unit cost ({state.settings.currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs text-[var(--pharma-text)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--pharma-text)]">Discount (₦)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs text-[var(--pharma-text)] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--pharma-text)]">Payment method</label>
                <select
                  value={payment}
                  onChange={(e) => setPayment(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs text-[var(--pharma-text)] outline-none"
                >
                  <option>Cash</option>
                  <option>Bank transfer</option>
                  <option>Card</option>
                  <option>Mixed</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--pharma-text)]">
                Receipt number (optional)
              </label>
              <input
                type="text"
                placeholder="Auto-generated if left blank"
                value={receipt}
                onChange={(e) => setReceipt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs text-[var(--pharma-text)] outline-none"
              />
            </div>

            {manualFeedback && (
              <div
                className={`rounded-xl p-3 text-xs font-semibold ${
                  manualFeedback.type === 'error'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {manualFeedback.text}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="rounded-xl bg-[#176b50] px-6 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#104c34]"
              >
                Save manual sale
              </button>
            </div>
          </form>
        </div>

        {/* Import Sales Register */}
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs lg:col-span-5">
          <h2 className="text-base font-bold text-[var(--pharma-text)]">Import sales register</h2>
          <p className="mb-4 text-xs text-[var(--pharma-muted)]">
            Upload .xlsx, .xls or .csv sales register. Imported historical sales will not deduct stock a second time.
          </p>

          <div className="rounded-xl border border-dashed border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-5 text-center">
            <Upload className="mx-auto h-8 w-8 text-[#176b50]" />
            <div className="mt-2 text-xs font-bold text-[var(--pharma-text)]">
              Choose Excel or CSV sales register
            </div>
            <p className="mt-1 text-[11px] text-[var(--pharma-muted)]">
              Matches columns: receipt, product name, quantity, price, total, and date
            </p>
            <label className="mt-3 inline-block cursor-pointer rounded-xl bg-[#176b50] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#104c34]">
              Browse file
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleSalesUpload}
              />
            </label>
          </div>

          {salesUploadPreview && (
            <div className="mt-4 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-4 text-xs">
              <div className="font-bold text-[var(--pharma-text)]">
                Preview: {salesUploadPreview.fileName}
              </div>
              <p className="text-[11px] text-[var(--pharma-muted)]">
                Found {salesUploadPreview.items.length} rows · {salesUploadPreview.validCount} valid sales.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleConfirmImport}
                  className="rounded-lg bg-[#176b50] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#104c34]"
                >
                  Confirm & Import ({salesUploadPreview.validCount})
                </button>
                <button
                  onClick={() => setSalesUploadPreview(null)}
                  className="rounded-lg border border-[var(--pharma-line)] bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Employee Daily Sales Submissions (Admin Review) */}
      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--pharma-text)]">
              Employee daily sales submissions
            </h2>
            <p className="text-xs text-[var(--pharma-muted)]">
              Review staff submissions and compile approved daily totals into the sales register.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--pharma-line)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--pharma-muted)]">
                <th className="pb-3 pr-4">Employee</th>
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Shift</th>
                <th className="pb-3 pr-4">Txns</th>
                <th className="pb-3 pr-4">Units</th>
                <th className="pb-3 pr-4">Revenue</th>
                <th className="pb-3 text-right">Status / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pharma-line)]">
              {state.dailySales.length > 0 ? (
                state.dailySales.map((sub) => (
                  <tr key={sub.id} className="hover:bg-[var(--pharma-panel2)] transition">
                    <td className="py-3 pr-4 font-bold text-[var(--pharma-text)]">
                      {sub.employee}
                    </td>
                    <td className="py-3 pr-4">{sub.date}</td>
                    <td className="py-3 pr-4 text-[var(--pharma-muted)]">{sub.shift}</td>
                    <td className="py-3 pr-4">{sub.transactions}</td>
                    <td className="py-3 pr-4">{sub.units}</td>
                    <td className="py-3 pr-4 font-bold text-[#176b50]">
                      {formatMoney(sub.revenue, state.settings.currency)}
                    </td>
                    <td className="py-3 text-right">
                      {sub.status === 'Recorded' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" /> Recorded
                        </span>
                      ) : (
                        <button
                          onClick={() => handleApproveSubmission(sub)}
                          className="rounded-lg bg-[#176b50] px-3 py-1 text-[11px] font-bold text-white transition hover:bg-[#104c34]"
                        >
                          Record in sales
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-xs text-[var(--pharma-muted)]">
                    No employee submissions pending review.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Sales Register (Grouped by Date) */}
      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--pharma-text)]">Daily sales register</h2>
            <p className="text-xs text-[var(--pharma-muted)]">Real-time totals grouped by sales date.</p>
          </div>
          <button
            onClick={exportDailyRegisterCsv}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-1.5 text-xs font-semibold text-[var(--pharma-text)] hover:bg-[var(--pharma-line)]"
          >
            <Download className="h-3.5 w-3.5" /> Export register
          </button>
        </div>

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
              {dailyRegister.length > 0 ? (
                dailyRegister.map((r) => (
                  <tr key={r.date} className="hover:bg-[var(--pharma-panel2)] transition">
                    <td className="py-3 pr-4 font-bold text-[var(--pharma-text)]">{r.date}</td>
                    <td className="py-3 pr-4">{r.transactions.toLocaleString()}</td>
                    <td className="py-3 pr-4">{r.units.toLocaleString()}</td>
                    <td className="py-3 pr-4 font-bold text-[#176b50]">
                      {formatMoney(r.revenue, state.settings.currency)}
                    </td>
                    <td className="py-3 font-semibold text-emerald-700 dark:text-emerald-400">
                      {formatMoney(r.profit, state.settings.currency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-[var(--pharma-muted)]">
                    Daily totals will appear here as transactions are saved.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Transactions</span>
          <div className="mt-2 text-2xl font-black text-[var(--pharma-text)]">
            {state.sales.length.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">All recorded dates</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Units sold</span>
          <div className="mt-2 text-2xl font-black text-[var(--pharma-text)]">
            {totalUnits.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Itemised sales & summaries</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Sales revenue</span>
          <div className="mt-2 text-2xl font-black text-[#176b50]">
            {formatMoney(totalRev, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Saved in sales register</div>
        </div>

        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-5 shadow-xs">
          <span className="text-xs font-bold text-[var(--pharma-muted)]">Itemised gross profit</span>
          <div className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {formatMoney(totalProfit, state.settings.currency)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pharma-muted)]">Excludes un-costed summaries</div>
        </div>
      </div>

      {/* All Transactions Table */}
      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--pharma-muted)]" />
            <input
              type="text"
              placeholder="Search receipt, medicine name or payment…"
              value={salesSearch}
              onChange={(e) => {
                setSalesSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] py-2 pl-9 pr-3 text-xs text-[var(--pharma-text)] outline-none"
            />
          </div>

          <button
            onClick={exportAllSalesCsv}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs font-bold text-[var(--pharma-text)] hover:bg-[var(--pharma-line)]"
          >
            <Download className="h-3.5 w-3.5" /> Export sales CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--pharma-line)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--pharma-muted)]">
                <th className="pb-3 pr-4">Receipt</th>
                <th className="pb-3 pr-4">Medicine</th>
                <th className="pb-3 pr-4">Qty</th>
                <th className="pb-3 pr-4">Payment</th>
                <th className="pb-3 pr-4">Total</th>
                <th className="pb-3">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pharma-line)]">
              {pageSales.length > 0 ? (
                pageSales.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--pharma-panel2)] transition">
                    <td className="py-3 pr-4 font-mono font-bold text-[var(--pharma-text)]">
                      {s.receipt}
                      {s.aggregate && (
                        <div className="text-[10px] font-normal text-[var(--pharma-muted)]">
                          Daily summary
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-[var(--pharma-text)]">{s.name}</div>
                      {s.batch && (
                        <div className="text-[10px] text-[var(--pharma-muted)]">Batch: {s.batch}</div>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-bold">{s.quantity}</td>
                    <td className="py-3 pr-4 text-[var(--pharma-muted)]">{s.payment || '—'}</td>
                    <td className="py-3 pr-4 font-bold text-[#176b50]">
                      {formatMoney(s.total, state.settings.currency)}
                    </td>
                    <td className="py-3 text-[var(--pharma-muted)]">
                      <div>{s.date}</div>
                      <div className="text-[10px]">
                        {s.time ? new Date(s.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[var(--pharma-muted)]">
                    No sales recorded yet. Record a counter sale or import a sales register.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredSales.length > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-[var(--pharma-line)] pt-3 sm:flex-row">
            <div className="text-xs text-[var(--pharma-muted)]">
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filteredSales.length)} of{' '}
              {filteredSales.length} records
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
