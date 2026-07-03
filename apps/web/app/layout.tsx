import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Cluster — multisig treasury on Stellar",
  description: "Multisig and treasury management platform for Stellar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // suppressHydrationWarning on <html>: the Stellar Wallets Kit injects its
  // `--swk-*` theme CSS variables onto <html> on the client, which the server
  // HTML can't match. Benign third-party root theming (same pattern next-themes
  // uses); this suppresses only the <html> attribute mismatch one level deep.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Satoshi (Fontshare) — a clean, minimal grotesque for the whole UI. */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
