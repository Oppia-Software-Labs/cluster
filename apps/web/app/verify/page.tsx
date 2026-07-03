import type { Metadata } from "next";

import { VerifyClient } from "./verify-client";

// PUBLIC route. Lives at app/verify — a SIBLING of the (dashboard) route group,
// so the auth gate in (dashboard) never runs for it. No wallet, no useAuth, no
// cookie: a KYC/compliance counterparty opens this with browser + RPC only.
export const metadata: Metadata = {
  title: "Verify disclosure — Cluster",
  description: "Publicly verify a confidential transfer disclosure in-browser.",
};

export default function VerifyPage() {
  return <VerifyClient />;
}
