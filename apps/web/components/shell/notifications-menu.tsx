"use client";

import Link from "next/link";
import { Bell, PenLine } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@cluster/ui";
import { usePendingSignatures } from "@/lib/transactions.queries";

/**
 * Notifications bell. Badges with the count of pending transactions the
 * signed-in user hasn't signed yet, across every account they belong to;
 * the dropdown lists them by account, linking to that account's /activity.
 */
export function NotificationsMenu() {
  const { data } = usePendingSignatures();
  const count = data?.count ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            count > 0 ? `Notifications (${count} pending signature${count === 1 ? "" : "s"})` : "Notifications"
          }
          className="text-muted-foreground hover:bg-[var(--surface-2)] hover:text-foreground relative"
        >
          <Bell className="size-4" />
          {count > 0 && (
            <span
              aria-hidden
              className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-[var(--gold)] font-mono text-[9px] font-bold text-[#0a0a0a]"
            >
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-72 border-[var(--hairline)] shadow-none"
      >
        <DropdownMenuLabel className="px-3 py-2.5 text-sm font-medium">
          Notifications
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />
        {count === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
            <Bell className="size-5 text-muted-foreground" />
            <p className="text-sm font-medium">You’re all caught up</p>
            <p className="text-muted-foreground text-xs">
              New activity will show up here.
            </p>
          </div>
        ) : (
          data?.accounts.map((a) => (
            <DropdownMenuItem key={a.accountId} asChild>
              <Link href={`/${a.stellarAccountId}/activity`} className="cursor-pointer">
                <PenLine className="size-4 text-[var(--gold)]" />
                <span className="flex-1 truncate">{a.accountName}</span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  {a.count} to sign
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
