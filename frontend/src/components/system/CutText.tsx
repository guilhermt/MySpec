import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { observeSize } from "./fits";
import { Tooltip } from "./Tooltip";

export interface CutTextProps {
  /** text is the whole text, which the tooltip says once the line cuts it. */
  text: string;
  /** children draw the text in place of the plain one, like a value that shimmers while it is read. */
  children?: ReactNode;
  id?: string;
  /** lines is how many lines the text takes before it is cut; one by default. */
  lines?: 1 | 2;
  className?: string;
}

/**
 * CutText is a text on one line, or two, that the space it has may cut: cut, the pointer resting on
 * it opens the whole text in a tooltip; whole, nothing opens.
 */
export function CutText({ text, children, id, lines = 1, className }: CutTextProps) {
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

  return (
    <Tooltip content={text} hover={cut}>
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
