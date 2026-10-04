import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scholario | Find your next opportunity",
  description: "Discover scholarships that fit your study plans.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}