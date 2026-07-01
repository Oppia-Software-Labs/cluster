import { AccountSwitcher } from "@/components/shell/account-switcher";
import { NavList } from "@/components/shell/nav-list";
import { PromoCard } from "@/components/shell/promo-card";
import { ClusterMark } from "@/components/landing/cluster-mark";

/**
 * Sidebar chrome: brand, account-switcher card, the nav list (from the
 * registry), and a dismissible footer promo slot.
 */
export function Sidebar({ accountId }: { accountId: string }) {
  return (
    <aside className="bg-background flex h-full w-64 shrink-0 flex-col gap-5 border-r border-[var(--hairline)] p-4">
      <div className="px-1 pt-1">
        <ClusterMark size={38} />
      </div>

      <AccountSwitcher />

      <div className="flex-1 overflow-y-auto">
        <NavList accountId={accountId} />
      </div>

      <PromoCard />
    </aside>
  );
}
