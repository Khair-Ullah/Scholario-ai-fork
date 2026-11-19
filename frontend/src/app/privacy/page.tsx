import LegalPage from "@/components/LegalPage";

export const metadata = {
  title: "Privacy policy | Scholario",
  description: "How Scholario collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="8 November 2026"
      intro="This policy explains what Scholario collects, why we collect it, and the choices you have. We keep data collection to what is needed to match you with scholarships and run your workspace."
    >
      <section>
        <h2>1. Who we are</h2>
        <p>
          Scholario is an independent scholarship discovery and application workspace. It is not
          affiliated with any university, government, or funding body. References to &quot;we&quot;,
          &quot;us&quot;, and &quot;Scholario&quot; mean the operator of this service.
        </p>
      </section>

      <section>
        <h2>2. Information we collect</h2>
        <ul>
          <li><strong>Account data:</strong> your name, email address, and a hashed password. If you sign in with Google, we receive your name, email, and Google account identifier.</li>
          <li><strong>Profile data:</strong> degree level, fields of study, destination countries, IELTS plan, grades, and preferences you choose to provide.</li>
          <li><strong>Workspace data:</strong> saved scholarships, applications, checklists, templates, documents, and advisor conversations you create.</li>
          <li><strong>Payment data:</strong> plan, status, and transaction identifiers. Card details are processed by Stripe and are never stored on our servers.</li>
          <li><strong>Technical data:</strong> IP address, user agent, and security events used for rate limiting, fraud prevention, and account protection.</li>
        </ul>
      </section>

      <section>
        <h2>3. How we use information</h2>
        <ul>
          <li>To create and secure your account, including sign-in, password reset, and session management.</li>
          <li>To match you with scholarships and explain why an opportunity fits your profile.</li>
          <li>To operate the workspace features you use, such as saving, tracking, checklists, and documents.</li>
          <li>To process subscriptions and maintain billing records.</li>
          <li>To detect abuse, prevent fraud, and keep the service reliable.</li>
          <li>To respond to support requests and send essential service emails.</li>
        </ul>
      </section>

      <section>
        <h2>4. What we do not do</h2>
        <p>
          We do not sell your personal data. We do not use your profile to show paid placement in
          your scholarship results. We do not claim admission or funding outcomes on your behalf.
        </p>
      </section>

      <section>
        <h2>5. Sharing with service providers</h2>
        <p>
          We share the minimum necessary data with providers that help us run Scholario, such as
          hosting, email delivery, and payment processing (Stripe). These providers are expected to
          protect your data and use it only for the service they provide. We may also disclose data
          when required by law or to protect the rights and safety of users.
        </p>
      </section>

      <section>
        <h2>6. Cookies and sessions</h2>
        <p>
          Scholario uses cookies that are necessary for the service to work: an access token, a
          refresh token, and a CSRF protection token. These cookies are HTTP-only where possible and
          are used to keep you signed in and protect form submissions. We do not use advertising
          cookies.
        </p>
      </section>

      <section>
        <h2>7. Retention</h2>
        <p>
          We keep account and workspace data while your account is active. Password reset tokens and
          verification tokens expire automatically. When you delete your account, we remove your
          account and associated workspace data, except where we must keep limited records for legal,
          tax, or security reasons.
        </p>
      </section>

      <section>
        <h2>8. Your choices and rights</h2>
        <ul>
          <li>You can review and update your profile and preferences from your account.</li>
          <li>You can delete your account from your profile page or by contacting support.</li>
          <li>You can request a copy of your account data by contacting support.</li>
          <li>You can withdraw consent for optional processing by contacting support, though some features may stop working.</li>
        </ul>
      </section>

      <section>
        <h2>9. Security</h2>
        <p>
          Passwords are hashed, sessions are short-lived and revocable, and sensitive actions are
          rate limited. No online service can promise perfect security, so please use a strong unique
          password and keep your email account secure.
        </p>
      </section>

      <section>
        <h2>10. Children</h2>
        <p>
          Scholario is intended for students who are old enough to enter into a binding agreement in
          their jurisdiction. If you are under the required age, please use the service with the
          involvement of a parent or guardian.
        </p>
      </section>

      <section>
        <h2>11. Changes to this policy</h2>
        <p>
          We may update this policy as the product changes. We will post the new version on this page
          with a new &quot;last updated&quot; date. Material changes will be communicated through the
          service where appropriate.
        </p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>
          Questions about this policy? Email <a href="mailto:support@scholario.ai">support@scholario.ai</a>.
        </p>
      </section>
    </LegalPage>
  );
}
