import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LexAI — Adversarial Legal Intelligence",
  description:
    "Build, attack, and harden Indian legal documents using GAN-inspired adversarial AI. Two agents compete to make your contracts bulletproof.",
  keywords: [
    "legal AI",
    "adversarial AI",
    "document analysis",
    "Indian law",
    "contract review",
    "loophole detection",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <div className="lexai-gradient-bg" />
        {children}
      </body>
    </html>
  );
}
