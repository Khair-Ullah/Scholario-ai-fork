import { ArrowUpRight, ArrowRight, Calculator, Filter, GraduationCap, ListChecks, Rocket, Search, ShieldQuestion, SlidersHorizontal, Sparkles, UserPlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import HiwNav from "@/components/HiwNav";

const steps = [
  {
    id: "step-1",
    icon: UserPlus,
    num: "01",
    title: "Create your profile",
    body: "Tell Scholario what you're looking for: your degree level (Undergraduate, Master's or PhD), the countries you want to study in, and your subject fields. Anything you skip stays wide open — nothing is a wrong answer.",
    pills: ["Degree level", "Target countries", "Subject fields"],
  },
  {
    id: "step-2",
    icon: Calculator,
    num: "02",
    title: "Share your academics",
    body: "Your GPA or percentage is converted to a familiar 4.0 scale, and you tell us your IELTS level (not taking, 6+, 7+ or 8+). No score yet? You're never blocked — matches just get sharper as you add it.",
    pills: ["GPA → 4.0 scale", "IELTS 6+ / 7+ / 8+", "FSc / Inter marks"],
  },
  {
    id: "step-3",
    icon: SlidersHorizontal,
    num: "03",
    title: "Set your preferences",
    body: "Your funding wish and nice-to-haves (work allowed, insurance, rolling admission…) are noted so your advisor can help. These preferences are stored only — they never remove results from your list.",
    pills: ["Full tuition / partial / stipend", "Nice-to-haves", "Advisor context"],
  },
  {
    id: "step-4",
    icon: Filter,
    num: "04",
    title: "Match by clear rules",
    body: "Before anything is ranked, every scholarship passes a fixed eligibility gate: it must be active, match your degree level and fields, and fit inside your IELTS + academic tiers. General / any-field opportunities always qualify for the fields you choose.",
    funnel: [
      { text: "IELTS tier ≤ your cap · academic tier met", ok: true },
      { text: "Host country matches your targets", ok: true },
      { text: "Different degree level", ok: false },
    ],
  },
  {
    id: "step-5",
    icon: ListChecks,
    num: "05",
    title: "See your ranked shortlist",
    body: "Eligible opportunities are ranked by Pakistani selection ratio, then sooner deadlines, then funding value — each with an honest chance label (Good, Moderate or Competitive).",
    ranks: [
      { label: "Good · 14% selection ratio", cls: "good", d: ".1s" },
      { label: "Moderate · 7% selection ratio", cls: "moderate", d: ".3s" },
      { label: "Competitive · 2.4% selection ratio", cls: "competitive", d: ".5s" },
    ],
  },
  {
    id: "step-6",
    icon: Rocket,
    num: "06",
    title: "Take action",
    body: "Save scholarships, track applications, auto-generate a checklist from required documents, build your SOP from templates, ask the AI advisor, and apply through the official link. Deadline reminders arrive 7, 3 and 1 days before.",
    actions: ["Save & track", "Checklist generator", "SOP / CV templates", "AI advisor", "Official apply link", "Deadline reminders"],
  },
];

const rules = [
  {
    icon: GraduationCap,
    title: "IELTS tiers",
    body: [
      "Every scholarship has an IELTS tier: 0 = no IELTS, 1 = 6+, 2 = 7+, 3 = 8+.",
      "Your IELTS choice is a cap — for example 7+ can match tiers 0, 1 and 2, but never an 8+ requirement. Not taking IELTS shows only the no-IELTS tier.",
    ],
  },
  {
    icon: ShieldQuestion,
    title: "Academic tier gate",
    body: [
      "Your GPA sets a competitiveness cap on top of IELTS. Higher scores unlock harder tiers. Thresholds differ by level: Undergraduate 3.0 / 3.5, Master's 3.2 / 3.6, PhD 3.4 / 3.7.",
      "Missing a score never blocks matches — you just lose the sharper cap.",
    ],
  },
  {
    icon: Sparkles,
    title: "What 'chance' means",
    body: [
      "Chances come from Pakistani applicants vs. selected: Good ≥ 10%, Moderate 4–10%, Competitive < 4%. They are estimates from the data — never a promise of admission or funding.",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <main>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Scholario home">
          <Image className="brand-logo" src="/images/logo/logo.png" alt="Scholario" width={39} height={36} priority />
          scholario<span className="brand-period">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/#opportunities">For students</Link>
        </nav>
        <div className="public-actions">
          <Link className="top-link" href="/login">Log in</Link>
          <Link className="public-signup" href="/register">Create account <ArrowUpRight size={15} /></Link>
        </div>
      </header>

      <section className="hiw-hero">
        <div className="hiw-hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> THIS IS HOW IT WORKS</p>
          <h1>From your profile<br />to <em>matched scholarships.</em></h1>
          <p className="hiw-hero-sub">Six clear steps, one rule-based path: share your plans, we filter by honest eligibility rules, rank what fits, and help you move every application forward.</p>
          <div className="hiw-hero-actions">
            <Link className="primary-button" href="/register"><Search size={17} /> Start matching <ArrowUpRight size={16} /></Link>
            <span className="hiw-hero-meta">Free to try · No IELTS needed to begin</span>
          </div>
        </div>
        <div className="hiw-hero-deco" aria-hidden="true">
          <svg className="hiw-path" viewBox="0 0 380 330" role="presentation">
            <path className="hiw-path-dash" d="M52 296 C 60 210, 130 248, 136 172 S 214 118, 214 96 S 300 74, 320 30" />
            <circle className="hiw-dot" cx="136" cy="172" r="9" />
            <circle className="hiw-dot-gold" cx="214" cy="96" r="7" />
            <circle className="hiw-dot" cx="320" cy="30" r="10" />
            <rect className="hiw-card" x="26" y="286" width="74" height="30" rx="8" />
            <text className="hiw-card-label" x="37" y="306">profile</text>
            <rect className="hiw-card" x="262" y="64" width="66" height="28" rx="8" />
            <text className="hiw-card-label" x="272" y="83">matched</text>
          </svg>
        </div>
      </section>

      <section className="hiw-flow">
        <HiwNav />
        <ol className="hiw-timeline">
          {steps.map((step) => (
            <li className="hiw-step" id={step.id} key={step.id}>
              <span className="hiw-step-dot"><em>{step.num}</em></span>
              <article className="hiw-step-card">
                <h2><step.icon size={21} /> {step.title}</h2>
                <p>{step.body}</p>
                {step.pills && (
                  <div className="hiw-pills">{step.pills.map((pill) => <span key={pill}>{pill}</span>)}</div>
                )}
                {step.funnel && (
                  <div className="hiw-funnel">
                    {step.funnel.map((row) => (
                      <div key={row.text} className={row.ok ? "" : "drop"}>
                        {row.ok ? "✓" : "✕"} {row.text} <b>{row.ok ? "PASS" : "OUT"}</b>
                      </div>
                    ))}
                  </div>
                )}
                {step.ranks && (
                  <div className="hiw-ranks">
                    {step.ranks.map((rank) => (
                      <div className="hiw-rank" key={rank.label}>
                        <div><span>{rank.label}</span></div>
                        <div className={`hiw-rank-bar ${rank.cls}`}><span style={{ width: rank.cls === "good" ? "68%" : rank.cls === "moderate" ? "44%" : "24%", "--d": rank.d } as React.CSSProperties} /></div>
                      </div>
                    ))}
                  </div>
                )}
                {step.actions && (
                  <div className="hiw-actions">{step.actions.map((action) => <span key={action}>{action}</span>)}</div>
                )}
              </article>
            </li>
          ))}
        </ol>
      </section>

      <section className="hiw-rules">
        <div className="hiw-rules-head">
          <p className="eyebrow">THE RULES, OUT IN THE OPEN</p>
          <h2>No black box.<br />Here&apos;s what we check.</h2>
          <p className="page-subtitle">Labels chips — every result you see passed all of these.</p>
          <div className="hiw-pills" style={{ marginTop: 18 }}>
            {["IELTS tier ≤ your cap", "Degree level matches", "Host country matches", "Field matches (any-field included)", "Active opportunity"].map((t) => <span key={t}>{t}</span>)}
          </div>
        </div>
        <div className="hiw-rules-grid">
          {rules.map((rule) => (
            <details className="hiw-rule" key={rule.title} open>
              <summary><rule.icon size={18} /> {rule.title}</summary>
              <div className="hiw-rule-body">
                <ul>{rule.body.map((line) => <li key={line}>{line}</li>)}</ul>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="hiw-cta">
        <p className="eyebrow">READY WHEN YOU ARE</p>
        <h2>See your scholarships in a few minutes.</h2>
        <p>Answer a short onboarding wizard and get a ranked, explainable shortlist built by the rules above.</p>
        <Link className="primary-button" href="/register">Show me my scholarships <ArrowRight size={16} /></Link>
      </section>

      <footer><Link className="brand footer-brand" href="/"><Image className="brand-logo" src="/images/logo/logo.png" alt="Scholario" width={30} height={28} />scholario<span className="brand-period">.</span></Link><span>Thoughtful tools for your next chapter.</span><span>Built for students, with care.</span></footer>
    </main>
  );
}