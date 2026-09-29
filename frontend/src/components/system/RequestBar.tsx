import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { type GlyphState, StateGlyph } from "./StateGlyph";
import { TimeChip } from "./TimeChip";
import { Tooltip } from "./Tooltip";

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
  /** progressTooltip is the reason behind the progress: why the merge couldn't be confirmed. */
  progressTooltip?: string;
  /** flash blinks the bar in the veil of its gravity, as the situation is born with the screen open. */
  flash?: "error" | "wait";
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
  /** status is what the bar's status says; the label when absent. */
  status?: string;
  /** goTooltip says where Go leads: "Show the reviewer's conversation". */
  goTooltip?: string;
  /** flash blinks the bar in the veil of its gravity, as the situation is born with the screen open. */
  flash?: "error" | "wait";
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
  progressTooltip,
  flash,
  status,
  actions,
}: RequestBarProps) {
  const middle = progress !== undefined && (
    <span
      className="text-(length:--text-meta) leading-(--leading-meta) text-ink-2"
      {...(progressTooltip !== undefined ? { tabIndex: 0 } : {})}
    >
      {progress}
    </span>
  );
  return (
    <section
      aria-label="Request"
      data-form={form}
      tabIndex={-1}
      {...(flash !== undefined ? { "data-flash": flash } : {})}
      className={cn(BAR, BACKGROUNDS[form], "situation-flash outline-none")}
    >
      <span role="status" className="sr-only">
        {status}
      </span>
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <StateGlyph state={glyph} />
        <span className={cn("font-bold", LABELS[form])}>{label}</span>
        {place !== undefined && <span className="text-ink-2">· {place}</span>}
        {time !== undefined && <TimeChip tone={time.tone} time={time.short} longTime={time.long} />}
      </span>
      {middle !== false &&
        (progressTooltip === undefined ? (
          middle
        ) : (
          <Tooltip content={progressTooltip}>{middle}</Tooltip>
        ))}
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
  goTooltip,
  flash,
  status = label,
}: OtherConversationBarProps) {
  const go = (
    <Button size="sm" onClick={onGo}>
      {goLabel}
    </Button>
  );
  return (
    <section
      aria-label="Request"
      data-form={failed ? "other-failed" : "other-waits"}
      tabIndex={-1}
      {...(flash !== undefined ? { "data-flash": flash } : {})}
      className={cn(BAR, "bg-surface-0 situation-flash outline-none", failed && RAIL)}
    >
      <span role="status" className="sr-only">
        {status}
      </span>
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <StateGlyph state={failed ? "error" : "wait"} />
        <span className={failed ? "font-bold text-state-error" : "text-ink-2"}>{label}</span>
        {time !== undefined && (
          <TimeChip tone={failed ? "error" : "wait"} time={time.short} longTime={time.long} />
        )}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {goTooltip === undefined ? go : <Tooltip content={goTooltip}>{go}</Tooltip>}
      </div>
    </section>
  );
}
