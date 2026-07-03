"use client";

/**
 * Auditor console (DESIGN.md §8 / SELECTIVE_DISCLOSURE.md §6.7). A top-level
 * route (sibling of `(dashboard)`) — NOT auth-gated, no wallet, no user session,
 * no TanStack Query. Access is gated ONLY by the auditor secret `k` (a Grumpkin
 * scalar): read from `NEXT_PUBLIC_CONFIDENTIAL_AUDITOR_SECRET_HEX` for the demo,
 * else pasted into the gate. The secret NEVER leaves the browser and is NEVER
 * transmitted anywhere — every event is fetched read-only over the RPC and
 * decrypted locally with `auditTransfer` / `auditWithdraw`.
 *
 * Public + wallet-free by construction, exactly like /verify: this component
 * imports neither `useAuth` nor the wallet kit, and renders with no provider in
 * the tree.
 */

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@cluster/ui";
import { fromHex } from "@cluster/zk";
import { hybridFetchEvents, auditTransfer, auditWithdraw } from "@cluster/zk/chain";

import { getZkRpcClient } from "@/lib/zk-rpc";

type Row = {
  kind: "transfer" | "withdraw";
  txHash: string;
  ledger: number;
  amount: string;
};

/** stroops (bigint, 7 dp) → human XLM string. Mirrors /verify's formatter. */
export function formatXlm(stroops: bigint): string {
  const STROOPS_PER_XLM = BigInt(10_000_000);
  const neg = stroops < BigInt(0);
  const abs = neg ? -stroops : stroops;
  const whole = abs / STROOPS_PER_XLM;
  const frac = (abs % STROOPS_PER_XLM)
    .toString()
    .padStart(7, "0")
    .replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

export function AuditorClient() {
  // Demo default: secret from env. Real deployment: it lives in the auditor's
  // own vault. When present, auto-unlock (no gate) on the first audit.
  const envSecret =
    process.env.NEXT_PUBLIC_CONFIDENTIAL_AUDITOR_SECRET_HEX ?? "";
  const [secretHex, setSecretHex] = useState(envSecret);
  const [unlocked, setUnlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function audit(hex: string) {
    setError(null);
    setBusy(true);
    try {
      // Parse the hex auditor secret to the Grumpkin scalar `k`. Never sent
      // anywhere — used only for local ECDH against each event's ephemeral key.
      const k = fromHex(hex.trim());
      const client = getZkRpcClient();
      // fromLedger: 0 lets the RPC clamp to its oldest served ledger.
      const { events } = await hybridFetchEvents(client, undefined, {
        fromLedger: 0,
      });

      const out: Row[] = [];
      for (const ev of events) {
        if (ev.type === "transfer") {
          const { amount } = auditTransfer(k, ev);
          out.push({
            kind: "transfer",
            txHash: ev.txHash,
            ledger: ev.ledger,
            amount: formatXlm(amount),
          });
        } else if (ev.type === "withdraw") {
          // The withdrawn amount is public in the event; auditWithdraw only
          // recovers the post-withdrawal balance checkpoint (unused here).
          auditWithdraw(k, ev);
          out.push({
            kind: "withdraw",
            txHash: ev.txHash,
            ledger: ev.ledger,
            amount: formatXlm(ev.amount),
          });
        }
      }
      setRows(out);
      setUnlocked(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to audit — check the secret.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!unlocked) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
            auditor console
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
            <KeyRound className="size-6" /> Auditor access
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Decrypt every confidential transfer of this token. Requires the
            auditor secret — it stays in this browser and is never transmitted.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--hairline)] bg-[var(--surface)]/60 p-4">
          <p className="text-muted-foreground text-xs leading-relaxed">
            <span className="text-foreground">Testnet · unaudited.</span> This
            confidential token runs on Stellar testnet using unaudited
            contracts. Do not use for real value.
          </p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <input
              type="password"
              aria-label="Auditor secret"
              value={secretHex}
              onChange={(e) => setSecretHex(e.target.value)}
              placeholder="auditor secret (hex)"
              className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 font-mono text-xs"
            />
            <Button
              onClick={() => audit(secretHex)}
              disabled={busy || secretHex.trim().length === 0}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Auditing…
                </>
              ) : (
                "Unlock & audit"
              )}
            </Button>
            {error && <p className="text-[var(--danger)] text-xs">{error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>

      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--hairline)] bg-[var(--surface)]/60 p-4">
        <p className="text-muted-foreground text-xs leading-relaxed">
          <span className="text-foreground">Testnet · unaudited.</span> Decrypted
          locally with the auditor secret; nothing was transmitted.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">All decrypted transfers</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-left font-mono text-[10px] uppercase">
                <th className="p-2">Kind</th>
                <th className="p-2">Tx</th>
                <th className="p-2">Ledger</th>
                <th className="p-2 text-right">Amount (XLM)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.txHash}-${r.ledger}-${r.kind}`}
                  className="border-t border-[var(--hairline)]"
                  data-testid="audit-row"
                >
                  <td className="p-2 font-mono text-xs">{r.kind}</td>
                  <td className="p-2 break-all font-mono text-xs">{r.txHash}</td>
                  <td className="p-2 font-mono text-xs">{r.ledger}</td>
                  <td className="p-2 text-right font-mono">{r.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="text-muted-foreground p-2 text-xs">
              No transfers found.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
