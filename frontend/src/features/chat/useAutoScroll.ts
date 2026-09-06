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
  /** hasNew is true when something arrived while the user was reading further up. */
  hasNew: boolean;
  scrollToBottom: () => void;
}

/**
 * useAutoScroll keeps the end of the conversation in view while the user is
 * already there, and never steals the scroll away from someone reading back:
 * for them the arrival only lights up the pill.
 */
export function useAutoScroll(
  ref: RefObject<HTMLElement | null>,
  deps: readonly unknown[],
): AutoScroll {
  const [hasNew, setHasNew] = useState(false);
  const atBottom = useRef(true);
  const previous = useRef(deps);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const onScroll = () => {
      atBottom.current = atBottomOf(element);
      if (atBottom.current) {
        setHasNew(false);
      }
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [ref]);

  const scrollToBottom = useCallback(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    toBottom(element);
    atBottom.current = true;
    setHasNew(false);
  }, [ref]);

  // The effect runs on every render and compares the values itself, so the
  // caller can pass the lengths and the streaming text as a plain array.
  useEffect(() => {
    if (same(previous.current, deps)) {
      return;
    }
    previous.current = deps;
    const element = ref.current;
    if (element === null) {
      return;
    }
    if (atBottom.current) {
      toBottom(element);
    } else {
      setHasNew(true);
    }
  });

  return { hasNew, scrollToBottom };
}
