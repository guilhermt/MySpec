import {
  createContext,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

/** NARROW_PX is the sidebar width under which the rows take their short forms and drop the meta. */
export const NARROW_PX = 330;

/** SidebarWidthContext tells the tree whether the sidebar is narrow, under NARROW_PX. */
export const SidebarWidthContext = createContext(false);

/** useNarrow is the sidebar being narrow, under NARROW_PX. */
export function useNarrow(): boolean {
  return useContext(SidebarWidthContext);
}

// One ResizeObserver for the whole tree: each element keeps the callbacks of
// the hooks that measure it.
let observer: ResizeObserver | null = null;
const callbacks = new Map<Element, Set<() => void>>();

/**
 * observeSize calls back each time the element changes size, through the
 * tree's shared ResizeObserver, until the returned function stops it.
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
    return observeSize(element, measure);
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
    return observeSize(element, check);
  }, [box, measure, content]);

  return fits;
}
