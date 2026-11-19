import Link from "next/link";
import { Clock3, LifeBuoy, Mail, ShieldCheck } from "lucide-react";
import ContactForm from "@/components/ContactForm";
import PublicFooter from "@/components/PublicFooter";
import PublicHeader from "@/components/PublicHeader";

export const metadata = {
  title: "Contact | Scholario",
  description: "Get help with your Scholario account, billing, or scholarship data.",
};

export default function ContactPage() {
  return (
    <main className="contact-page">
      <PublicHeader />

      <section className="contact-hero">
        <div className="contact-hero-copy">
          <p className="eyebrow">CONTACT</p>
          <h1>Talk to the team behind Scholario.</h1>
          <p>
            Questions about your account, a payment, or a scholarship listing? Send a note and a
            real person on the team will reply.
          </p>
        </div>
        <div className="contact-hero-note">
          <Clock3 size={17} />
          <div>
            <strong>2–5 business days</strong>
            <span>Typical reply time. Billing and data requests are handled first.</span>
          </div>
        </div>
      </section>

      <section className="contact-body">
        <ContactForm />

        <aside className="contact-rail">
          <div className="contact-rail-card">
            <span className="contact-rail-icon">
              <Mail size={17} />
            </span>
            <h3>Email us directly</h3>
            <a className="contact-mail" href="mailto:support@scholario.ai">
              support@scholario.ai
            </a>
            <p>
              For account access, billing, data deletion, and anything the form cannot cover.
            </p>
          </div>

          <div className="contact-rail-card">
            <span className="contact-rail-icon">
              <LifeBuoy size={17} />
            </span>
            <h3>What to include</h3>
            <ul>
              <li>The email address on your Scholario account.</li>
              <li>What you were doing and what you expected to happen.</li>
              <li>
                For billing: the payment date and the last four card digits — never the full
                number.
              </li>
              <li>For a listing: the scholarship title and the provider page you checked.</li>
            </ul>
          </div>

          <div className="contact-rail-card contact-rail-security">
            <span className="contact-rail-icon">
              <ShieldCheck size={17} />
            </span>
            <h3>Keep your account safe</h3>
            <p>
              We will never ask for your password, full card number, or one-time security codes
              by email.
            </p>
          </div>

          <p className="contact-staff">
            Staff or consultant? Use the <Link href="/admin/login">super admin</Link> or{" "}
            <Link href="/consultant/login">consultant</Link> sign-in pages.
          </p>
        </aside>
      </section>

      <PublicFooter />
    </main>
  );
}
