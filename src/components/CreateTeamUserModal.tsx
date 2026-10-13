import React, { useState } from 'react';
import { Modal } from './Modal';
import { UserProfile } from '../types';
import { passwordHash } from '../utils/storage';

interface CreateTeamUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingUsers: UserProfile[];
  onCreateUser: (newUser: UserProfile) => void;
}

export const CreateTeamUserModal: React.FC<CreateTeamUserModalProps> = ({
  isOpen,
  onClose,
  existingUsers,
  onCreateUser,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'Pharmacist/Manager' | 'Staff'>('Staff');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (existingUsers.some((u) => u.username.toLowerCase() === cleanUsername)) {
      setError('A user with that username already exists on this device.');
      return;
    }

    const newUser: UserProfile = {
      id: `USR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      displayName: displayName.trim(),
      username: username.trim(),
      passwordHash: passwordHash(password),
      role,
      createdAt: new Date().toISOString(),
    };

    onCreateUser(newUser);
    onClose();
    setDisplayName('');
    setUsername('');
    setPassword('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add team member account">
      <p className="mb-4 text-xs text-[var(--pharma-muted)]">
        Create a local login for someone working in your pharmacy. Accounts share the workspace on this device.
      </p>

      {error && (
        <div className="mb-4 rounded-xl bg-red-100 p-3 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[var(--pharma-text)]">Full name *</label>
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. John Okoro"
            className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--pharma-text)]">Username *</label>
          <input
            type="text"
            required
            minLength={3}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. john"
            className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--pharma-text)]">Password *</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--pharma-text)]">Role *</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
          >
            <option value="Staff">Staff (Daily sales submission workspace)</option>
            <option value="Pharmacist/Manager">Pharmacist / Manager (Full workspace access)</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-[var(--pharma-line)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--pharma-line)] px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-xl bg-[#176b50] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[#104c34]"
          >
            Create account
          </button>
        </div>
      </form>
    </Modal>
  );
};
