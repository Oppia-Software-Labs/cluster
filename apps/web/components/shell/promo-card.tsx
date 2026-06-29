"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Card } from "@cluster/ui";

/**
 * Dismissible footer promo slot. CHROME ONLY — content is a placeholder
 * the marketing/feature owners can replace. Renders nothing once dismissed.
 */
export function PromoCard() {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  return (
    <Card className="relative gap-2 p-4">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setOpen(false)}
        className="text-muted-foreground hover:text-foreground absolute top-3 right-3"
      >
        <X className="size-4" />
      </button>
      <p className="text-sm font-medium">Welcome to Cluster</p>
      <p className="text-muted-foreground text-xs">
        Secure your Stellar assets with multisig.
      </p>
    </Card>
  );
}
