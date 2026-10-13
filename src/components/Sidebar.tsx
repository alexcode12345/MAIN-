import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  ClipboardPenLine,
  TrendingUp,
  ClockAlert,
  BarChart3,
  PieChart,
  FileSpreadsheet,
  History,
  Settings,
  Download,
} from 'lucide-react';
import { UserProfile } from '../types';

interface SidebarProps {
  activePage: string;
  onSelectPage: (page: string) => void;
  currentUser: UserProfile | null;
  expiryAlertCount: number;
  onExportBackup: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  currentUser,
  expiryAlertCount,
  onExportBackup,
}) => {
  const isStaff = currentUser?.role === 'Staff';

  const workspaceNav = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, staffOnly: false, adminOnly: true },
    { id: 'inventory', label: 'Inventory', icon: Boxes, staffOnly: false, adminOnly: true },
    { id: 'daily-sales', label: 'Daily sales entry', icon: ClipboardPenLine, staffOnly: true, adminOnly: false },
    { id: 'sales', label: 'Sales & POS', icon: TrendingUp, staffOnly: false, adminOnly: true },
    {
      id: 'expiry',
      label: 'Expiry centre',
      icon: ClockAlert,
      staffOnly: false,
      adminOnly: true,
      badge: expiryAlertCount > 0 ? expiryAlertCount : null,
    },
    { id: 'reports', label: 'Reports', icon: BarChart3, staffOnly: false, adminOnly: true },
    { id: 'analytics', label: 'Stock analytics', icon: PieChart, staffOnly: false, adminOnly: true },
  ];

  const managementNav = [
    { id: 'imports', label: 'Spreadsheet centre', icon: FileSpreadsheet, adminOnly: true },
    { id: 'activity', label: 'Activity log', icon: History, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
  ];

  const visibleWorkspace = workspaceNav.filter((item) => {
    if (isStaff) return item.staffOnly;
    return !item.staffOnly;
  });

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-[#103d32] p-5 text-[#f1f7f3] shadow-xl md:flex">
      {/* Brand */}
      <div className="mb-7 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#d8b45b] text-xl font-black text-[#17392e] shadow-md">
          ✚
        </div>
        <div>
          <div className="text-base font-extrabold tracking-tight text-white">
            PharmaCore <span className="text-[#d8b45b]">Pro</span>
          </div>
          <div className="text-[10px] font-semibold tracking-widest text-[#a9c4b5]">
            PHARMACY OPERATIONS
          </div>
        </div>
      </div>

      {/* Workspace links */}
      <div className="mb-6 flex-1 space-y-6">
        <div>
          <div className="mb-2 px-3 text-[11px] font-bold tracking-wider text-[#88aa98] uppercase">
            Workspace
          </div>
          <nav className="space-y-1">
            {visibleWorkspace.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectPage(item.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-[#225747] text-white shadow-inner'
                      : 'text-[#c9ddd2] hover:bg-[#194a3b] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge !== null && (
                    <span className="flex h-5 items-center rounded-full bg-rose-500/90 px-2 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Management links (Hidden for staff) */}
        {!isStaff && (
          <div>
            <div className="mb-2 px-3 text-[11px] font-bold tracking-wider text-[#88aa98] uppercase">
              Management
            </div>
            <nav className="space-y-1">
              {managementNav.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectPage(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-[#225747] text-white shadow-inner'
                        : 'text-[#c9ddd2] hover:bg-[#194a3b] hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Bottom prompt (Hidden for staff) */}
      {!isStaff && (
        <div className="mt-auto rounded-xl border border-[#2d604e] bg-[#194a3b] p-3.5 text-xs">
          <div className="font-bold text-white">✦ Keep your data safe</div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#b7d0c2]">
            Pharmacy records are saved offline on this browser. Export regular backups.
          </p>
          <button
            onClick={onExportBackup}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#d8b45b] py-2 text-xs font-bold text-[#17392e] transition hover:bg-[#e4c573]"
          >
            <Download className="h-3.5 w-3.5" /> Export backup ↗
          </button>
        </div>
      )}
    </aside>
  );
};
