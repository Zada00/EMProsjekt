import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tilstandsrapport-copilot",
  description: "Trekker ut TG-avvik og nøkkelinfo fra tilstandsrapporter.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
