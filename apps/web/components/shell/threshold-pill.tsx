import { Grid2x2 } from "lucide-react";

import { Badge, Button } from "@cluster/ui";

/**
 * Sidebar `Threshold x/y` pill + a grid button.
 * CHROME ONLY — the x/y numbers are placeholders; real threshold data
 * is wired by Member 2.
 */
export function ThresholdPill({
  current = 0,
  total = 0,
}: {
  current?: number;
  total?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
        <span className="text-muted-foreground">Threshold</span>
        <span className="text-foreground font-semibold">
          {current}/{total}
        </span>
      </Badge>
      <Button
        variant="outline"
        size="icon"
        aria-label="Open accounts grid"
        className="size-8"
      >
        <Grid2x2 className="size-4" />
      </Button>
    </div>
  );
}
