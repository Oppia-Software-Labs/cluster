"use client";

import { useParams } from "next/navigation";

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  cn,
} from "@cluster/ui";
import type { MemberRole, ThresholdLevel } from "@cluster/shared";

import { useAuth } from "@/lib/auth";
import { useAccount } from "@/lib/queries";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;
const initials = (k: string) => k.slice(1, 3).toUpperCase();

const ROLE_VARIANT: Record<MemberRole, "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "secondary",
  member: "outline",
};

const THRESHOLD_HELP: Record<ThresholdLevel, string> = {
  low: "Low-risk operations (e.g. managing trustlines).",
  medium: "Asset movement such as payments and trades.",
  high: "Administrative changes — members and thresholds.",
};

// Config changes (add/remove member, edit thresholds) flow through Member 3's
// propose→sign→submit pipeline, which isn't wired yet, so these are read-only.
const PENDING_NOTE =
  "Changing this proposes a multisig transaction — available once the signing pipeline ships.";

export default function MembersPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = params?.accountId;
  const { user } = useAuth();
  const { data: account, isLoading, isError, error } = useAccount(accountId);

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading account…</p>;
  }
  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Couldn’t load this account:{" "}
        {error instanceof Error ? error.message : "unknown error"}
      </p>
    );
  }
  if (!account) {
    return <p className="text-muted-foreground text-sm">Account not found.</p>;
  }

  const totalWeight = account.members.reduce((sum, m) => sum + m.weight, 0);
  const levels: ThresholdLevel[] = ["low", "medium", "high"];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Members</CardTitle>
            <p className="text-muted-foreground text-xs">
              {account.members.length} signer
              {account.members.length === 1 ? "" : "s"} · total weight{" "}
              {totalWeight}
            </p>
          </div>
          <Button variant="outline" size="sm" disabled title={PENDING_NOTE}>
            Add member
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {account.members.map((m) => {
            const isYou = m.publicKey === user?.publicKey;
            return (
              <div
                key={m.id}
                className="border-border flex items-center gap-3 rounded-md border p-3"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="text-[10px]">
                    {initials(m.publicKey)}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 truncate font-mono text-xs">
                  {truncate(m.publicKey)}
                </span>
                {isYou && (
                  <Badge variant="secondary" className="text-[10px]">
                    you
                  </Badge>
                )}
                <Badge variant={ROLE_VARIANT[m.role]} className="text-[10px] capitalize">
                  {m.role}
                </Badge>
                <span className="text-muted-foreground w-16 text-right text-xs">
                  weight {m.weight}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled
                  title={PENDING_NOTE}
                  className="text-muted-foreground"
                >
                  Remove
                </Button>
              </div>
            );
          })}
          <p className="text-muted-foreground text-xs">{PENDING_NOTE}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Signing thresholds</CardTitle>
            <p className="text-muted-foreground text-xs">
              Combined signer weight required to approve each class of operation.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled title={PENDING_NOTE}>
            Edit thresholds
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {levels.map((level) => {
            const required = account.thresholds[level];
            const pct =
              totalWeight > 0
                ? Math.min(100, (required / totalWeight) * 100)
                : 0;
            return (
              <div key={level} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize">{level}</span>
                  <span className="text-muted-foreground text-xs">
                    {required} / {totalWeight} weight
                  </span>
                </div>
                <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                  <div
                    className={cn("bg-primary h-full rounded-full")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-xs">
                  {THRESHOLD_HELP[level]}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
