"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { StrKey } from "@stellar/stellar-sdk";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@cluster/ui";
import type { AccountThresholds } from "@cluster/shared";

import { useAuth } from "@/lib/auth";
import { useCreateAccount } from "@/lib/queries";
import {
  createMultisigOnChain,
  suggestedStartingBalance,
} from "@/lib/accounts/create-multisig";

type Step = "name" | "members" | "thresholds" | "review" | "done";
const ORDER: Step[] = ["name", "members", "thresholds", "review"];

type DraftMember = { publicKey: string; weight: number; isCreator: boolean };

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;

const STEP_LABELS: Record<Step, string> = {
  name: "name",
  members: "signers",
  thresholds: "thresholds",
  review: "review",
  done: "done",
};

export function CreateAccountDialog({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const createAccount = useCreateAccount();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("name");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ stellarAccountId: string } | null>(null);

  const [name, setName] = useState("");
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [thresholds, setThresholds] = useState<AccountThresholds>({
    low: 1,
    medium: 1,
    high: 1,
  });
  const [startingBalance, setStartingBalance] = useState("2.0");
  const [newKey, setNewKey] = useState("");
  const [newWeight, setNewWeight] = useState("1");

  // Reset to a clean draft whenever the dialog opens, seeding the creator as the
  // first signer (they cannot be removed — they own the account).
  function reset() {
    const creator = user?.publicKey;
    setStep("name");
    setSubmitting(false);
    setError(null);
    setResult(null);
    setName("");
    setMembers(creator ? [{ publicKey: creator, weight: 1, isCreator: true }] : []);
    setThresholds({ low: 1, medium: 1, high: 1 });
    setStartingBalance("2.0");
    setNewKey("");
    setNewWeight("1");
  }

  function onOpenChange(next: boolean) {
    if (submitting) return; // never close mid-submission
    if (next) reset();
    setOpen(next);
  }

  const totalWeight = members.reduce((sum, m) => sum + m.weight, 0);
  const thresholdsSatisfiable =
    members.length > 0 &&
    (["low", "medium", "high"] as const).every(
      (l) => thresholds[l] >= 1 && thresholds[l] <= totalWeight,
    );

  function addMember() {
    const key = newKey.trim();
    if (!StrKey.isValidEd25519PublicKey(key)) {
      setError("Enter a valid Stellar public key (G…).");
      return;
    }
    if (members.some((m) => m.publicKey === key)) {
      setError("That signer is already in the list.");
      return;
    }
    const weight = Number(newWeight);
    if (!Number.isInteger(weight) || weight <= 0) {
      setError("Weight must be a positive whole number.");
      return;
    }
    setError(null);
    setMembers((prev) => [...prev, { publicKey: key, weight, isCreator: false }]);
    setNewKey("");
    setNewWeight("1");
  }

  function setMemberWeight(publicKey: string, value: string) {
    const weight = Math.max(1, Math.floor(Number(value) || 1));
    setMembers((prev) =>
      prev.map((m) => (m.publicKey === publicKey ? { ...m, weight } : m)),
    );
  }

  function removeMember(publicKey: string) {
    setMembers((prev) => prev.filter((m) => m.publicKey !== publicKey));
  }

  const canAdvance: Record<Step, boolean> = {
    name: name.trim().length > 0,
    members: members.length > 0,
    thresholds: thresholdsSatisfiable,
    review: Number(startingBalance) > 0 && !submitting,
    done: true,
  };

  function goNext() {
    setError(null);
    const idx = ORDER.indexOf(step);
    if (idx < ORDER.length - 1) setStep(ORDER[idx + 1]);
  }
  function goBack() {
    setError(null);
    const idx = ORDER.indexOf(step);
    if (idx > 0) setStep(ORDER[idx - 1]);
  }

  async function submit() {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createMultisigOnChain({
        creatorPublicKey: user.publicKey,
        members: members.map((m) => ({ publicKey: m.publicKey, weight: m.weight })),
        thresholds,
        startingBalance,
      });
      await createAccount.mutateAsync({
        name: name.trim(),
        stellarAccountId: res.stellarAccountId,
        thresholds,
        members: members.map((m) => ({
          publicKey: m.publicKey,
          weight: m.weight,
          role: m.isCreator ? "owner" : "member",
        })),
      });
      setResult({ stellarAccountId: res.stellarAccountId });
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create account.");
    } finally {
      setSubmitting(false);
    }
  }

  const stepIndex = ORDER.indexOf(step);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <Button>Create multisig account</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md border-[var(--hairline)]">
        <DialogHeader>
          {step !== "done" && (
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
              step {stepIndex + 1}/{ORDER.length} · {STEP_LABELS[step]}
            </p>
          )}
          <DialogTitle className="font-[family-name:var(--font-display)] tracking-tight">
            {step === "done" ? "Account created" : "Create multisig account"}
          </DialogTitle>
          <DialogDescription>
            {step === "done"
              ? "Your multisig account is live on mainnet."
              : "Signing rules are enforced on-chain by Stellar itself."}
          </DialogDescription>
          {step !== "done" && (
            <div className="mt-2 flex gap-1.5" aria-hidden>
              {ORDER.map((s, i) => (
                <span
                  key={s}
                  className={
                    i <= stepIndex
                      ? "h-1 flex-1 rounded-full bg-[var(--gold)]"
                      : "h-1 flex-1 rounded-full bg-[var(--surface-2)]"
                  }
                />
              ))}
            </div>
          )}
        </DialogHeader>

        {step === "name" && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Account name</label>
            <Input
              autoFocus
              placeholder="e.g. Core Treasury"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              A label for your team. Stored off-chain in Cluster.
            </p>
          </div>
        )}

        {step === "members" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {members.map((m) => (
                <div
                  key={m.publicKey}
                  className="flex items-center gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2"
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] bg-[var(--surface-2)] font-mono text-[10px] font-semibold text-[var(--gold)]"
                    aria-hidden
                  >
                    {m.publicKey.slice(1, 3).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate font-mono text-xs">
                    {truncate(m.publicKey)}
                  </span>
                  {m.isCreator && (
                    <Badge className="border-transparent bg-[var(--surface-2)] text-[10px] text-muted-foreground">
                      you
                    </Badge>
                  )}
                  <Input
                    type="number"
                    min={1}
                    value={m.weight}
                    onChange={(e) => setMemberWeight(m.publicKey, e.target.value)}
                    className="h-8 w-16 font-mono"
                    aria-label="weight"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    disabled={m.isCreator}
                    onClick={() => removeMember(m.publicKey)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-end gap-2">
              <Input
                placeholder="Signer public key (G…)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="flex-1 font-mono text-xs"
              />
              <Input
                type="number"
                min={1}
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="w-16"
                aria-label="new signer weight"
              />
              <Button type="button" variant="outline" size="icon" onClick={addMember}>
                <Plus className="size-4" />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Total signer weight: {totalWeight}
            </p>
          </div>
        )}

        {step === "thresholds" && (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground text-xs">
              How much combined signer weight is required to approve each class of
              operation. High covers admin changes (members &amp; thresholds).
            </p>
            {(["low", "medium", "high"] as const).map((level) => (
              <div
                key={level}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3"
              >
                <div className="flex flex-col">
                  <label className="text-sm font-medium capitalize">{level}</label>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    max {totalWeight}
                  </span>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={totalWeight}
                  value={thresholds[level]}
                  onChange={(e) =>
                    setThresholds((prev) => ({
                      ...prev,
                      [level]: Math.floor(Number(e.target.value) || 0),
                    }))
                  }
                  className="w-24 font-mono"
                />
              </div>
            ))}
            <p
              className={
                thresholdsSatisfiable
                  ? "text-muted-foreground text-xs"
                  : "text-destructive text-xs"
              }
            >
              {thresholdsSatisfiable
                ? `Each threshold is reachable (total weight ${totalWeight}).`
                : `Each threshold must be between 1 and the total signer weight (${totalWeight}). A higher threshold would lock the account permanently.`}
            </p>
          </div>
        )}

        {step === "review" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 text-sm">
              <Row label="Name" value={name} />
              <Row label="Signers" value={`${members.length} (weight ${totalWeight})`} />
              <Row
                label="Thresholds"
                value={`L ${thresholds.low} · M ${thresholds.medium} · H ${thresholds.high}`}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm">Funding (XLM)</label>
              <Input
                type="number"
                min={0}
                step="0.5"
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                className="w-28 font-mono"
              />
            </div>
            <button
              type="button"
              className="text-muted-foreground self-start text-xs underline"
              onClick={() =>
                setStartingBalance(suggestedStartingBalance(members.length))
              }
            >
              Use suggested minimum
            </button>
            <div className="border-destructive/40 bg-destructive/10 text-destructive flex gap-2 rounded-md border p-3 text-xs">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                This funds a brand-new account with <strong>real XLM on mainnet</strong>
                and disables its master key. It cannot be undone.
              </span>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <div className="grid size-14 place-items-center rounded-2xl border border-[var(--signal)]/30 bg-[var(--surface)]">
              <CheckCircle2 className="size-7 text-[var(--signal)]" />
            </div>
            <p className="font-mono text-xs">{truncate(result.stellarAccountId)}</p>
            <p className="text-muted-foreground text-sm">
              “{name}” is ready. Members can now propose and co-sign transactions.
            </p>
          </div>
        )}

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          {step === "done" ? (
            <div className="flex w-full items-center justify-between gap-3">
              <Button
                variant="outline"
                className="border-[var(--hairline)] bg-transparent"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setOpen(false);
                  router.push(`/${result!.stellarAccountId}`);
                }}
                className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
              >
                Open account <ArrowUpRight className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={goBack}
                disabled={stepIndex === 0 || submitting}
              >
                <ArrowLeft className="size-4" /> Back
              </Button>
              {step === "review" ? (
                <Button
                  onClick={submit}
                  disabled={!canAdvance.review}
                  className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {submitting ? "Creating…" : "Create account"}
                </Button>
              ) : (
                <Button
                  onClick={goNext}
                  disabled={!canAdvance[step]}
                  className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
                >
                  Next <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium">{value}</span>
    </div>
  );
}
