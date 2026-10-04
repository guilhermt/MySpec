import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { CutText } from "./CutText";

export interface PanelRowProps {
  /** children is the text of the row, cut when it runs out of room, and whole in a tooltip then. */
  children: string;
  /** glyph is the sign in the first column: the check, a state glyph, the file icon. */
  glyph?: ReactNode;
  /** meta is what the row holds on the right: a time, a SHA, the choosers of a step. */
  meta?: ReactNode;
  /** onClick makes the row a button that opens what it names. */
  onClick?: () => void;
  /** nested is a row under another, indented past its glyph, as the reports under a step. */
  nested?: boolean;
  /** focusOnMount takes the focus when the row appears: the row a document opened in place came from. */
  focusOnMount?: boolean;
  /** pressed is a row that opens something and stands for what is open now: the conversation being read. */
  pressed?: boolean;
  /** busy is a row whose opening is on its way. */
  busy?: boolean;
  /** id names the row, for the focus to come back to it. */
  id?: string;
  /** label is the accessible name of a row that opens something, when its text and meta don't read as one. */
  label?: string;
  className?: string;
}

/** ROW is the line of a panel list, bled into the padding so its hover reaches the edges. */
const ROW =
  "-mx-(--space-2) flex w-[calc(100%+var(--space-4))] min-h-(--size-control-sm) items-center gap-(--space-2) rounded-sm px-(--space-2) text-left text-(length:--text-meta) leading-(--leading-meta) text-ink-1";

/** BUTTON is the hover, the press and the focus of a row that opens something; pressed, it is tinted. */
const BUTTON =
  "outline-none transition-colors duration-(--duration-fast) ease-standard not-aria-pressed:hover:bg-veil-hover not-aria-pressed:active:bg-veil-press focus-visible:focus-ring aria-pressed:bg-brand-tint-plane aria-pressed:text-brand-ink aria-pressed:shadow-[inset_0_0_0_var(--border)_var(--brand-marker-ring)]";

/** NESTED is a row under another: the second ink, shorter, past the glyph of the row above. */
const NESTED =
  "min-h-(--size-control-xs) pl-[calc(var(--space-2)+var(--icon-sm)+var(--space-2))] text-ink-2";

/**
 * PanelRow is one row of a list in a panel: the glyph, the text and the meta on the
 * right. A row that opens something is a button; a row that holds controls is not.
 */
export function PanelRow({
  children,
  glyph,
  meta,
  onClick,
  nested = false,
  focusOnMount = false,
  pressed,
  busy = false,
  id,
  label,
  className,
}: PanelRowProps) {
  const ref = useRef<HTMLButtonElement>(null);

  // Only on its arrival: the row takes the focus back from the document it opened.
  useEffect(() => {
    if (focusOnMount) {
      ref.current?.focus();
    }
  }, [focusOnMount]);

  const content = (
    <>
      {glyph !== undefined && (
        <span className="inline-grid w-(--icon-sm) shrink-0 place-items-center text-ink-3">
          {glyph}
        </span>
      )}
      <CutText text={children} className="flex-1" />
      {meta !== undefined && (
        <span className="flex shrink-0 items-center gap-(--space-1-5) text-(length:--text-micro) leading-(--leading-micro) whitespace-nowrap text-ink-3 tabular-nums">
          {meta}
        </span>
      )}
    </>
  );
  const classes = cn(ROW, nested && NESTED, className);

  if (onClick === undefined) {
    return <div className={classes}>{content}</div>;
  }
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      onClick={onClick}
      {...(pressed !== undefined ? { "aria-pressed": pressed } : {})}
      {...(busy ? { "aria-busy": true } : {})}
      {...(label !== undefined ? { "aria-label": label } : {})}
      className={cn(classes, BUTTON)}
    >
      {content}
    </button>
  );
}
