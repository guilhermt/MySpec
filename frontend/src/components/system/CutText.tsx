import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { observeSize } from "./fits";
import { Tooltip } from "./Tooltip";

export interface CutTextProps {
  /** text is the whole text, which the tooltip says once the line cuts it. */
  text: string;
  /** tooltip says more than the text when the line cuts it; the text itself by default. */
  tooltip?: ReactNode | readonly string[];
  /** children draw the text in place of the plain one, like a value that shimmers while it is read. */
  children?: ReactNode;
  id?: string;
  /** lines is how many lines the text takes before it is cut; one by default. */
  lines?: 1 | 2;
  /** onCut hears whether the text is cut, now and each time that changes. */
  onCut?: (cut: boolean) => void;
  className?: string;
}

/**
 * CutText is a text on one line, or two, that the space it has may cut: cut, the pointer resting on
 * it opens the whole text in a tooltip; whole, nothing opens.
 */
export function CutText({
  text,
  tooltip,
  children,
  id,
  lines = 1,
  onCut,
  className,
}: CutTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new text is a new width to measure
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const check = () =>
      setCut(
        lines === 1
          ? element.scrollWidth > element.clientWidth
          : element.scrollHeight > element.clientHeight,
      );
    check();
    return observeSize(element, check);
  }, [text, lines]);

  useEffect(() => onCut?.(cut), [cut, onCut]);

  return (
    <Tooltip content={tooltip ?? text} hover={cut}>
      <span
        ref={ref}
        {...(id !== undefined ? { id } : {})}
        className={cn("min-w-0", lines === 1 ? "truncate" : "line-clamp-2", className)}
      >
        {children ?? text}
      </span>
    </Tooltip>
  );
}
