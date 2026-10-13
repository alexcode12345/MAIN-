import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, CheckCircle2, Clock } from 'lucide-react';
import { AppState, DailySalesSubmission, UserProfile } from '../types';
import { formatMoney } from '../utils/formatters';
import { parseCSV, rowsFromSheetMatrix, canonicalizeSaleRow } from '../utils/spreadsheet';

interface DailySalesViewProps {
  state: AppState;
  currentUser: UserProfile | null;
  onSubmitDailySales: (submission: DailySalesSubmission) => void;
  onShowToast: (msg: string) => void;
}

export const DailySalesView: React.FC<DailySalesViewProps> = ({
  state,
  currentUser,
  onSubmitDailySales,
  onShowToast,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(todayStr);
  const [transactions, setTransactions] = useState(0);
  const [units, setUnits] = useState(0);
  const [revenue, setRevenue] = useState<number | string>('');
  const [payment, setPayment] = useState('Mixed');
  const [shift, setShift] = useState('Full day');
  const [notes, setNotes] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [uploadFileName, setUploadFileName] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
          throw new Error('Please select an Excel (.xlsx, .xls) or CSV file');
        }

        if (!rows.length) {
          throw new Error('No recognizable sales rows found. Include product name and quantity columns.');
        }

        const parsed = rows.map(canonicalizeSaleRow).filter((r) => r.isValid);
        let totalUnits = 0;
        let totalRev = 0;

        parsed.forEach((r) => {
          totalUnits += r.quantity;
          totalRev += r.total;
        });

        if (parsed.length === 0) {
          throw new Error('No valid sales items detected in workbook.');
        }

        setTransactions(parsed.length);
        setUnits(totalUnits);
        setRevenue(totalRev.toFixed(2));
        setUploadFileName(file.name);
        setParsedItems(
          parsed.map((r) => ({
            name: r.name,
            batch: r.batch,
            quantity: r.quantity,
            price: r.price,
            cost: r.cost,
            discount: r.discount,
            total: r.total,
            date: r.date || date,
            receipt: r.receipt,
            payment: r.payment || payment,
          }))
        );

        setUploadStatus(
          `Analyzed ${file.name}: ${parsed.length} rows, ${totalUnits} units, ${formatMoney(totalRev, state.settings.currency)} estimated revenue.`
        );
        onShowToast('Spreadsheet analyzed and values populated');
      } catch (err: any) {
        setUploadStatus(`Error: ${err.message || 'Could not process spreadsheet'}`);
      }
    };

    if (ext === 'csv') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const revNum = Number(revenue);
    if (!date || transactions < 0 || units < 0 || isNaN(revNum) || revNum < 0) {
      alert('Please check all input numbers before submitting.');
      return;
    }

    const submission: DailySalesSubmission = {
      id: `DS-${Math.random().toString(36).slice(2, 9).toUpperCase()}`,
      employee: currentUser?.displayName || currentUser?.username || 'Employee',
      username: currentUser?.username || 'user',
      date,
      transactions: Number(transactions),
      units: Number(units),
      revenue: revNum,
      payment,
      shift,
      notes: notes.trim() + (uploadFileName ? ` · Upload: ${uploadFileName}` : ''),
      uploadFile: uploadFileName,
      saleItems: parsedItems,
      status: 'Pending',
      submittedAt: new Date().toISOString(),
    };

    onSubmitDailySales(submission);
    // Reset form
    setTransactions(0);
    setUnits(0);
    setRevenue('');
    setNotes('');
    setUploadStatus('');
    setParsedItems([]);
    setUploadFileName('');
    onShowToast('Daily sales submitted for admin review');
  };

  // Filter my submissions
  const mySubmissions = state.dailySales.filter(
    (s) => s.username === (currentUser?.username || '')
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-[11px] font-extrabold tracking-wider text-[#176b50] uppercase">
          Employee workspace
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--pharma-text)] sm:text-3xl">
          Daily sales entry
        </h1>
        <p className="mt-1 text-xs text-[var(--pharma-muted)]">
          Submit your shift or daily sales totals. All submissions are queued for admin approval.
        </p>
      </div>

      {/* Form card */}
      <div className="max-w-3xl rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <h2 className="text-base font-bold text-[var(--pharma-text)]">Submit daily sales</h2>
        <p className="mb-5 text-xs text-[var(--pharma-muted)]">
          Fill in the values from your register, or upload a daily sales spreadsheet to auto-calculate totals.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-[var(--pharma-text)]">
                Sales date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none focus:border-[#176b50]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--pharma-text)]">
                Number of transactions *
              </label>
              <input
                type="number"
                min={0}
                required
                value={transactions}
                onChange={(e) => setTransactions(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none focus:border-[#176b50]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--pharma-text)]">
                Total units sold *
              </label>
              <input
                type="number"
                min={0}
                required
                value={units}
                onChange={(e) => setUnits(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none focus:border-[#176b50]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--pharma-text)]">
                Total sales revenue ({state.settings.currency}) *
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                placeholder="0.00"
                value={revenue}
                onChange={(e) => setRevenue(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none focus:border-[#176b50]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--pharma-text)]">
                Payment method
              </label>
              <select
                value={payment}
                onChange={(e) => setPayment(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none focus:border-[#176b50]"
              >
                <option>Mixed</option>
                <option>Cash</option>
                <option>Bank transfer</option>
                <option>Card</option>
                <option>Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--pharma-text)]">Shift</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none focus:border-[#176b50]"
              >
                <option>Full day</option>
                <option>Morning</option>
                <option>Afternoon</option>
                <option>Evening</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--pharma-text)]">
              Notes (optional)
            </label>
            <input
              type="text"
              maxLength={300}
              placeholder="e.g. Shift handover notes or receipt range"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none focus:border-[#176b50]"
            />
          </div>

          {/* Optional Excel Upload */}
          <div className="rounded-xl border border-dashed border-[var(--pharma-line)] p-4">
            <label className="block text-xs font-bold text-[var(--pharma-text)]">
              Upload daily sales register (Optional Excel / CSV)
            </label>
            <p className="mt-0.5 text-[11px] text-[var(--pharma-muted)]">
              Upload the day’s spreadsheet. PharmaCore will calculate total transactions, units and revenue for you.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="mt-2.5 block text-xs text-[var(--pharma-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[#176b50] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-[#104c34]"
            />
            {uploadStatus && (
              <div className="mt-2 text-xs font-semibold text-[#176b50]">{uploadStatus}</div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-xl bg-[#176b50] px-6 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#104c34]"
            >
              Submit daily sales
            </button>
          </div>
        </form>
      </div>

      {/* My Submissions Table */}
      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <h2 className="text-base font-bold text-[var(--pharma-text)]">My submissions</h2>
        <p className="mb-4 text-xs text-[var(--pharma-muted)]">
          Historical daily totals submitted under your account.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--pharma-line)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--pharma-muted)]">
                <th className="pb-3 pr-4">Date</th>
                <th className="pb-3 pr-4">Shift</th>
                <th className="pb-3 pr-4">Transactions</th>
                <th className="pb-3 pr-4">Units</th>
                <th className="pb-3 pr-4">Revenue</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pharma-line)]">
              {mySubmissions.length > 0 ? (
                mySubmissions.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--pharma-panel2)] transition">
                    <td className="py-3 pr-4 font-bold text-[var(--pharma-text)]">{s.date}</td>
                    <td className="py-3 pr-4 text-[var(--pharma-muted)]">{s.shift}</td>
                    <td className="py-3 pr-4">{s.transactions}</td>
                    <td className="py-3 pr-4">{s.units}</td>
                    <td className="py-3 pr-4 font-bold text-[#176b50]">
                      {formatMoney(s.revenue, state.settings.currency)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          s.status === 'Recorded'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {s.status === 'Recorded' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-[var(--pharma-muted)]">
                    No daily sales submitted yet.
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
