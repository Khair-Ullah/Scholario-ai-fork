"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Briefcase,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { apiFetch, getMe, resetSessionCache } from "@/lib/api";

const consultantLinks = [
  { href: "/consultant/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/consultant/scholarships", label: "My scholarships", icon: FileSpreadsheet },
  { href: "/consultant/applicants", label: "Applicants", icon: Users },
  { href: "/consultant/warnings", label: "Warnings", icon: AlertTriangle },
  { href: "/consultant/profile", label: "Profile & 2FA", icon: UserCircle },
];

const labels = Object.fromEntries(consultantLinks.map((link) => [link.href, link.label]));

export default function ConsultantLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (pathname === "/consultant/login") return;
    let active = true;
    getMe()
      .then((user) => {
        if (!active) return;
        if (user.role === "consultant") setAllowed(true);
        else router.replace("/consultant/login");
      })
      .catch(() => {
        if (active) router.replace("/consultant/login");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (pathname === "/consultant/login") return children;
  if (checking || !allowed)
    return (
      <div className="admin-loading">
        <Briefcase size={20} /> Checking consultant access...
      </div>
    );

  async function signOut() {
    resetSessionCache();
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/consultant/login");
    }
  }

  const crumbs = pathname.slice("/consultant".length).split("/").filter(Boolean);

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <Link href="/consultant/dashboard" className="admin-brand">
          <Image
            className="brand-logo brand-logo-full"
            src="/images/logo/Nlogo.png"
            alt="Scholario"
            width={810}
            height={308}
          />
          <small>CONSULTANT</small>
        </Link>
        <p className="admin-nav-label">WORKSPACE</p>
        <nav>
          {consultantLinks.map(({ href, label, icon: Icon }) => (
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
          aria-label="Close consultant navigation"
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
            aria-label="Toggle consultant menu"
          >
            <Menu size={18} />
          </button>
          <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
            <span>Consultant</span>
            {crumbs.map((crumb) => (
              <span key={crumb}>
                <span className="admin-breadcrumb-sep">/</span>
                <strong>{labels[`/consultant/${crumbs.join("/")}`] ?? crumb.replaceAll("-", " ")}</strong>
              </span>
            ))}
          </nav>
          <span className="admin-role-chip">Consultant</span>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
