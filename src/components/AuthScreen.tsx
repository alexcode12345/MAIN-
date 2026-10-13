import React, { useState } from 'react';
import { UserProfile } from '../types';
import { passwordHash } from '../utils/storage';

interface AuthScreenProps {
  ownerProfile: UserProfile | null;
  teamUsers: UserProfile[];
  onSetupOwner: (profile: UserProfile, pharmacyName: string) => void;
  onLogin: (user: UserProfile) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  ownerProfile,
  teamUsers,
  onSetupOwner,
  onLogin,
}) => {
  const isSetup = !ownerProfile;

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [pharmacyName, setPharmacyName] = useState('');
  const [username, setUsername] = useState(ownerProfile ? ownerProfile.username : '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (isSetup) {
      if (!displayName.trim() || !pharmacyName.trim()) {
        setErrorMessage('Enter your name and pharmacy name.');
        return;
      }
      if (username.trim().length < 3) {
        setErrorMessage('Username must be at least 3 characters.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('The passwords do not match.');
        return;
      }

      const newOwner: UserProfile = {
        displayName: displayName.trim(),
        pharmacyName: pharmacyName.trim(),
        username: username.trim(),
        passwordHash: passwordHash(password),
        role: 'Owner',
        createdAt: new Date().toISOString(),
      };
      onSetupOwner(newOwner, pharmacyName.trim());
    } else {
      // Check owner profile
      const hash = passwordHash(password);
      if (
        ownerProfile &&
        username.trim().toLowerCase() === ownerProfile.username.toLowerCase()
      ) {
        if (hash !== ownerProfile.passwordHash) {
          setErrorMessage('Username or password is incorrect.');
          return;
        }
        onLogin(ownerProfile);
        return;
      }

      // Check team users
      const match = teamUsers.find(
        (u) => u.username.toLowerCase() === username.trim().toLowerCase()
      );
      if (match && hash === match.passwordHash) {
        onLogin(match);
        return;
      }

      setErrorMessage('Username or password is incorrect.');
    }
  };

  const allKnownUsers: UserProfile[] = [];
  if (ownerProfile) allKnownUsers.push(ownerProfile);
  teamUsers.forEach((u) => {
    if (!allKnownUsers.some((x) => x.username.toLowerCase() === u.username.toLowerCase())) {
      allKnownUsers.push(u);
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gradient-to-br from-[#0d3026] via-[#12392d] to-[#071d17] p-4 text-[#f4f8f5]">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-[#315c4b] bg-[#12392d] shadow-2xl md:grid-cols-12">
        {/* Left branding panel */}
        <div className="flex flex-col justify-between bg-gradient-to-b from-[#164735] to-[#0e3026] p-8 md:col-span-6 md:p-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d8b45b] text-2xl font-black text-[#17392e] shadow-md">
                ✚
              </div>
              <div>
                <div className="text-xl font-black tracking-tight text-white">
                  PharmaCore <span className="text-[#d8b45b]">Pro</span>
                </div>
                <div className="text-[10px] font-bold tracking-widest text-[#a9c4b5]">
                  PHARMACY OPERATIONS
                </div>
              </div>
            </div>

            <h1 className="mt-8 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Better stock control.
              <br />
              <span className="text-[#d8b45b]">Peace of mind.</span>
            </h1>

            <p className="mt-4 text-xs leading-relaxed text-[#b9d0c4] sm:text-sm">
              Your complete pharmacy workspace for stock control, batch expiry alerts, daily sales registers, and spreadsheet analytics — fully functional offline in your browser.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-[#245542]/60 px-3 py-2 text-xs font-semibold text-[#dceae2]">
                <span className="text-sm text-[#e3c879]">▤</span> Inventory & Batches
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-[#245542]/60 px-3 py-2 text-xs font-semibold text-[#dceae2]">
                <span className="text-sm text-[#e3c879]">↗</span> Offline POS Records
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-[#245542]/60 px-3 py-2 text-xs font-semibold text-[#dceae2]">
                <span className="text-sm text-[#e3c879]">◷</span> Expiry Safeguards
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-[#245542]/60 px-3 py-2 text-xs font-semibold text-[#dceae2]">
                <span className="text-sm text-[#e3c879]">⇧</span> Excel & CSV Tools
              </div>
            </div>
          </div>

          <div className="mt-8 text-[11px] font-medium tracking-wide text-[#8eafa0]">
            LOCAL WORKSPACE · YOUR RECORDS STAY IN THIS BROWSER
          </div>
        </div>

        {/* Right form panel */}
        <div className="flex flex-col justify-center bg-[#f8faf8] p-8 text-[#182a21] md:col-span-6 md:p-10">
          <div className="mb-6">
            <span className="text-[10px] font-black tracking-widest text-[#176b50] uppercase">
              {isSetup ? 'Initial Setup' : 'Welcome back'}
            </span>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#17251f]">
              {isSetup ? 'Set up owner account' : 'Sign in to PharmaCore'}
            </h2>
            <p className="mt-1 text-xs text-[#708077]">
              {isSetup
                ? 'Create the primary owner profile to manage your pharmacy.'
                : 'Enter your credentials to access your pharmacy operations.'}
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="mb-4 rounded-xl bg-red-100 p-3 text-xs font-semibold text-red-800"
            >
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSetup && (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#40564a]">Your name *</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Dr. Ada Okafor"
                    className="mt-1.5 w-full rounded-xl border border-[#d8e2db] bg-white px-3.5 py-2.5 text-sm text-[#17251f] shadow-xs outline-none focus:border-[#267453] focus:ring-2 focus:ring-[#267453]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#40564a]">Pharmacy name *</label>
                  <input
                    type="text"
                    required
                    value={pharmacyName}
                    onChange={(e) => setPharmacyName(e.target.value)}
                    placeholder="e.g. GreenCross Pharmacy"
                    className="mt-1.5 w-full rounded-xl border border-[#d8e2db] bg-white px-3.5 py-2.5 text-sm text-[#17251f] shadow-xs outline-none focus:border-[#267453] focus:ring-2 focus:ring-[#267453]/20"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-[#40564a]">Username *</label>
              <input
                type="text"
                required
                minLength={3}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose username"
                className="mt-1.5 w-full rounded-xl border border-[#d8e2db] bg-white px-3.5 py-2.5 text-sm text-[#17251f] shadow-xs outline-none focus:border-[#267453] focus:ring-2 focus:ring-[#267453]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#40564a]">Password *</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="mt-1.5 w-full rounded-xl border border-[#d8e2db] bg-white px-3.5 py-2.5 text-sm text-[#17251f] shadow-xs outline-none focus:border-[#267453] focus:ring-2 focus:ring-[#267453]/20"
              />
            </div>

            {isSetup && (
              <div>
                <label className="block text-xs font-bold text-[#40564a]">Confirm password *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="mt-1.5 w-full rounded-xl border border-[#d8e2db] bg-white px-3.5 py-2.5 text-sm text-[#17251f] shadow-xs outline-none focus:border-[#267453] focus:ring-2 focus:ring-[#267453]/20"
                />
              </div>
            )}

            <button
              type="submit"
              className="mt-2 w-full rounded-xl bg-[#176b50] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#104c34]"
            >
              {isSetup ? 'Create owner account' : 'Sign in securely'}
            </button>
          </form>

          {/* Quick chip buttons for existing accounts on device */}
          {!isSetup && allKnownUsers.length > 0 && (
            <div className="mt-5 border-t border-[#d8e2db] pt-4 text-[11px] text-[#748178]">
              <span className="font-semibold">Accounts on this device:</span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {allKnownUsers.map((u) => (
                  <button
                    key={u.username}
                    type="button"
                    onClick={() => {
                      setUsername(u.username);
                      setErrorMessage('');
                    }}
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                      username.toLowerCase() === u.username.toLowerCase()
                        ? 'border-[#176b50] bg-emerald-100 text-[#176b50]'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {u.displayName} ({u.role || 'Owner'})
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-6 text-[10px] leading-relaxed text-[#7a8980]">
            This is a local browser login for this device. Data is preserved across reloads via localStorage & IndexedDB. Keep backups by exporting via the Spreadsheet Centre.
          </p>
        </div>
      </div>
    </div>
  );
};
