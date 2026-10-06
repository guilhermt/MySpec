import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PlaceholderProps {
  children: ReactNode;
  className?: string;
}

/** Placeholder is a template variable in a prompt, like {{prd_path}}. */
export function Placeholder({ children, className }: PlaceholderProps) {
  return (
    <span
      className={cn(
        "inline-flex h-(--size-kbd) items-center rounded-xs border border-line-2 bg-surface-0 px-(--space-1) font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}
