import React, { useState } from 'react';
import { UserPlus, Shield, Building2, BellRing, UserCheck } from 'lucide-react';
import { AppState, PharmacySettings, UserProfile } from '../types';

interface SettingsViewProps {
  state: AppState;
  currentUser: UserProfile | null;
  teamUsers: UserProfile[];
  onSaveSettings: (settings: PharmacySettings) => void;
  onOpenCreateUser: () => void;
  onShowToast: (msg: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  currentUser,
  teamUsers,
  onSaveSettings,
  onOpenCreateUser,
  onShowToast,
}) => {
  const [name, setName] = useState(state.settings.name);
  const [currency, setCurrency] = useState(state.settings.currency || 'NGN');
  const [defaultMin, setDefaultMin] = useState(state.settings.defaultMin || 0);
  const [reminders, setReminders] = useState(state.settings.reminders || false);
  const [expiryWarnings, setExpiryWarnings] = useState(state.settings.expiryWarnings ?? true);

  const isOwner = currentUser?.role === 'Owner' || currentUser?.role === 'Owner/Admin';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      name: name.trim() || 'My Pharmacy',
      currency,
      defaultMin: Number(defaultMin) || 0,
      reminders,
      expiryWarnings,
    });
    onShowToast('Pharmacy settings updated');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-[11px] font-extrabold tracking-wider text-[#176b50] uppercase">
          Your workspace
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--pharma-text)] sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-xs text-[var(--pharma-muted)]">
          Configure pharmacy identity, currency, reorder defaults, and staff accounts.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pharmacy Profile */}
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-5 w-5 text-[#176b50]" />
            <h2 className="text-base font-bold text-[var(--pharma-text)]">Pharmacy profile</h2>
          </div>

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--pharma-text)]">
                Pharmacy name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. GreenCross Pharmacy"
                className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--pharma-text)]">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
              >
                <option value="NGN">Nigerian naira (NGN ₦)</option>
                <option value="USD">US dollar (USD $)</option>
                <option value="GHS">Ghanaian cedi (GHS ₵)</option>
                <option value="KES">Kenyan shilling (KES KSh)</option>
                <option value="EUR">Euro (EUR €)</option>
                <option value="GBP">British pound (GBP £)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--pharma-text)]">
                Default low-stock threshold
              </label>
              <input
                type="number"
                min={0}
                value={defaultMin}
                onChange={(e) => setDefaultMin(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
              />
            </div>

            <button
              type="submit"
              className="mt-2 rounded-xl bg-[#176b50] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#104c34]"
            >
              Save settings
            </button>
          </form>
        </div>

        {/* Reminders & Privacy */}
        <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
          <div className="flex items-center gap-2.5">
            <BellRing className="h-5 w-5 text-[#176b50]" />
            <h2 className="text-base font-bold text-[var(--pharma-text)]">Reminders & privacy</h2>
          </div>

          <div className="mt-5 space-y-4">
            <label className="flex items-center justify-between rounded-xl border border-[var(--pharma-line)] p-3 text-xs">
              <div>
                <div className="font-bold text-[var(--pharma-text)]">Daily stock review reminder</div>
                <div className="text-[11px] text-[var(--pharma-muted)]">
                  Remind to verify stock on app opening
                </div>
              </div>
              <input
                type="checkbox"
                checked={reminders}
                onChange={(e) => setReminders(e.target.checked)}
                className="h-4 w-4 rounded-md accent-[#176b50]"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-[var(--pharma-line)] p-3 text-xs">
              <div>
                <div className="font-bold text-[var(--pharma-text)]">Expiry warnings</div>
                <div className="text-[11px] text-[var(--pharma-muted)]">
                  Flag batches expiring within 90 days
                </div>
              </div>
              <input
                type="checkbox"
                checked={expiryWarnings}
                onChange={(e) => setExpiryWarnings(e.target.checked)}
                className="h-4 w-4 rounded-md accent-[#176b50]"
              />
            </label>

            <div className="rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-3.5 text-[11px] leading-relaxed text-[var(--pharma-muted)]">
              All records are saved securely inside browser storage and mirrored to IndexedDB on this device. Data remains available offline. Regular backups are recommended.
            </div>
          </div>
        </div>
      </div>

      {/* Team Accounts Section */}
      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-[var(--pharma-text)]">Team accounts</h2>
            <p className="text-xs text-[var(--pharma-muted)]">
              Create local credentials for staff members to submit daily sales on this device.
            </p>
          </div>

          {isOwner && (
            <button
              onClick={onOpenCreateUser}
              className="flex items-center gap-1.5 rounded-xl bg-[#176b50] px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-[#104c34]"
            >
              <UserPlus className="h-3.5 w-3.5" /> Add team user
            </button>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--pharma-line)] text-[10px] uppercase font-bold text-[var(--pharma-muted)]">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Username</th>
                <th className="pb-3 pr-4">Role</th>
                <th className="pb-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--pharma-line)]">
              {teamUsers.length > 0 ? (
                teamUsers.map((u) => (
                  <tr key={u.username} className="hover:bg-[var(--pharma-panel2)] transition">
                    <td className="py-3 pr-4 font-bold text-[var(--pharma-text)]">
                      {u.displayName}
                    </td>
                    <td className="py-3 pr-4 font-mono text-[var(--pharma-muted)]">{u.username}</td>
                    <td className="py-3 pr-4">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 text-[var(--pharma-muted)]">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-[var(--pharma-muted)]">
                    No team members created yet.
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
