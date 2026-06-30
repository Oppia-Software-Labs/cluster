"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, LayoutGrid } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  Card,
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
  const active = accounts?.find((a) => a.id === activeId);
  const name = active?.name ?? "Select account";
  const count = accounts?.length ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Card
          role="button"
          className="hover:bg-accent/50 flex-row items-center gap-3 p-3 text-left"
        >
          <Avatar className="size-9">
            <AvatarFallback>
              {(active?.name ?? "—").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="text-muted-foreground truncate text-xs">
              {count > 0 ? `${count} account${count === 1 ? "" : "s"}` : "—"}
            </span>
          </div>
          <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
        </Card>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Accounts</DropdownMenuLabel>
        {count > 0 ? (
          accounts!.map((a) => (
            <DropdownMenuItem key={a.id} onSelect={() => router.push(`/${a.id}`)}>
              <Avatar className="size-5">
                <AvatarFallback className="text-[9px]">
                  {a.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
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
