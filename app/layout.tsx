import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaultAI Billing Service",
  description: "Service de gestion de facturation pour VaultAI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
