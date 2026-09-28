import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "./Tooltip";

export interface ContextMeterProps {
  percent: number | null;
  paused?: boolean;
  /** compact drops the track; "narrow" drops it only below 1300px of main area. */
  compact?: boolean | "narrow";
  detail: string;
}

/** ContextMeter shows how much of the session's context is used; it never changes colour as it fills. */
export function ContextMeter({ percent, paused, compact, detail }: ContextMeterProps) {
  const clamped = percent === null ? 0 : Math.min(Math.max(percent, 0), 100);
  const rounded = Math.round(clamped);
  const label = paused ? "—" : percent === null ? "…" : `${rounded}%`;
  const valueText = paused ? "paused" : percent === null ? "not read yet" : undefined;

  return (
    <Tooltip content={detail}>
      {/* biome-ignore lint/a11y/useSemanticElements: <meter> cannot draw the system's track and fill. */}
      <span
        role="meter"
        aria-label="Context"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valueText === undefined ? rounded : 0}
        {...(valueText !== undefined ? { "aria-valuetext": valueText } : {})}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the meter takes focus to show its detail.
        tabIndex={0}
        className="inline-flex items-center gap-1.5 rounded-xs text-(length:--text-micro) leading-(--leading-micro) text-ink-3 tabular-nums hover:text-ink-1 focus-visible:focus-ring"
      >
        {compact !== true && (
          <span
            data-slot="track"
            className={cn(
              compact === "narrow" && "@max-[1300px]/main:hidden",
              "block h-(--meter-h) w-(--meter-w) shrink-0 overflow-hidden rounded-(--radius-pill)",
              percent === null && !paused ? "shimmer-track" : "bg-brand-track",
            )}
          >
            {percent !== null && (
              <span
                style={{ "--p": clamped } as CSSProperties}
                className="block h-full w-[round(down,calc(var(--meter-w)*var(--p)/100),1px)] rounded-[inherit] bg-brand"
              />
            )}
          </span>
        )}
        <span className="w-(--meter-label) text-right">{label}</span>
      </span>
    </Tooltip>
  );
}
