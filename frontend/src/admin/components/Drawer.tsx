"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function Drawer({
  open,
  title,
  onClose,
  children,
  width = 420,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="admin-drawer-layer">
      <button className="admin-scrim admin-scrim-solid" onClick={onClose} aria-label="Close panel" />
      <aside className="admin-drawer" style={{ width: `min(${width}px, 92vw)` }}>
        <header className="admin-drawer-head">
          <h2>{title}</h2>
          <button className="admin-icon-btn" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </header>
        <div className="admin-drawer-body">{children}</div>
      </aside>
    </div>
  );
}