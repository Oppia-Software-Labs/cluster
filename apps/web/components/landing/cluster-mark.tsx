"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@cluster/ui";

/**
 * The Cluster brand lockup. Keeps the official logo asset as-is (per brand),
 * dropped onto a soft gold halo instead of a bordered box — no outline. The
 * mark is an easter-egg trigger: five taps spins it and whispers a secret.
 */
export function ClusterMark({
  size = 44,
  showWordmark = true,
  wordmarkClassName,
  className,
}: {
  size?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  className?: string;
}) {
  const [taps, setTaps] = useState(0);
  const unlocked = taps >= 5;

  return (
    <div className={cn("group flex items-center gap-3", className)}>
      <button
        type="button"
        onClick={() => setTaps((t) => (t >= 5 ? 0 : t + 1))}
        aria-label="Cluster"
        className="relative grid shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo/cluster-logo.png"
          alt="Cluster"
          width={size}
          height={size}
          priority
          className={cn(
            "relative object-contain transition-transform duration-500",
            unlocked && "[animation:cl-spin-slow_1.4s_linear_infinite]",
          )}
          style={{ width: size, height: size }}
        />
      </button>
      {showWordmark && (
        <div className="flex flex-col leading-none pt-2">
          <span
            className={cn(
              "font-[family-name:var(--font-display)] text-lg font-extrabold tracking-tight",
              wordmarkClassName,
            )}
          >
            Cluster
          </span>
          <span
            className={cn(
              "mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground transition-all",
              unlocked ? "opacity-100" : "opacity-0",
            )}
          >
            n of many
          </span>
        </div>
      )}
    </div>
  );
}
