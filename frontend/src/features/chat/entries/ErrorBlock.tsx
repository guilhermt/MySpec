import { asErrorKind, type ErrorEntry, type ErrorKind } from "@/lib/wails";
import { clockTime } from "@/lib/when";

const EXPLANATIONS: Record<ErrorKind, string> = {
  process_exit: "Claude Code stopped unexpectedly.",
  start_failed: "Claude Code couldn't start.",
  not_found:
    "Claude Code wasn't found on this machine. Install it, or check that claude is on the PATH.",
  not_logged_in: "Claude Code isn't logged in. Run claude in a terminal and log in.",
  turn_error: "The agent couldn't finish the turn.",
};

export interface ErrorBlockProps {
  error: ErrorEntry;
  createdAt: string;
}

/** ErrorBlock is a failure of the session, told in the conversation; retrying is on the request bar. */
export function ErrorBlock({ error, createdAt }: ErrorBlockProps) {
  return (
    <article
      data-feed-item
      tabIndex={-1}
      aria-label={`Session error, ${clockTime(createdAt, Date.now())}`}
      className="flex flex-col gap-(--space-1) rounded-md bg-surface-0 px-(--space-4) py-(--space-3) shadow-[inset_var(--error-rail)_0_0_var(--state-error)] outline-none focus-visible:focus-ring"
    >
      <p className="text-(length:--text-body) leading-(--leading-body) text-ink-1">
        {EXPLANATIONS[asErrorKind(error.kind)]}
      </p>
      {error.message !== "" && (
        <pre className="overflow-x-auto font-mono text-(length:--text-micro) leading-(--leading-micro) text-ink-2 select-text">
          {error.message}
        </pre>
      )}
    </article>
  );
}
