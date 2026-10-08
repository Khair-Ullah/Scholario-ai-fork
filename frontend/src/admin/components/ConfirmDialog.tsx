"use client";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="admin-modal-wrap">
      <button className="admin-scrim admin-scrim-solid" onClick={onCancel} aria-label="Cancel" />
      <div className="admin-modal" role="dialog" aria-modal="true">
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="admin-modal-actions">
          <button className="admin-outline" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className={`admin-btn ${danger ? "danger" : "primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}