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
  className?: string;
}

/**
 * CutText is a text on one line that the space it has may cut: cut, the pointer resting on it opens
 * the whole text in a tooltip; whole, nothing opens.
 */
export function CutText({ text, children, id, className }: CutTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [cut, setCut] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new text is a new width to measure
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const check = () => setCut(element.scrollWidth > element.clientWidth);
    check();
    return observeSize(element, check);
  }, [text]);

  return (
    <Tooltip content={text} hover={cut}>
      <span
        ref={ref}
        {...(id !== undefined ? { id } : {})}
        className={cn("min-w-0 truncate", className)}
      >
        {children ?? text}
      </span>
    </Tooltip>
  );
}
