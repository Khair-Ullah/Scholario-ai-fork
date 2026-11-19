"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";

type Direction = "left" | "right";

const AuthTransitionContext = createContext<(href: string, direction: Direction) => void>(
  () => {},
);

type AuthGateProps = {
  kicker: string;
  headline: ReactNode;
  copy: string;
  points: string[];
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  switchLine: ReactNode;
  mobileAlign?: "top" | "center";
};

export default function AuthGate({
  kicker,
  headline,
  copy,
  points,
  eyebrow,
  title,
  subtitle,
  children,
  switchLine,
  mobileAlign = "top",
}: AuthGateProps) {
  const router = useRouter();
  const leavingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const [leaving, setLeaving] = useState<Direction | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const navigate = useCallback(
    (href: string, direction: Direction) => {
      if (leavingRef.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        router.push(href);
        return;
      }
      leavingRef.current = true;
      setLeaving(direction);
      timerRef.current = window.setTimeout(() => router.push(href), 340);
    },
    [router],
  );

  return (
    <AuthTransitionContext.Provider value={navigate}>
      <div className="authgate-viewport">
        <main className={`authgate-page${leaving ? ` is-leaving-${leaving}` : ""}`}>
          <aside className="authgate-brand">
            <div className="authgate-brand-top">
              <Link className="authgate-logo" href="/" aria-label="Scholario home">
                <Image
                  className="authgate-logo-img"
                  src="/images/logo/Nlogo.png"
                  alt="Scholario"
                  width={810}
                  height={308}
                  priority
                />
              </Link>
              <Link className="authgate-home" href="/">
                <ArrowLeft size={14} /> Back to home
              </Link>
            </div>

            <div className="authgate-brand-body">
              <p className="authgate-kicker">{kicker}</p>
              <h1 className="authgate-headline">{headline}</h1>
              <p className="authgate-brand-copy">{copy}</p>
              <ul className="authgate-points">
                {points.map((point) => (
                  <li key={point}>
                    <Check size={15} /> {point}
                  </li>
                ))}
              </ul>
            </div>

            <div className="authgate-brand-foot">
              <span>© 2026 Scholario</span>
              <span className="authgate-brand-links">
                <Link href="/privacy">Privacy</Link>
                <Link href="/terms">Terms</Link>
              </span>
            </div>
          </aside>

          <section
            className={`authgate-main${
              mobileAlign === "center" ? " authgate-main-center" : ""
            }`}
          >
            <div className="authgate-mobile-head">
              <Link
                className="authgate-mobile-logo"
                href="/"
                aria-label="Scholario home"
              >
                <Image
                  className="authgate-mobile-logo-img"
                  src="/images/logo/Nlogo.png"
                  alt="Scholario"
                  width={810}
                  height={308}
                  priority
                />
              </Link>
              <Link className="authgate-mobile-home" href="/">
                <ArrowLeft size={14} /> Back home
              </Link>
            </div>

            <div className="authgate-card">
              <header className="authgate-card-head">
                <p className="authgate-eyebrow">{eyebrow}</p>
                <h2 className="authgate-title">{title}</h2>
                <p className="authgate-subtitle">{subtitle}</p>
              </header>
              {children}
              {switchLine}
            </div>
            <p className="authgate-legal">
              By continuing you agree to our <Link href="/terms">Terms</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </section>
        </main>
      </div>
    </AuthTransitionContext.Provider>
  );
}

export function AuthSwitchLink({
  href,
  direction,
  label,
  cta,
}: {
  href: string;
  direction: Direction;
  label: string;
  cta: string;
}) {
  const onClick = useAuthNavigate(href, direction);

  return (
    <p className="authgate-switch">
      {label}{" "}
      <Link href={href} onClick={onClick}>
        {cta}
      </Link>
    </p>
  );
}

export function AuthLink({
  href,
  direction,
  className,
  children,
}: {
  href: string;
  direction: Direction;
  className?: string;
  children: ReactNode;
}) {
  const onClick = useAuthNavigate(href, direction);

  return (
    <Link className={className} href={href} onClick={onClick}>
      {children}
    </Link>
  );
}

function useAuthNavigate(href: string, direction: Direction) {
  const navigate = useContext(AuthTransitionContext);

  return useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      event.preventDefault();
      navigate(href, direction);
    },
    [direction, href, navigate],
  );
}
