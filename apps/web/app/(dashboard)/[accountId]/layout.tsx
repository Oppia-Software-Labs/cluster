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
  params: Promise<{ accountId: string }> | { accountId: string };
}) {
  // Next 15 passes params as a Promise in async layouts; `use` unwraps it
  // and is a no-op for the plain object the test passes.
  const resolved = params instanceof Promise ? use(params) : params;
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
        <Topbar publicKey={user.publicKey} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
