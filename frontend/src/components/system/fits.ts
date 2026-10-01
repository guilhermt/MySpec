import { type RefObject, useLayoutEffect, useState } from "react";

// One ResizeObserver for the whole app: each element keeps the callbacks of
// the hooks that measure it.
let observer: ResizeObserver | null = null;
const callbacks = new Map<Element, Set<() => void>>();

/**
 * observeSize calls back each time the element changes size, through the
 * shared ResizeObserver, until the returned function stops it.
 */
export function observeSize(element: Element, callback: () => void): () => void {
  if (observer === null) {
    observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        for (const run of callbacks.get(entry.target) ?? []) {
          run();
        }
      }
    });
  }
  const own = callbacks.get(element) ?? new Set();
  if (own.size === 0) {
    callbacks.set(element, own);
    observer.observe(element);
  }
  own.add(callback);
  return () => {
    own.delete(callback);
    if (own.size === 0) {
      callbacks.delete(element);
      observer?.unobserve(element);
    }
  };
}

/** useFits tells whether the natural width of `measure` fits in `box`: measure is an invisible, nowrap copy of the long content. */
export function useFits(
  box: RefObject<HTMLElement | null>,
  measure: RefObject<HTMLElement | null>,
  content: string,
): boolean {
  const [fits, setFits] = useState(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new content is a new width to measure
  useLayoutEffect(() => {
    const element = box.current;
    if (element === null) {
      return;
    }
    const check = () => setFits((measure.current?.scrollWidth ?? 0) <= element.clientWidth);
    check();
    return observeSize(element, check);
  }, [box, measure, content]);

  return fits;
}
