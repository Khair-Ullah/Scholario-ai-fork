"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BookOpenCheck,
  ChevronDown,
  ClipboardCheck,
  Compass,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Plane,
  Search,
  Settings2,
  Sparkles,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import { apiFetch, getMe, signOut } from "@/lib/api";

type ShellLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type NoticeSummary = {
  unread_count: number;
};

const groups: { label: string; links: ShellLink[] }[] = [
  {
    label: "Workspace",
    links: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/onboarding", label: "Study preferences", icon: Settings2 },
      { href: "/scholarships", label: "Scholarships", icon: Compass },
      { href: "/saved", label: "Saved", icon: BookOpenCheck },
      { href: "/tracker", label: "Application tracker", icon: ClipboardCheck },
    ],
  },
  {
    label: "Prepare",
    links: [
      { href: "/checklist", label: "Checklist", icon: ClipboardCheck },
      { href: "/templates", label: "Documents", icon: FileText },
      { href: "/sop-reviewer", label: "SOP reviewer", icon: Sparkles },
      { href: "/advisor", label: "Advisor", icon: MessageCircle },
      { href: "/visa-travel", label: "Visa & travel", icon: Plane },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/referral", label: "Referral", icon: UserPlus },
      { href: "/billing", label: "Plan & billing", icon: CreditCard },
    ],
  },
];

const primaryTabs = [
  {
    href: "/dashboard",
    label: "Home",
    icon: LayoutDashboard,
    match: (path: string) => path === "/dashboard",
  },
  {
    href: "/scholarships",
    label: "Scholarships",
    icon: Compass,
    match: (path: string) => within(path, "/scholarships"),
  },
  {
    href: "/tracker",
    label: "Tracker",
    icon: ClipboardCheck,
    match: (path: string) => within(path, "/tracker"),
  },
  {
    href: "/templates",
    label: "Documents",
    icon: FileText,
    match: (path: string) => within(path, "/templates"),
  },
];

const moreGroups: { label: string; links: ShellLink[] }[] = [
  {
    label: "Plan",
    links: [
      { href: "/onboarding", label: "Study preferences", icon: Settings2 },
      { href: "/saved", label: "Saved", icon: BookOpenCheck },
      { href: "/checklist", label: "Checklist", icon: ClipboardCheck },
    ],
  },
  {
    label: "Prepare",
    links: [
      { href: "/sop-reviewer", label: "SOP reviewer", icon: Sparkles },
      { href: "/advisor", label: "Advisor", icon: MessageCircle },
      { href: "/visa-travel", label: "Visa & travel", icon: Plane },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/referral", label: "Referral", icon: UserPlus },
      { href: "/billing", label: "Plan & billing", icon: CreditCard },
    ],
  },
];

const primaryPaths = ["/dashboard", "/scholarships", "/tracker", "/templates"];

function within(path: string, href: string): boolean {
  return path === href || path.startsWith(`${href}/`);
}

export default function AppShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const path = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [initial, setInitial] = useState("S");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      getMe(),
      apiFetch<NoticeSummary>("/api/notifications"),
    ]).then(([me, notices]) => {
      if (!active) return;
      if (me.status === "fulfilled") {
        setInitial(me.value.full_name.trim().charAt(0).toUpperCase() || "S");
      }
      if (notices.status === "fulfilled") {
        setUnread(notices.value.unread_count || 0);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!moreOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  async function handleSignOut() {
    await signOut("/login");
  }

  const moreActive = !primaryPaths.some((href) => within(path, href));

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <aside className="app-sidebar">
        <Link className="brand shell-brand" href="/dashboard">
          <Image
            className="brand-logo brand-logo-full"
            src="/images/logo/Nlogo.png"
            alt="Scholario"
            width={810}
            height={308}
          />
        </Link>

        <div className="sidebar-scroll">
          {groups.map((group, index) => (
            <div className="sidebar-group" key={group.label}>
              <p
                className={`sidebar-label${
                  index > 0 ? " sidebar-label-secondary" : ""
                }`}
              >
                {group.label}
              </p>
              <nav aria-label={`${group.label} navigation`}>
                {group.links.map(({ href, label, icon: Icon }) => {
                  const active = within(path, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`sidebar-link${active ? " active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon size={17} strokeWidth={1.8} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <Link
            href="/profile"
            className={`sidebar-link${path === "/profile" ? " active" : ""}`}
            aria-current={path === "/profile" ? "page" : undefined}
          >
            <Settings2 size={17} strokeWidth={1.8} />
            <span>Profile & account</span>
          </Link>
          <button className="sidebar-link signout-link" onClick={handleSignOut}>
            <LogOut size={17} strokeWidth={1.8} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <Link
            className="app-mobile-brand"
            href="/dashboard"
            aria-label="Scholario dashboard"
          >
            <Image
              src="/images/logo/Nlogo.png"
              alt="Scholario"
              width={810}
              height={308}
              priority
            />
          </Link>

          <label className="global-search">
            <Search size={16} />
            <input
              aria-label="Search scholarships, documents and resources"
              placeholder="Search scholarships..."
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  router.push(
                    `/scholarships?q=${encodeURIComponent(event.currentTarget.value)}`,
                  );
                }
              }}
            />
            <kbd>Enter</kbd>
          </label>

          <div className="topbar-actions">
            <Link
              className="notification-button"
              href="/notifications"
              aria-label={
                unread > 0
                  ? `Notifications, ${unread} unread`
                  : "Notifications"
              }
            >
              <Bell size={18} />
              {unread > 0 && (
                <span className="notification-badge" aria-hidden="true">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link className="account-chip" href="/profile">
              <span className="account-avatar">{initial}</span>
              <span>My account</span>
              <ChevronDown size={14} />
            </Link>
          </div>
        </header>

        <main className="app-content" id="main-content">
          {children}
        </main>

        <nav className="mobile-tabs" aria-label="Student navigation">
          {primaryTabs.map(({ href, label, icon: Icon, match }) => {
            const active = match(path);
            return (
              <Link
                key={href}
                href={href}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={20} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className={`mobile-tab-more${moreOpen || moreActive ? " active" : ""}`}
            aria-expanded={moreOpen}
            aria-controls="app-more-sheet"
            onClick={() => setMoreOpen((current) => !current)}
          >
            <MoreHorizontal size={20} strokeWidth={1.8} />
            <span>More</span>
          </button>
        </nav>

        {moreOpen && (
          <>
            <button
              className="app-more-scrim"
              aria-label="Close navigation menu"
              onClick={() => setMoreOpen(false)}
            />
            <section
              className="app-more-sheet"
              id="app-more-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="More navigation"
            >
              <span className="app-more-grab" aria-hidden="true" />
              <div className="app-more-head">
                <div>
                  <p className="eyebrow">MORE</p>
                  <strong>Your workspace</strong>
                </div>
                <button
                  type="button"
                  className="app-more-close"
                  aria-label="Close"
                  onClick={() => setMoreOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="app-more-body">
                {moreGroups.map((group) => (
                  <div className="app-more-group" key={group.label}>
                    <p>{group.label}</p>
                    <div className="app-more-grid">
                      {group.links.map(({ href, label, icon: Icon }) => (
                        <Link
                          key={href}
                          href={href}
                          className={`app-more-link${
                            within(path, href) ? " active" : ""
                          }`}
                          onClick={() => setMoreOpen(false)}
                        >
                          <Icon size={18} strokeWidth={1.8} />
                          <span>{label}</span>
                          {href === "/notifications" && unread > 0 && (
                            <small>{unread}</small>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="app-more-foot">
                <Link
                  href="/profile"
                  className="app-more-account"
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="account-avatar">{initial}</span>
                  <span>
                    <strong>Profile & account</strong>
                    <small>Manage your details and plan</small>
                  </span>
                </Link>
                <button
                  type="button"
                  className="app-more-signout"
                  onClick={handleSignOut}
                >
                  <LogOut size={17} /> Sign out
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
