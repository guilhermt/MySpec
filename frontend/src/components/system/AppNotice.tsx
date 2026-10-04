import { Button } from "./Button";

export interface AppNoticeProps {
  /** label is the action that failed, with its item: "Couldn't pause Rate limit per API key". */
  label: string;
  /** detail is what happened and, when the action has a known way out, what to do. */
  detail: string;
  onDismiss: () => void;
}

/**
 * AppNotice is the strip at the top of the main area that says an action failed: which one, what
 * happened and what to do. It stays until it is dismissed; the next failure replaces it.
 */
export function AppNotice({ label, detail, onDismiss }: AppNoticeProps) {
  return (
    <div
      role="alert"
      className="flex min-h-(--size-ask) shrink-0 flex-wrap items-center gap-(--space-2) bg-state-error-veil py-(--space-1-5) pr-(--space-2) pl-(--space-5) text-(length:--text-ui) leading-(--leading-ui) text-ink-1 shadow-[inset_var(--error-rail)_0_0_var(--state-error)]"
    >
      <span className="min-w-0 font-bold text-state-error">{label}</span>
      {/* The detail keeps a readable width, and goes under a long label instead of squeezing. */}
      <span className="min-w-0 flex-1 basis-(--notice-detail-min) text-(length:--text-meta) leading-(--leading-meta) text-ink-2">
        {detail}
      </span>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
