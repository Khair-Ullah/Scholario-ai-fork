import { ArrowUpRight, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const steps = [
  { number: "01", title: "Tell us what you need", body: "Your degree, subject, destinations, and academic profile shape a useful shortlist." },
  { number: "02", title: "See the rules clearly", body: "Understand why an opportunity matches, what it funds, and what to prepare." },
  { number: "03", title: "Keep every application moving", body: "Save deadlines, organize documents, and track your next step in one place." },
];

export default function HomePage() {
  return (
    <main>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Scholario home">
          <Image className="brand-logo" src="/images/logo/logo.png" alt="Scholario" width={39} height={36} priority />
          scholario<span className="brand-period">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/how-it-works">How it works</Link>
          <a href="#opportunities">For students</a>
        </nav>
        <div className="public-actions">
          <Link className="top-link" href="/login">Log in</Link>
          <Link className="public-signup" href="/register">Create account <ArrowUpRight size={15} /></Link>
        </div>
      </header>

      <section className="hero" id="opportunities">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> SCHOLARSHIPS, WITH A CLEARER PATH</p>
          <h1>Your next chapter<br />is <em>closer than you think.</em></h1>
          <p className="hero-summary">Find scholarships that fit your plans, understand what you qualify for, and bring every application into focus.</p>
          <Link className="primary-button" href="/register"><Search size={17} /> Find scholarships <ArrowUpRight size={16} /></Link>
          <div className="hero-note"><span className="note-rule" /> Built for ambitious students, starting from Pakistan.</div>
        </div>

        <div className="hero-art" aria-label="Preview of the Scholario app">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="hero-flip">
            <div className="hero-flip-inner">
              <div className="hero-face">
                <Image className="hero-visual" src="/images/design/nav.jpg" alt="Scholario app preview" width={768} height={1376} priority />
              </div>
              <div className="hero-face hero-face-back">
                <Image className="hero-visual" src="/images/design/map.jpg" alt="Scholario destinations map" width={768} height={1376} />
              </div>
            </div>
          </div>
        </div>
        <div className="hero-index"><span>01</span><span className="index-line" /><span>03</span></div>
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="steps-heading"><p className="eyebrow">A GOOD PLACE TO BEGIN</p><h2>From wondering<br />to moving forward.</h2></div>
        <div className="steps-list">
          {steps.map((step) => <article className="step-row" key={step.number}><span className="step-number">{step.number}</span><div><h3>{step.title}</h3><p>{step.body}</p></div><ArrowUpRight size={17} className="step-arrow" /></article>)}
        </div>
        <Link className="text-link" href="/how-it-works">See the full matching process <ArrowUpRight size={15} /></Link>
      </section>

      <footer><Link className="brand footer-brand" href="/"><Image className="brand-logo" src="/images/logo/logo.png" alt="Scholario" width={30} height={28} />scholario<span className="brand-period">.</span></Link><span>Thoughtful tools for your next chapter.</span><span>Built for students, with care.</span></footer>
    </main>
  );
}