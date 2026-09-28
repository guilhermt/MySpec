import { type ReactNode, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface PanelRowProps {
  /** children is the text of the row, cut when it runs out of room. */
  children: ReactNode;
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
  className?: string;
}

/** ROW is the line of a panel list, bled into the padding so its hover reaches the edges. */
const ROW =
  "-mx-(--space-2) flex w-[calc(100%+var(--space-4))] min-h-(--size-control-sm) items-center gap-(--space-2) rounded-sm px-(--space-2) text-left text-(length:--text-meta) leading-(--leading-meta) text-ink-1";

/** BUTTON is the hover, the press and the focus of a row that opens something. */
const BUTTON =
  "outline-none transition-colors duration-(--duration-fast) ease-standard hover:bg-veil-hover active:bg-veil-press focus-visible:focus-ring";

/** NESTED is a row under another: the second ink, shorter, past the glyph of the row above. */
const NESTED =
  "min-h-(--size-control-xs) pl-[calc(var(--space-2)+var(--icon-sm)+var(--space-2))] text-ink-2";

/**
 * PanelRow is one row of a list in a panel of the task: the glyph, the text and the meta on the
 * right. A row that opens something is a button; a row that holds controls is not.
 */
export function PanelRow({
  children,
  glyph,
  meta,
  onClick,
  nested = false,
  focusOnMount = false,
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
      <span className="min-w-0 flex-1 truncate">{children}</span>
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
    <button ref={ref} type="button" onClick={onClick} className={cn(classes, BUTTON)}>
      {content}
    </button>
  );
}
