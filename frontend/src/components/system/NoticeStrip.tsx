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
  role?: "alert" | "status";
  className?: string;
}

/** NoticeStrip is the strip that says something could not be read, with the action that retries. */
export function NoticeStrip({
  id,
  title,
  reason,
  action,
  error,
  outlined,
  role = "alert",
  className,
}: NoticeStripProps) {
  return (
    <div
      id={id}
      role={role}
      className={cn(
        "flex min-h-(--size-ask) flex-wrap items-center gap-2 rounded-sm bg-surface-0 py-1.5 pr-1.5 pl-4 text-(length:--text-meta) leading-(--leading-meta)",
        outlined && "border border-line-2",
        className,
      )}
    >
      <StateGlyph state="blocked" />
      <span className="font-semibold text-ink-1 whitespace-nowrap">{title}</span>
      <span className="min-w-0 flex-1 text-ink-2">{reason}</span>
      {action}
      {error !== undefined && <span className="basis-full text-state-error">{error}</span>}
    </div>
  );
}
