import React from 'react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-[#153e30] px-5 py-3.5 text-sm font-medium text-white shadow-xl shadow-black/20 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 max-w-[90vw]"
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d8b45b] text-xs font-bold text-[#103d32]">
        ✓
      </div>
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-white/70 hover:text-white"
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
};
