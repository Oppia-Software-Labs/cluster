"use client";

import Link from "next/link";

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  cn,
} from "@cluster/ui";
import { useAccounts } from "@/lib/queries";
import { CreateAccountDialog } from "./create-account-dialog";

const truncate = (k: string) => `${k.slice(0, 4)}…${k.slice(-4)}`;
const initials = (name: string) => name.slice(0, 2).toUpperCase();

/**
 * The signed-in user's multisig accounts: a clickable list, an empty-state CTA,
 * and a "new account" action. Used by the /accounts landing and the overview
 * Accounts tab. `activeAccountId` highlights the current account when rendered
 * inside a specific account's dashboard.
 */
export function AccountsList({ activeAccountId }: { activeAccountId?: string }) {
  const { data: accounts, isLoading, isError, error } = useAccounts();

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading accounts…</p>;
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Couldn’t load accounts:{" "}
        {error instanceof Error ? error.message : "unknown error"}
      </p>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-3 rounded-lg border border-dashed p-8 text-center">
        <p className="text-sm font-medium">No multisig accounts yet</p>
        <p className="text-muted-foreground max-w-xs text-xs">
          Create your first multisig to manage assets together, with signing
          rules enforced on-chain.
        </p>
        <CreateAccountDialog
          trigger={<Button>Create your first multisig</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {accounts.map((account) => {
        const active = account.id === activeAccountId;
        return (
          <Link key={account.id} href={`/${account.id}`} className="block">
            <Card
              className={cn(
                "hover:bg-accent/50 flex-row items-center gap-3 p-3 transition-colors",
                active && "border-primary",
              )}
            >
              <Avatar className="size-9">
                <AvatarFallback>{initials(account.name)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                  {account.name}
                </span>
                <span className="text-muted-foreground truncate font-mono text-xs">
                  {truncate(account.stellarAccountId)}
                </span>
              </div>
              {active && (
                <Badge variant="secondary" className="text-[10px]">
                  current
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">
                H {account.thresholds.high}
              </Badge>
            </Card>
          </Link>
        );
      })}
      <div className="pt-1">
        <CreateAccountDialog
          trigger={
            <Button variant="outline" className="w-full">
              New account
            </Button>
          }
        />
      </div>
    </div>
  );
}
