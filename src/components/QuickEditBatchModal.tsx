import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Product } from '../types';

interface QuickEditBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSaveBatch: (product: Product, newBatch: string) => void;
}

export const QuickEditBatchModal: React.FC<QuickEditBatchModalProps> = ({
  isOpen,
  onClose,
  product,
  onSaveBatch,
}) => {
  const [batch, setBatch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (product) {
      setBatch(product.batch || '');
    }
    setError('');
  }, [product, isOpen]);

  if (!product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch.trim()) {
      setError('Batch identifier cannot be empty.');
      return;
    }
    onSaveBatch(product, batch.trim());
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update batch number">
      <div className="mb-4 rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] p-3.5 text-xs text-[var(--pharma-text)]">
        <div>Medicine: <strong>{product.name}</strong></div>
        <div className="mt-1 text-[var(--pharma-muted)]">
          Current batch label: <strong>{product.batch || 'Not recorded'}</strong>
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
            New batch / lot number *
          </label>
          <input
            type="text"
            required
            autoFocus
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            placeholder="e.g. BATCH-002"
            className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
          />
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
            Update batch
          </button>
        </div>
      </form>
    </Modal>
  );
};
