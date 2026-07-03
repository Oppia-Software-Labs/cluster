"use client";

import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";

/**
 * Dismissible footer promo slot. CHROME ONLY — content is a placeholder
 * the marketing/feature owners can replace. Renders nothing once dismissed.
 */
export function PromoCard() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <div className="relative flex flex-col gap-1.5 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setOpen(false)}
        className="text-muted-foreground hover:text-foreground absolute right-3 top-3"
      >
        <X className="size-3.5" />
      </button>
      <ShieldCheck className="size-4 text-[var(--gold)]" />
      <p className="mt-1 text-sm font-medium">Welcome to Cluster</p>
      <p className="text-muted-foreground text-xs leading-relaxed">
        Secure your Stellar assets with on-chain multisig.
      </p>
    </div>
  );
}
