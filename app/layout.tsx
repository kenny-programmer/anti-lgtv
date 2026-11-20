import type { Metadata } from "next";
import "./globals.css";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description:
    "Run a private, fair, secret gift exchange with friends or family. Invite-only groups, a one-click raffle, and nobody ever gets themselves.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
