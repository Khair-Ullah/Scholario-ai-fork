import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock3 } from "lucide-react";
import PublicFooter from "./PublicFooter";
import PublicHeader from "./PublicHeader";

type LegalPageProps = {
  title: string;
  updated: string;
  intro?: string;
  children: React.ReactNode;
};

export default function LegalPage({ title, updated, intro, children }: LegalPageProps) {
  return (
    <main className="legal-page">
      <PublicHeader />

      <article className="legal-wrap">
        <header className="legal-hero">
          <p className="eyebrow">LEGAL</p>
          <h1>{title}</h1>
          {intro && <p className="legal-intro">{intro}</p>}
          <div className="legal-meta-row">
            <span className="legal-updated">
              <Clock3 size={13} /> Last updated {updated}
            </span>
            <Link className="legal-meta-link" href="/contact">
              Questions? Contact us <ArrowUpRight size={13} />
            </Link>
          </div>
        </header>

        <div className="legal-body">{children}</div>

        <footer className="legal-help">
          <div>
            <h2>Still need a hand?</h2>
            <p>If anything here is unclear, ask us directly — a real person will reply.</p>
          </div>
          <Link className="legal-help-link" href="/contact">
            Contact support <ArrowRight size={15} />
          </Link>
        </footer>
      </article>

      <PublicFooter />
    </main>
  );
}
