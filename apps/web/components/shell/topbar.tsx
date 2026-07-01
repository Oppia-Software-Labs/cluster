"use client";

import { NotificationsMenu } from "@/components/shell/notifications-menu";
import { WalletMenu } from "@/components/shell/wallet-menu";

/**
 * Topbar chrome: notifications and the wallet menu (network / copy /
 * disconnect). The wallet menu reads the session directly, so no props are
 * needed.
 */
export function Topbar() {
  return (
    <header className="bg-background flex h-14 shrink-0 items-center justify-end gap-2 border-b border-[var(--hairline)] px-6">
      <NotificationsMenu />
      <WalletMenu />
    </header>
  );
}
