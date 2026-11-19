"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  GraduationCap,
  Home,
  Mail,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
  match: (pathname: string) => boolean;
};

const tabs: Tab[] = [
  {
    href: "/",
    label: "Home",
    icon: Home,
    match: (pathname) => pathname === "/",
  },
  {
    href: "/#scholarships",
    label: "Scholarships",
    icon: GraduationCap,
    match: (pathname) => pathname.startsWith("/scholarships"),
  },
  {
    href: "/register",
    label: "Apply",
    icon: Sparkles,
    primary: true,
    match: (pathname) =>
      pathname.startsWith("/register") || pathname.startsWith("/onboarding"),
  },
  {
    href: "/contact",
    label: "Contact",
    icon: Mail,
    match: (pathname) => pathname.startsWith("/contact"),
  },
  {
    href: "/login",
    label: "Profile",
    icon: UserRound,
    match: (pathname) =>
      ["/login", "/dashboard", "/profile", "/account", "/settings"].some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      ),
  },
];

export default function MobileTabBar() {
  const pathname = usePathname();

  useEffect(() => {
    document.body.classList.add("has-mobile-tabbar");

    return () => {
      document.body.classList.remove("has-mobile-tabbar");
    };
  }, []);

  return (
    <nav className="mobile-tabbar" aria-label="Mobile navigation">
      <div className="mobile-tabbar-inner">
        {tabs.map(({ href, label, icon: Icon, primary, match }) => {
          const active = match(pathname);

          return (
            <Link
              key={href}
              href={href}
              className={`mobile-tab${primary ? " is-primary" : ""}${
                active ? " is-active" : ""
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span className="mobile-tab-icon">
                <Icon size={21} strokeWidth={1.9} />
              </span>
              <span className="mobile-tab-label">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
