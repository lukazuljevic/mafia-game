import { useEffect, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown> | void;
}

export default function ConfirmModal({ options, onClose }: { options: ConfirmOptions | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!options) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, onClose]);

  if (!options) return null;

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await options.onConfirm();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="card modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <h2>{options.title}</h2>
        {options.message && <p className="modal-message">{options.message}</p>}
        <div className="modal-buttons">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
            Odustani
          </button>
          <button
            type="button"
            className={`btn ${options.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirm}
            disabled={busy}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
