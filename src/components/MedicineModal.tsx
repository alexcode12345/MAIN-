import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Product, PharmacySettings } from '../types';
import { parseStockQuantity } from '../utils/spreadsheet';

interface MedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  settings: PharmacySettings;
  onSave: (productData: Partial<Product>) => void;
}

export const MedicineModal: React.FC<MedicineModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
  settings,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [generic, setGeneric] = useState('');
  const [category, setCategory] = useState('');
  const [batch, setBatch] = useState('');
  const [quantityInput, setQuantityInput] = useState('');
  const [purchasePrice, setPurchasePrice] = useState<number | string>('');
  const [sellingPrice, setSellingPrice] = useState<number | string>('');
  const [expiry, setExpiry] = useState('');
  const [minStock, setMinStock] = useState<number | string>(settings.defaultMin || 0);
  const [supplier, setSupplier] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name || '');
      setGeneric(productToEdit.generic || '');
      setCategory(productToEdit.category || 'Other');
      setBatch(productToEdit.batch || '');
      setQuantityInput(productToEdit.stockCountLabel || String(productToEdit.quantity || 0));
      setPurchasePrice(productToEdit.purchasePrice ?? '');
      setSellingPrice(productToEdit.sellingPrice ?? '');
      setExpiry(productToEdit.expiry || '');
      setMinStock(productToEdit.minStock ?? settings.defaultMin ?? 0);
      setSupplier(productToEdit.supplier || '');
    } else {
      setName('');
      setGeneric('');
      setCategory('');
      setBatch('');
      setQuantityInput('');
      setPurchasePrice('');
      setSellingPrice('');
      setExpiry('');
      setMinStock(settings.defaultMin || 0);
      setSupplier('');
    }
    setError('');
  }, [productToEdit, isOpen, settings.defaultMin]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsedQty = parseStockQuantity(quantityInput);
    if (!parsedQty.valid) {
      setError('Please enter a valid stock quantity (e.g. 100, 12 boxes, 4 strips).');
      return;
    }

    const buyPrice = Number(purchasePrice);
    const sellPrice = Number(sellingPrice);

    if (isNaN(buyPrice) || buyPrice < 0 || isNaN(sellPrice) || sellPrice < 0) {
      setError('Prices cannot be negative.');
      return;
    }

    if (!batch.trim()) {
      setError('Batch number or lot identifier is required.');
      return;
    }

    onSave({
      name: name.trim(),
      generic: generic.trim(),
      category: category.trim() || 'Other',
      batch: batch.trim(),
      quantity: parsedQty.value,
      stockCountLabel: parsedQty.label || String(parsedQty.value),
      purchasePrice: buyPrice,
      sellingPrice: sellPrice,
      expiry,
      minStock: Number(minStock) || 0,
      supplier: supplier.trim(),
    });

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={productToEdit ? 'Edit medicine' : 'Add medicine to inventory'}
    >
      {error && (
        <div className="mb-4 rounded-xl bg-red-100 p-3 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-[var(--pharma-text)]">Medicine name *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Paracetamol 500mg"
            className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold text-[var(--pharma-text)]">Generic name</label>
            <input
              type="text"
              value={generic}
              onChange={(e) => setGeneric(e.target.value)}
              placeholder="e.g. Acetaminophen"
              className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--pharma-text)]">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Analgesics, Antibiotics"
              className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--pharma-text)]">Batch / lot number *</label>
            <input
              type="text"
              required
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              placeholder="e.g. BATCH-001"
              className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--pharma-text)]">Stock quantity *</label>
            <input
              type="text"
              required
              value={quantityInput}
              onChange={(e) => setQuantityInput(e.target.value)}
              placeholder="e.g. 100, 12 boxes, 4 strips"
              className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--pharma-text)]">
              Purchase price / unit ({settings.currency}) *
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              required
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--pharma-text)]">
              Selling price / unit ({settings.currency}) *
            </label>
            <input
              type="number"
              step="0.01"
              min={0}
              required
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--pharma-text)]">Expiry date *</label>
            <input
              type="date"
              required
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--pharma-text)]">Minimum stock level</label>
            <input
              type="number"
              min={0}
              value={minStock}
              onChange={(e) => setMinStock(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[var(--pharma-line)] bg-[var(--pharma-panel2)] px-3.5 py-2 text-xs text-[var(--pharma-text)] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[var(--pharma-text)]">Supplier / Distributor</label>
          <input
            type="text"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="e.g. MegaCare Pharma Ltd"
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
            {productToEdit ? 'Save changes' : 'Add to inventory'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
