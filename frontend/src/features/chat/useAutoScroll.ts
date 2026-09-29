import { type RefObject, useCallback, useEffect, useRef, useState } from "react";

// How far from the end still counts as reading the end of the conversation.
const BOTTOM_SLACK = 24;

function atBottomOf(element: HTMLElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < BOTTOM_SLACK;
}

function toBottom(element: HTMLElement): void {
  element.scrollTo({ top: element.scrollHeight });
}

function same(left: readonly unknown[], right: readonly unknown[]): boolean {
  return left.length === right.length && left.every((value, at) => value === right[at]);
}

/** AutoScroll is what the conversation needs to follow, or offer to follow, the end. */
export interface AutoScroll {
  /** atBottom is true while the user is reading the end of the conversation. */
  atBottom: boolean;
  /** newCount is how many rows were born since the user left the end; a row that grows counts once. */
  newCount: number;
  scrollToBottom: () => void;
}

/**
 * useAutoScroll keeps the end of the conversation in view while the user is
 * there, whatever makes the conversation grow, and never moves the scroll away
 * from someone reading further up: for them an arrival only counts in newCount, by the keys of the
 * rows seen when they left the end. With
 * follow false, as for a conversation read from its start, it never scrolls and
 * never offers the way back to the end.
 */
export function useAutoScroll(
  ref: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  deps: readonly unknown[],
  rowKeys: readonly string[],
  follow = true,
): AutoScroll {
  // seen is the rows on screen when the user left the end; null at the end.
  const [seen, setSeen] = useState<ReadonlySet<string> | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const atBottomRef = useRef(true);
  const rowKeysRef = useRef(rowKeys);
  rowKeysRef.current = rowKeys;
  const previous = useRef(deps);

  const markAtBottom = useCallback((value: boolean) => {
    if (value !== atBottomRef.current) {
      setSeen(value ? null : new Set(rowKeysRef.current));
    }
    atBottomRef.current = value;
    setAtBottom(value);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const onScroll = () => markAtBottom(atBottomOf(element));
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [ref, markAtBottom]);

  // Growth that no dep captures, like Markdown rendering late or the viewport
  // shrinking under a taller composer, must still keep the reader at the end.
  useEffect(() => {
    const element = ref.current;
    const content = contentRef.current;
    if (!follow || element === null || content === null) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current) {
        toBottom(element);
      }
    });
    observer.observe(element);
    observer.observe(content);
    return () => observer.disconnect();
  }, [ref, contentRef, follow]);

  const scrollToBottom = useCallback(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    toBottom(element);
    markAtBottom(true);
  }, [ref, markAtBottom]);

  // The effect runs on every render and compares the values itself, so the
  // caller can pass the lengths and the streaming text as a plain array.
  useEffect(() => {
    if (!follow || same(previous.current, deps)) {
      return;
    }
    previous.current = deps;
    const element = ref.current;
    if (element === null) {
      return;
    }
    if (atBottomRef.current) {
      toBottom(element);
    }
  });

  const newCount = seen === null ? 0 : rowKeys.filter((key) => !seen.has(key)).length;
  // Not following, the reader is never away from an end they are taken back to.
  return follow
    ? { atBottom, newCount, scrollToBottom }
    : { atBottom: true, newCount: 0, scrollToBottom };
}
