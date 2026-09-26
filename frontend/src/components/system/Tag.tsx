import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TagProps {
  children: ReactNode;
  className?: string;
}

/** Tag is a short mono token, like a branch or a model. */
export function Tag({ children, className }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-(--size-time-chip) items-center rounded-xs bg-surface-0 px-1.5 font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-3 whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}
