import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Circumference of the arc below, so the dash can be a share of the ring.
const RADIUS = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function toneClass(percent: number): string {
  if (percent > 90) {
    return "text-destructive";
  }
  if (percent >= 70) {
    return "text-[var(--status-attention)]";
  }
  return "text-muted-foreground";
}

export interface ContextGaugeProps {
  percent: number;
  className?: string;
}

/**
 * ContextGauge is the share of the context window the conversation on screen used: a ring and the
 * percentage. Below 1300px of main area the ring gives way and the percentage stays.
 */
export function ContextGauge({ percent, className }: ContextGaugeProps) {
  if (percent <= 0) {
    return null;
  }
  const filled = Math.min(percent, 100) / 100;

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className={cn(
          "flex items-center gap-1 text-xs tabular-nums",
          toneClass(percent),
          className,
        )}
      >
        <svg
          aria-hidden="true"
          className="size-4 -rotate-90 @max-[1300px]/main:hidden"
          viewBox="0 0 16 16"
        >
          <circle className="stroke-border" cx="8" cy="8" r={RADIUS} fill="none" strokeWidth="2" />
          <circle
            className="stroke-current"
            cx="8"
            cy="8"
            r={RADIUS}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - filled)}
          />
        </svg>
        <span className="sr-only">Context used</span>
        {percent}%
      </TooltipTrigger>
      <TooltipContent>Context used</TooltipContent>
    </Tooltip>
  );
}
