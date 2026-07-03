"use client";

/**
 * Holder-side selective disclosure (SELECTIVE_DISCLOSURE.md §12, holder side).
 * Lives INSIDE the `(dashboard)` route group, so the auth layout already gates
 * it — the holder needs their unwrapped confidential secret `sk`, which only a
 * signed-in member can produce (via {@link useConfidentialKey}). No extra auth
 * wiring here.
 *
 * The flow composes the two Z5 read hooks with the frozen `@cluster/zk`
 * disclosure prover:
 *
 *   1. {@link useConfidentialKey} unlocks `sk` (wallet message signature).
 *   2. {@link useConfidentialTransfers} lists this account's transfers, tagged
 *      recipient/sender, once `sk` is available.
 *   3. The holder pastes the verifier's one-time request `(pR, ν)` and picks a
 *      transfer; "Generate disclosure" derives the contract-bound key set from
 *      `sk`, builds a browser prover from the vendored circuit artifact, and
 *      calls `proveRecipientDisclosure` / `proveSenderDisclosure`.
 *   4. The resulting bundle is shown as copyable JSON — it never touches the
 *      chain; the holder hands it back over their usual channel.
 */

import { useState } from "react";
import { Share2, Loader2 } from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@cluster/ui";
import {
  addressToField,
  deriveKeys,
  deriveEphemeralRE,
  proverFromArtifact,
  proveRecipientDisclosure,
  proveSenderDisclosure,
  pointCoords,
  scalarMul,
  H,
  type CircuitProver,
  type DisclosureEvent,
  type DisclosureRequest,
  type DisclosureBundle,
} from "@cluster/zk";
import { eventRef, type TransferEvent } from "@cluster/zk/chain";

import { useConfidentialKey, useConfidentialTransfers } from "@/lib/confidential";
import type { DecryptedTransfer } from "@/lib/confidential";
import { getZkRpcClient } from "@/lib/zk-rpc";
import { ensureBrowserProver } from "@/lib/bb-loader";

import discloseRecipientCircuit from "@/lib/zk-artifacts/disclose_recipient.json";
import discloseSenderCircuit from "@/lib/zk-artifacts/disclose_sender.json";

const TOKEN_CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONFIDENTIAL_TOKEN_CONTRACT_ID ?? "";

/** A chain `TransferEvent` carries the raw fields but no disclosure `ref`; the
 * disclosure prover needs {@link DisclosureEvent} (fields + `ref`). Attach the
 * source-independent {@link eventRef} so the produced bundle can name the event. */
function toDisclosureEvent(ev: TransferEvent): DisclosureEvent {
  return {
    ref: eventRef(ev),
    from: ev.from,
    to: ev.to,
    rE: ev.rE,
    sigma: ev.sigma,
    vTilde: ev.vTilde,
  };
}

export function DiscloseClient({ accountId }: { accountId: string }) {
  const { sk, status, unlock, isLoading, error: keyError } =
    useConfidentialKey(accountId);
  const { transfers } = useConfidentialTransfers(accountId, sk);

  const [requestJson, setRequestJson] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bundle, setBundle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setError(null);
    setBundle(null);
    setCopied(false);

    const row: DecryptedTransfer | undefined = transfers.find(
      (t) => t.ev.cursor === selected,
    );
    if (!row) {
      setError("Pick a transfer to disclose.");
      return;
    }
    if (sk == null) {
      setError("Unlock your confidential key first.");
      return;
    }

    let request: DisclosureRequest;
    try {
      const parsed = JSON.parse(requestJson) as DisclosureRequest;
      if (!parsed?.pR?.x || !parsed?.pR?.y || !parsed?.nu) throw new Error();
      request = parsed;
    } catch {
      setError(
        "Paste the verifier's request — it must contain pR {x,y} and nu.",
      );
      return;
    }

    setBusy(true);
    let prover: CircuitProver | undefined;
    try {
      ensureBrowserProver();
      const keys = deriveKeys(sk, addressToField(TOKEN_CONTRACT_ID));
      const event = toDisclosureEvent(row.ev);

      let result: DisclosureBundle;
      if (row.role === "recipient") {
        prover = proverFromArtifact(discloseRecipientCircuit as never);
        result = await proveRecipientDisclosure({
          keys,
          event,
          request,
          prover,
        });
      } else {
        // D-sender (§7): re-derive the ephemeral scalar from vk + the event's
        // public sigma, and read the transfer recipient's viewing key from the
        // chain (both bound into the sender-disclosure witness).
        const rEScalar = deriveEphemeralRE(keys.vk, row.ev.sigma);
        const derived = pointCoords(scalarMul(rEScalar, H));
        const rE = pointCoords(row.ev.rE);
        if (derived.x !== rE.x || derived.y !== rE.y) {
          throw new Error(
            "This transfer's R_e doesn't match your keys — it wasn't sent from this account.",
          );
        }
        const recipient = await getZkRpcClient().confidentialBalance(row.ev.to);
        if (!recipient) {
          throw new Error(
            "Transfer recipient has no confidential account on-chain.",
          );
        }
        prover = proverFromArtifact(discloseSenderCircuit as never);
        result = await proveSenderDisclosure({
          keys,
          rEScalar,
          event,
          pvkB: recipient.viewingPublicKey,
          request,
          prover,
        });
      }

      setBundle(JSON.stringify(result, null, 2));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to generate disclosure.",
      );
    } finally {
      if (prover) await prover.destroy();
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          selective disclosure
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Share2 className="size-6" /> Disclose a transfer
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Prove one confidential transfer&apos;s amount to one designated
          receiver. Paste the request they gave you, pick the transfer, and
          share the bundle back over your usual channel — it never touches the
          chain.
        </p>
      </div>

      {sk == null && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <p className="text-muted-foreground text-sm">
              Unlock this account&apos;s confidential key to list your transfers.
              You&apos;ll sign a message with your wallet — the secret stays in
              this browser.
            </p>
            <div>
              <Button onClick={() => unlock()} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Unlocking…
                  </>
                ) : (
                  "Unlock confidential key"
                )}
              </Button>
            </div>
            {status === "not-provisioned" && (
              <p className="text-muted-foreground text-xs">
                This account has no confidential key envelope for you yet.
              </p>
            )}
            {keyError && (
              <p className="text-[var(--danger)] text-xs">{keyError}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">1 · Verifier request</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            aria-label="Verifier request"
            value={requestJson}
            onChange={(e) => setRequestJson(e.target.value)}
            placeholder='{"pR":{"x":"…","y":"…"},"nu":"…"}'
            spellCheck={false}
            className="min-h-24 w-full resize-y rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 font-mono text-xs"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">2 · Pick a transfer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {sk != null && transfers.length === 0 && (
            <p className="text-muted-foreground text-xs">
              No confidential transfers yet.
            </p>
          )}
          {transfers.map((t) => (
            <label
              key={t.ev.cursor}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--hairline)] p-3 text-sm"
            >
              <input
                type="radio"
                name="transfer"
                value={t.ev.cursor}
                checked={selected === t.ev.cursor}
                onChange={() => setSelected(t.ev.cursor)}
              />
              <span className="font-mono text-xs">{t.label}</span>
              <span className="text-muted-foreground ml-auto font-mono text-[10px] uppercase">
                {t.role}
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Button onClick={generate} disabled={busy || !selected}>
        {busy ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" /> Generating proof…
          </>
        ) : (
          "Generate disclosure"
        )}
      </Button>

      {error && <p className="text-[var(--danger)] text-xs">{error}</p>}

      {bundle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">3 · Shareable bundle</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <pre
              data-testid="disclosure-bundle"
              className="max-h-64 overflow-auto rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 font-mono text-[11px]"
            >
              {bundle}
            </pre>
            <div>
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard?.writeText(bundle);
                  setCopied(true);
                }}
              >
                {copied ? "Copied" : "Copy bundle"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
