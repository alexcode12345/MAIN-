import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, FileSpreadsheet, Trash2, ShieldCheck, AlertCircle, Eye } from 'lucide-react';
import { AppState, Product, ImportedFile, Sale } from '../types';
import { formatMoney, monthLabel } from '../utils/formatters';
import {
  parseCSV,
  rowsFromSheetMatrix,
  canonicalizeStockRow,
  canonicalizeSaleRow,
  downloadFile,
  escapeCsv,
  ParsedStockRow,
} from '../utils/spreadsheet';
import { passwordHash, getOwnerProfile } from '../utils/storage';

interface ImportsViewProps {
  state: AppState;
  onCommitStockImport: (
    items: ParsedStockRow[],
    fileName: string,
    stockMonth: string,
    mode: 'update' | 'additional'
  ) => void;
  onCommitSalesImport: (sales: Sale[], fileName: string) => void;
  onDeleteImportedFile: (fileId: string) => void;
  onRestoreBackup: (newState: AppState) => void;
  onShowToast: (msg: string) => void;
  onExportBackup: () => void;
}

export const ImportsView: React.FC<ImportsViewProps> = ({
  state,
  onCommitStockImport,
  onCommitSalesImport,
  onDeleteImportedFile,
  onRestoreBackup,
  onShowToast,
  onExportBackup,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonth = todayStr.slice(0, 7);

  const [importMode, setImportMode] = useState<'stock' | 'sales'>('stock');
  const [stockMonth, setStockMonth] = useState(currentMonth);

  // Pending previews
  const [stockPreview, setStockPreview] = useState<{
    fileName: string;
    rows: ParsedStockRow[];
    sourceSheet?: string;
  } | null>(null);

  const [salesPreview, setSalesPreview] = useState<{
    fileName: string;
    rows: any[];
  } | null>(null);

  // Conflict modal state (when another stock file exists for the selected month)
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);

  // Password confirmation modal for deleting a stock file
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteFile, setPendingDeleteFile] = useState<ImportedFile | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        let rows: Record<string, unknown>[] = [];
        let detectedMonth = '';
        let sourceSheet = '';

        if (ext === 'csv') {
          const raw = parseCSV(event.target?.result as string);
          rows = rowsFromSheetMatrix(raw).rows;
        } else if (ext === 'xlsx' || ext === 'xls') {
          const wb = XLSX.read(event.target?.result, { type: 'array', cellDates: true });

          // Try detecting logged month from cells if user has not picked a specific non-default month
          const monthNames: Record<string, number> = {
            january: 1,
            february: 2,
            march: 3,
            april: 4,
            may: 5,
            june: 6,
            july: 7,
            august: 8,
            september: 9,
            october: 10,
            november: 11,
            december: 12,
          };

          for (const sn of wb.SheetNames) {
            const cells = (
              XLSX.utils.sheet_to_json(wb.Sheets[sn], {
                header: 1,
                defval: '',
                raw: true,
              }) as unknown[][]
            )
              .flat()
              .map((v) => String(v ?? ''))
              .join(' ');

            const mm = cells.match(/logged\s*:\s*([a-z]+)\s+(20\d{2})/i);
            if (mm && monthNames[mm[1].toLowerCase()]) {
              detectedMonth = `${mm[2]}-${String(monthNames[mm[1].toLowerCase()]).padStart(2, '0')}`;
              break;
            }
          }

          // Pick the best sheet matching headers
          let best = { rows: [] as Record<string, unknown>[], score: 0, sheet: '' };
          const sheetOrder = [...wb.SheetNames].sort(
            (a, b) =>
              (/all inventory|master inventory/i.test(b) ? 1 : 0) -
              (/all inventory|master inventory/i.test(a) ? 1 : 0)
          );

          for (const sName of sheetOrder) {
            const matrix = XLSX.utils.sheet_to_json(wb.Sheets[sName], {
              header: 1,
              defval: '',
              raw: true,
            }) as unknown[][];
            const parsed = rowsFromSheetMatrix(matrix);
            if (parsed.score > best.score) {
              best = { ...parsed, sheet: sName };
            }
          }

          rows = best.rows;
          sourceSheet = best.sheet;
        } else {
          throw new Error('Please choose an Excel (.xlsx, .xls) or CSV file.');
        }

        if (detectedMonth) {
          setStockMonth(detectedMonth);
        }

        if (!rows.length) {
          throw new Error('No recognizable table found. Ensure file contains product and quantity columns.');
        }

        if (importMode === 'stock') {
          const canonical = rows.map(canonicalizeStockRow);
          setStockPreview({
            fileName: file.name,
            rows: canonical,
            sourceSheet,
          });
          onShowToast(`Stock file analyzed: ${canonical.filter((r) => r.isValid).length} ready rows`);
        } else {
          const canonical = rows.map(canonicalizeSaleRow);
          setSalesPreview({
            fileName: file.name,
            rows: canonical,
          });
          onShowToast(`Sales file analyzed: ${canonical.filter((r) => r.isValid).length} ready rows`);
        }
      } catch (err: any) {
        alert(err.message || 'Could not parse spreadsheet.');
      }
    };

    if (ext === 'csv') reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleStartStockImport = () => {
    if (!stockPreview) return;
    const existing = state.importedFiles.filter(
      (f) => f.kind === 'stock' && f.month === stockMonth
    );
    if (existing.length > 0) {
      setConflictModalOpen(true);
    } else {
      executeStockImport('update');
    }
  };

  const executeStockImport = (mode: 'update' | 'additional') => {
    if (!stockPreview) return;
    const validItems = stockPreview.rows.filter((r) => r.isValid);
    onCommitStockImport(validItems, stockPreview.fileName, stockMonth, mode);
    setStockPreview(null);
    setConflictModalOpen(false);
    onShowToast(`Stock import complete for ${monthLabel(stockMonth)}`);
  };

  const handleCommitSales = () => {
    if (!salesPreview) return;
    const valid = salesPreview.rows.filter((r) => r.isValid);
    const newSales: Sale[] = valid.map((r) => ({
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
    onCommitSalesImport(newSales, salesPreview.fileName);
    setSalesPreview(null);
    onShowToast(`Sales import complete: ${newSales.length} rows added`);
  };

  // Restore backup handler
  const handleRestoreBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.sales)) {
          throw new Error('Invalid backup file structure.');
        }
        if (
          confirm(
            'Restore this backup? This will replace your current workspace records on this device. (Ensure you have a recent backup exported if needed).'
          )
        ) {
          onRestoreBackup(parsed);
          onShowToast('Workspace successfully restored from backup');
        }
      } catch (err: any) {
        alert(err.message || 'Invalid backup JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Delete imported file password verification
  const confirmDeleteFile = (file: ImportedFile) => {
    setPendingDeleteFile(file);
    setDeletePassword('');
    setDeleteError('');
    setDeleteModalOpen(true);
  };

  const executeDeleteFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingDeleteFile) return;

    const owner = getOwnerProfile();
    if (owner && passwordHash(deletePassword) !== owner.passwordHash) {
      setDeleteError('Incorrect owner password. File deletion blocked.');
      return;
    }

    onDeleteImportedFile(pendingDeleteFile.id);
    setDeleteModalOpen(false);
    setPendingDeleteFile(null);
    onShowToast(`Deleted import: ${pendingDeleteFile.name}`);
  };

  // Templates download
  const downloadStockTemplate = () => {
    const content =
      'name,generic,category,batch,quantity,purchasePrice,sellingPrice,expiry,minStock,supplier\nParacetamol 500mg,Paracetamol,Analgesic,BATCH-001,100,50,80,2027-12-31,20,Emzor';
    downloadFile('pharmacore-blank-stock-template.csv', content, 'text/csv');
    onShowToast('Stock template CSV downloaded');
  };

  const downloadSalesTemplate = () => {
    const content =
      'receipt,date,name,batch,quantity,price,total,discount,payment,cost\nRX-1001,2026-10-13,Paracetamol 500mg,BATCH-001,2,80,160,0,Cash,50';
    downloadFile('pharmacore-blank-sales-template.csv', content, 'text/csv');
    onShowToast('Sales template CSV downloaded');
  };

  // Stock files grouped by month
  const stockMonths = [
    ...new Set(
      state.importedFiles.filter((f) => f.kind === 'stock').map((f) => f.month || 'unassigned')
    ),
  ].sort().reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-[11px] font-extrabold tracking-wider text-[#176b50] uppercase">
          Data management
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--pharma-text)] sm:text-3xl">
          Spreadsheet centre
        </h1>
        <p className="mt-1 text-xs text-[var(--pharma-muted)]">
          Import inventory safely, maintain historical file snapshots, and export backups.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Import Uploader & Preview Card */}
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs lg:col-span-8">
          <h2 className="text-base font-bold text-[var(--pharma-text)]">Import Excel or CSV</h2>
          <p className="mb-4 text-xs text-[var(--pharma-muted)]">
            Smart column detection recognizes product names, batches, expiry dates, quantities, and prices automatically.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-[var(--pharma-text)]">
                What are you importing?
              </label>
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs text-[var(--pharma-text)] outline-none"
              >
                <option value="stock">Stock / Inventory (Updates current stock)</option>
                <option value="sales">Sales register / Past sales (Historical transactions)</option>
              </select>
            </div>

            {importMode === 'stock' && (
              <div>
                <label className="block text-xs font-bold text-[var(--pharma-text)]">
                  Stock month / snapshot period
                </label>
                <input
                  type="month"
                  value={stockMonth}
                  onChange={(e) => setStockMonth(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs text-[var(--pharma-text)] outline-none"
                />
              </div>
            )}
          </div>

          {/* Upload Dropzone */}
          <div className="mt-5 rounded-2xl border border-dashed border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-6 text-center">
            <FileSpreadsheet className="mx-auto h-10 w-10 text-[#176b50]" />
            <div className="mt-2 text-xs font-bold text-[var(--pharma-text)]">
              Choose an .xlsx, .xls or .csv spreadsheet
            </div>
            <p className="mt-1 text-[11px] text-[var(--pharma-muted)]">
              Files are processed locally inside your browser. No data leaves your machine.
            </p>
            <label className="mt-4 inline-block cursor-pointer rounded-xl bg-[#176b50] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#104c34]">
              Select spreadsheet file
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* Stock Preview Table */}
          {stockPreview && (
            <div className="mt-6 rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-4 text-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[var(--pharma-text)]">
                    Import Preview: {stockPreview.fileName}
                  </div>
                  <div className="text-[11px] text-[var(--pharma-muted)]">
                    Filing under: <strong>{monthLabel(stockMonth)}</strong> ·{' '}
                    {stockPreview.rows.filter((r) => r.isValid).length} ready rows of{' '}
                    {stockPreview.rows.length} detected
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleStartStockImport}
                    className="rounded-xl bg-[#176b50] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#104c34]"
                  >
                    Confirm Import ({stockPreview.rows.filter((r) => r.isValid).length} rows)
                  </button>
                  <button
                    onClick={() => setStockPreview(null)}
                    className="rounded-xl border border-[var(--pharma-line)] bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              <div className="mt-4 max-h-64 overflow-x-auto rounded-xl border border-[var(--pharma-line)] bg-white dark:bg-[#121c18]">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-[var(--pharma-line)] bg-gray-50 text-[10px] uppercase font-bold text-[var(--pharma-muted)] dark:bg-neutral-900">
                      <th className="p-2.5">Product</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Batch</th>
                      <th className="p-2.5">Qty</th>
                      <th className="p-2.5">Cost</th>
                      <th className="p-2.5">Sell Price</th>
                      <th className="p-2.5">Expiry</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--pharma-line)]">
                    {stockPreview.rows.slice(0, 15).map((r, i) => (
                      <tr key={i}>
                        <td className="p-2.5 font-bold">{r.name}</td>
                        <td className="p-2.5 text-[var(--pharma-muted)]">{r.category}</td>
                        <td className="p-2.5 font-mono">{r.batch}</td>
                        <td className="p-2.5">{r.stockCountLabel || r.quantity}</td>
                        <td className="p-2.5 font-mono">{formatMoney(r.purchasePrice, state.settings.currency)}</td>
                        <td className="p-2.5 font-mono">{formatMoney(r.sellingPrice, state.settings.currency)}</td>
                        <td className="p-2.5">{r.expiry || '—'}</td>
                        <td className="p-2.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              r.isValid
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {r.isValid ? 'Ready' : 'Check row'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sales Preview Table */}
          {salesPreview && (
            <div className="mt-6 rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-4 text-xs animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-[var(--pharma-text)]">
                    Sales Register Preview: {salesPreview.fileName}
                  </div>
                  <div className="text-[11px] text-[var(--pharma-muted)]">
                    {salesPreview.rows.filter((r) => r.isValid).length} ready sales rows
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCommitSales}
                    className="rounded-xl bg-[#176b50] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#104c34]"
                  >
                    Confirm Import
                  </button>
                  <button
                    onClick={() => setSalesPreview(null)}
                    className="rounded-xl border border-[var(--pharma-line)] bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Download Blank Templates */}
          <div className="mt-5 flex flex-wrap gap-2 border-t border-[var(--pharma-line)] pt-4">
            <button
              onClick={downloadStockTemplate}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-1.5 text-xs font-semibold text-[var(--pharma-text)] hover:bg-[var(--pharma-line)]"
            >
              <Download className="h-3.5 w-3.5" /> Download stock CSV template
            </button>
            <button
              onClick={downloadSalesTemplate}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-1.5 text-xs font-semibold text-[var(--pharma-text)] hover:bg-[var(--pharma-line)]"
            >
              <Download className="h-3.5 w-3.5" /> Download sales CSV template
            </button>
          </div>
        </div>

        {/* Backups Card */}
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs lg:col-span-4">
          <h2 className="text-base font-bold text-[var(--pharma-text)]">Export & Backup</h2>
          <p className="mb-4 text-xs text-[var(--pharma-muted)]">
            Keep independent offline copies of your inventory and sales data.
          </p>

          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-4">
              <div className="text-xs font-bold text-[var(--pharma-text)]">Full JSON backup</div>
              <p className="mt-1 text-[11px] text-[var(--pharma-muted)]">
                Contains complete catalogue, sales registers, and activity trail.
              </p>
              <button
                onClick={onExportBackup}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#176b50] py-2 text-xs font-bold text-white shadow-xs hover:bg-[#104c34]"
              >
                <Download className="h-3.5 w-3.5" /> Export full backup
              </button>
            </div>

            <div className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-4">
              <div className="text-xs font-bold text-[var(--pharma-text)]">Restore backup</div>
              <p className="mt-1 text-[11px] text-[var(--pharma-muted)]">
                Load a previously exported JSON backup file.
              </p>
              <label className="mt-3 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[var(--pharma-line)] bg-white py-2 text-xs font-bold text-gray-800 shadow-xs hover:bg-gray-50 dark:bg-neutral-800 dark:text-gray-200">
                <Upload className="h-3.5 w-3.5" /> Choose backup file
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleRestoreBackupFile}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Imported File History */}
      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <h2 className="text-base font-bold text-[var(--pharma-text)]">Imported file history</h2>
        <p className="mb-4 text-xs text-[var(--pharma-muted)]">
          Monthly stock files and sales registers. Stock file deletion requires owner password verification to prevent accidental data loss.
        </p>

        <div className="space-y-4">
          {stockMonths.length > 0 ? (
            stockMonths.map((m) => {
              const filesInMonth = state.importedFiles.filter(
                (f) => f.kind === 'stock' && (f.month || 'unassigned') === m
              );
              return (
                <div
                  key={m}
                  className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between border-b border-[var(--pharma-line)] pb-2">
                    <h3 className="text-xs font-bold text-[var(--pharma-text)]">
                      {monthLabel(m)} ({filesInMonth.length} file(s))
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead>
                        <tr className="text-[10px] uppercase font-bold text-[var(--pharma-muted)]">
                          <th className="pb-2">File Name</th>
                          <th className="pb-2">Imported On</th>
                          <th className="pb-2">Rows</th>
                          <th className="pb-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--pharma-line)]">
                        {filesInMonth.map((f) => (
                          <tr key={f.id}>
                            <td className="py-2.5 font-bold text-[var(--pharma-text)]">{f.name}</td>
                            <td className="py-2.5 text-[var(--pharma-muted)]">
                              {new Date(f.date).toLocaleDateString()}
                            </td>
                            <td className="py-2.5">{f.count} rows</td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() => confirmDeleteFile(f)}
                                className="flex items-center gap-1 ml-auto rounded-lg border border-red-200 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:hover:bg-red-950/40"
                              >
                                <Trash2 className="h-3 w-3" /> Delete stock file
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-[var(--pharma-muted)]">
              No spreadsheet imports recorded yet.
            </div>
          )}
        </div>
      </div>

      {/* Conflict Modal */}
      {conflictModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-[var(--pharma-text)]">
              A stock file already exists for {monthLabel(stockMonth)}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[var(--pharma-muted)]">
              How would you like to handle this new file?
            </p>

            <div className="mt-5 space-y-2.5">
              <button
                onClick={() => executeStockImport('update')}
                className="w-full rounded-xl bg-[#176b50] p-3 text-left text-xs font-bold text-white hover:bg-[#104c34]"
              >
                <div>Update existing month — Apply as latest stock count</div>
                <div className="text-[11px] font-normal text-emerald-100">
                  Updates inventory records to match this latest count.
                </div>
              </button>

              <button
                onClick={() => executeStockImport('additional')}
                className="w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-3 text-left text-xs font-bold text-[var(--pharma-text)] hover:bg-gray-100"
              >
                <div>Save as additional snapshot — Archive for comparison only</div>
                <div className="text-[11px] font-normal text-[var(--pharma-muted)]">
                  Keeps historical copy in analytics without altering live inventory.
                </div>
              </button>

              <button
                onClick={() => setConflictModalOpen(false)}
                className="w-full rounded-xl border border-gray-300 p-2.5 text-center text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Password Verification Modal */}
      {deleteModalOpen && pendingDeleteFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--pharma-text)]">
                  Owner verification required
                </h3>
                <div className="text-xs text-[var(--pharma-muted)]">
                  Deleting {pendingDeleteFile.name}
                </div>
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[var(--pharma-muted)]">
              Enter your owner account password to authorize permanent removal of this stock file.
            </p>

            {deleteError && (
              <div className="mt-3 rounded-xl bg-red-100 p-2.5 text-xs font-semibold text-red-800">
                {deleteError}
              </div>
            )}

            <form onSubmit={executeDeleteFile} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--pharma-text)]">
                  Owner password
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter password"
                  className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3 py-2 text-xs text-[var(--pharma-text)] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  className="rounded-xl border border-[var(--pharma-line)] px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
                >
                  Verify & Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
