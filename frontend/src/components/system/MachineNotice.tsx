import { Button } from "./Button";
import { StateGlyph } from "./StateGlyph";

export interface MachineNoticeProps {
  /** title is the missing item, or how many things need attention. */
  title: string;
  /** text is what the lack costs. */
  text: string;
  onOpen: () => void;
  onDismiss: () => void;
}

/**
 * MachineNotice is the strip at the top of the main area that says something on the machine keeps part
 * of MySpec from working: what, or how many, with the way to Settings › Machine. It is no failure of an
 * action, so it is never red; it stays until it is dismissed or a check finds nothing missing.
 */
export function MachineNotice({ title, text, onOpen, onDismiss }: MachineNoticeProps) {
  return (
    <div
      role="status"
      className="flex min-h-(--size-ask) shrink-0 flex-wrap items-center gap-(--space-2) border-b border-line-1 bg-surface-0 py-(--space-1-5) pr-(--space-2) pl-(--space-5) text-(length:--text-ui) leading-(--leading-ui)"
    >
      <StateGlyph state="blocked" />
      <span className="min-w-0 font-semibold text-ink-1">{title}</span>
      <span className="min-w-0 flex-1 basis-(--notice-detail-min) text-(length:--text-meta) leading-(--leading-meta) text-ink-2">
        {text}
      </span>
      <Button variant="ghost" size="sm" onClick={onOpen} aria-label="Open Settings › Machine">
        Open Settings
      </Button>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}
