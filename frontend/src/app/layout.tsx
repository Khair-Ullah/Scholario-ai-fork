import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://scholario.ai"),
  title: "Scholario | Find scholarships you can actually get",
  description:
    "Tell Scholario about yourself and get scholarship recommendations based on your profile, eligibility, goals, and preferences.",
  icons: {
    icon: "/images/logo/logo.png",
    apple: "/images/logo/logo.png",
  },
  openGraph: {
    title: "Scholario | Find scholarships you can actually get",
    description:
      "Profile-first scholarship matching with clear eligibility rules, visible deadlines, and an honest shortlist.",
    type: "website",
    images: [{ url: "/images/logo/Nlogo.png", width: 810, height: 308, alt: "Scholario" }],
  },
  twitter: {
    card: "summary",
    title: "Scholario | Find scholarships you can actually get",
    description:
      "Profile-first scholarship matching with clear eligibility rules, visible deadlines, and an honest shortlist.",
    images: ["/images/logo/Nlogo.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0D4F4B",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}