"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Database, FileSpreadsheet, Users } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Stats = { users: number; pro_users: number; scholarships: number; saved: number; applications: number };

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Stats>("/api/admin/stats").then(setStats).catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load administrator statistics.")); }, []);
  const cards = [{ label: "Scholarships", value: stats?.scholarships, icon: FileSpreadsheet, href: "/admin/scholarships" }, { label: "Student accounts", value: stats?.users, icon: Users, href: "/admin/users" }, { label: "Pro accounts", value: stats?.pro_users, icon: Users, href: "/admin/users" }, { label: "Saved opportunities", value: stats?.saved, icon: Database, href: "/admin/data-quality" }, { label: "Tracked applications", value: stats?.applications, icon: Database, href: "/admin/users" }];
  return <div className="admin-page"><div className="admin-page-heading"><div><p className="admin-eyebrow">SYSTEM OVERVIEW</p><h1>Operations dashboard</h1><p>Core catalogue and account metrics.</p></div></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="admin-stat-grid">{cards.map(({ label, value, icon: Icon, href }) => <Link className="admin-stat" href={href} key={label}><span><Icon size={17} /></span><small>{label}</small><strong>{value?.toLocaleString() ?? "—"}</strong><ArrowRight size={14} /></Link>)}</div><section className="admin-section"><div><p className="admin-eyebrow">CATALOGUE HEALTH</p><h2>Keep the data dependable.</h2><p>Review unresolved university countries and correct application links.</p></div><Link className="admin-outline" href="/admin/data-quality">Open data quality <ArrowRight size={14} /></Link></section></div>;
}