import { Inbox } from "lucide-react";

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="admin-empty">
      <Inbox size={20} />
      <strong>{text}</strong>
    </div>
  );
}