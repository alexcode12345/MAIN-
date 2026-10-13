import * as XLSX from 'xlsx';

export interface ParsedStockRow {
  name: string;
  generic: string;
  category: string;
  batch: string;
  quantity: number;
  stockCountLabel: string;
  purchasePrice: number;
  sellingPrice: number;
  expiry: string;
  minStock: number;
  supplier: string;
  remarks: string;
  isValid: boolean;
}

export interface ParsedSaleRow {
  receipt: string;
  date: string;
  time: string;
  name: string;
  batch: string;
  quantity: number;
  price: number;
  cost: number;
  discount: number;
  payment: string;
  total: number;
  isValid: boolean;
}

export function normHeader(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/[₦$€£]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const STOCK_HEADER_ALIASES: Record<string, string[]> = {
  name: [
    'name',
    'medicine',
    'medicinename',
    'product',
    'productname',
    'item',
    'itemname',
    'itemdescription',
    'description',
    'drug',
    'drugname',
    'particulars',
  ],
  generic: ['generic', 'genericname', 'activeingredient', 'ingredient'],
  category: ['category', 'type', 'therapeuticclass', 'categorypage', 'page', 'stockcategory'],
  batch: ['batch', 'batchnumber', 'batchno', 'lot', 'lotnumber', 'lotno'],
  quantity: [
    'quantity',
    'qty',
    'stock',
    'stockquantity',
    'units',
    'availablequantity',
    'currentstock',
    'totalstockqty',
    'soldqty',
  ],
  purchasePrice: [
    'purchaseprice',
    'purchasepriceunit',
    'cost',
    'costprice',
    'unitcost',
    'buyprice',
    'buyingprice',
    'unitprice',
    'costperunit',
  ],
  sellingPrice: [
    'sellingprice',
    'sellingpriceunit',
    'retailprice',
    'saleprice',
    'sellingrate',
  ],
  expiry: [
    'expiry',
    'expirydate',
    'expirationdate',
    'expires',
    'bestbefore',
    'expirydatebatch',
  ],
  minStock: ['minstock', 'minimumstock', 'reorderlevel', 'reorderpoint', 'lowstocklevel'],
  supplier: ['supplier', 'vendor', 'distributor', 'suppliername'],
  remarks: ['remarks', 'remark', 'notes', 'remarksstatus', 'flag', 'condition'],
};

const SALES_HEADER_ALIASES: Record<string, string[]> = {
  receipt: [
    'receipt',
    'receiptno',
    'receiptnumber',
    'invoice',
    'invoiceno',
    'invoicenumber',
    'transactionid',
    'saleid',
    'billno',
  ],
  date: [
    'date',
    'saledate',
    'transactiondate',
    'datetime',
    'time',
  ],
  name: [
    'name',
    'medicine',
    'medicinename',
    'product',
    'productname',
    'item',
    'itemname',
    'description',
    'drug',
  ],
  batch: ['batch', 'batchnumber', 'batchno', 'lot', 'lotnumber'],
  quantity: ['quantity', 'qty', 'units', 'soldqty', 'qtysold', 'quantitysold', 'unitssold'],
  price: ['price', 'sellingprice', 'unitprice', 'rate', 'saleprice', 'retailprice'],
  total: [
    'total',
    'amount',
    'netamount',
    'salesamount',
    'grandtotal',
    'linetotal',
    'nettotal',
    'totalsales',
    'extendedprice',
  ],
  discount: ['discount', 'discountamount'],
  payment: ['payment', 'paymentmethod', 'modeofpayment', 'tender'],
  cost: ['cost', 'unitcost', 'purchaseprice', 'costprice'],
};

export function parseStockQuantity(raw: unknown): { valid: boolean; value: number; label: string } {
  const text = String(raw ?? '').trim();
  const m = text.match(/^\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(.*)$/);
  if (!m) return { valid: false, value: 0, label: text };
  const value = Number(m[1].replace(/,/g, ''));
  return { valid: Number.isFinite(value) && value >= 0, value, label: text };
}

export function normalizeExcelDate(v: unknown): string {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    try {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) {
        return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
      }
    } catch {
      // ignore
    }
  }
  const s = String(v ?? '').trim();
  if (!s || s === '-' || s === '—' || /^n\/?a$/i.test(s)) return '';

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;

  m = s.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const y = Number(m[2]);
    const mo = Number(m[1]);
    if (mo >= 1 && mo <= 12) {
      const lastDay = new Date(y, mo, 0).getDate();
      return `${y}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  m = s.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    if (mo >= 1 && mo <= 12) {
      const lastDay = new Date(y, mo, 0).getDate();
      return `${y}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
  }

  m = s.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
  if (m) {
    const d1 = Number(m[1]);
    const d2 = Number(m[2]);
    const y = Number(m[3]);
    // check month/day order
    if (d1 <= 12 && d2 > 12) {
      // month then day
      return `${y}-${String(d1).padStart(2, '0')}-${String(d2).padStart(2, '0')}`;
    }
    // day then month
    if (d2 <= 12 && d1 <= 31) {
      return `${y}-${String(d2).padStart(2, '0')}-${String(d1).padStart(2, '0')}`;
    }
  }

  // Fallback Date parser
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1990 && parsed.getFullYear() < 2100) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

export function parseCSV(text: string): string[][] {
  text = String(text ?? '').replace(/^\uFEFF/, '');
  const candidates = [',', ';', '\t', '|'];

  function parseWith(delim: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') {
          field += '"';
          i++;
        } else if (c === '"') {
          quoted = false;
        } else {
          field += c;
        }
      } else if (c === '"' && field.length === 0) {
        quoted = true;
      } else if (c === delim) {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field.replace(/\r$/, ''));
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
    if (field.length || row.length) {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
    }
    return rows.filter((r) => r.some((v) => String(v).trim()));
  }

  let best: string[][] = [];
  let bestScore = -1;
  for (const delim of candidates) {
    const rows = parseWith(delim);
    const widths = rows.slice(0, 15).map((r) => r.length);
    const multi = widths.filter((n) => n > 1).length;
    const avg = widths.reduce((a, b) => a + b, 0) / (widths.length || 1);
    const consistency = widths.length ? widths.filter((n) => n === Math.max(...widths)).length / widths.length : 0;
    const score = (multi ? avg : 0) + consistency * 3 + multi * 0.2;
    if (score > bestScore) {
      bestScore = score;
      best = rows;
    }
  }
  return best;
}

export function rowsFromSheetMatrix(matrix: unknown[][]): {
  rows: Record<string, unknown>[];
  headerRow: number;
  score: number;
} {
  const stockTokens = new Set(Object.values(STOCK_HEADER_ALIASES).flat().map(normHeader));
  const salesTokens = new Set(Object.values(SALES_HEADER_ALIASES).flat().map(normHeader));
  const allTokens = new Set([...stockTokens, ...salesTokens]);

  let best = -1;
  let bestScore = 0;

  for (let i = 0; i < Math.min(matrix.length, 40); i++) {
    const row = matrix[i] || [];
    const score = row.reduce<number>((acc, c) => acc + (allTokens.has(normHeader(c)) ? 1 : 0), 0);
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }

  if (best < 0 || bestScore < 2) {
    return { rows: [], headerRow: -1, score: bestScore };
  }

  const headers = (matrix[best] || []).map((v) => String(v ?? '').trim());
  const rows: Record<string, unknown>[] = [];

  for (let i = best + 1; i < matrix.length; i++) {
    const vals = matrix[i] || [];
    if (!vals.some((v) => String(v ?? '').trim())) continue;
    // Skip summary / total rows
    if (
      /^(grand\s+)?total$/i.test(String(vals[0] ?? '').trim()) ||
      vals.some((v) => /^\s*\d+\s+total\s+skus?\s*$/i.test(String(v ?? '')))
    ) {
      continue;
    }

    const o: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      if (h) o[h] = vals[j] ?? '';
    });
    if (Object.values(o).some((v) => String(v ?? '').trim())) {
      rows.push(o);
    }
  }

  return { rows, headerRow: best, score: bestScore };
}

export function canonicalizeStockRow(rawRow: Record<string, unknown>): ParsedStockRow {
  const normalizedKeys: Record<string, unknown> = {};
  Object.keys(rawRow).forEach((k) => {
    normalizedKeys[normHeader(k)] = rawRow[k];
  });

  const getVal = (aliases: string[]): unknown => {
    for (const a of aliases) {
      const nk = normHeader(a);
      if (
        Object.prototype.hasOwnProperty.call(normalizedKeys, nk) &&
        normalizedKeys[nk] !== '' &&
        normalizedKeys[nk] !== null &&
        normalizedKeys[nk] !== undefined
      ) {
        return normalizedKeys[nk];
      }
    }
    return '';
  };

  const name = String(getVal(STOCK_HEADER_ALIASES.name)).trim();
  const generic = String(getVal(STOCK_HEADER_ALIASES.generic)).trim();
  const category = String(getVal(STOCK_HEADER_ALIASES.category)).trim() || 'Other';
  const batch = String(getVal(STOCK_HEADER_ALIASES.batch)).trim() || 'Not recorded';
  const supplier = String(getVal(STOCK_HEADER_ALIASES.supplier)).trim();
  const remarks = String(getVal(STOCK_HEADER_ALIASES.remarks)).trim();

  const rawQty = getVal(STOCK_HEADER_ALIASES.quantity);
  const qtyParsed = parseStockQuantity(rawQty);

  const rawPurchase = String(getVal(STOCK_HEADER_ALIASES.purchasePrice) ?? '').replace(/[₦$€£,\s]/g, '');
  const purchasePrice = rawPurchase !== '' && Number.isFinite(Number(rawPurchase)) ? Math.max(0, Number(rawPurchase)) : 0;

  const rawSelling = String(getVal(STOCK_HEADER_ALIASES.sellingPrice) ?? '').replace(/[₦$€£,\s]/g, '');
  const sellingPrice = rawSelling !== '' && Number.isFinite(Number(rawSelling)) ? Math.max(0, Number(rawSelling)) : 0;

  const rawMin = String(getVal(STOCK_HEADER_ALIASES.minStock) ?? '').replace(/[,\s]/g, '');
  const minStock = rawMin !== '' && Number.isFinite(Number(rawMin)) ? Math.max(0, Number(rawMin)) : 0;

  const expiry = normalizeExcelDate(getVal(STOCK_HEADER_ALIASES.expiry));

  const isValid = Boolean(name) && qtyParsed.valid && purchasePrice >= 0 && sellingPrice >= 0;

  return {
    name,
    generic,
    category,
    batch,
    quantity: qtyParsed.value,
    stockCountLabel: qtyParsed.label || String(qtyParsed.value),
    purchasePrice,
    sellingPrice,
    expiry,
    minStock,
    supplier,
    remarks,
    isValid,
  };
}

export function canonicalizeSaleRow(rawRow: Record<string, unknown>): ParsedSaleRow {
  const normalizedKeys: Record<string, unknown> = {};
  Object.keys(rawRow).forEach((k) => {
    normalizedKeys[normHeader(k)] = rawRow[k];
  });

  const getVal = (aliases: string[]): unknown => {
    for (const a of aliases) {
      const nk = normHeader(a);
      if (
        Object.prototype.hasOwnProperty.call(normalizedKeys, nk) &&
        normalizedKeys[nk] !== '' &&
        normalizedKeys[nk] !== null &&
        normalizedKeys[nk] !== undefined
      ) {
        return normalizedKeys[nk];
      }
    }
    return '';
  };

  const toNum = (v: unknown): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    const cleaned = String(v ?? '').replace(/[₦$€£,\s()]/g, '');
    const n = Number(cleaned);
    return String(v ?? '').trim() === '' ? NaN : n;
  };

  const name = String(getVal(SALES_HEADER_ALIASES.name)).trim();
  const batch = String(getVal(SALES_HEADER_ALIASES.batch)).trim() || 'Not recorded';
  const receipt = String(getVal(SALES_HEADER_ALIASES.receipt) || '').trim() || `IMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const quantity = toNum(getVal(SALES_HEADER_ALIASES.quantity));
  let price = toNum(getVal(SALES_HEADER_ALIASES.price));
  let total = toNum(getVal(SALES_HEADER_ALIASES.total));
  const cost = toNum(getVal(SALES_HEADER_ALIASES.cost)) || 0;
  const discount = toNum(getVal(SALES_HEADER_ALIASES.discount)) || 0;
  const payment = String(getVal(SALES_HEADER_ALIASES.payment) || 'Imported').trim();

  const rawDate = getVal(SALES_HEADER_ALIASES.date);
  let date = normalizeExcelDate(rawDate);
  if (!date && rawDate) {
    const d = new Date(String(rawDate));
    if (!isNaN(d.getTime())) date = d.toISOString().slice(0, 10);
  }
  if (!date) {
    date = new Date().toISOString().slice(0, 10);
  }

  if (!Number.isFinite(price) || price < 0) {
    price = quantity > 0 && Number.isFinite(total) && total >= 0 ? total / quantity : 0;
  }
  if (!Number.isFinite(total) || total < 0) {
    total = Number.isFinite(quantity) && quantity > 0 ? quantity * price - discount : 0;
  }

  const isValid = Boolean(name) && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(total) && total >= 0;

  return {
    receipt,
    date,
    time: `${date}T12:00:00`,
    name,
    batch,
    quantity: Number.isFinite(quantity) ? quantity : 0,
    price: Number.isFinite(price) ? price : 0,
    cost: Number.isFinite(cost) ? cost : 0,
    discount: Number.isFinite(discount) ? discount : 0,
    payment,
    total: Number.isFinite(total) ? total : 0,
    isValid,
  };
}

export function escapeCsv(val: unknown): string {
  const str = String(val ?? '');
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function downloadFile(name: string, content: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
