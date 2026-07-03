"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Send,
} from "lucide-react";
import { Button, Badge } from "@cluster/ui";

import { TestnetBanner } from "@/components/confidential/testnet-banner";
import { GrantAccessButton } from "@/components/confidential/grant-access-button";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/queries";
import { useProposeAndSign } from "@/lib/transactions.queries";
import { apiError } from "@/lib/api-error";
import {
  getConfidentialChainClient,
  proposeMergeTx,
  stroopsToXlm,
  useAdvanceRegistration,
  useConfidentialRegistration,
  useConfidentialSession,
  useConfidentialSync,
  useKeyEnvelopes,
} from "@/lib/confidential";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

export default function ConfidentialPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { user } = useAuth();
  const { data: account } = useAccount(accountId);
  const { data: registration, isSuccess: regReady } =
    useConfidentialRegistration(accountId);
  const session = useConfidentialSession(accountId);
  const sync = useConfidentialSync(
    accountId,
    session.status === "unlocked" ? session.sk : null,
  );
  const { data: envelopes } = useKeyEnvelopes(accountId);
  const advanceRegistration = useAdvanceRegistration(accountId);
  const propose = useProposeAndSign(accountId, user?.publicKey);

  const [mergeBusy, setMergeBusy] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeProposed, setMergeProposed] = useState(false);
  const advancedRef = useRef(false);

  const envelopeKeys = new Set(
    (envelopes ?? []).map((e) => e.memberPublicKey),
  );

  useEffect(() => {
    if (advancedRef.current) return;
    if (!registration || registration.status !== "pending") return;
    if (!account?.stellarAccountId) return;

    const address = account.stellarAccountId;

    if (sync.data?.verified) {
      advancedRef.current = true;
      advanceRegistration.mutate({ status: "registered" });
      return;
    }

    let cancelled = false;
    getConfidentialChainClient()
      .isRegistered(address)
      .then((registered) => {
        if (cancelled || advancedRef.current) return;
        if (registered) {
          advancedRef.current = true;
          advanceRegistration.mutate({ status: "registered" });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    registration,
    sync.data?.verified,
    account?.stellarAccountId,
    advanceRegistration,
  ]);

  async function handleMerge() {
    if (!account) return;
    setMergeError(null);
    setMergeBusy(true);
    try {
      const built = await proposeMergeTx({ account: account.stellarAccountId });
      await propose.mutateAsync({
        type: built.type,
        xdr: built.xdr,
        thresholdLevel: built.thresholdLevel,
        confidentialOp: built.confidentialOp,
        network: "testnet",
        memo: "Confidential merge",
      });
      setMergeProposed(true);
    } catch (e) {
      setMergeError(apiError(e));
    } finally {
      setMergeBusy(false);
    }
  }

  if (regReady && !registration) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
            confidential
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            Confidential
          </h1>
        </div>
        <section className="cl-card flex flex-col items-center gap-4 p-8 text-center">
          <div className="grid size-14 place-items-center rounded-2xl border border-[var(--gold)]/30 bg-[var(--surface)]">
            <LockKeyhole className="size-7 text-[var(--gold)]" />
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            This account is not confidential yet
          </h2>
          <p className="text-muted-foreground max-w-md text-sm">
            Activate confidential balances to deposit, transfer privately, and
            withdraw back to classic XLM.
          </p>
          <Button
            asChild
            className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
          >
            <Link href={`/${accountId}/confidential/activate`}>
              Activate confidential
            </Link>
          </Button>
        </section>
      </div>
    );
  }

  const unlocked = session.status === "unlocked" && session.sk != null;
  const receiving = sync.data?.receiving.v ?? BigInt(0);
  const hasReceiving = receiving > BigInt(0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          confidential
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Confidential
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Private balances on the confidential token — unlock to sync, transfer,
          and withdraw.
        </p>
      </div>

      <TestnetBanner />

      {!unlocked ? (
        <section className="cl-card flex flex-col gap-4 p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-medium">
            <LockKeyhole className="size-4 text-[var(--gold)]" />
            Unlock confidential key
          </h2>
          {session.status === "not-provisioned" ? (
            <p className="text-muted-foreground text-sm">
              You don&apos;t hold this account&apos;s confidential key yet. Ask a
              member to grant you access once another signer has unlocked.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                Sign a message with your wallet to decrypt your copy of the
                account secret. The key stays in this browser only.
              </p>
              <Button
                disabled={session.status === "unlocking"}
                onClick={() => session.unlock()}
                className="self-start bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
              >
                {session.status === "unlocking" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Unlocking…
                  </>
                ) : (
                  <>
                    <LockKeyhole className="size-4" /> Unlock
                  </>
                )}
              </Button>
            </>
          )}
          {session.error ? (
            <p className="text-destructive text-sm">{session.error}</p>
          ) : null}
        </section>
      ) : (
        <>
          <section className="cl-card flex flex-col gap-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-medium">Balances</h2>
              <button
                type="button"
                onClick={() => sync.refetch()}
                disabled={sync.isFetching}
                className="text-muted-foreground hover:text-foreground rounded-lg p-1.5 transition-colors disabled:opacity-50"
                aria-label="Refresh balances"
              >
                <RefreshCw
                  className={`size-3.5 ${sync.isFetching ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {sync.isLoading ? (
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Syncing from chain…
              </div>
            ) : sync.data ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs font-medium">
                      Spendable
                    </span>
                    <span className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">
                      {stroopsToXlm(sync.data.spendable.v)}
                      <span className="text-muted-foreground ml-1 text-sm font-normal">
                        XLM
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground text-xs font-medium">
                      Receiving
                    </span>
                    <span className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">
                      {stroopsToXlm(sync.data.receiving.v)}
                      <span className="text-muted-foreground ml-1 text-sm font-normal">
                        XLM
                      </span>
                    </span>
                  </div>
                </div>
                {sync.lastSyncedAt > 0 ? (
                  <p className="text-muted-foreground font-mono text-[11px]">
                    Last synced{" "}
                    {new Date(sync.lastSyncedAt).toLocaleTimeString()}
                  </p>
                ) : null}
                {registration?.status === "pending" ? (
                  <p className="text-[var(--gold)] text-xs">
                    Awaiting on-chain registration.
                  </p>
                ) : sync.data.verified === false ? (
                  <p className="text-amber-600 text-xs dark:text-amber-400">
                    Local state does not match the on-chain commitments — events
                    may be outside the RPC retention window.
                  </p>
                ) : null}
              </>
            ) : sync.error ? (
              <p className="text-destructive text-sm">
                {sync.error instanceof Error
                  ? sync.error.message
                  : "Failed to sync confidential state."}
              </p>
            ) : null}
          </section>

          {hasReceiving ? (
            <section className="cl-card flex flex-col gap-4 p-5">
              {mergeProposed ? (
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--signal)]" />
                  <span className="text-muted-foreground">
                    Merge proposed — see{" "}
                    <Link
                      href={`/${accountId}/activity`}
                      className="text-[var(--gold)] underline"
                    >
                      Activity
                    </Link>
                    .
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-sm">
                    You have{" "}
                    <span className="font-semibold tabular-nums">
                      {stroopsToXlm(receiving)} XLM
                    </span>{" "}
                    waiting to consolidate.
                  </p>
                  {mergeError ? (
                    <p className="text-destructive text-sm">{mergeError}</p>
                  ) : null}
                  <Button
                    disabled={mergeBusy || propose.isPending}
                    onClick={handleMerge}
                    className="self-start bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
                  >
                    {mergeBusy || propose.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Proposing…
                      </>
                    ) : (
                      "Propose merge"
                    )}
                  </Button>
                </>
              )}
            </section>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href={`/${accountId}/confidential/deposit`}
              className="cl-card flex flex-col gap-2 p-4 transition-colors hover:border-[var(--gold)]/40"
            >
              <ArrowDownToLine className="size-5 text-[var(--gold)]" />
              <span className="text-sm font-medium">Deposit</span>
              <span className="text-muted-foreground text-xs">
                Fund from classic XLM
              </span>
            </Link>
            <Link
              href={`/${accountId}/confidential/transfer`}
              className="cl-card flex flex-col gap-2 p-4 transition-colors hover:border-[var(--gold)]/40"
            >
              <Send className="size-5 text-[var(--gold)]" />
              <span className="text-sm font-medium">Transfer</span>
              <span className="text-muted-foreground text-xs">
                Private confidential send
              </span>
            </Link>
            <Link
              href={`/${accountId}/confidential/withdraw`}
              className="cl-card flex flex-col gap-2 p-4 transition-colors hover:border-[var(--gold)]/40"
            >
              <ArrowUpFromLine className="size-5 text-[var(--gold)]" />
              <span className="text-sm font-medium">Withdraw</span>
              <span className="text-muted-foreground text-xs">
                Return to public balance
              </span>
            </Link>
          </div>

          <section className="cl-card flex flex-col gap-4 p-5">
            <header>
              <h2 className="text-sm font-medium">Members</h2>
              <p className="text-muted-foreground text-xs">
                Grant confidential key access to co-signers who were not sealed
                during activation.
              </p>
            </header>
            {(account?.members ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">No members listed.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(account?.members ?? []).map((m) => {
                  const isSelf = m.publicKey === user?.publicKey;
                  const hasEnvelope = envelopeKeys.has(m.publicKey);
                  return (
                    <li
                      key={m.publicKey}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-mono text-xs">
                          {truncate(m.publicKey)}
                        </span>
                        {isSelf ? (
                          <Badge
                            variant="outline"
                            className="border-[var(--gold)]/40 text-[var(--gold)]"
                          >
                            you
                          </Badge>
                        ) : null}
                      </div>
                      {isSelf ? null : hasEnvelope ? (
                        <Badge
                          variant="outline"
                          className="border-[var(--signal)]/40 text-[var(--signal)]"
                        >
                          <Check className="size-3" />
                          has key
                        </Badge>
                      ) : (
                        <GrantAccessButton
                          accountId={accountId}
                          memberPublicKey={m.publicKey}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
