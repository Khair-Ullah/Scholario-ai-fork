import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function StatCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: string | number | null | undefined;
  icon: React.ComponentType<{ size?: number | string }>;
  href?: string;
}) {
  const Icon = icon;
  const body = (
    <>
      <span>
        <Icon size={17} />
      </span>
      <small>{label}</small>
      <strong>{value?.toLocaleString() ?? "—"}</strong>
      {href && <ArrowRight size={14} />}
    </>
  );
  return href ? (
    <Link className="admin-stat" href={href}>
      {body}
    </Link>
  ) : (
    <div className="admin-stat">{body}</div>
  );
}