import LegalPage from "@/components/LegalPage";

export const metadata = {
  title: "Refund policy | Scholario",
  description: "How refunds work for Scholario Pro subscriptions.",
};

export default function RefundPolicyPage() {
  return (
    <LegalPage
      title="Refund policy"
      updated="8 November 2026"
      intro="We want Pro to feel fair. This policy explains when we refund a payment and how to ask for one. It does not limit any refund rights you have under applicable law."
    >
      <section>
        <h2>1. Free plan</h2>
        <p>
          The free plan costs nothing, so there is nothing to refund. You can use it for as long as
          you like.
        </p>
      </section>

      <section>
        <h2>2. Pro subscriptions</h2>
        <ul>
          <li>Pro is billed monthly or yearly and renews automatically until you cancel.</li>
          <li>You can cancel at any time from the billing page in your account.</li>
          <li>After cancelling, you keep Pro access until the end of the period you already paid for.</li>
          <li>We do not automatically refund the unused part of a period after you cancel.</li>
        </ul>
      </section>

      <section>
        <h2>3. When we refund</h2>
        <ul>
          <li><strong>Duplicate or accidental charge:</strong> we refund the duplicate or accidental charge in full.</li>
          <li><strong>Unauthorised charge:</strong> contact us and your bank immediately; we will investigate and refund a confirmed unauthorised charge.</li>
          <li><strong>First purchase, within 7 days:</strong> if Pro is not what you expected, contact us within 7 days of your first payment and we will review a refund.</li>
          <li><strong>Service not delivered:</strong> if a paid feature is unavailable for a significant period because of our error, contact us for a fair resolution.</li>
        </ul>
      </section>

      <section>
        <h2>4. When we may decline a refund</h2>
        <ul>
          <li>The request is made long after the charge and the period has been used.</li>
          <li>The account was closed for violating the terms of service.</li>
          <li>The request is for a renewal after you had already used the renewed period.</li>
        </ul>
        <p>We will always explain our decision and point you to any rights you have under local law.</p>
      </section>

      <section>
        <h2>5. How to request a refund</h2>
        <p>
          Email <a href="mailto:support@scholario.ai">support@scholario.ai</a> with the email on your
          account, the approximate payment date, and the last four digits of the card. Do not send
          full card numbers. We aim to respond within 5 business days.
        </p>
      </section>

      <section>
        <h2>6. Chargebacks</h2>
        <p>
          Please contact us before starting a chargeback so we can resolve the issue quickly. If a
          chargeback is raised, we may suspend Pro while the payment provider investigates.
        </p>
      </section>
    </LegalPage>
  );
}
