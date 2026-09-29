import type { UserEntry } from "@/lib/wails";
import { clockTime } from "@/lib/when";

export interface YourMessageProps {
  user: UserEntry;
  createdAt: string;
}

/** YourMessage is what the user said, in the column, as written. */
export function YourMessage({ user, createdAt }: YourMessageProps) {
  const time = clockTime(createdAt, Date.now());

  return (
    <article
      data-feed-item
      tabIndex={-1}
      aria-label={`You, ${time}`}
      className="flex flex-col gap-(--space-1) rounded-lg bg-surface-user px-(--space-4) py-(--space-3) outline-none focus-visible:focus-ring"
    >
      <div className="flex items-center gap-(--space-1-5) text-(length:--text-meta) leading-(--leading-meta)">
        <span className="font-medium text-ink-2">You</span>
        <span className="entry-time text-ink-4 tabular-nums">{time}</span>
      </div>
      <p className="text-(length:--text-body) leading-(--leading-body) break-words whitespace-pre-wrap text-ink-1 select-text">
        {user.text}
      </p>
    </article>
  );
}
