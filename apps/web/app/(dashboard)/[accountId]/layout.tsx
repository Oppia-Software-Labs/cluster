"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

/**
 * Protected dashboard layout (Member 1 — app shell chrome).
 * Reads the session via useAuth (Member 1 · sub-project D). Redirects to
 * /connect when there is no session; otherwise renders sidebar + topbar +
 * {children}.
 */
export default function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  // Next 15 types route `params` as a Promise. Tests pass a plain object;
  // the runtime guard below unwraps either form.
  params: Promise<{ accountId: string }>;
}) {
  const maybePromise = params as
    | Promise<{ accountId: string }>
    | { accountId: string };
  const resolved =
    maybePromise instanceof Promise ? use(maybePromise) : maybePromise;
  const { accountId } = resolved;

  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/connect");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar accountId={accountId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
