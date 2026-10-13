import React from 'react';
import { History, CheckCheck, TrendingUp, Shield, Package } from 'lucide-react';
import { AppState } from '../types';

interface ActivityViewProps {
  state: AppState;
  onMarkAllReviewed: () => void;
}

export const ActivityView: React.FC<ActivityViewProps> = ({ state, onMarkAllReviewed }) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'sale':
        return <TrendingUp className="h-4 w-4 text-[#176b50]" />;
      case 'security':
        return <Shield className="h-4 w-4 text-amber-600" />;
      default:
        return <Package className="h-4 w-4 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="text-[11px] font-extrabold tracking-wider text-[#176b50] uppercase">
            Audit trail
          </div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[var(--pharma-text)] sm:text-3xl">
            Activity log & notifications
          </h1>
          <p className="mt-1 text-xs text-[var(--pharma-muted)]">
            Chronological audit trail of stock adjustments, counter sales, and local user sign-ins.
          </p>
        </div>

        <button
          onClick={onMarkAllReviewed}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] px-3.5 py-2 text-xs font-bold text-[var(--pharma-text)] shadow-xs hover:bg-[var(--pharma-panel2)]"
        >
          <CheckCheck className="h-3.5 w-3.5" /> Mark all reviewed
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--pharma-line)] bg-[var(--pharma-panel)] p-6 shadow-xs">
        <div className="divide-y divide-[var(--pharma-line)]">
          {state.activity.length > 0 ? (
            state.activity.map((item) => (
              <div key={item.id} className="flex items-start gap-4 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--pharma-panel2)] border border-[var(--pharma-line)]">
                  {getIcon(item.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--pharma-text)]">{item.title}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        item.read
                          ? 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {item.read ? 'Reviewed' : 'New'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--pharma-muted)]">{item.detail}</p>
                  <div className="mt-1 text-[10px] text-[var(--pharma-muted)]">
                    {new Date(item.time).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-xs text-[var(--pharma-muted)]">
              No activity recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
