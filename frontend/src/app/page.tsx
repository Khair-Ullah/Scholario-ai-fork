import { ArrowDownRight, ArrowUpRight, Compass, GraduationCap, Search } from "lucide-react";
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
          <span className="brand-mark"><GraduationCap size={20} strokeWidth={2.2} /></span>
          scholario<span className="brand-period">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
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

        <div className="hero-art" aria-label="Illustration of a student preparing an application">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="art-stamp"><Compass size={19} /><span>YOUR<br />NEXT STEP</span></div>
          <div className="paper paper-back"><span className="paper-caption">A WORLD OF POSSIBILITY</span><span className="paper-line line-short" /><span className="paper-line" /><span className="paper-line line-mid" /></div>
          <div className="paper paper-front"><span className="paper-top"><span>01 / YOUR SHORTLIST</span><span className="paper-star">✳</span></span><span className="paper-title">Make room<br />for what’s next.</span><span className="paper-foot"><span className="paper-avatar">S</span><span>Scholarships<br /><strong>matched to you</strong></span><ArrowDownRight size={19} /></span></div>
          <span className="art-caption">A more considered way to search.</span>
        </div>
        <div className="hero-index"><span>01</span><span className="index-line" /><span>03</span></div>
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="steps-heading"><p className="eyebrow">A GOOD PLACE TO BEGIN</p><h2>From wondering<br />to moving forward.</h2></div>
        <div className="steps-list">
          {steps.map((step) => <article className="step-row" key={step.number}><span className="step-number">{step.number}</span><div><h3>{step.title}</h3><p>{step.body}</p></div><ArrowUpRight size={17} className="step-arrow" /></article>)}
        </div>
      </section>

      <footer><Link className="brand footer-brand" href="/">scholario<span className="brand-period">.</span></Link><span>Thoughtful tools for your next chapter.</span><span>Built for students, with care.</span></footer>
    </main>
  );
}