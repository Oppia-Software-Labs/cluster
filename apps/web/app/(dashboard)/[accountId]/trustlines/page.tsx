"use client";

import { use, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Link2, Loader2 } from "lucide-react";
import { StrKey } from "@stellar/stellar-sdk";

import { Button, Input } from "@cluster/ui";

import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/queries";
import { useBalances } from "@/lib/assets.queries";
import { useProposeAndSign } from "@/lib/transactions.queries";
import { buildTrustlineXdr } from "@/lib/transactions/build-trustline";
import { apiError } from "@/lib/api-error";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;
// Classic asset codes: 1–12 alphanumeric characters.
const CODE_RE = /^[a-zA-Z0-9]{1,12}$/;

export default function TrustlinesPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { user } = useAuth();
  const { data: account } = useAccount(accountId);
  const { data: balancesData } = useBalances(accountId);
  const propose = useProposeAndSign(accountId, user?.publicKey);

  const [code, setCode] = useState("");
  const [issuer, setIssuer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<{ id: string; signed: boolean } | null>(
    null,
  );

  const trustlines = (balancesData?.balances ?? []).filter((b) => b.assetIssuer);
  const codeValid = CODE_RE.test(code.trim());
  const issuerValid = StrKey.isValidEd25519PublicKey(issuer.trim());
  const alreadyTrusted = trustlines.some(
    (t) => t.assetCode === code.trim() && t.assetIssuer === issuer.trim(),
  );
  const canSubmit =
    Boolean(account) &&
    codeValid &&
    issuerValid &&
    !alreadyTrusted &&
    !propose.isPending;

  async function submit() {
    if (!account) return;
    setError(null);
    try {
      const built = await buildTrustlineXdr({
        source: account.stellarAccountId,
        assetCode: code.trim(),
        assetIssuer: issuer.trim(),
      });
      const { tx, signed } = await propose.mutateAsync({
        type: built.type,
        xdr: built.xdr,
        thresholdLevel: built.thresholdLevel,
        memo: `Trust ${code.trim()} ${truncate(issuer.trim())}`,
      });
      setProposed({ id: tx.id, signed });
      setCode("");
      setIssuer("");
    } catch (e) {
      setError(apiError(e));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          assets
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Trustlines
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Trustlines let this account hold issued assets. Adding one is a
          medium-threshold multisig operation and reserves 0.5 XLM.
        </p>
      </div>

      {/* Propose a new trustline */}
      <section className="cl-card flex flex-col gap-4 p-5">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          <Link2 className="size-4 text-[var(--gold)]" /> Add a trustline
        </h2>

        {proposed && (
          <div className="flex items-start gap-2 rounded-xl border border-[var(--signal)]/30 bg-[var(--surface)] p-3 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--signal)]" />
            <span className="text-muted-foreground">
              Trustline proposed{proposed.signed ? " and signed" : ""} (tx{" "}
              <span className="font-mono">{truncate(proposed.id)}</span>). It
              submits automatically once the threshold is met — track it from{" "}
              <Link
                href={`/${accountId}/activity`}
                className="text-[var(--gold)] underline"
              >
                Activity
              </Link>
              .
            </span>
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="flex w-full flex-col gap-1.5 sm:w-40">
            <span className="text-sm font-medium">Asset code</span>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="USDC"
              maxLength={12}
              spellCheck={false}
              className="font-mono"
              aria-invalid={code.length > 0 && !codeValid}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium">Issuer</span>
            <Input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="G…"
              spellCheck={false}
              className="font-mono text-xs"
              aria-invalid={issuer.length > 0 && !issuerValid}
            />
          </label>
        </div>
        {code.length > 0 && !codeValid && (
          <p className="text-destructive text-xs">
            Asset codes are 1–12 letters or digits.
          </p>
        )}
        {issuer.length > 0 && !issuerValid && (
          <p className="text-destructive text-xs">
            Not a valid Stellar public key.
          </p>
        )}
        {alreadyTrusted && (
          <p className="text-destructive text-xs">
            This account already trusts that asset.
          </p>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button
          disabled={!canSubmit}
          onClick={submit}
          className="self-start bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
        >
          {propose.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Proposing…
            </>
          ) : (
            <>
              <Link2 className="size-4" /> Propose trustline
            </>
          )}
        </Button>
      </section>

      {/* Existing trustlines */}
      <section className="cl-card p-5">
        <header>
          <h2 className="text-sm font-medium">Current trustlines</h2>
          <p className="text-muted-foreground font-mono text-[11px]">
            {trustlines.length} asset{trustlines.length === 1 ? "" : "s"} trusted
          </p>
        </header>
        {trustlines.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            Only native XLM so far — propose a trustline above to hold issued
            assets.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {trustlines.map((t) => (
              <li
                key={`${t.assetCode}:${t.assetIssuer}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] bg-[var(--surface-2)] font-[family-name:var(--font-display)] text-[11px] font-bold text-[var(--gold)]"
                  aria-hidden
                >
                  {t.assetCode.slice(0, 3)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{t.assetCode}</span>
                  <span className="text-muted-foreground truncate font-mono text-[11px]">
                    {t.assetIssuer && truncate(t.assetIssuer)}
                  </span>
                </div>
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {Number(t.amount).toLocaleString(undefined, {
                    maximumFractionDigits: 4,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
