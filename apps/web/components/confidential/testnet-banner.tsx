import { AlertTriangle } from "lucide-react";

/** Persistent testnet/unaudited notice rendered on every confidential surface. */
export function TestnetBanner() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--gold)]" />
      <p className="text-muted-foreground">
        <span className="font-semibold text-foreground">Testnet · unaudited.</span>{" "}
        Confidential accounts run on Stellar testnet against unaudited contracts.
        Do not use real funds.
      </p>
    </div>
  );
}
