"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function Toast({
  text,
  tone = "success",
  onHide,
}: {
  text: string;
  tone?: "success" | "error";
  onHide?: () => void;
}) {
  useEffect(() => {
    if (!text) return;
    const timer = window.setTimeout(() => onHide?.(), 3500);
    return () => window.clearTimeout(timer);
  }, [text, onHide]);

  if (!text) return null;
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div className={`admin-toast ${tone}`} role="status">
      <Icon size={16} />
      {text}
    </div>
  );
}