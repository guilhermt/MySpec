import { type ReactNode, useId } from "react";
import { Icon } from "@/components/system/Icon";
import { ICONS } from "@/components/system/icons";
import type { StretchFoldView } from "@/features/chat/conversation";
import { Chevron } from "@/features/chat/entries/Chevron";

export interface StretchFoldProps {
  fold: StretchFoldView;
  open: boolean;
  onToggle: () => void;
  /** children are the entries of the stretch, mounted only while it is open. */
  children: ReactNode;
}

/**
 * StretchFold is a stretch of an earlier round folded into one line: its size and where it began.
 * Open, its entries follow the line as they were, in the same column.
 */
export function StretchFold({ fold, open, onToggle, children }: StretchFoldProps) {
  const id = useId();
  return (
    <>
      {/* The line is the stop of the walk, with the state of the fold; the article holds the name. */}
      <article id={id} data-feed-entry aria-label={fold.name} className="flex flex-col">
        <button
          type="button"
          data-feed-item
          data-feed-toggle
          tabIndex={-1}
          aria-expanded={open}
          aria-labelledby={id}
          onClick={onToggle}
          className="-mx-(--space-2) flex min-h-(--size-control-sm) min-w-0 items-center gap-(--space-2) rounded-sm px-(--space-2) text-left text-(length:--text-meta) leading-(--leading-meta) text-ink-3 outline-none transition-colors duration-(--duration-fast) ease-standard hover:bg-veil-hover active:bg-veil-press focus-visible:focus-ring"
        >
          <Chevron open={open} />
          <Icon icon={ICONS.history} size="sm" className="text-ink-4" />
          <span className="shrink-0 font-medium whitespace-nowrap text-ink-2 tabular-nums">
            {fold.text}
          </span>
          <span className="min-w-0 truncate text-ink-3">{fold.from}</span>
          {fold.interval !== "" && (
            <span className="entry-time ml-auto shrink-0 text-(length:--text-micro) leading-(--leading-micro) whitespace-nowrap text-ink-4 tabular-nums">
              {fold.interval}
            </span>
          )}
        </button>
      </article>
      {open && children}
    </>
  );
}
