"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import MobileTabBar from "@/components/MobileTabBar";

export default function PublicHeader() {
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);

  useEffect(() => {
    lastScroll.current = window.scrollY;

    const onScroll = () => {
      const current = window.scrollY;
      const delta = current - lastScroll.current;

      if (current < 96) {
        setHidden(false);
      } else if (delta > 6) {
        setHidden(true);
      } else if (delta < -6) {
        setHidden(false);
      }

      lastScroll.current = current;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header className={`topbar${hidden ? " is-hidden" : ""}`}>
        <Link className="brand" href="/" aria-label="Scholario home">
          <Image
            className="brand-logo brand-logo-full"
            src="/images/logo/Nlogo.png"
            alt="Scholario"
            width={810}
            height={308}
            priority
          />
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/#scholarships">Scholarships</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/#faq">FAQ</Link>
        </nav>
        <div className="public-actions">
          <Link className="top-link" href="/login">Log in</Link>
          <Link
            className="public-signup"
            href="/register"
            aria-label="Check my scholarship eligibility"
          >
            <span className="cta-long">Check My Eligibility</span>
            <span className="cta-short">Check eligibility</span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>
      <MobileTabBar />
    </>
  );
}
