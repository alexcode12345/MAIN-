import React, { useState, useRef, useEffect } from 'react';
import { Bell, Moon, Sun, User, LogOut, Users, Settings as SettingsIcon } from 'lucide-react';
import { UserProfile } from '../types';

interface TopbarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  currentUser: UserProfile | null;
  unreadCount: number;
  onLogout: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

const PAGE_NAMES: Record<string, string> = {
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  'daily-sales': 'Daily sales entry',
  sales: 'Sales & POS',
  expiry: 'Expiry centre',
  reports: 'Reports',
  analytics: 'Stock analytics',
  imports: 'Spreadsheet centre',
  activity: 'Activity log',
  settings: 'Settings',
};

export const Topbar: React.FC<TopbarProps> = ({
  activePage,
  onNavigate,
  currentUser,
  unreadCount,
  onLogout,
  isDark,
  onToggleTheme,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = (currentUser?.displayName || currentUser?.username || 'PC')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isStaff = currentUser?.role === 'Staff';

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[var(--pharma-line)] bg-[var(--pharma-panel)] px-4 sm:px-8">
      {/* Mobile brand & desktop breadcrumb */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 md:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#103d32] font-black text-[#d8b45b]">
            ✚
          </div>
          <span className="text-sm font-extrabold text-[#17251f] dark:text-white">
            PharmaCore <span className="text-[#c19a36]">Pro</span>
          </span>
        </div>

        <div className="hidden text-xs text-[var(--pharma-muted)] sm:block">
          Workspace /{' '}
          <strong className="text-[var(--pharma-text)]">
            {PAGE_NAMES[activePage] || activePage}
          </strong>
        </div>
      </div>

      {/* Top action buttons */}
      <div className="flex items-center gap-2.5">
        {/* Activity log bell (hidden for staff) */}
        {!isStaff && (
          <button
            onClick={() => onNavigate('activity')}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] text-[var(--pharma-text)] transition hover:bg-[var(--pharma-panel2)]"
            title="Activity notifications"
            aria-label="Activity notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#d7a93d]" />
            )}
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] text-[var(--pharma-text)] transition hover:bg-[var(--pharma-panel2)]"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Account Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 items-center gap-2 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-2.5 py-1 text-xs font-bold text-[#16553e] transition hover:border-[#176b50] dark:bg-emerald-950/40 dark:text-emerald-300"
            title="Account menu"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#dcefe4] text-xs font-black text-[#16553e] dark:bg-emerald-900/60 dark:text-emerald-200">
              {initials}
            </span>
            <span className="hidden font-semibold md:inline">
              {currentUser?.displayName || currentUser?.username}
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-2 shadow-xl animate-in fade-in zoom-in-95">
              <div className="border-b border-[var(--pharma-line)] px-3 py-2 text-xs">
                <div className="font-bold text-[var(--pharma-text)]">
                  {currentUser?.displayName || currentUser?.username}
                </div>
                <div className="text-[11px] text-[var(--pharma-muted)]">
                  Role: <span className="font-semibold text-[#176b50]">{currentUser?.role || 'Owner'}</span>
                </div>
              </div>

              <div className="mt-1 space-y-0.5 text-xs">
                {!isStaff && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onNavigate('settings');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-[var(--pharma-text)] hover:bg-[var(--pharma-panel2)]"
                  >
                    <SettingsIcon className="h-3.5 w-3.5 text-[var(--pharma-muted)]" />
                    <span>Pharmacy Settings</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Switch user / Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
