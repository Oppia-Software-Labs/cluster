"use client";

import { use } from "react";

import { DiscloseClient } from "./disclose-client";

// Inside the (dashboard) route group → the auth layout protects it. The holder
// needs their unwrapped confidential sk, so a session is required here (unlike
// the public /verify page). No extra auth wiring — the group layout gates it.
export default function DisclosePage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  return <DiscloseClient accountId={accountId} />;
}
