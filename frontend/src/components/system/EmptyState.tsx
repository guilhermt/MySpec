import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  /** children is the text under the title; a place that says it all in the title has none. */
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** EmptyState says what a place shows once it has something, and how to get there. */
export function EmptyState({ title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <p className="text-(length:--text-ui) leading-(--leading-ui) font-semibold text-ink-1">
        {title}
      </p>
      {children !== undefined && (
        <div className="max-w-(--measure-read) text-(length:--text-body) leading-(--leading-body) text-ink-3">
          {children}
        </div>
      )}
      {action !== undefined && <div className="mt-1">{action}</div>}
    </div>
  );
}
