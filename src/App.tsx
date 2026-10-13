import React, { useState, useEffect, useCallback } from 'react';
import {
  AppState,
  Product,
  Sale,
  DailySalesSubmission,
  UserProfile,
  PharmacySettings,
  ActivityItem,
} from './types';
import {
  loadState,
  saveState,
  getOwnerProfile,
  getTeamUsers,
  saveTeamUsers,
  idbRead,
  AUTH_KEY,
  ACTIVE_USER_KEY,
  PROFILE_KEY,
} from './utils/storage';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { InventoryView } from './components/InventoryView';
import { DailySalesView } from './components/DailySalesView';
import { SalesView } from './components/SalesView';
import { ExpiryView } from './components/ExpiryView';
import { ReportsView } from './components/ReportsView';
import { AnalyticsView } from './components/AnalyticsView';
import { ImportsView } from './components/ImportsView';
import { ActivityView } from './components/ActivityView';
import { SettingsView } from './components/SettingsView';
import { MedicineModal } from './components/MedicineModal';
import { AdjustStockModal } from './components/AdjustStockModal';
import { QuickEditBatchModal } from './components/QuickEditBatchModal';
import { CreateTeamUserModal } from './components/CreateTeamUserModal';
import { Toast } from './components/Toast';
import { dayDiff } from './utils/formatters';
import { downloadFile, ParsedStockRow } from './utils/spreadsheet';

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [ownerProfile, setOwnerProfile] = useState<UserProfile | null>(getOwnerProfile);
  const [teamUsers, setTeamUsers] = useState<UserProfile[]>(getTeamUsers);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const [activePage, setActivePage] = useState<string>('dashboard');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);

  // Modals state
  const [medicineModalOpen, setMedicineModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustStockModalOpen, setAdjustStockModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [quickBatchModalOpen, setQuickBatchModalOpen] = useState(false);
  const [quickBatchProduct, setQuickBatchProduct] = useState<Product | null>(null);
  const [createTeamUserModalOpen, setCreateTeamUserModalOpen] = useState(false);

  // Initial restore from IndexedDB if localStorage was empty or needs sync
  useEffect(() => {
    idbRead()
      .then((stored) => {
        if (stored && stored.data) {
          const localCount = state.products.length + state.sales.length;
          const dbCount =
            (stored.data.products?.length || 0) + (stored.data.sales?.length || 0);
          if (dbCount > localCount) {
            setState(stored.data);
            showToast('Recovered saved workspace from local database');
          }
        }
      })
      .catch(() => {});

    // Check existing auth
    const authStatus = localStorage.getItem(AUTH_KEY);
    const activeUsername = localStorage.getItem(ACTIVE_USER_KEY);
    const owner = getOwnerProfile();

    if (authStatus === 'yes') {
      if (activeUsername && activeUsername !== owner?.username) {
        const team = getTeamUsers();
        const found = team.find((u) => u.username === activeUsername);
        if (found) {
          setCurrentUser(found);
          setIsAuthenticated(true);
          if (found.role === 'Staff') setActivePage('daily-sales');
          return;
        }
      }
      if (owner) {
        setCurrentUser(owner);
        setIsAuthenticated(true);
      }
    }
  }, []);

  // Save changes to localStorage & IndexedDB
  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  // Show toast with auto-hide
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Log activity helper
  const addLog = useCallback(
    (title: string, detail: string, type: 'stock' | 'sale' | 'system' | 'security' = 'stock') => {
      const item: ActivityItem = {
        id: Math.random().toString(36).slice(2, 9).toUpperCase(),
        type,
        title,
        detail,
        time: new Date().toISOString(),
        read: false,
      };
      updateState((prev) => ({
        ...prev,
        activity: [item, ...prev.activity.slice(0, 249)],
      }));
    },
    [updateState]
  );

  // Theme toggle
  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.dataset.theme = 'dark';
      } else {
        delete document.documentElement.dataset.theme;
      }
      return next;
    });
    showToast(isDark ? 'Light mode enabled' : 'Dark mode enabled');
  };

  // Auth actions
  const handleSetupOwner = (newOwner: UserProfile, pharmacyName: string) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(newOwner));
    localStorage.setItem(AUTH_KEY, 'yes');
    localStorage.setItem(ACTIVE_USER_KEY, newOwner.username);
    setOwnerProfile(newOwner);
    setCurrentUser(newOwner);
    setIsAuthenticated(true);
    updateState((prev) => ({
      ...prev,
      settings: { ...prev.settings, name: pharmacyName },
    }));
    addLog(
      'Owner account created',
      `Owner profile established for ${pharmacyName}`,
      'system'
    );
    showToast(`Welcome, ${newOwner.displayName}`);
  };

  const handleLogin = (user: UserProfile) => {
    localStorage.setItem(AUTH_KEY, 'yes');
    localStorage.setItem(ACTIVE_USER_KEY, user.username);
    setCurrentUser(user);
    setIsAuthenticated(true);
    if (user.role === 'Staff') {
      setActivePage('daily-sales');
    } else {
      setActivePage('dashboard');
    }
    addLog('User signed in', `${user.displayName} signed in (${user.role})`, 'security');
    showToast(`Signed in as ${user.displayName}`);
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(ACTIVE_USER_KEY);
    setCurrentUser(null);
    setIsAuthenticated(false);
    showToast('Signed out');
  };

  // Count expiring soon or expired batches for sidebar badge
  const expiryAlertCount = state.products.filter(
    (p) =>
      p.status !== 'archived' &&
      p.quantity > 0 &&
      p.expiry &&
      dayDiff(p.expiry) <= 30
  ).length;

  // Unread activity items
  const unreadActivityCount = state.activity.filter((a) => !a.read).length;

  // Add / Edit Medicine
  const handleSaveMedicine = (productData: Partial<Product>) => {
    const today = new Date().toISOString().slice(0, 10);
    if (editingProduct) {
      updateState((prev) => ({
        ...prev,
        products: prev.products.map((p) =>
          p.id === editingProduct.id
            ? { ...p, ...productData, updated: new Date().toISOString() }
            : p
        ),
      }));
      addLog(
        'Medicine updated',
        `${productData.name} · Batch: ${productData.batch}`
      );
      showToast('Medicine updated successfully');
    } else {
      const newProduct: Product = {
        id: `MED-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        name: productData.name || '',
        generic: productData.generic || '',
        category: productData.category || 'Other',
        batch: productData.batch || 'Not recorded',
        quantity: productData.quantity || 0,
        stockCountLabel: productData.stockCountLabel,
        purchasePrice: productData.purchasePrice || 0,
        sellingPrice: productData.sellingPrice || 0,
        expiry: productData.expiry || '',
        minStock: productData.minStock || state.settings.defaultMin || 0,
        supplier: productData.supplier || '',
        updated: new Date().toISOString(),
        stockMonth: today.slice(0, 7),
        status:
          productData.expiry && dayDiff(productData.expiry) < 0
            ? 'quarantined'
            : 'active',
      };
      updateState((prev) => ({
        ...prev,
        products: [newProduct, ...prev.products],
      }));
      addLog(
        'New medicine added',
        `${newProduct.name} · ${newProduct.quantity} units · Batch: ${newProduct.batch}`
      );
      showToast('Medicine added to inventory');
    }
    setEditingProduct(null);
  };

  // Adjust stock
  const handleSaveStockAdjustment = (
    product: Product,
    mode: 'add' | 'remove' | 'set',
    qty: number,
    label: string,
    reason: string
  ) => {
    const oldQty = product.quantity;
    let nextQty = oldQty;
    if (mode === 'add') nextQty = oldQty + qty;
    else if (mode === 'remove') nextQty = Math.max(0, oldQty - qty);
    else if (mode === 'set') nextQty = qty;

    updateState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === product.id
          ? {
              ...p,
              quantity: nextQty,
              stockCountLabel: label,
              updated: new Date().toISOString(),
            }
          : p
      ),
    }));

    addLog(
      'Stock adjusted',
      `${product.name} (Batch ${product.batch}): ${oldQty} → ${nextQty} units (${reason})`
    );
    showToast(`Stock adjusted: ${oldQty} → ${nextQty} units`);
  };

  // Quick edit batch
  const handleSaveQuickBatch = (product: Product, newBatch: string) => {
    updateState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === product.id
          ? { ...p, batch: newBatch, updated: new Date().toISOString() }
          : p
      ),
    }));
    addLog(
      'Batch updated',
      `${product.name}: Batch changed to ${newBatch}`
    );
    showToast(`Batch updated to ${newBatch}`);
  };

  // Quarantine batch
  const handleQuarantineProduct = (product: Product) => {
    if (
      !confirm(
        `Quarantine ${product.name} (Batch ${product.batch})? This batch will be locked and blocked from all sales.`
      )
    ) {
      return;
    }
    updateState((prev) => ({
      ...prev,
      products: prev.products.map((p) =>
        p.id === product.id
          ? { ...p, status: 'quarantined', updated: new Date().toISOString() }
          : p
      ),
    }));
    addLog(
      'Batch quarantined',
      `${product.name} (Batch ${product.batch}) quarantined from sales`
    );
    showToast(`${product.name} quarantined`);
  };

  // Record manual sale
  const handleRecordManualSale = (sale: Sale, updatedProduct: Product) => {
    updateState((prev) => ({
      ...prev,
      sales: [sale, ...prev.sales],
      products: prev.products.map((p) =>
        p.id === updatedProduct.id ? updatedProduct : p
      ),
    }));
    addLog(
      'Sale recorded',
      `Receipt ${sale.receipt}: ${sale.name} × ${sale.quantity} · Total: ${sale.total}`,
      'sale'
    );
  };

  // Record daily employee submission
  const handleRecordEmployeeSubmission = (
    subId: string,
    mode: 'itemized' | 'summary',
    salesToInsert: Sale[],
    productsToUpdate: Product[]
  ) => {
    updateState((prev) => {
      const updatedDailySales = prev.dailySales.map((s) =>
        s.id === subId
          ? {
              ...s,
              status: 'Recorded' as const,
              recordedAt: new Date().toISOString(),
              recordedBy: currentUser?.username || 'admin',
            }
          : s
      );

      const prodMap = new Map(productsToUpdate.map((p) => [p.id, p]));
      const nextProducts = prev.products.map((p) =>
        prodMap.has(p.id) ? prodMap.get(p.id)! : p
      );

      return {
        ...prev,
        dailySales: updatedDailySales,
        sales: [...salesToInsert, ...prev.sales],
        products: nextProducts,
      };
    });

    addLog(
      'Employee submission approved',
      `Submission ${subId} recorded in sales (${mode})`,
      'sale'
    );
  };

  // Import sales file
  const handleImportSales = (sales: Sale[], fileName: string) => {
    const importId = `IMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const taggedSales = sales.map((s) => ({ ...s, importId }));

    updateState((prev) => ({
      ...prev,
      sales: [...taggedSales, ...prev.sales],
      importedFiles: [
        {
          id: importId,
          name: fileName,
          kind: 'sales',
          date: new Date().toISOString(),
          count: sales.length,
          productIds: [],
        },
        ...prev.importedFiles,
      ],
    }));

    addLog(
      'Sales register imported',
      `Imported ${sales.length} rows from ${fileName}`,
      'sale'
    );
  };

  // Commit stock import (mode: 'update' or 'additional')
  const handleCommitStockImport = (
    items: ParsedStockRow[],
    fileName: string,
    targetMonth: string,
    mode: 'update' | 'additional'
  ) => {
    const importId = `IMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    if (mode === 'additional') {
      // Archive snapshot without altering live products
      const snapshotRows = items.map((r) => ({
        name: r.name,
        batch: r.batch,
        quantity: r.quantity,
        stockCountLabel: r.stockCountLabel,
        purchasePrice: r.purchasePrice,
        sellingPrice: r.sellingPrice,
        expiry: r.expiry,
        category: r.category,
      }));

      updateState((prev) => ({
        ...prev,
        importedFiles: [
          {
            id: importId,
            name: fileName,
            kind: 'stock',
            month: targetMonth,
            date: new Date().toISOString(),
            count: items.length,
            productIds: [],
            snapshotRows,
            importMode: 'additional-snapshot',
            affectsLiveStock: false,
            approved: true,
          },
          ...prev.importedFiles,
        ],
      }));
      addLog(
        'Additional monthly snapshot saved',
        `${items.length} rows from ${fileName} saved for ${targetMonth}`
      );
      return;
    }

    // Mode is 'update': Update live inventory and record snapshot
    updateState((prev) => {
      const existingProducts = [...prev.products];
      const previousProductsBackup: Product[] = [];
      const updatedProductIds: string[] = [];

      items.forEach((item) => {
        const itemKey = item.name.trim().toLowerCase();
        const batchKey = (item.batch || 'Not recorded').trim().toLowerCase();

        const match = existingProducts.find(
          (p) =>
            p.name.trim().toLowerCase() === itemKey &&
            (p.batch || 'Not recorded').trim().toLowerCase() === batchKey &&
            (p.stockMonth || p.updated.slice(0, 7)) === targetMonth
        );

        const expired = item.expiry && dayDiff(item.expiry) < 0;

        if (match) {
          previousProductsBackup.push({ ...match });
          match.quantity = item.quantity;
          match.stockCountLabel = item.stockCountLabel;
          match.purchasePrice = item.purchasePrice;
          match.sellingPrice = item.sellingPrice;
          match.expiry = item.expiry;
          match.category = item.category || match.category;
          match.supplier = item.supplier || match.supplier;
          match.updated = new Date().toISOString();
          match.status = expired ? 'quarantined' : match.status;
          match.importId = importId;
          match.stockMonth = targetMonth;
          updatedProductIds.push(match.id);
        } else {
          const newId = `MED-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
          const newProduct: Product = {
            id: newId,
            name: item.name,
            generic: item.generic || '',
            category: item.category || 'Other',
            batch: item.batch || 'Not recorded',
            quantity: item.quantity,
            stockCountLabel: item.stockCountLabel,
            purchasePrice: item.purchasePrice,
            sellingPrice: item.sellingPrice,
            expiry: item.expiry,
            minStock: item.minStock || prev.settings.defaultMin || 0,
            supplier: item.supplier || '',
            updated: new Date().toISOString(),
            stockMonth: targetMonth,
            status: expired ? 'quarantined' : 'active',
            importId,
          };
          existingProducts.push(newProduct);
          updatedProductIds.push(newId);
        }
      });

      const snapshotRows = items.map((r) => ({
        name: r.name,
        batch: r.batch,
        quantity: r.quantity,
        stockCountLabel: r.stockCountLabel,
        purchasePrice: r.purchasePrice,
        sellingPrice: r.sellingPrice,
        expiry: r.expiry,
        category: r.category,
      }));

      const newImportedFile = {
        id: importId,
        name: fileName,
        kind: 'stock' as const,
        month: targetMonth,
        date: new Date().toISOString(),
        count: items.length,
        productIds: updatedProductIds,
        previousProducts: previousProductsBackup,
        snapshotRows,
        importMode: 'update',
        affectsLiveStock: true,
      };

      return {
        ...prev,
        products: existingProducts,
        importedFiles: [newImportedFile, ...prev.importedFiles],
      };
    });

    addLog(
      'Stock spreadsheet imported',
      `${items.length} records processed for ${targetMonth} from ${fileName}`
    );
  };

  // Delete imported file (stock rollback or sales purge)
  const handleDeleteImportedFile = (fileId: string) => {
    updateState((prev) => {
      const target = prev.importedFiles.find((f) => f.id === fileId);
      if (!target) return prev;

      let nextProducts = prev.products;
      if (target.kind === 'stock' && target.affectsLiveStock !== false) {
        const priorMap = new Map(
          (target.previousProducts || []).map((p) => [p.id, p])
        );
        const owned = new Set(target.productIds || []);

        nextProducts = prev.products.flatMap((p) => {
          if (p.importId === fileId || (owned.has(p.id) && !p.importId)) {
            const restored = priorMap.get(p.id);
            return restored ? [{ ...restored }] : [];
          }
          return [p];
        });
      }

      const nextSales = prev.sales.filter((s) => s.importId !== fileId);
      const nextFiles = prev.importedFiles.filter((f) => f.id !== fileId);

      return {
        ...prev,
        products: nextProducts,
        sales: nextSales,
        importedFiles: nextFiles,
      };
    });

    addLog('Import deleted', `File import ${fileId} was removed`);
  };

  // Full backup JSON export
  const handleExportBackup = () => {
    const today = new Date().toISOString().slice(0, 10);
    const content = JSON.stringify(state, null, 2);
    downloadFile(`pharmacore-pro-backup-${today}.json`, content, 'application/json');
    showToast('Full workspace backup exported');
  };

  // Full backup restore
  const handleRestoreBackup = (newState: AppState) => {
    updateState(() => newState);
    addLog('Workspace restored', 'Full backup restored from external file', 'system');
  };

  // Settings save
  const handleSaveSettings = (newSettings: PharmacySettings) => {
    updateState((prev) => ({
      ...prev,
      settings: newSettings,
    }));
    addLog('Settings updated', 'Pharmacy settings modified', 'system');
  };

  // Create team user
  const handleCreateTeamUser = (newUser: UserProfile) => {
    const updatedTeam = [...teamUsers, newUser];
    setTeamUsers(updatedTeam);
    saveTeamUsers(updatedTeam);
    addLog('Team member added', `${newUser.displayName} created as ${newUser.role}`, 'security');
    showToast(`Account created for ${newUser.displayName}`);
  };

  // Mark all activity reviewed
  const handleMarkAllReviewed = () => {
    updateState((prev) => ({
      ...prev,
      activity: prev.activity.map((a) => ({ ...a, read: true })),
    }));
    showToast('All activity marked as reviewed');
  };

  if (!isAuthenticated) {
    return (
      <AuthScreen
        ownerProfile={ownerProfile}
        teamUsers={teamUsers}
        onSetupOwner={handleSetupOwner}
        onLogin={handleLogin}
      />
    );
  }

  const isStaff = currentUser?.role === 'Staff';

  return (
    <div className="flex min-h-screen bg-[var(--pharma-bg)] text-[var(--pharma-text)]">
      {/* Desktop Sidebar */}
      <Sidebar
        activePage={activePage}
        onSelectPage={setActivePage}
        currentUser={currentUser}
        expiryAlertCount={expiryAlertCount}
        onExportBackup={handleExportBackup}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar
          activePage={activePage}
          onNavigate={setActivePage}
          currentUser={currentUser}
          unreadCount={unreadActivityCount}
          onLogout={handleLogout}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />

        <main className="flex-1 p-4 pb-20 sm:p-8 sm:pb-12 max-w-[1600px] w-full mx-auto min-w-0">
          {activePage === 'dashboard' && (
            <DashboardView
              state={state}
              onNavigate={setActivePage}
              onOpenAddMedicine={() => {
                setEditingProduct(null);
                setMedicineModalOpen(true);
              }}
            />
          )}

          {activePage === 'inventory' && (
            <InventoryView
              state={state}
              onNavigate={setActivePage}
              onOpenAddMedicine={() => {
                setEditingProduct(null);
                setMedicineModalOpen(true);
              }}
              onOpenEditMedicine={(product) => {
                setEditingProduct(product);
                setMedicineModalOpen(true);
              }}
              onOpenAdjustStock={(product) => {
                setAdjustingProduct(product);
                setAdjustStockModalOpen(true);
              }}
              onQuickEditBatch={(product) => {
                setQuickBatchProduct(product);
                setQuickBatchModalOpen(true);
              }}
              onShowToast={showToast}
            />
          )}

          {activePage === 'daily-sales' && (
            <DailySalesView
              state={state}
              currentUser={currentUser}
              onSubmitDailySales={(sub) => {
                updateState((prev) => ({
                  ...prev,
                  dailySales: [sub, ...prev.dailySales],
                }));
                addLog(
                  'Daily sales submitted',
                  `${sub.employee}: ${sub.date} · Revenue ${sub.revenue} (Pending review)`,
                  'sale'
                );
              }}
              onShowToast={showToast}
            />
          )}

          {activePage === 'sales' && !isStaff && (
            <SalesView
              state={state}
              onRecordManualSale={handleRecordManualSale}
              onRecordEmployeeSubmission={handleRecordEmployeeSubmission}
              onImportSales={handleImportSales}
              onShowToast={showToast}
            />
          )}

          {activePage === 'expiry' && (
            <ExpiryView
              state={state}
              onQuarantineProduct={handleQuarantineProduct}
              onShowToast={showToast}
            />
          )}

          {activePage === 'reports' && (
            <ReportsView state={state} onShowToast={showToast} />
          )}

          {activePage === 'analytics' && (
            <AnalyticsView state={state} onShowToast={showToast} />
          )}

          {activePage === 'imports' && (
            <ImportsView
              state={state}
              onCommitStockImport={handleCommitStockImport}
              onCommitSalesImport={handleImportSales}
              onDeleteImportedFile={handleDeleteImportedFile}
              onRestoreBackup={handleRestoreBackup}
              onShowToast={showToast}
              onExportBackup={handleExportBackup}
            />
          )}

          {activePage === 'activity' && (
            <ActivityView state={state} onMarkAllReviewed={handleMarkAllReviewed} />
          )}

          {activePage === 'settings' && (
            <SettingsView
              state={state}
              currentUser={currentUser}
              teamUsers={teamUsers}
              onSaveSettings={handleSaveSettings}
              onOpenCreateUser={() => setCreateTeamUserModalOpen(true)}
              onShowToast={showToast}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-2 md:hidden">
        {isStaff ? (
          <button
            onClick={() => setActivePage('daily-sales')}
            className="flex flex-col items-center gap-1 text-[10px] font-bold text-[#176b50]"
          >
            <span>▤</span>
            <span>Daily Sales</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => setActivePage('dashboard')}
              className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
                activePage === 'dashboard' ? 'text-[#176b50]' : 'text-[var(--pharma-muted)]'
              }`}
            >
              <span>▦</span>
              <span>Home</span>
            </button>
            <button
              onClick={() => setActivePage('inventory')}
              className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
                activePage === 'inventory' ? 'text-[#176b50]' : 'text-[var(--pharma-muted)]'
              }`}
            >
              <span>▤</span>
              <span>Stock</span>
            </button>
            <button
              onClick={() => setActivePage('sales')}
              className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
                activePage === 'sales' ? 'text-[#176b50]' : 'text-[var(--pharma-muted)]'
              }`}
            >
              <span>↗</span>
              <span>Sales</span>
            </button>
            <button
              onClick={() => setActivePage('expiry')}
              className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
                activePage === 'expiry' ? 'text-[#176b50]' : 'text-[var(--pharma-muted)]'
              }`}
            >
              <span>◷</span>
              <span>Expiry</span>
            </button>
            <button
              onClick={() => setActivePage('reports')}
              className={`flex flex-col items-center gap-1 text-[10px] font-bold ${
                activePage === 'reports' ? 'text-[#176b50]' : 'text-[var(--pharma-muted)]'
              }`}
            >
              <span>▥</span>
              <span>Reports</span>
            </button>
          </>
        )}
      </nav>

      {/* Modals */}
      <MedicineModal
        isOpen={medicineModalOpen}
        onClose={() => {
          setMedicineModalOpen(false);
          setEditingProduct(null);
        }}
        productToEdit={editingProduct}
        settings={state.settings}
        onSave={handleSaveMedicine}
      />

      <AdjustStockModal
        isOpen={adjustStockModalOpen}
        onClose={() => {
          setAdjustStockModalOpen(false);
          setAdjustingProduct(null);
        }}
        product={adjustingProduct}
        onSaveAdjustment={handleSaveStockAdjustment}
      />

      <QuickEditBatchModal
        isOpen={quickBatchModalOpen}
        onClose={() => {
          setQuickBatchModalOpen(false);
          setQuickBatchProduct(null);
        }}
        product={quickBatchProduct}
        onSaveBatch={handleSaveQuickBatch}
      />

      <CreateTeamUserModal
        isOpen={createTeamUserModalOpen}
        onClose={() => setCreateTeamUserModalOpen(false)}
        existingUsers={teamUsers}
        onCreateUser={handleCreateTeamUser}
      />

      {/* Toast Notification */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
}
