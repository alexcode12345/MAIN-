import React, { useState } from 'react';
import { Modal } from './Modal';
import { Product } from '../types';
import { parseStockQuantity } from '../utils/spreadsheet';

interface AdjustStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSaveAdjustment: (
    product: Product,
    mode: 'add' | 'remove' | 'set',
    quantity: number,
    label: string,
    reason: string
  ) => void;
}

export const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  isOpen,
  onClose,
  product,
  onSaveAdjustment,
}) => {
  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add');
  const [quantityInput, setQuantityInput] = useState('');
  const [reason, setReason] = useState('Stock received');
  const [error, setError] = useState('');

  if (!product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsed = parseStockQuantity(quantityInput);
    if (!parsed.valid || parsed.value < 0) {
      setError('Please enter a valid stock quantity (e.g. 10, 12 boxes).');
      return;
    }

    if (mode === 'remove' && parsed.value > product.quantity) {
      setError(`Cannot remove more than current stock (${product.quantity} units).`);
      return;
    }

    onSaveAdjustment(
      product,
      mode,
      parsed.value,
      parsed.label || String(parsed.value),
      reason
    );
    setQuantityInput('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adjust stock">
      <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
        <div>
          Product: <strong>{product.name}</strong> · Batch: <strong>{product.batch}</strong>
        </div>
        <div className="mt-1 font-mono">
          Current stock: <strong>{product.stockCountLabel || product.quantity}</strong> units
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-100 p-3 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[var(--pharma-text)]">
            Adjustment type
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
          >
            <option value="add">Receive stock (+ Add units)</option>
            <option value="remove">Remove stock (− Deduct units)</option>
            <option value="set">Set counted physical quantity (= Override)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--pharma-text)]">
            Quantity count *
          </label>
          <input
            type="text"
            required
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value)}
            placeholder="e.g. 10, 12 boxes, 4 strips"
            className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--pharma-text)]">Reason *</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
          >
            <option>Stock received</option>
            <option>Physical count correction</option>
            <option>Damaged stock</option>
            <option>Expired stock</option>
            <option>Supplier return</option>
            <option>Internal transfer</option>
            <option>Other</option>
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
            Save adjustment
          </button>
        </div>
      </form>
    </Modal>
  );
};
