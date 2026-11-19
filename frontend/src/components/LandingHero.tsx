"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight, Check, Search } from "lucide-react";

type LandingHeroProps = {
  scholarships: number;
  universities: number;
  countryLabel: string;
};

type HeroSlide = {
  eyebrow: string;
  title: ReactNode;
  supporting: string;
  badgeTitle: string;
  badgeLabel: string;
  badgeNote: string;
};

const SLIDE_COUNT = 2;
const ROTATE_MS = 8000;

function format(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export default function LandingHero({
  scholarships,
  universities,
  countryLabel,
}: LandingHeroProps) {
  const [active, setActive] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const tiltRef = useRef<HTMLDivElement | null>(null);

  const slides: HeroSlide[] = [
    {
      eyebrow: "SCHOLARSHIP MATCHING",
      title: (
        <>
          Find scholarships you can <em>actually get.</em>
        </>
      ),
      supporting:
        "Tell Scholario about yourself and get scholarship recommendations based on your profile, eligibility, goals, and preferences.",
      badgeTitle: `${format(scholarships)}+`,
      badgeLabel: "scholarships indexed",
      badgeNote: "Eligibility checked before ranking",
    },
    {
      eyebrow: "STUDY DESTINATIONS",
      title: (
        <>
          Study <em>anywhere</em> you want in the world.
        </>
      ),
      supporting: `Explore opportunities across ${countryLabel} host countries, then narrow by degree, field, budget, and eligibility before you apply.`,
      badgeTitle: countryLabel,
      badgeLabel: "host countries",
      badgeNote: `${format(universities)} universities in the catalogue`,
    },
  ];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.("change", updatePreference);
    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  useEffect(() => {
    if (reducedMotion || isPaused) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % SLIDE_COUNT);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [isPaused, reducedMotion]);

  useEffect(() => {
    const el = tiltRef.current;
    if (!el || reducedMotion) return;
    let frame = 0;
    let tiltX = 0;
    let tiltY = 0;
    const apply = () => {
      frame = 0;
      el.style.transform = `rotateX(${tiltX.toFixed(2)}deg) rotateY(${tiltY.toFixed(2)}deg)`;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    const onMove = (event: PointerEvent) => {
      const nx = (event.clientX / window.innerWidth - 0.5) * 2;
      const ny = (event.clientY / window.innerHeight - 0.5) * 2;
      tiltX = Math.max(-1, Math.min(1, -ny)) * 7;
      tiltY = Math.max(-1, Math.min(1, nx)) * 9;
      schedule();
    };
    const reset = () => {
      tiltX = 0;
      tiltY = 0;
      schedule();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseleave", reset);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", reset);
      window.removeEventListener("blur", reset);
      if (frame) window.cancelAnimationFrame(frame);
      el.style.transform = "";
    };
  }, [reducedMotion]);

  const slide = slides[active];

  return (
    <section
      className="hero"
      id="opportunities"
      aria-label="Scholarship matching preview"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
    >
      <div className="hero-copy">
        <p className="eyebrow hero-eyebrow" key={slide.eyebrow}>
          <span className="eyebrow-dot" /> {slide.eyebrow}
        </p>
        <h1 className="hero-title">
          {slides.map((item, index) => (
            <span
              className={active === index ? "is-active" : ""}
              aria-hidden={active !== index}
              key={item.eyebrow}
            >
              {item.title}
            </span>
          ))}
        </h1>
        <div className="hero-summary-slot">
          {slides.map((item, index) => (
            <p
              className={active === index ? "is-active" : ""}
              aria-hidden={active !== index}
              key={item.eyebrow}
            >
              {item.supporting}
            </p>
          ))}
        </div>
        <div className="lp-hero-actions">
          <Link className="primary-button" href="/register">
            <Search size={17} /> Check My Eligibility <ArrowUpRight size={16} />
          </Link>
          <Link className="lp-secondary-button" href="#scholarships">
            Explore Scholarships <ArrowRight size={15} />
          </Link>
        </div>
        <ul className="lp-hero-trust">
          <li><Check size={15} /> Free to start</li>
          <li><Check size={15} /> No IELTS needed to begin</li>
          <li><Check size={15} /> Your data stays yours</li>
        </ul>
      </div>

      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="hero-flip">
          <div className="hero-flip-inner" ref={tiltRef}>
            <div className="hero-face">
              <Image
                className="hero-visual"
                src="/images/design/glob.png"
                alt=""
                width={1536}
                height={1024}
                priority
                sizes="(max-width: 980px) 90vw, 480px"
              />
            </div>
          </div>
        </div>
        <div className="hero-art-badge">
          <span className="hero-art-badge-dot" />
          <div>
            <strong>{slide.badgeTitle}</strong>
            <span>{slide.badgeLabel}</span>
            <small>{slide.badgeNote}</small>
          </div>
        </div>
      </div>

      <div className="hero-index" aria-label="Hero preview controls">
        <button
          type="button"
          className={active === 0 ? "is-active" : ""}
          onClick={() => setActive(0)}
          aria-label="Show scholarship matching preview"
          aria-pressed={active === 0}
        >
          01
        </button>
        <span className="index-line" />
        <button
          type="button"
          className={active === 1 ? "is-active" : ""}
          onClick={() => setActive(1)}
          aria-label="Show study destinations preview"
          aria-pressed={active === 1}
        >
          02
        </button>
        <span className="hero-index-label">
          {active === 0 ? "Matching" : "Destinations"}
        </span>
      </div>
    </section>
  );
}
