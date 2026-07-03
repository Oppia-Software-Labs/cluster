"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AxiosError } from "axios";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button, Badge, cn } from "@cluster/ui";
import type { WrapKeyResponse } from "@cluster/shared";
import {
  generateAccountSecret,
  sealSecret,
  deriveAccountKeys,
  bytesToHex,
  hexToBytes,
} from "@cluster/zk";

import { TestnetBanner } from "@/components/confidential/testnet-banner";
import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/queries";
import { useProposeAndSign } from "@/lib/transactions.queries";
import { apiError } from "@/lib/api-error";
import { http } from "@/lib/http";
import {
  CONFIDENTIAL_TOKEN_ID,
  getMyWrapKeypair,
  primeConfidentialSession,
  useConfidentialSession,
  useConfidentialRegistration,
  useCreateRegistration,
  useWrapKey,
  usePublishWrapKey,
  proposeRegisterTx,
} from "@/lib/confidential";

const AUDITOR_ID = Number(process.env.NEXT_PUBLIC_CONFIDENTIAL_AUDITOR_ID ?? "0");

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

type WizardStep = 1 | 2 | 3;
type StepState = "done" | "active" | "future";

async function fetchWrapKey(publicKey: string): Promise<WrapKeyResponse | null> {
  try {
    const { data } = await http.get<WrapKeyResponse>(
      `/confidential/wrap-key/${publicKey}`,
    );
    return data;
  } catch (e) {
    if (e instanceof AxiosError && e.response?.status === 404) return null;
    throw e;
  }
}

function Step({
  n,
  state,
  title,
  description,
  icon: Icon,
  children,
}: {
  n: WizardStep;
  state: StepState;
  title: string;
  description: string;
  icon: typeof KeyRound;
  children?: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-3 border-b border-[var(--hairline)] pb-5 last:border-0 last:pb-0",
        state === "future" && "opacity-60",
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold",
            state === "done" &&
              "border-[var(--signal)] bg-[var(--signal)]/15 text-[var(--signal)]",
            state === "active" &&
              "border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--gold)]",
            state === "future" &&
              "border-[var(--hairline)] text-muted-foreground bg-[var(--surface)]",
          )}
        >
          {state === "done" ? (
            <CheckCircle2 className="size-4" aria-hidden />
          ) : (
            n
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <Icon
              className={cn(
                "size-4",
                state === "active"
                  ? "text-[var(--gold)]"
                  : state === "done"
                    ? "text-[var(--signal)]"
                    : "text-muted-foreground",
              )}
            />
            {title}
          </h3>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
      {state === "active" && children ? (
        <div className="ml-11 flex flex-col gap-3">{children}</div>
      ) : null}
    </li>
  );
}

function stepState(current: WizardStep, n: WizardStep): StepState {
  if (current > n) return "done";
  if (current === n) return "active";
  return "future";
}

export default function ConfidentialActivatePage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = use(params);
  const { user } = useAuth();
  const { data: account } = useAccount(accountId);
  const { data: myWrapKey, isSuccess: wrapKeyReady } = useWrapKey(
    user?.publicKey,
  );
  const { data: registration, isSuccess: regReady } =
    useConfidentialRegistration(accountId);
  const session = useConfidentialSession(accountId);
  const publishWrapKey = usePublishWrapKey();
  const createRegistration = useCreateRegistration(accountId);
  const propose = useProposeAndSign(accountId, user?.publicKey);

  const [step, setStep] = useState<WizardStep>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposed, setProposed] = useState<string | null>(null);
  const [sealedFor, setSealedFor] = useState<string[]>([]);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current || !wrapKeyReady || !regReady) return;
    bootstrapped.current = true;
    if (registration?.status === "pending") setStep(3);
    else if (myWrapKey) setStep(2);
  }, [wrapKeyReady, regReady, registration, myWrapKey]);

  async function handlePublishWrapKey() {
    if (!user?.publicKey) return;
    setError(null);
    setBusy(true);
    try {
      const wrap = await getMyWrapKeypair(user.publicKey);
      await publishWrapKey.mutateAsync({
        wrapPublicKey: bytesToHex(wrap.publicKey),
      });
      setStep(2);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleSealAndRegister() {
    if (!account || !user?.publicKey) return;
    setError(null);
    setBusy(true);
    try {
      const sk = generateAccountSecret();
      const callerPk = user.publicKey;
      const ordered = [
        ...account.members.filter((m) => m.publicKey === callerPk),
        ...account.members.filter((m) => m.publicKey !== callerPk),
      ];

      const sealed: string[] = [];

      for (const m of ordered) {
        const wrap = await fetchWrapKey(m.publicKey);
        if (!wrap) {
          if (m.publicKey === callerPk) {
            throw new Error(
              "Your wrap key is not published. Complete step 1 first.",
            );
          }
          continue;
        }
        const ciphertext = bytesToHex(
          sealSecret(sk, hexToBytes(wrap.wrapPublicKey)),
        );
        await http.put(`/confidential/accounts/${accountId}/envelopes`, {
          memberPublicKey: m.publicKey,
          ciphertext,
        });
        sealed.push(m.publicKey);
      }

      const keys = deriveAccountKeys(sk, CONFIDENTIAL_TOKEN_ID);
      await createRegistration.mutateAsync({
        tokenContract: CONFIDENTIAL_TOKEN_ID,
        auditorId: AUDITOR_ID,
        spendingPubKey: bytesToHex(keys.Y),
      });

      primeConfidentialSession(accountId, sk);
      setSealedFor(sealed);
      setStep(3);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleProposeRegistration() {
    if (!account) return;
    setError(null);

    const sk = session.sk;
    if (!sk) {
      setError(
        "Confidential key not loaded — repeat step 2 or unlock your session.",
      );
      return;
    }

    setBusy(true);
    try {
      const built = await proposeRegisterTx({
        account: account.stellarAccountId,
        sk,
        auditorId: AUDITOR_ID,
      });
      const { tx } = await propose.mutateAsync({
        type: built.type,
        xdr: built.xdr,
        thresholdLevel: built.thresholdLevel,
        confidentialOp: built.confidentialOp,
        network: "testnet",
        memo: "Confidential registration",
      });
      setProposed(tx.id);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (registration?.status === "registered") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
            confidential · activation
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            Activate confidential
          </h1>
        </div>
        <TestnetBanner />
        <section className="cl-card flex flex-col items-center gap-4 p-8 text-center">
          <div className="grid size-14 place-items-center rounded-2xl border border-[var(--signal)]/30 bg-[var(--surface)]">
            <CheckCircle2 className="size-7 text-[var(--signal)]" />
          </div>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            Already activated
          </h2>
          <p className="text-muted-foreground max-w-md text-sm">
            This account is registered on the confidential token. Open the
            confidential dashboard to deposit, transfer, and withdraw.
          </p>
          <Button
            asChild
            className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
          >
            <Link href={`/${accountId}/confidential`}>Go to confidential</Link>
          </Button>
        </section>
      </div>
    );
  }

  if (proposed) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 py-10 text-center">
        <div className="grid size-14 place-items-center rounded-2xl border border-[var(--signal)]/30 bg-[var(--surface)]">
          <CheckCircle2 className="size-7 text-[var(--signal)]" />
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold">
          Registration proposed
        </h2>
        <p className="text-muted-foreground max-w-md text-sm">
          Co-signers approve the registration in Activity. Once the medium
          threshold is met, the transaction submits on-chain and this account
          becomes confidential.
        </p>
        <p className="text-muted-foreground font-mono text-xs">
          tx {truncate(proposed)}
        </p>
        <Button
          asChild
          className="mt-2 bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
        >
          <Link href={`/${accountId}/activity`}>View activity</Link>
        </Button>
      </div>
    );
  }

  const members = account?.members ?? [];
  const step1Busy = busy || publishWrapKey.isPending;
  const step2Busy = busy || createRegistration.isPending;
  const step3Busy = busy || propose.isPending;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          confidential · activation
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Activate confidential
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Provision a confidential account key, seal it for each signer, and
          propose on-chain registration for co-signer approval.
        </p>
      </div>

      <TestnetBanner />

      <ol className="cl-card flex list-none flex-col gap-5 p-5">
        <Step
          n={1}
          state={stepState(step, 1)}
          title="Publish your wrap key"
          description="Sign a message with your wallet to derive an X25519 key used to unwrap your copy of the account secret."
          icon={KeyRound}
        >
          <Button
            disabled={!user?.publicKey || step1Busy}
            onClick={handlePublishWrapKey}
            className="self-start bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
          >
            {step1Busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Publishing…
              </>
            ) : (
              <>
                <KeyRound className="size-4" /> Publish wrap key
              </>
            )}
          </Button>
        </Step>

        <Step
          n={2}
          state={stepState(step, 2)}
          title="Generate & seal the account key"
          description="Create a fresh account secret in-browser, seal a copy for each signer with a published wrap key, and record the spending public key."
          icon={ShieldCheck}
        >
          <Button
            disabled={!account || step < 2 || step2Busy}
            onClick={handleSealAndRegister}
            className="self-start bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
          >
            {step2Busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Sealing & registering…
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" /> Generate & seal
              </>
            )}
          </Button>

          {members.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {members.map((m) => {
                const sealed = sealedFor.includes(m.publicKey);
                return (
                  <li
                    key={m.publicKey}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3 py-2"
                  >
                    <span className="truncate font-mono text-xs">
                      {truncate(m.publicKey)}
                    </span>
                    {sealedFor.length > 0 ? (
                      sealed ? (
                        <Badge
                          variant="outline"
                          className="border-[var(--signal)]/40 text-[var(--signal)]"
                        >
                          will receive key
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-[var(--hairline)] text-muted-foreground"
                        >
                          pending — grant later
                        </Badge>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </Step>

        <Step
          n={3}
          state={stepState(step, 3)}
          title="Propose registration"
          description="Prove key well-formedness in-browser and propose the confidential register operation for multisig approval."
          icon={ShieldCheck}
        >
          <Button
            disabled={!account || step < 3 || step3Busy}
            onClick={handleProposeRegistration}
            className="self-start bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
          >
            {step3Busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Proving & proposing…
              </>
            ) : (
              <>
                <ShieldCheck className="size-4" /> Propose registration
              </>
            )}
          </Button>
        </Step>
      </ol>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
