"use client";

import { useParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { Badge, cn } from "@cluster/ui";
import type { MemberRole, ThresholdLevel } from "@cluster/shared";

import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/queries";
import { AddMemberDialog } from "@/components/members/add-member-dialog";
import { EditThresholdsDialog } from "@/components/members/edit-thresholds-dialog";
import { RemoveMemberButton } from "@/components/members/remove-member-button";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;
const initials = (k: string) => k.slice(1, 3).toUpperCase();

const ROLE_STYLE: Record<MemberRole, string> = {
  owner: "border-transparent bg-[var(--gold)]/15 text-[var(--gold)]",
  admin: "border-[var(--hairline)] bg-[var(--surface-2)] text-foreground",
  member: "border-[var(--hairline)] text-muted-foreground",
};

const THRESHOLD_HELP: Record<ThresholdLevel, string> = {
  low: "Low-risk operations (e.g. managing trustlines).",
  medium: "Asset movement such as payments and trades.",
  high: "Administrative changes — members and thresholds.",
};

export default function MembersPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = params?.accountId;
  const { user } = useAuth();
  const { data: account, isLoading, isError, error } = useAccount(accountId);

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-48 animate-pulse rounded-2xl border border-[var(--hairline)] bg-[var(--surface)]/60"
          />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Couldn’t load this account:{" "}
        {error instanceof Error ? error.message : "unknown error"}
      </p>
    );
  }
  if (!account || !accountId) {
    return <p className="text-muted-foreground text-sm">Account not found.</p>;
  }

  const totalWeight = account.members.reduce((sum, m) => sum + m.weight, 0);
  const levels: ThresholdLevel[] = ["low", "medium", "high"];
  const myRole = account.members.find(
    (m) => m.publicKey === user?.publicKey,
  )?.role;
  const canManage = myRole === "owner" || myRole === "admin";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--gold)]">
          governance
        </p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
          Members &amp; thresholds
        </h1>
      </div>

      {/* Members */}
      <section className="cl-card p-5">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">Signers</h2>
            <p className="text-muted-foreground font-mono text-[11px]">
              {account.members.length} signer
              {account.members.length === 1 ? "" : "s"} · total weight{" "}
              {totalWeight}
            </p>
          </div>
          {canManage && <AddMemberDialog accountId={accountId} />}
        </header>

        <ul className="mt-4 flex flex-col gap-2">
          {account.members.map((m) => {
            const isYou = m.publicKey === user?.publicKey;
            const removable = canManage && m.role !== "owner";
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3"
              >
                <span
                  className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] bg-[var(--surface-2)] font-mono text-[11px] font-semibold text-[var(--gold)]"
                  aria-hidden
                >
                  {initials(m.publicKey)}
                </span>
                <span className="flex-1 truncate font-mono text-xs">
                  {truncate(m.publicKey)}
                </span>
                {isYou && (
                  <Badge className="border-transparent bg-[var(--surface-2)] text-[10px] text-muted-foreground">
                    you
                  </Badge>
                )}
                <Badge
                  className={cn("text-[10px] capitalize", ROLE_STYLE[m.role])}
                >
                  {m.role}
                </Badge>
                <span className="text-muted-foreground w-20 text-right font-mono text-[11px] tabular-nums">
                  weight {m.weight}
                </span>
                {removable ? (
                  <RemoveMemberButton
                    accountId={accountId}
                    memberId={m.id}
                    memberKey={m.publicKey}
                  />
                ) : (
                  <span className="size-8" aria-hidden />
                )}
              </li>
            );
          })}
        </ul>

        {!canManage && (
          <p className="text-muted-foreground mt-3 text-xs">
            Only owners and admins can add or remove signers.
          </p>
        )}
      </section>

      {/* Thresholds */}
      <section className="cl-card p-5">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-medium">
              <ShieldCheck className="size-4 text-[var(--gold)]" /> Signing
              thresholds
            </h2>
            <p className="text-muted-foreground font-mono text-[11px]">
              Combined weight required per operation class.
            </p>
          </div>
          {canManage && (
            <EditThresholdsDialog
              accountId={accountId}
              thresholds={account.thresholds}
              totalWeight={totalWeight}
            />
          )}
        </header>

        <div className="mt-4 flex flex-col gap-4">
          {levels.map((level) => {
            const required = account.thresholds[level];
            const pct =
              totalWeight > 0 ? Math.min(100, (required / totalWeight) * 100) : 0;
            return (
              <div key={level} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize">{level}</span>
                  <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                    {required} / {totalWeight} weight
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  {THRESHOLD_HELP[level]}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
