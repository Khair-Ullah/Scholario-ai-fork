"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  CreditCard,
  Database,
  FileText,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

const adminLinks = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/scholarships", label: "Scholarships", icon: FileSpreadsheet },
  { href: "/admin/data-quality", label: "Data quality", icon: Database },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/templates", label: "Templates", icon: FileText },
  { href: "/admin/announcements", label: "Announcements", icon: Bell },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
  { href: "/admin/ai", label: "AI activity", icon: Activity },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const labels = Object.fromEntries(adminLinks.map((link) => [link.href, link.label]));

let mePromise: Promise<{ role: string }> | null = null;
const loadMe = () => {
  if (!mePromise) mePromise = apiFetch<{ role: string }>("/api/auth/me");
  return mePromise;
};

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
    loadMe()
      .then((user) => {
        if (!active) return;
        if (user.role === "admin") setAllowed(true);
        else router.replace("/admin/login");
      })
      .catch(() => {
        if (active) router.replace("/admin/login");
      })
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

  const crumbs = pathname.slice("/admin".length).split("/").filter(Boolean);

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
          className="admin-scrim admin-scrim-solid"
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
            <Menu size={18} />
          </button>
          <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
            <span>Administration</span>
            {crumbs.map((crumb) => (
              <span key={crumb}>
                <span className="admin-breadcrumb-sep">/</span>
                <strong>
                  {labels[`/admin/${crumbs.join("/")}`] ??
                    crumb.replaceAll("-", " ")}
                </strong>
              </span>
            ))}
          </nav>
          <span className="admin-role-chip">Administrator</span>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}