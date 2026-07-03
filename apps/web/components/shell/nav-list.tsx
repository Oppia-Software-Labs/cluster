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
    <nav className="flex flex-col gap-0.5" aria-label="Primary">
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
              "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-[var(--surface-2)] font-medium text-foreground"
                : "font-normal text-muted-foreground hover:bg-[var(--surface)] hover:text-foreground",
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--gold)]"
              />
            )}
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active ? "text-[var(--gold)]" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
