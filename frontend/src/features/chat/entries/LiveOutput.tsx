import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { Shimmer } from "@/components/system/Shimmer";
import { useNow } from "@/features/attention/useNow";
import { OUTPUT_FRAME, OUTPUT_ROW, OUTPUT_TEXT } from "@/features/chat/entries/CommandOutput";
import { outputView } from "@/features/chat/output";
import { cn } from "@/lib/utils";
import type { ActionOutput } from "@/lib/wails";
import { readTaskOutput } from "@/store/actions";

/** LIVE_OUTPUT_MS is how often the output of a task that runs is read again while it is open. */
export const LIVE_OUTPUT_MS = 1000;

// PAD is the inset of the lines of an output.
const PAD = "pl-(--space-3)";

export interface LiveOutputProps {
  itemId: string;
  stage: string;
  /** taskId is the id the CLI gave the command or monitor. */
  taskId: string;
}

/**
 * LiveOutput is the end of the output of a command or monitor that runs in the background, read
 * again every LIVE_OUTPUT_MS while it is on screen.
 */
export function LiveOutput({ itemId, stage, taskId }: LiveOutputProps) {
  const [output, setOutput] = useState<ActionOutput | null>(null);
  const [failed, setFailed] = useState(false);
  const [whole, setWhole] = useState(false);
  const now = useNow(LIVE_OUTPUT_MS, true);
  const reading = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // A reading at each tick, none while another is on its way or after one failed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the tick is the trigger
  useEffect(() => {
    if (reading.current || failed) {
      return;
    }
    reading.current = true;
    readTaskOutput(itemId, stage, taskId)
      .then((read) => {
        if (mounted.current) {
          setOutput(read);
        }
      })
      .catch(() => {
        if (mounted.current) {
          setFailed(true);
        }
      })
      .finally(() => {
        reading.current = false;
      });
  }, [now, failed, itemId, stage, taskId]);

  const view = output === null ? null : outputView(output.text, output.lines);

  return (
    <div
      data-output
      className={cn(OUTPUT_FRAME, "shadow-[inset_0_0_0_var(--border)_var(--line-1)]")}
    >
      {output?.truncated === true && (
        <p className={cn(OUTPUT_ROW, PAD)}>Only the last 8 KiB is shown while it runs</p>
      )}
      {failed && (
        <p className={cn(OUTPUT_ROW, PAD)}>
          <span className="text-state-error">Couldn't read the output</span>
          <span className="text-state-error">·</span>
          <Button variant="ghost" size="xs" onClick={() => setFailed(false)}>
            Try again
          </Button>
        </p>
      )}
      {!failed && output === null && (
        <p className={cn(OUTPUT_ROW, PAD)}>
          <Shimmer>Reading the output…</Shimmer>
        </p>
      )}
      {!failed && output !== null && output.text === "" && (
        <p className={cn(OUTPUT_ROW, PAD)}>No output yet</p>
      )}
      {view !== null && output !== null && output.text !== "" && (
        <>
          {view.above > 0 && (
            <div
              className={cn(
                OUTPUT_ROW,
                PAD,
                "shadow-[inset_0_calc(var(--border)*-1)_0_var(--line-1)]",
              )}
            >
              {!whole && <span className="tabular-nums">{view.above} more lines above</span>}
              <Button
                variant="ghost"
                size="xs"
                className="ml-auto"
                onClick={() => setWhole(!whole)}
              >
                {whole ? "Show less" : `Show all ${output.lines} lines`}
              </Button>
            </div>
          )}
          <pre className={cn(OUTPUT_TEXT, PAD)}>{whole ? output.text : view.text}</pre>
        </>
      )}
    </div>
  );
}
