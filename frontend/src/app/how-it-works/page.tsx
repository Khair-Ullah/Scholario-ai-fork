import {
  ArrowRight,
  ArrowUpRight,
  Calculator,
  Check,
  Filter,
  GraduationCap,
  ListChecks,
  Rocket,
  Search,
  ShieldQuestion,
  SlidersHorizontal,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import StepConnector from "@/components/StepConnector";

type Step = {
  id: string;
  icon: LucideIcon;
  num: string;
  title: string;
  body: string;
  pills?: string[];
  funnel?: { text: string; ok: boolean }[];
  ranks?: { label: string; cls: string }[];
  actions?: string[];
};

type Rule = {
  icon: LucideIcon;
  title: string;
  body: string[];
};

const steps: Step[] = [
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
      { label: "Good · 14% selection ratio", cls: "good" },
      { label: "Moderate · 7% selection ratio", cls: "moderate" },
      { label: "Competitive · 2.4% selection ratio", cls: "competitive" },
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

const rules: Rule[] = [
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

const gates = [
  "IELTS tier ≤ your cap",
  "Degree level matches",
  "Host country matches",
  "Field matches (any-field included)",
  "Active opportunity",
];

function SectionHead({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
}) {
  return (
    <div className="lp-section-head">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <main className="hiw-page">
      <PublicHeader />

      <section className="lp-band hiw-hero-band">
        <div className="lp-container">
          <div className="lp-section-head">
            <p className="eyebrow"><span className="eyebrow-dot" /> THIS IS HOW IT WORKS</p>
            <h2>From your profile to <em>matched scholarships.</em></h2>
            <p>
              Six clear steps, one rule-based path: share your plans, we filter by honest
              eligibility rules, rank what fits, and help you move every application forward.
            </p>
          </div>
          <div className="lp-hero-actions">
            <Link className="primary-button" href="/register">
              <Search size={17} /> Start matching <ArrowUpRight size={16} />
            </Link>
            <Link className="lp-secondary-button" href="/#scholarships">
              Explore scholarships <ArrowRight size={15} />
            </Link>
          </div>
          <ul className="lp-hero-trust">
            <li><Check size={15} /> Free to try</li>
            <li><Check size={15} /> No IELTS needed to begin</li>
            <li><Check size={15} /> Every match shows why it fits</li>
          </ul>
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
        </div>
      </section>

      <section className="lp-band lp-steps" id="process">
        <div className="lp-container">
          <SectionHead
            eyebrow="SIX CLEAR STEPS"
            title={<>A path you can follow, <em>step by step.</em></>}
            description="Nothing hidden, nothing arbitrary. Each step narrows the list with rules you can read and understand."
          />
          <div className="lp-three-grid hiw-steps">
            <StepConnector />
            {steps.map((step) => (
              <article className="lp-card lp-step-card" id={step.id} key={step.id}>
                <span className="lp-step-num" data-step-badge>{step.num}</span>
                <step.icon className="lp-step-icon" size={22} />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                {step.pills && (
                  <div className="lp-tag-list">
                    {step.pills.map((pill) => <span key={pill}>{pill}</span>)}
                  </div>
                )}
                {step.funnel && (
                  <div className="lp-funnel">
                    {step.funnel.map((row) => (
                      <div
                        className={row.ok ? "lp-funnel-row" : "lp-funnel-row is-drop"}
                        key={row.text}
                      >
                        {row.ok ? <Check size={13} /> : <X size={13} />}
                        <span>{row.text}</span>
                        <b>{row.ok ? "PASS" : "OUT"}</b>
                      </div>
                    ))}
                  </div>
                )}
                {step.ranks && (
                  <div className="lp-rank-list">
                    {step.ranks.map((rank) => (
                      <div className="lp-rank" key={rank.label}>
                        <span>{rank.label}</span>
                        <div className={`lp-rank-track ${rank.cls}`}><span /></div>
                      </div>
                    ))}
                  </div>
                )}
                {step.actions && (
                  <div className="lp-tag-list">
                    {step.actions.map((action) => <span key={action}>{action}</span>)}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-band hiw-rules-band" id="rules">
        <div className="lp-container">
          <SectionHead
            eyebrow="THE RULES, OUT IN THE OPEN"
            title={<>No black box. <em>Here&apos;s what we check.</em></>}
            description="Every result you see passed all of these gates before it was ranked."
          />
          <div className="lp-tag-list lp-rule-chips">
            {gates.map((gate) => <span key={gate}>{gate}</span>)}
          </div>
          <div className="lp-three-grid">
            {rules.map((rule) => (
              <details className="lp-faq-item" key={rule.title} open>
                <summary><rule.icon size={16} /> {rule.title}</summary>
                <ul className="lp-rule-list">
                  {rule.body.map((line) => <li key={line}>{line}</li>)}
                </ul>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-cta">
        <div className="lp-cta-inner">
          <p className="eyebrow">READY WHEN YOU ARE</p>
          <h2>See your scholarships in a few minutes.</h2>
          <p>
            Answer a short onboarding wizard and get a ranked, explainable shortlist built by the
            rules above.
          </p>
          <div className="lp-cta-steps" aria-hidden="true">
            <span>Profile</span><ArrowRight size={13} /><span>Match</span><ArrowRight size={13} /><span>Opportunity</span>
          </div>
          <div className="lp-cta-actions">
            <Link className="primary-button" href="/register">
              Check My Eligibility <ArrowRight size={16} />
            </Link>
            <Link className="lp-secondary-button" href="/#scholarships">
              Explore Scholarships
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
