import { type RefObject, useEffect, useLayoutEffect, useState } from "react";

// One ResizeObserver for the whole tree: each element keeps the callbacks of
// the hooks that measure it.
let observer: ResizeObserver | null = null;
const callbacks = new Map<Element, Set<() => void>>();

function observe(element: Element, callback: () => void): () => void {
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

/** useWidth is the width of an element, followed by the tree's shared ResizeObserver. */
export function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (element === null) {
      return;
    }
    const measure = () => setWidth(element.clientWidth);
    measure();
    return observe(element, measure);
  }, [ref]);

  return width;
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
    return observe(element, check);
  }, [box, measure, content]);

  return fits;
}
