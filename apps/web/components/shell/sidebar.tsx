import { AccountSwitcher } from "@/components/shell/account-switcher";
import { NavList } from "@/components/shell/nav-list";
import { PromoCard } from "@/components/shell/promo-card";
import { ThresholdPill } from "@/components/shell/threshold-pill";

/**
 * Sidebar chrome: brand, account-switcher card, threshold pill + grid button,
 * the nav list (from the registry), and a dismissible footer promo slot.
 * Data-bearing props (account, threshold) are wired by M2 later.
 */
export function Sidebar({ accountId }: { accountId: string }) {
  return (
    <aside className="bg-background flex h-full w-64 shrink-0 flex-col gap-4 border-r p-4">
      <div className="flex items-center gap-2 px-1">
        <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-sm font-bold">
          C
        </div>
        <span className="text-base font-semibold">Cluster</span>
      </div>

      <AccountSwitcher />
      <ThresholdPill />

      <div className="flex-1 overflow-y-auto">
        <NavList accountId={accountId} />
      </div>

      <PromoCard />
    </aside>
  );
}
