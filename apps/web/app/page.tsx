"use client";

import { useHealth } from "@/lib/queries";

export default function Home() {
  const { data, isLoading, isError, error } = useHealth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">Cluster</h1>
      <p className="text-neutral-400">
        Multisig and treasury management platform for Stellar
      </p>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 font-mono text-sm">
        {isLoading && <span className="text-neutral-400">Loading…</span>}
        {isError && (
          <span className="text-red-400">
            API unreachable: {error instanceof Error ? error.message : "unknown error"}
          </span>
        )}
        {data && (
          <span className="text-emerald-400">
            {data.status.toUpperCase()} — {data.message}
          </span>
        )}
      </div>
    </main>
  );
}
