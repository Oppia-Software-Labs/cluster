import { ChevronsUpDown } from "lucide-react";

import { Avatar, AvatarFallback, Card } from "@cluster/ui";

/**
 * Account switcher CARD (avatar + name + balance + chevron).
 * CHROME ONLY — name/balance are placeholders; account data comes from
 * Member 2 in a later milestone.
 */
export function AccountSwitcher({
  name = "Account",
  balance = "—",
}: {
  name?: string;
  balance?: string;
}) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <Avatar className="size-9">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="text-muted-foreground truncate text-xs">
          {balance}
        </span>
      </div>
      <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
    </Card>
  );
}
