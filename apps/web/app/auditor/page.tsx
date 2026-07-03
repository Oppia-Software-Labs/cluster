import type { Metadata } from "next";

import { AuditorClient } from "./auditor-client";

// Top-level route (sibling of (dashboard)) → no dashboard auth gate, no user
// session, no wallet. Access is gated instead by the auditor SECRET (env for
// the demo, else pasted). Read-only: only RPC reads + local decryption
// (SELECTIVE_DISCLOSURE.md §6.7). The secret never leaves the browser.
export const metadata: Metadata = {
  title: "Auditor — Cluster",
  description: "Auditor console: decrypt all confidential transfers (read-only).",
};

export default function AuditorPage() {
  return <AuditorClient />;
}
