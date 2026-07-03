"use client";

/**
 * Public disclosure verifier (SELECTIVE_DISCLOSURE.md §5.3 / §12). This page
 * NEVER connects a wallet, reads a session cookie, or imports `useAuth`: the
 * verifier is any third party (compliance desk, tax authority, KYC provider)
 * with a browser and an RPC endpoint. It:
 *
 *   1. Mints a long-lived Grumpkin keypair (r_R kept in localStorage) and a
 *      one-time request `(P_R, ν)` to hand to the account holder.
 *   2. Takes the bundle the holder pastes back, resolves the referenced event
 *      + the disclosing account's viewing key straight from the chain (never
 *      trusting the bundle for anything but `R_disc` / `ṽ_disc`, §5.2), pins the
 *      circuit's audited VK, verifies the UltraHonk proof, and decrypts the
 *      amount sealed to this browser's key.
 *
 * The `verifyDisclosure` in `@cluster/zk` does NO RPC — it takes a fully
 * resolved `ctx`. All chain reads happen here via `getZkRpcClient()` (the single
 * wallet-free RPC entry point).
 */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, ShieldCheck, Loader2, Copy } from "lucide-react";

import { Button, Card, CardContent, CardHeader, CardTitle } from "@cluster/ui";
import {
  addressToField,
  generateRecipientKeys,
  recipientKeysFromSecret,
  newDisclosureRequest,
  proverFromArtifact,
  verifyDisclosure,
  DisclosureVerifyError,
  pointFromJson,
  toHex32,
  fromHex,
  DISCLOSE_SENDER_CIRCUIT_ID,
  type CircuitProver,
  type RecipientKeys,
  type DisclosureRequest,
  type DisclosureBundle,
  type DisclosureCircuitId,
} from "@cluster/zk";
import { hybridResolveEventRef, type TransferEvent } from "@cluster/zk/chain";

import { getZkRpcClient } from "@/lib/zk-rpc";
import { ensureBrowserProver } from "@/lib/bb-loader";

import discloseRecipientCircuit from "@/lib/zk-artifacts/disclose_recipient.json";
import discloseRecipientVk from "@/lib/zk-artifacts/disclose_recipient.vk.json";
import discloseSenderCircuit from "@/lib/zk-artifacts/disclose_sender.json";
import discloseSenderVk from "@/lib/zk-artifacts/disclose_sender.vk.json";

const RR_KEY = "cluster:disclosure:rR";
const REQUEST_KEY = "cluster:disclosure:request";

/** Shared artifacts (§5.5) by circuit_id — the pasted bundle picks which loads. */
const ARTIFACTS: Record<
  DisclosureCircuitId,
  { circuit: unknown; vk: { vkBase64: string } }
> = {
  disclose_recipient: {
    circuit: discloseRecipientCircuit,
    vk: discloseRecipientVk,
  },
  disclose_sender: { circuit: discloseSenderCircuit, vk: discloseSenderVk },
};

/** base64 `vkBase64` → raw VK bytes, browser-safe (no node:fs, no Buffer). */
function vkBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** stroops (bigint, 7 dp) → human XLM string. */
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

/** Port of the demo's bundle validator — throws on any malformed field. */
function parseBundle(json: string): DisclosureBundle {
  let b: unknown;
  try {
    b = JSON.parse(json);
  } catch {
    throw new Error("bundle is not valid JSON");
  }
  const bundle = b as DisclosureBundle;
  if (
    !bundle?.circuitId ||
    !(bundle.circuitId in ARTIFACTS) ||
    !bundle?.refE?.id ||
    typeof bundle.refE.ledger !== "number" ||
    !bundle?.refE?.txHash ||
    !bundle?.proof ||
    !bundle?.rDisc?.x ||
    !bundle?.rDisc?.y ||
    !bundle?.vTildeDisc
  ) {
    throw new Error(
      "bundle must contain circuitId, refE {ledger,id,txHash}, proof, rDisc {x,y}, vTildeDisc",
    );
  }
  return bundle;
}

type Result =
  | {
      ok: true;
      amountStroops: bigint;
      discloser: string;
      role: "recipient" | "sender";
      txHash: string;
      ledger: number;
    }
  | { ok: false; stage: string; message: string };

export function VerifyClient() {
  const [keys, setKeys] = useState<RecipientKeys | null>(null);
  const [request, setRequest] = useState<DisclosureRequest | null>(null);
  const [blob, setBlob] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // Long-lived receiver identity + last issued request, both local-only.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedRr = localStorage.getItem(RR_KEY);
    const k = storedRr
      ? recipientKeysFromSecret(fromHex(storedRr))
      : generateRecipientKeys();
    if (!storedRr) localStorage.setItem(RR_KEY, toHex32(k.rR));
    setKeys(k);

    const storedReq = localStorage.getItem(REQUEST_KEY);
    let req: DisclosureRequest | null = null;
    if (storedReq) {
      try {
        const parsed = JSON.parse(storedReq) as DisclosureRequest;
        // A request minted under a previous identity can't be verified anymore.
        if (parsed.pR.x === k.pR.x && parsed.pR.y === k.pR.y) req = parsed;
      } catch {
        req = null;
      }
    }
    if (!req) {
      req = newDisclosureRequest(k);
      localStorage.setItem(REQUEST_KEY, JSON.stringify(req));
    }
    setRequest(req);
  }, []);

  const mintRequest = useCallback(() => {
    if (!keys) return;
    const req = newDisclosureRequest(keys);
    localStorage.setItem(REQUEST_KEY, JSON.stringify(req));
    setRequest(req);
    setResult(null);
  }, [keys]);

  const onVerify = useCallback(async () => {
    if (!keys || !request) return;
    setResult(null);
    setBusy(true);
    let prover: CircuitProver | undefined;
    try {
      ensureBrowserProver();
      const bundle = parseBundle(blob);
      const client = getZkRpcClient();

      // §5.3 steps 1–3 — resolve the on-chain event + disclosing PVK(s) here;
      // verifyDisclosure itself does NO RPC.
      const ev = await hybridResolveEventRef(client, undefined, bundle.refE);
      if (!ev || ev.type !== "transfer") {
        throw new DisclosureVerifyError(
          "resolve-event",
          "referenced event is not a resolvable confidential transfer",
        );
      }
      const transfer = ev as TransferEvent;
      const isSender = bundle.circuitId === DISCLOSE_SENDER_CIRCUIT_ID;

      // Disclosing account: E.to for D-recipient, E.from for D-sender.
      const disclosingAccount = isSender ? transfer.from : transfer.to;
      const accA = await client.confidentialBalance(disclosingAccount);
      if (!accA) {
        throw new DisclosureVerifyError(
          "resolve-account",
          "disclosing account is not registered on the confidential token",
        );
      }
      // D-sender additionally binds the transfer recipient's PVK_B (E.to).
      let pvkB;
      if (isSender) {
        const accB = await client.confidentialBalance(transfer.to);
        if (!accB) {
          throw new DisclosureVerifyError(
            "resolve-account",
            "transfer recipient is not registered on the confidential token",
          );
        }
        pvkB = accB.viewingPublicKey;
      }

      const { circuit, vk } = ARTIFACTS[bundle.circuitId];
      prover = proverFromArtifact(circuit as never);

      const verified = await verifyDisclosure(bundle, {
        addrF: addressToField(client.cfg.contracts.token),
        rE: transfer.rE,
        sigma: transfer.sigma,
        vTilde: transfer.vTilde,
        pvkA: accA.viewingPublicKey,
        pvkB,
        pinnedVk: vkBytes(vk.vkBase64),
        disclosingAccount,
        request,
        keys,
        prover,
      });

      setResult({
        ok: true,
        amountStroops: verified.amount,
        discloser: verified.disclosingAccount,
        role: verified.role,
        txHash: transfer.txHash,
        ledger: transfer.ledger,
      });
    } catch (e) {
      // Per the verifier protocol, a bundle that fails any step reveals nothing.
      if (e instanceof DisclosureVerifyError) {
        setResult({ ok: false, stage: e.stage, message: e.message });
      } else {
        setResult({
          ok: false,
          stage: "parse",
          message: e instanceof Error ? e.message : "Malformed disclosure bundle.",
        });
      }
    } finally {
      if (prover) await prover.destroy();
      setBusy(false);
    }
  }, [keys, request, blob]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          public verifier
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldCheck className="size-6" /> Verify a disclosure
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Paste a disclosure bundle to confirm what a single confidential transfer
          paid. Verification runs entirely in your browser against on-chain
          commitments — no wallet, no sign-in.
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--hairline)] bg-[var(--surface)]/60 p-4">
        <p className="text-muted-foreground text-xs leading-relaxed">
          <span className="text-foreground">Testnet · unaudited.</span> This
          confidential token runs on Stellar testnet using unaudited contracts. Do
          not use for real value.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Your disclosure request</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-xs leading-relaxed">
            Hand this to the account holder. They paste it into their wallet to
            produce a bundle. The nonce is one-time and the disclosed value is
            readable only with this browser&apos;s key.
          </p>
          {request && (
            <textarea
              aria-label="Disclosure request"
              readOnly
              spellCheck={false}
              value={JSON.stringify(request, null, 2)}
              className="min-h-28 w-full resize-y rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 font-mono text-xs"
            />
          )}
          <div>
            <Button variant="outline" onClick={mintRequest} disabled={!keys}>
              <Copy className="mr-2 size-4" /> New request (fresh nonce)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Disclosure bundle</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <textarea
            aria-label="Disclosure bundle"
            value={blob}
            onChange={(e) => setBlob(e.target.value)}
            placeholder='{"circuitId":"disclose_recipient", ... }'
            spellCheck={false}
            className="min-h-40 w-full resize-y rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 font-mono text-xs"
          />
          <Button
            onClick={onVerify}
            disabled={busy || !request || blob.trim().length === 0}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Verifying…
              </>
            ) : (
              "Verify"
            )}
          </Button>
        </CardContent>
      </Card>

      {result?.ok && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <div className="flex items-center gap-2 text-[var(--signal)]">
              <CheckCircle2 className="size-5" />
              <span className="font-semibold">Disclosure verified</span>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Amount</dt>
              <dd
                className="font-mono font-semibold"
                data-testid="disclosed-amount"
              >
                {formatXlm(result.amountStroops)} XLM
              </dd>
              <dt className="text-muted-foreground">Disclosed by</dt>
              <dd className="break-all font-mono text-xs">{result.discloser}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-mono text-xs">{result.role}</dd>
              <dt className="text-muted-foreground">Transaction</dt>
              <dd className="break-all font-mono text-xs">{result.txHash}</dd>
              <dt className="text-muted-foreground">Ledger</dt>
              <dd className="font-mono text-xs">{result.ledger}</dd>
            </dl>
          </CardContent>
        </Card>
      )}

      {result && !result.ok && (
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-[var(--danger)]">
            <XCircle className="size-5" />
            <div>
              <p className="font-semibold">Not verified</p>
              <p className="text-muted-foreground text-xs">
                {result.stage}: {result.message}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
