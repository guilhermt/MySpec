import { ArrowDown } from "lucide-react";
import { type RefObject, useEffect, useState } from "react";
import { Icon } from "@/components/system/Icon";
import { observeSize } from "@/features/sidebar/useFits";
import { ENTRY_ATTRIBUTE } from "@/features/sidebar/useTreeKeyboard";

export interface MoreBelowProps {
  /** viewport is the scrolling viewport of the tree, which the indicator sits at the foot of. */
  viewport: RefObject<HTMLElement | null>;
}

/** entriesBelow counts the lines of the tree whose top is past the bottom of the viewport. */
function entriesBelow(viewport: HTMLElement): number {
  const bottom = viewport.getBoundingClientRect().bottom;
  let count = 0;
  for (const line of viewport.querySelectorAll(`[${ENTRY_ATTRIBUTE}]`)) {
    if (line.getBoundingClientRect().top > bottom) {
      count += 1;
    }
  }
  return count;
}

/**
 * MoreBelow says how many lines of the tree are below the fold, over a fade at
 * the foot of the viewport, and scrolls to the end on a click. It is not a Tab
 * stop: the keyboard walks the tree itself. Nothing below, it is gone.
 */
export function MoreBelow({ viewport }: MoreBelowProps) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const element = viewport.current;
    if (element === null) {
      return;
    }
    const recount = () => setCount(entriesBelow(element));
    recount();
    element.addEventListener("scroll", recount, { passive: true });
    // The viewport resizes with the window; its content, as nodes expand and
    // collapse and items come and go.
    const stops = [element, ...element.children].map((observed) => observeSize(observed, recount));
    return () => {
      element.removeEventListener("scroll", recount);
      for (const stop of stops) {
        stop();
      }
    };
  }, [viewport]);

  if (count === 0) {
    return null;
  }

  return (
    <div
      role="none"
      className="pointer-events-none sticky bottom-0 -mt-(--size-more-below) flex h-(--size-more-below) items-end bg-linear-to-b from-transparent to-surface-sidebar to-70% pr-(--space-2) pb-(--space-1) pl-[calc(var(--space-2)+var(--tree-pad)+var(--icon)+var(--space-2-5))]"
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={() => {
          const element = viewport.current;
          if (element !== null) {
            element.scrollTop = element.scrollHeight;
          }
        }}
        className="pointer-events-auto inline-flex items-center gap-(--space-1) rounded-xs text-(length:--text-micro) leading-(--leading-micro) text-ink-3 transition-colors duration-(--duration-fast) ease-standard hover:text-ink-1"
      >
        <Icon icon={ArrowDown} size="xs" />
        {count} more below
      </button>
    </div>
  );
}
