import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PlaceEmptyProps {
  title: string;
  /** children are the body: its text, in paragraphs, and then the block of what it waits for (the live checks, the error block). */
  children?: ReactNode;
  className?: string;
}

/**
 * PlaceEmpty is a place with no conversation yet, at the top of the conversation column: the title
 * and the text, then the block of what it waits for at the width of the column. It holds no action:
 * the action is the ask bar's.
 */
export function PlaceEmpty({ title, children, className }: PlaceEmptyProps) {
  return (
    <div
      role="status"
      className={cn("flex flex-col gap-(--space-2) pt-[calc(var(--space-16)*2)]", className)}
    >
      <p className="text-(length:--text-title) leading-(--leading-title) font-semibold text-ink-1">
        {title}
      </p>
      {children !== undefined && (
        <div className="flex flex-col gap-(--space-3) text-(length:--text-body) leading-(--leading-body) text-ink-3 [&>p]:max-w-(--measure-read)">
          {children}
        </div>
      )}
    </div>
  );
}
