"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@cluster/ui";
import { navRegistry } from "@/lib/nav";

/** Builds an absolute dashboard path for an account-relative href. */
function toHref(accountId: string, href: string): string {
  return href === "/" ? `/${accountId}` : `/${accountId}${href}`;
}

/** Renders the sidebar nav from the append-only registry. */
export function NavList({ accountId }: { accountId: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {navRegistry.map((entry) => {
        const href = toHref(accountId, entry.href);
        const active = pathname === href;
        const Icon = entry.icon;
        return (
          <Link
            key={entry.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
