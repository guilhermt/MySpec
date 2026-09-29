import { useState } from "react";
import { Button } from "@/components/system/Button";
import { Shimmer } from "@/components/system/Shimmer";
import { cn } from "@/lib/utils";
import { readActionOutput } from "@/store/actions";

export interface CommandOutputProps {
  taskId: string;
  stage: string;
  /** entryId is the action whose whole output Show all reads. */
  entryId: string;
  /** lines is how many lines the whole output has. */
  lines: number;
  /** tail is what the payload carries: the whole output up to 16 lines, the last 12 above that. */
  tail: string;
  /** truncated says the product kept only the last 64 KiB. */
  truncated: boolean;
  /** failed draws the rail of a command that failed. */
  failed?: boolean;
}

// Reading is what the output shows: its tail, the whole on its way, a reading that failed, or the whole.
type Reading = "tail" | "reading" | "failed" | "whole";

// ROW is the line above the output: what it doesn't show and the way to show it.
const ROW =
  "flex min-h-(--size-control-xs) items-center gap-(--space-2) pr-(--space-1) text-(length:--text-micro) leading-(--leading-micro) text-ink-3";

/**
 * CommandOutput is what a command printed: its tail, with the way to read it whole. The whole
 * output is read on demand and kept while the output is on screen.
 */
export function CommandOutput({
  taskId,
  stage,
  entryId,
  lines,
  tail,
  truncated,
  failed = false,
}: CommandOutputProps) {
  const [reading, setReading] = useState<Reading>("tail");
  const [whole, setWhole] = useState<string | null>(null);
  const above = Math.max(lines - tail.split("\n").length, 0);

  // read shows the whole output, read once and kept for the next Show all.
  const read = async () => {
    if (whole !== null) {
      setReading("whole");
      return;
    }
    setReading("reading");
    try {
      const output = await readActionOutput(taskId, stage, entryId);
      setWhole(output.text);
      setReading("whole");
    } catch {
      setReading("failed");
    }
  };

  const pad = failed ? "pl-[calc(var(--space-3)+var(--error-rail))]" : "pl-(--space-3)";

  return (
    <div
      data-output
      className={cn(
        "overflow-hidden rounded-sm bg-surface-1",
        failed
          ? "shadow-[inset_var(--error-rail)_0_0_var(--state-error),inset_0_0_0_var(--border)_var(--line-1)]"
          : "shadow-[inset_0_0_0_var(--border)_var(--line-1)]",
      )}
    >
      {truncated && <p className={cn(ROW, pad)}>Only the last 64 KiB was kept</p>}
      {(above > 0 || reading === "whole") && (
        <div className={cn(ROW, pad, "shadow-[inset_0_calc(var(--border)*-1)_0_var(--line-1)]")}>
          {reading === "tail" && (
            <>
              <span className="tabular-nums">{above} more lines above</span>
              <Button variant="ghost" size="xs" className="ml-auto" onClick={() => void read()}>
                {`Show all ${lines} lines`}
              </Button>
            </>
          )}
          {reading === "reading" && <Shimmer>Reading the output…</Shimmer>}
          {reading === "failed" && (
            <>
              <span className="text-state-error">Couldn't read the output</span>
              <span className="text-state-error">·</span>
              <Button variant="ghost" size="xs" onClick={() => void read()}>
                Try again
              </Button>
            </>
          )}
          {reading === "whole" && (
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto"
              onClick={() => setReading("tail")}
            >
              Show less
            </Button>
          )}
        </div>
      )}
      <pre
        className={cn(
          "overflow-x-auto py-(--space-1-5) pr-(--space-3) font-mono text-(length:--text-micro) leading-(--leading-micro) whitespace-pre text-ink-2 [font-variant-ligatures:none] [tab-size:4] select-text",
          pad,
        )}
      >
        {reading === "whole" && whole !== null ? whole : tail}
      </pre>
    </div>
  );
}
