"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Database,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Users,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const adminLinks = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/scholarships", label: "Scholarships", icon: FileSpreadsheet },
  { href: "/admin/data-quality", label: "Data quality", icon: Database },
  { href: "/admin/users", label: "Users", icon: Users },
];

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    if (pathname === "/admin/login") {
      return;
    }
    let active = true;
    apiFetch<{ role: string }>("/api/auth/me")
      .then((user) => {
        if (user.role === "admin") {
          if (active) setAllowed(true);
        }
        else router.replace("/admin/login");
      })
      .catch(() => router.replace("/admin/login"))
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);
  if (pathname === "/admin/login") return children;
  if (checking || !allowed)
    return (
      <div className="admin-loading">
        <ShieldCheck size={20} /> Checking administrator access...
      </div>
    );

  async function signOut() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
    }
  }

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <Link href="/admin/dashboard" className="admin-brand">
          <span>
            <ShieldCheck size={18} />
          </span>{" "}
          scholario <small>ADMIN</small>
        </Link>
        <p className="admin-nav-label">OPERATIONS</p>
        <nav>
          {adminLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "active" : ""}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <button className="admin-signout" onClick={signOut}>
          <LogOut size={16} /> Sign out
        </button>
      </aside>
      {mobileOpen && (
        <button
          className="admin-scrim"
          aria-label="Close admin navigation"
          onClick={() => setMobileOpen(false)}
        >
          <X size={1} />
        </button>
      )}
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-mobile-menu"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle admin menu"
          >
            ☰
          </button>
          <span>
            ADMINISTRATION /{" "}
            <strong>{pathname.split("/").at(-1)?.replaceAll("-", " ")}</strong>
          </span>
          <span className="admin-role-chip">Administrator</span>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
