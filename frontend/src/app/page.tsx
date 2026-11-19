import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpenCheck,
  CalendarClock,
  Check,
  ClipboardCheck,
  Compass,
  Database,
  FileCheck2,
  FileText,
  ListChecks,
  LockKeyhole,
  MessagesSquare,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  UserRound,
} from "lucide-react";
import LandingHero from "@/components/LandingHero";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";
import { fetchPublic } from "@/lib/serverApi";

export const revalidate = 60;

type Stats = { scholarships: number; universities: number; countries: number };

type FeaturedItem = {
  scholarship_id: string;
  title: string;
  university_name: string | null;
  host_country: string;
  level: string | null;
  scholarship_type: string | null;
  ielts_tier: number;
  deadline_date: string | null;
  deadline_kind: string;
  selection_ratio_percent: number | null;
  grant_amount_formatted: string | null;
};
type FeaturedResponse = { items: FeaturedItem[] };

const fallbackFeatured: FeaturedResponse = {
  items: [
    {
      scholarship_id: "5476",
      title: "Barbara Weightman Scholarships",
      university_name: "California State University Fullerton",
      host_country: "United States",
      level: "Master",
      scholarship_type: "Fully Funded",
      ielts_tier: 2,
      deadline_date: "2027-03-01",
      deadline_kind: "fixed",
      selection_ratio_percent: 50,
      grant_amount_formatted: "$500",
    },
    {
      scholarship_id: "5213",
      title: "Canadian Institute of Forestry Bursary",
      university_name: "University of Northern British Columbia",
      host_country: "Canada",
      level: "Master",
      scholarship_type: "Fully Funded",
      ielts_tier: 2,
      deadline_date: "2027-04-01",
      deadline_kind: "fixed",
      selection_ratio_percent: 50,
      grant_amount_formatted: "$1,000",
    },
    {
      scholarship_id: "1169",
      title: "PIF Program",
      university_name: "University of Electronic Science and Technology of China",
      host_country: "China",
      level: "Undergraduate",
      scholarship_type: "Fully Funded",
      ielts_tier: 0,
      deadline_date: null,
      deadline_kind: "unspecified",
      selection_ratio_percent: 50,
      grant_amount_formatted: "Tuition fee waiver",
    },
  ],
};

const steps = [
  {
    number: "01",
    icon: UserRound,
    title: "Build your profile",
    body: "Share your degree level, target destinations, field of study, IELTS plan, and grades. Anything you skip stays wide open.",
  },
  {
    number: "02",
    icon: Target,
    title: "Get matched",
    body: "Every opportunity passes a clear eligibility gate first, then is ranked with an honest reason and a realistic chance estimate.",
  },
  {
    number: "03",
    icon: Send,
    title: "Apply confidently",
    body: "Save opportunities, track deadlines, generate checklists, and draft documents from templates in one calm workspace.",
  },
];

const problems = [
  {
    icon: Search,
    title: "Too many lists",
    body: "Hundreds of scholarship pages, stale deadlines, and eligibility rules hidden in fine print.",
  },
  {
    icon: SlidersHorizontal,
    title: "Unclear eligibility",
    body: "You cannot tell whether your degree, IELTS band, or grades actually qualify you.",
  },
  {
    icon: CalendarClock,
    title: "Missed deadlines",
    body: "Applications, documents, and reminders live in different tabs and get forgotten.",
  },
];

const trustPoints = [
  {
    icon: Database,
    title: "Source shown, not hidden",
    body: "Every opportunity shows the provider, university, host country, and deadline so you can verify it on the official page.",
  },
  {
    icon: ShieldCheck,
    title: "Eligibility, explained",
    body: "Degree level, field, destination, IELTS, and academic tiers are applied as a fixed gate before anything is ranked.",
  },
  {
    icon: BadgeCheck,
    title: "Estimates stay estimates",
    body: "Selection ratios and chance labels are clearly marked as estimates. We never promise admission or funding.",
  },
  {
    icon: CalendarClock,
    title: "Deadlines in plain sight",
    body: "Deadlines and rolling status appear on the card, so you can plan around dates instead of hunting for them.",
  },
];

const workspace = [
  {
    icon: BookOpenCheck,
    title: "Compare opportunities",
    body: "Keep a shortlist and compare up to three opportunities side by side before you commit.",
  },
  {
    icon: ClipboardCheck,
    title: "Understand requirements",
    body: "Turn each scholarship's required documents into a clear checklist you can work through.",
  },
  {
    icon: FileText,
    title: "Prepare applications",
    body: "Start SOPs and CVs from structured templates and save your own versions.",
  },
  {
    icon: CalendarClock,
    title: "Track deadlines",
    body: "See what is due this month and get reminders 7, 3, and 1 day before.",
  },
  {
    icon: ListChecks,
    title: "Organize progress",
    body: "Follow every application from planning to submitted in one visual tracker.",
  },
  {
    icon: MessagesSquare,
    title: "Ask for guidance",
    body: "Ask the AI advisor about eligibility, documents, and next steps when you feel stuck.",
  },
];

const faqs = [
  {
    q: "How does Scholario match me?",
    a: "Matching first applies hard eligibility rules: degree level, field, host country, IELTS, and academic tiers. Only opportunities that pass those rules are ranked, and every result comes with a clear reason.",
  },
  {
    q: "Where does the scholarship data come from?",
    a: "The catalogue is built from a curated scholarship dataset with university and provider details. We show the source information available on each listing, but you should always confirm the final requirements and deadline on the official provider page.",
  },
  {
    q: "Can I apply through Scholario?",
    a: "No. Scholario helps you discover, compare, and prepare. Applications are submitted through the scholarship provider's official link, which we surface on every opportunity.",
  },
  {
    q: "Do you guarantee that I will win a scholarship?",
    a: "No. We help you find and organise opportunities that fit your profile. Admission and funding decisions belong to the provider. Selection ratios and chance labels are estimates, not promises.",
  },
  {
    q: "How do you decide if I am eligible?",
    a: "We check the rules stored with each opportunity against your profile: degree level, field, host country, IELTS tier, and academic tier. If a requirement is missing from our data, verify it with the provider before applying.",
  },
  {
    q: "Do you list fully funded scholarships?",
    a: "The catalogue includes a range of funding types, including fully funded, partial, and stipend-based opportunities. Each card shows the funding details we have, and the official page is the final source.",
  },
  {
    q: "How often is the information updated?",
    a: "We refresh the catalogue regularly, but scholarship pages can change without notice. Always check the official provider page for the latest deadline, requirements, and application link.",
  },
  {
    q: "Is Scholario free to use?",
    a: "Yes. You can create an account, build your profile, and browse matched opportunities for free. Pro is an optional upgrade for unlimited matches, saved documents, and expanded AI limits.",
  },
  {
    q: "Can I use Scholario without IELTS?",
    a: "Yes. Choose the no-IELTS option and you will only see opportunities that do not require an IELTS band. You can update this later as your plans change.",
  },
];

function number(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function deadlineLabel(item: FeaturedItem): string {
  if (item.deadline_date) {
    const date = new Date(item.deadline_date);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }
  }
  if (item.deadline_kind === "rolling") return "Rolling admissions";
  if (item.deadline_kind === "anytime") return "Anytime";
  return "Deadline not specified";
}

function chanceLabel(ratio: number | null): string {
  if (ratio == null) return "Check details";
  if (ratio >= 10) return "Good chance";
  if (ratio >= 4) return "Moderate chance";
  return "Competitive";
}

function chanceTone(ratio: number | null): string {
  if (ratio == null) return "unknown";
  if (ratio >= 10) return "good";
  if (ratio >= 4) return "moderate";
  return "competitive";
}

function SectionHead({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="lp-section-head">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export default async function HomePage() {
  const stats = await fetchPublic<Stats>("/api/public/stats", {
    scholarships: 9338,
    universities: 844,
    countries: 0,
  });
  const featured = await fetchPublic<FeaturedResponse>("/api/public/featured", fallbackFeatured);
  const countryLabel = stats.countries > 0 ? number(stats.countries) : "Multiple";

  return (
    <main>
      <PublicHeader />

      <LandingHero
        scholarships={stats.scholarships}
        universities={stats.universities}
        countryLabel={countryLabel}
      />

      <section className="lp-proof" aria-label="Scholario catalogue at a glance">
        <div><strong>{number(stats.scholarships)}+</strong><span>scholarships indexed</span></div>
        <div><strong>{number(stats.universities)}</strong><span>universities</span></div>
        <div><strong>{countryLabel}</strong><span>host countries</span></div>
        <div><strong>Explainable</strong><span>matching, not a black box</span></div>
      </section>

      <section className="lp-band lp-problem">
        <div className="lp-container">
          <SectionHead
            eyebrow="THE REAL PROBLEM"
            title="Applying abroad shouldn't feel like guesswork."
            description="The information exists, but it is scattered, outdated, and hard to compare. Scholario brings eligibility, chances, deadlines, and preparation into one calm workspace."
          />
          <div className="lp-three-grid">
            {problems.map((problem) => (
              <article className="lp-card" key={problem.title}>
                <span className="lp-icon"><problem.icon size={20} /></span>
                <h3>{problem.title}</h3>
                <p>{problem.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-band lp-steps" id="how-it-works">
        <div className="lp-container">
          <SectionHead
            eyebrow="A CLEARER PATH"
            title="Three steps from wondering to applying."
            description="No black box. Start with what you know, let the rules do the filtering, then move the right applications forward."
          />
          <div className="lp-steps-grid">
            {steps.map((step) => (
              <article className="lp-card lp-step-card" key={step.title}>
                <span className="lp-step-num">{step.number}</span>
                <step.icon className="lp-step-icon" size={22} />
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
          <Link className="text-link" href="/how-it-works">
            See the full matching process <ArrowUpRight size={15} />
          </Link>
        </div>
      </section>

      <section className="lp-band lp-trust" id="trust">
        <div className="lp-container">
          <SectionHead
            eyebrow="NO BLACK BOX"
            title="Here's how we earn your trust."
            description="Trust is not a badge. It is a set of choices we make on every screen: explain the rules, label the estimates, and let you verify the source."
          />
          <div className="lp-two-grid">
            {trustPoints.map((point) => (
              <article className="lp-card lp-trust-card" key={point.title}>
                <span className="lp-icon"><point.icon size={20} /></span>
                <div>
                  <h3>{point.title}</h3>
                  <p>{point.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-band lp-featured" id="scholarships">
        <div className="lp-container">
          <SectionHead
            eyebrow="FROM THE CATALOGUE"
            title="Real opportunities, not vague promises."
            description="Three examples from the Scholario catalogue. Selection ratios are shown as estimates, never guarantees."
          />
          {featured.items.length > 0 ? (
            <div className="lp-three-grid">
              {featured.items.map((item) => {
                const ratio = item.selection_ratio_percent;
                return (
                  <Link
                    className="lp-card lp-featured-card"
                    key={item.scholarship_id}
                    href={`/scholarships/${item.scholarship_id}`}
                  >
                    <div className="lp-featured-top">
                      <span className="lp-featured-country">{item.host_country}</span>
                      <span className="lp-match-chip">
                        <strong>{ratio != null ? `${ratio.toFixed(1)}%` : "—"}</strong>
                        <span>{ratio != null ? "est. selection ratio" : "check details"}</span>
                      </span>
                    </div>
                    <h3>{item.title}</h3>
                    <p className="lp-featured-uni">
                      {item.university_name || "Provider details in the catalogue"}
                    </p>
                    <div className={`lp-match-note ${chanceTone(ratio)}`}>
                      {chanceLabel(ratio)}
                    </div>
                    <div className="lp-featured-meta">
                      <span>{item.level || "Level varies"}</span>
                      <span>{item.scholarship_type || "Funding varies"}</span>
                      {item.grant_amount_formatted ? <span>{item.grant_amount_formatted}</span> : null}
                    </div>
                    <div className="lp-featured-foot">
                      <span><CalendarClock size={14} /> {deadlineLabel(item)}</span>
                      <span className="lp-featured-link">View opportunity <ArrowUpRight size={14} /></span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="lp-empty">
              <Compass size={22} />
              <p>The live catalogue is being refreshed. Create a free account to browse every opportunity.</p>
              <Link className="text-link" href="/register">Create a free account <ArrowRight size={15} /></Link>
            </div>
          )}
        </div>
      </section>

      <section className="lp-band lp-workspace">
        <div className="lp-container">
          <SectionHead
            eyebrow="ONE WORKSPACE"
            title="Everything after the shortlist."
            description="Finding an opportunity is step one. Scholario also helps you understand it, prepare for it, and finish strong."
          />
          <div className="lp-three-grid">
            {workspace.map((item) => (
              <article className="lp-card lp-workspace-card" key={item.title}>
                <span className="lp-icon"><item.icon size={20} /></span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-security">
        <div className="lp-container lp-security-grid">
          <div className="lp-security-copy">
            <p className="eyebrow">SECURITY &amp; PRIVACY</p>
            <h2>Built to protect your plans, not exploit them.</h2>
            <p>
              Scholario stores the minimum profile data needed to match you with opportunities. Your
              account is protected by hashed passwords, short-lived sessions, and revocable refresh
              tokens.
            </p>
            <Link className="text-link" href="/privacy">Read the privacy policy <ArrowUpRight size={15} /></Link>
          </div>
          <ul className="lp-security-list">
            <li><LockKeyhole size={18} /> Passwords are hashed, never stored in plain text.</li>
            <li><ShieldCheck size={18} /> Sessions expire and can be revoked from any device.</li>
            <li><Sparkles size={18} /> Estimates are clearly labelled as estimates.</li>
            <li><FileCheck2 size={18} /> You can update or delete your account data.</li>
          </ul>
        </div>
      </section>

      <section className="lp-band lp-pricing" id="pricing">
        <div className="lp-container">
          <SectionHead
            eyebrow="SIMPLE PRICING"
            title="Start free. Upgrade only when it helps."
            description="Free is for discovery. Pro adds deeper assistance when you are ready to move faster. No hidden fees and no paid placement in your results."
          />
          <div className="lp-pricing-grid">
            <article className="lp-price-card">
              <p className="lp-price-kicker">Discovery</p>
              <h3>Free</h3>
              <strong className="lp-price">$0</strong>
              <p className="lp-price-note">Everything you need to begin.</p>
              <ul>
                <li><Check size={15} /> 30 matched opportunities</li>
                <li><Check size={15} /> 5 saved documents</li>
                <li><Check size={15} /> Application tracker and checklists</li>
                <li><Check size={15} /> Core templates and advisor access</li>
              </ul>
              <Link className="primary-button" href="/register">
                Check My Eligibility <ArrowRight size={15} />
              </Link>
            </article>
            <article className="lp-price-card lp-price-pro">
              <span className="lp-plan-badge">Optional</span>
              <p className="lp-price-kicker">Deeper assistance</p>
              <h3>Pro</h3>
              <strong className="lp-price">$5<small>/month</small></strong>
              <p className="lp-price-note">or $40 / year. Cancel anytime.</p>
              <ul>
                <li><Check size={15} /> Unlimited matches</li>
                <li><Check size={15} /> Unlimited saved documents</li>
                <li><Check size={15} /> Expanded AI limits</li>
                <li><Check size={15} /> Priority support</li>
              </ul>
              <Link className="lp-secondary-button" href="/register">
                Start free, upgrade later <ArrowUpRight size={15} />
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="lp-band lp-faq" id="faq">
        <div className="lp-container">
          <SectionHead
            eyebrow="QUESTIONS, ANSWERED"
            title="What students ask us first."
            description="Clear answers about matching, data, eligibility, and what Scholario can and cannot do."
          />
          <div className="lp-faq-list">
            {faqs.map((item) => (
              <details className="lp-faq-item" key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
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
            Answer a short profile wizard and get a ranked shortlist built by clear eligibility rules,
            with the reasons behind every match.
          </p>
          <div className="lp-cta-steps" aria-hidden="true">
            <span>Profile</span><ArrowRight size={13} /><span>Match</span><ArrowRight size={13} /><span>Opportunity</span>
          </div>
          <div className="lp-cta-actions">
            <Link className="primary-button" href="/register">
              Check My Eligibility <ArrowRight size={16} />
            </Link>
            <Link className="lp-secondary-button" href="#scholarships">
              Explore Scholarships
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
