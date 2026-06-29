import { Bell } from "lucide-react";

import { Badge, Button } from "@cluster/ui";

/** Shortens a Stellar public key to `head…tail`. */
function truncateKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/**
 * Topbar chrome: network-status indicator, wallet chip (truncated pubkey),
 * and a notification slot. The notification slot is intentionally empty —
 * feature owners fill it.
 */
export function Topbar({ publicKey }: { publicKey?: string }) {
  return (
    <header className="bg-background flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2 text-sm">
        <span
          className="size-2 rounded-full bg-emerald-500"
          aria-hidden="true"
        />
        <span className="text-muted-foreground">Network Status</span>
      </div>

      <div className="flex items-center gap-2">
        {/* notification slot — feature owners append here */}
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>
        {publicKey ? (
          <Badge variant="outline" className="font-mono">
            {truncateKey(publicKey)}
          </Badge>
        ) : null}
      </div>
    </header>
  );
}
