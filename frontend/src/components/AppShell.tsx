"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BookOpenCheck, ChevronDown, ClipboardCheck, Compass, FileText, LayoutDashboard, LogOut, Menu, MessageCircle, Search, Settings2, X, Plane, Sparkles, UserPlus, CreditCard } from "lucide-react";
import { apiFetch } from "@/lib/api";

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/onboarding", label: "Study preferences", icon: Settings2 },
  { href: "/scholarships", label: "Scholarships", icon: Compass },
  { href: "/saved", label: "Saved", icon: BookOpenCheck },
  { href: "/tracker", label: "Application tracker", icon: ClipboardCheck },
  { href: "/checklist", label: "Checklist", icon: CheckListIcon },
  { href: "/templates", label: "Documents", icon: FileText },
  { href: "/advisor", label: "Advisor", icon: MessageCircle },
  { href: "/sop-reviewer", label: "SOP reviewer", icon: Sparkles },
  { href: "/visa-travel", label: "Visa & travel", icon: Plane },
  { href: "/referral", label: "Referral", icon: UserPlus },
  { href: "/billing", label: "Plan & billing", icon: CreditCard },
];

export default function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const path = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    try { await apiFetch("/api/auth/logout", { method: "POST" }); } finally { router.replace("/login"); }
  }

  return (
    <div className="app-shell">
      {mobileOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`app-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <Link className="brand shell-brand" href="/dashboard"><Image className="brand-logo" src="/images/logo/logo.png" alt="Scholario" width={39} height={36} /> scholario<span className="brand-period">.</span></Link>
        <p className="sidebar-label">YOUR WORKSPACE</p>
        <nav aria-label="Student workspace">
          {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`sidebar-link ${path === href || path.startsWith(`${href}/`) ? "active" : ""}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>)}
        </nav>
        <div className="sidebar-bottom"><Link href="/profile" className={`sidebar-link ${path === "/profile" ? "active" : ""}`}><Settings2 size={17} /><span>Profile & account</span></Link><button className="sidebar-link signout-link" onClick={signOut}><LogOut size={17} /><span>Sign out</span></button></div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <button className="mobile-menu" aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X size={20} /> : <Menu size={20} />}</button>
          <label className="global-search"><Search size={16} /><input aria-label="Search scholarships" placeholder="Search scholarships, documents..." onKeyDown={(event) => { if (event.key === "Enter") router.push(`/scholarships?q=${encodeURIComponent(event.currentTarget.value)}`); }} /><kbd>↵</kbd></label>
          <div className="topbar-actions"><Link className="notification-button" href="/notifications" aria-label="Notifications"><Bell size={18} /><span /></Link><Link className="account-chip" href="/profile"><span className="account-avatar">S</span><span>My account</span><ChevronDown size={14} /></Link></div>
        </header>
        <div className="app-content">{children}</div>
        <nav className="mobile-tabs" aria-label="Quick navigation">{links.slice(0, 4).map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={path === href ? "active" : ""}><Icon size={19} /><span>{label === "Study preferences" ? "Profile" : label === "Overview" ? "Home" : label}</span></Link>)}</nav>
      </div>
    </div>
  );
}

function CheckListIcon() { return <ClipboardCheck size={17} strokeWidth={1.8} />; }