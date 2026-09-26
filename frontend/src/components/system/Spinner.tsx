import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export interface SpinnerProps {
  tone?: "work" | "current" | "on-solid";
  className?: string;
}

/** TONES are the arc and the track of each spinner tone. */
const TONES = {
  work: { arc: "var(--state-work)", track: "var(--state-work-track)" },
  current: { arc: "currentColor", track: "var(--state-work-track)" },
  "on-solid": { arc: "currentColor", track: "var(--brand-key-ring)" },
} as const;

/** Spinner is the one loop of the product; the caller writes the gerund next to it. */
export function Spinner({ tone = "work", className }: SpinnerProps) {
  const { arc, track } = TONES[tone];
  // --spin-arc lets spin-glyph draw the three-quarter ring when motion is reduced.
  const style = {
    "--spin-arc": arc,
    borderColor: track,
    borderTopColor: arc,
    borderRightColor: arc,
  } as CSSProperties;
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      className={cn(
        "inline-block size-(--glyph) shrink-0 rounded-full border-(length:--border-2) spin-glyph",
        className,
      )}
      style={style}
    />
  );
}
