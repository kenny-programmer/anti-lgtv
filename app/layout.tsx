import type { Metadata } from "next";
import { DM_Mono, Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";
import { SITE_NAME } from "@/lib/site";

const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-display",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const code = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description:
    "Secret Santa for friends, family or the office. Run a private holiday gift exchange: invite-only groups, one fair draw, and everyone opens only their own tag.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${code.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
