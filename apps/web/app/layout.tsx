import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Cluster",
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
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
