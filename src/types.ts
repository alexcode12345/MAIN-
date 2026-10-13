export interface Product {
  id: string;
  name: string;
  generic: string;
  category: string;
  batch: string;
  quantity: number;
  stockCountLabel?: string;
  purchasePrice: number;
  sellingPrice: number;
  expiry: string; // YYYY-MM-DD or empty
  minStock: number;
  supplier: string;
  updated: string;
  stockMonth: string; // YYYY-MM
  status: 'active' | 'quarantined' | 'archived';
  notes?: string;
  importId?: string;
}

export interface Sale {
  id: string;
  receipt: string;
  productId?: string;
  name: string;
  batch: string;
  quantity: number;
  price: number;
  cost: number | null;
  discount: number;
  payment: string;
  total: number;
  date: string; // YYYY-MM-DD
  time: string;
  manual?: boolean;
  aggregate?: boolean;
  transactions?: number;
  sourceDailySalesId?: string;
  stockDeducted?: boolean;
  importId?: string;
}

export interface DailySalesItem {
  name: string;
  batch: string;
  quantity: number;
  price: number;
  cost: number;
  discount: number;
  total: number;
  date: string;
  receipt?: string;
  payment?: string;
}

export interface DailySalesSubmission {
  id: string;
  employee: string;
  username: string;
  date: string;
  transactions: number;
  units: number;
  revenue: number;
  payment: string;
  shift: string;
  notes: string;
  uploadFile?: string;
  saleItems?: DailySalesItem[];
  status: 'Pending' | 'Recorded';
  submittedAt: string;
  recordedAt?: string;
  recordedBy?: string;
}

export interface SnapshotRow {
  name: string;
  batch: string;
  quantity: number;
  stockCountLabel?: string;
  purchasePrice: number;
  sellingPrice: number;
  expiry: string;
  category: string;
  status?: string;
}

export interface ImportedFile {
  id: string;
  name: string;
  kind: 'stock' | 'sales';
  month?: string;
  date: string;
  count: number;
  productIds: string[];
  previousProducts?: Product[];
  snapshotRows?: SnapshotRow[];
  importMode?: string;
  affectsLiveStock?: boolean;
  approved?: boolean;
  saleReceipts?: string[];
}

export interface ActivityItem {
  id: string;
  type: 'stock' | 'sale' | 'system' | 'security';
  title: string;
  detail: string;
  time: string;
  read: boolean;
}

export interface UserProfile {
  id?: string;
  displayName: string;
  pharmacyName?: string;
  username: string;
  passwordHash: string;
  role: 'Owner' | 'Owner/Admin' | 'Pharmacist/Manager' | 'Staff';
  createdAt: string;
}

export interface PharmacySettings {
  name: string;
  currency: string;
  defaultMin: number;
  reminders: boolean;
  expiryWarnings: boolean;
}

export interface AppState {
  settings: PharmacySettings;
  products: Product[];
  sales: Sale[];
  activity: ActivityItem[];
  importedFiles: ImportedFile[];
  dailySales: DailySalesSubmission[];
}
