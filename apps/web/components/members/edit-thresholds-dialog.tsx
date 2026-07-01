"use client";

import { useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@cluster/ui";
import type { AccountThresholds, ThresholdLevel } from "@cluster/shared";

import { useUpdateThresholds } from "@/lib/queries";
import { apiError } from "@/lib/api-error";

const LEVELS: { level: ThresholdLevel; help: string }[] = [
  { level: "low", help: "Low-risk operations (e.g. managing trustlines)." },
  { level: "medium", help: "Asset movement such as payments and trades." },
  { level: "high", help: "Administrative changes — members and thresholds." },
];

/**
 * Edit the low/medium/high thresholds. Client-side guards keep each value
 * within the total signer weight so the account can't lock itself out; the API
 * enforces the same rule authoritatively.
 */
export function EditThresholdsDialog({
  accountId,
  thresholds,
  totalWeight,
}: {
  accountId: string;
  thresholds: AccountThresholds;
  totalWeight: number;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<AccountThresholds>(thresholds);
  const [error, setError] = useState<string | null>(null);

  const update = useUpdateThresholds(accountId);

  const invalid = LEVELS.some(({ level }) => {
    const v = values[level];
    return !Number.isInteger(v) || v < 0 || v > totalWeight;
  });

  function set(level: ThresholdLevel, raw: string) {
    setValues((prev) => ({ ...prev, [level]: Number(raw) }));
  }

  async function submit() {
    setError(null);
    try {
      await update.mutateAsync(values);
      setOpen(false);
    } catch (e) {
      setError(apiError(e));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setValues(thresholds);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-[var(--hairline)] bg-transparent hover:bg-[var(--surface-2)]"
        >
          <SlidersHorizontal className="size-4" /> Edit thresholds
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Signing thresholds</DialogTitle>
          <DialogDescription>
            Combined signer weight required to approve each class of operation.
            Total available weight is {totalWeight}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {LEVELS.map(({ level, help }) => (
            <label key={level} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">{level}</span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  max {totalWeight}
                </span>
              </div>
              <Input
                type="number"
                min={0}
                max={totalWeight}
                value={String(values[level])}
                onChange={(e) => set(level, e.target.value)}
                className="font-mono"
                aria-invalid={values[level] > totalWeight}
              />
              <span className="text-muted-foreground text-xs">{help}</span>
            </label>
          ))}
          {invalid && (
            <p className="text-destructive text-xs">
              Each threshold must be between 0 and the total signer weight.
            </p>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-[var(--hairline)] bg-transparent"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            disabled={invalid || update.isPending}
            onClick={submit}
            className="bg-[var(--gold)] text-[#0a0a0a] shadow-none hover:bg-[var(--gold-soft)]"
          >
            {update.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save thresholds"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
