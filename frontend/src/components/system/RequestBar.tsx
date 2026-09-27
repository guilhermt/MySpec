import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { type GlyphState, StateGlyph } from "./StateGlyph";
import { TimeChip } from "./TimeChip";

/** RequestForm is each form of the request bar (components.md, Barra do pedido). */
export type RequestForm = "quiet" | "tinted" | "decision" | "error" | "closing";

export interface RequestBarProps {
  form: RequestForm;
  glyph: GlyphState;
  label: string;
  /** place is where in the item the request is: "Reviewer", "PR review · pass 1". */
  place?: string;
  time?: { short: string; long: string; tone: "wait" | "error" | "close" };
  /** progress is how far the request is: "1 of 4 decided", "5 of 7 files staged · 71%". */
  progress?: string;
  /** status is the sentence the bar's status says when it appears or changes on its own. */
  status: string;
  actions: ReactNode;
}

export interface OtherConversationBarProps {
  /** failed is the other conversation having stopped on an error; otherwise it waits. */
  failed: boolean;
  /** label is what the other conversation asks: "The reviewer waits · Question". */
  label: string;
  time?: { short: string; long: string };
  onGo: () => void;
  /** goLabel names the way to the other conversation: "Go to reviewer". */
  goLabel: string;
}

/**
 * BAR is the frame every form shares: in the conversation column, centered on a whole pixel, at
 * least --size-ask high, and wrapping to two lines before an action would be hidden.
 */
const BAR =
  "relative flex min-h-(--size-ask) w-full max-w-(--measure-conversation) ml-[max(0px,round(down,calc((100%_-_var(--measure-conversation))/2),1px))] flex-wrap items-center gap-2 rounded-md py-1.5 pr-1.5 pl-4 text-(length:--text-ui) leading-(--leading-ui) text-ink-1";

/** RAIL is the error rail on the left edge of a bar that failed. */
const RAIL = "pl-5 shadow-[inset_var(--error-rail)_0_0_var(--state-error)]";

/** BACKGROUNDS are the ground of each form: quiet where the card holds the answer, tinted where the bar does. */
const BACKGROUNDS: Record<RequestForm, string> = {
  quiet: "bg-surface-0",
  tinted: "bg-state-wait-veil",
  decision: "bg-state-wait-veil",
  error: cn("bg-state-error-veil", RAIL),
  closing: "bg-surface-0",
};

/** LABELS are the ink of the label of each form. */
const LABELS: Record<RequestForm, string> = {
  quiet: "text-ink-1",
  tinted: "text-state-wait",
  decision: "text-state-wait",
  error: "text-state-error",
  closing: "text-state-close",
};

/**
 * RequestBar is the call of an item that asks something of the user, above the composer: what it
 * asks, where and for how long, how far it is, and the actions that resolve it.
 */
export function RequestBar({
  form,
  glyph,
  label,
  place,
  time,
  progress,
  status,
  actions,
}: RequestBarProps) {
  return (
    <section aria-label="Request" data-form={form} className={cn(BAR, BACKGROUNDS[form])}>
      <span role="status" className="sr-only">
        {status}
      </span>
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <StateGlyph state={glyph} />
        <span className={cn("font-bold", LABELS[form])}>{label}</span>
        {place !== undefined && <span className="text-ink-2">· {place}</span>}
        {time !== undefined && <TimeChip tone={time.tone} time={time.short} longTime={time.long} />}
      </span>
      {progress !== undefined && (
        <span className="text-(length:--text-meta) leading-(--leading-meta) text-ink-2">
          {progress}
        </span>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">{actions}</div>
    </section>
  );
}

/**
 * OtherConversationBar is the request bar when only the other conversation of the step asks: it
 * says so and leads there.
 */
export function OtherConversationBar({
  failed,
  label,
  time,
  onGo,
  goLabel,
}: OtherConversationBarProps) {
  return (
    <section
      aria-label="Request"
      data-form={failed ? "other-failed" : "other-waits"}
      className={cn(BAR, "bg-surface-0", failed && RAIL)}
    >
      <span role="status" className="sr-only">
        {label}
      </span>
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <StateGlyph state={failed ? "error" : "wait"} />
        <span className={failed ? "font-bold text-state-error" : "text-ink-2"}>{label}</span>
        {time !== undefined && (
          <TimeChip tone={failed ? "error" : "wait"} time={time.short} longTime={time.long} />
        )}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        <Button size="sm" onClick={onGo}>
          {goLabel}
        </Button>
      </div>
    </section>
  );
}
