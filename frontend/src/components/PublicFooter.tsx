import Image from "next/image";
import Link from "next/link";

const columns = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/how-it-works" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Why trust us", href: "/#trust" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Create account", href: "/register" },
      { label: "Log in", href: "/login" },
      { label: "Forgot password", href: "/forgot-password" },
      { label: "Student workspace", href: "/dashboard" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Refund policy", href: "/refund-policy" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export default function PublicFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-top">
        <div className="lp-footer-brand">
          <Link className="brand" href="/" aria-label="Scholario home">
            <Image
              className="brand-logo brand-logo-full"
              src="/images/logo/Nlogo.png"
              alt="Scholario"
              width={810}
              height={308}
            />
          </Link>
          <p>Thoughtful tools for your next chapter. Built for students, with care.</p>
          <a className="lp-footer-mail" href="mailto:support@scholario.ai">support@scholario.ai</a>
        </div>
        <div className="lp-footer-cols">
          {columns.map((column) => (
            <div key={column.title}>
              <h2>{column.title}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}><Link href={link.href}>{link.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="lp-footer-note">
        <p>
          Scholario is an independent scholarship discovery tool. It is not affiliated with any
          university, government, or funding body. Selection ratios and chances are estimates, not
          guarantees of admission or funding. Always verify details on the official provider page.
        </p>
      </div>
      <div className="lp-footer-bottom">
        <span>© {new Date().getFullYear()} Scholario. All rights reserved.</span>
        <span>Made for students, starting from Pakistan and beyond.</span>
      </div>
    </footer>
  );
}
