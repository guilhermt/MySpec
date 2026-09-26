import { cn } from "@/lib/utils";
import { Tooltip } from "./Tooltip";

export interface TimeChipProps {
  tone: "wait" | "error" | "close";
  time: string;
  longTime: string;
  raised?: boolean;
}

const TONES = {
  wait: "rounded-(--radius-pill) bg-state-wait-chip text-state-wait-chip-ink shadow-[inset_0_0_0_var(--border)_var(--state-wait-ring)]",
  error: "rounded-xs bg-state-error text-state-error-on",
  close:
    "rounded-(--radius-pill) bg-transparent text-state-close shadow-[inset_0_0_0_var(--border)_var(--state-close)]",
} as const;

/** HIDDEN is what a screen reader hears before the time of each tone. */
const HIDDEN = {
  wait: "waiting for you",
  error: "error, waiting for you",
  close: "ready to close",
} as const;

/** TimeChip is how long a task has waited for the person, or has been ready to close. */
export function TimeChip({ tone, time, longTime, raised }: TimeChipProps) {
  return (
    <Tooltip content={longTime}>
      <span
        data-tone={tone}
        className={cn(
          "inline-flex h-(--size-time-chip) items-center gap-0.5 px-1.5 text-(length:--text-micro) leading-(--leading-micro) font-semibold tabular-nums whitespace-nowrap",
          TONES[tone],
          tone === "close" && raised && "bg-surface-2",
        )}
      >
        <span className="sr-only">{HIDDEN[tone]} </span>
        {tone === "error" && (
          <span aria-hidden="true" className="font-bold">
            !
          </span>
        )}
        {time}
      </span>
    </Tooltip>
  );
}
