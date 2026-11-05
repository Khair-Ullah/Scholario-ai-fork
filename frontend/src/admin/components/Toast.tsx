"use client";

import { useEffect, useRef } from "react";
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
  const onHideRef = useRef(onHide);
  useEffect(() => {
    onHideRef.current = onHide;
  }, [onHide]);
  useEffect(() => {
    if (!text) return;
    const timer = window.setTimeout(() => onHideRef.current?.(), 3500);
    return () => window.clearTimeout(timer);
  }, [text]);

  if (!text) return null;
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div className={`admin-toast ${tone}`} role="status">
      <Icon size={16} />
      {text}
    </div>
  );
}