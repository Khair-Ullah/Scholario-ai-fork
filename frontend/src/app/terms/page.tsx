import LegalPage from "@/components/LegalPage";

export const metadata = {
  title: "Terms of service | Scholario",
  description: "The terms that govern your use of Scholario.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="8 November 2026"
      intro="These terms govern your use of Scholario. By creating an account or using the service, you agree to them. Please read them carefully."
    >
      <section>
        <h2>1. The service</h2>
        <p>
          Scholario helps students discover scholarships, understand eligibility rules, and organise
          applications. It is an informational and organisational tool. It does not submit
          applications to providers on your behalf and does not make admission or funding decisions.
        </p>
      </section>

      <section>
        <h2>2. Accounts</h2>
        <ul>
          <li>You must provide accurate information and keep your account credentials secure.</li>
          <li>You are responsible for activity that happens under your account.</li>
          <li>You must be old enough to enter into a binding agreement in your jurisdiction.</li>
          <li>We may suspend or close accounts that violate these terms or put the service at risk.</li>
        </ul>
      </section>

      <section>
        <h2>3. Scholarship information</h2>
        <p>
          Scholarship listings are compiled from curated sources and may contain errors, outdated
          deadlines, or incomplete requirements. Selection ratios and chance labels are estimates,
          not guarantees. You must verify every requirement, deadline, fee, and application link on
          the official provider page before applying.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <ul>
          <li>Do not use Scholario to break the law or infringe the rights of others.</li>
          <li>Do not scrape, resell, or redistribute the catalogue without permission.</li>
          <li>Do not attempt to access another user&apos;s account or data.</li>
          <li>Do not upload malware, spam, or abusive content.</li>
          <li>Do not interfere with the security or availability of the service.</li>
        </ul>
      </section>

      <section>
        <h2>5. Your content</h2>
        <p>
          You keep ownership of the documents and notes you create. You grant us the limited right to
          store, process, and display that content so we can provide the service to you. You are
          responsible for making sure your content does not violate the rights of others.
        </p>
      </section>

      <section>
        <h2>6. Subscriptions and billing</h2>
        <p>
          The free plan is available at no cost. Pro is an optional paid subscription. Payments are
          processed by Stripe. By subscribing, you authorise recurring charges at the price and
          interval shown at checkout until you cancel. You can cancel from the billing page; access
          continues until the end of the current billing period. Refunds are described in the
          <a href="/refund-policy"> refund policy</a>.
        </p>
      </section>

      <section>
        <h2>7. Intellectual property</h2>
        <p>
          The Scholario name, design, software, and original content are protected by intellectual
          property laws. You may not copy or reuse them except as allowed by these terms or with
          written permission.
        </p>
      </section>

      <section>
        <h2>8. Availability and changes</h2>
        <p>
          We work to keep Scholario available and accurate, but the service is provided on an
          &quot;as is&quot; and &quot;as available&quot; basis. We may change, pause, or discontinue
          features, and we may update these terms. Continued use after an update means you accept the
          revised terms.
        </p>
      </section>

      <section>
        <h2>9. Disclaimers and limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, we are not liable for indirect, incidental, or
          consequential losses, including lost opportunities, missed deadlines, or decisions made by
          scholarship providers. Nothing in these terms limits rights that cannot be limited by law.
        </p>
      </section>

      <section>
        <h2>10. Termination</h2>
        <p>
          You can stop using Scholario at any time and delete your account. We may suspend or end
          access if you violate these terms or if we must do so for legal or security reasons.
        </p>
      </section>

      <section>
        <h2>11. Governing law</h2>
        <p>
          These terms are governed by the laws of the Islamic Republic of Pakistan, without regard to
          conflict-of-law rules, unless mandatory local law provides otherwise. Disputes will be
          handled by the competent courts in that jurisdiction.
        </p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>
          Questions about these terms? Email <a href="mailto:support@scholario.ai">support@scholario.ai</a>.
        </p>
      </section>
    </LegalPage>
  );
}
