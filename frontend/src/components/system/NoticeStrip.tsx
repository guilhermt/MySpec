import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StateGlyph } from "./StateGlyph";

export interface NoticeStripProps {
  id?: string;
  title: string;
  reason?: string;
  action?: ReactNode;
  error?: string;
  outlined?: boolean;
  /** role is alert for a failure that arrived after the screen, status for a note, and none for what was there when the screen opened. */
  role?: "alert" | "status" | undefined;
  className?: string;
}

/**
 * NoticeStrip is the strip that says something could not be read, with the action that retries. The
 * title and the reason are one text that wraps in whole lines; in a list narrower than 32rem the text takes the whole line beside the glyph and the action drops
 * to a line of its own, at the end.
 */
export function NoticeStrip({
  id,
  title,
  reason,
  action,
  error,
  outlined,
  role,
  className,
}: NoticeStripProps) {
  return (
    <div
      id={id}
      data-slot="notice-strip"
      {...(role !== undefined ? { role } : {})}
      className={cn(
        "@container flex min-h-(--size-ask) flex-wrap items-center gap-(--space-2) rounded-sm bg-surface-0 py-(--space-1-5) pr-(--space-1-5) pl-(--space-4) text-(length:--text-meta) leading-(--leading-meta)",
        outlined && "border border-line-2",
        className,
      )}
    >
      <StateGlyph state="blocked" />
      <p className="min-w-0 flex-[1_1_var(--notice-detail-min)] @max-lg:basis-[calc(100%-var(--icon)-var(--space-2))]">
        <span className="font-semibold text-ink-1">{title}</span>
        {reason !== undefined && <span className="text-ink-2"> {reason}</span>}
      </p>
      {action !== undefined && <div className="ml-auto flex shrink-0">{action}</div>}
      {error !== undefined && <span className="basis-full text-state-error">{error}</span>}
    </div>
  );
}
