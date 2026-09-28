import type { ReactNode } from "react";
import { LINK } from "@/components/system/Link";
import { cn } from "@/lib/utils";

export interface SaveFailureProps {
  /** children say what failed: "Couldn't save the mode", or the reason a binding gave. */
  children: ReactNode;
  /** onRetry makes the choice that failed again. */
  onRetry: () => void;
  className?: string;
}

/**
 * SaveFailure says in place that a choice of a popover wasn't saved, in the error ink, with Try again
 * as an action written in the line, which makes the choice again.
 */
export function SaveFailure({ children, onRetry, className }: SaveFailureProps) {
  return (
    <p role="alert" className={cn("text-state-error", className)}>
      {children}
      {" · "}
      <button type="button" className={LINK} onClick={onRetry}>
        Try again
      </button>
    </p>
  );
}
