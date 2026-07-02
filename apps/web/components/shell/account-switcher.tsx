"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, LayoutGrid } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@cluster/ui";
import { useAccounts } from "@/lib/queries";

/**
 * Account switcher card + dropdown. Reads the active account from the route
 * (first path segment) and the user's accounts from the API (the Member 2 data
 * the shell placeholder expected). Selecting an account navigates to its
 * dashboard; "View all accounts" goes to the landing.
 */
export function AccountSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: accounts } = useAccounts();

  const activeId = pathname?.split("/").filter(Boolean)[0];
  const active = accounts?.find(
    (a) => a.stellarAccountId === activeId || a.id === activeId,
  );
  const name = active?.name ?? "Select account";
  const count = accounts?.length ?? 0;

  const initials = (active?.name ?? "—").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="cl-card flex w-full items-center gap-3 p-2.5 text-left"
        >
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--hairline)] bg-[var(--surface-2)] font-[family-name:var(--font-display)] text-xs font-bold text-[var(--gold)]"
            aria-hidden
          >
            {initials}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="text-muted-foreground truncate font-mono text-[11px]">
              {count > 0 ? `${count} account${count === 1 ? "" : "s"}` : "—"}
            </span>
          </div>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-56 border-[var(--hairline)] shadow-none"
      >
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Accounts
        </DropdownMenuLabel>
        {count > 0 ? (
          accounts!.map((a) => (
            <DropdownMenuItem key={a.id} onSelect={() => router.push(`/${a.stellarAccountId}`)}>
              <span
                className="grid size-5 shrink-0 place-items-center rounded-md border border-[var(--hairline)] bg-[var(--surface-2)] text-[9px] font-bold text-[var(--gold)]"
                aria-hidden
              >
                {a.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="truncate">{a.name}</span>
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>No accounts yet</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/accounts")}>
          <LayoutGrid className="size-4" /> View all accounts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
