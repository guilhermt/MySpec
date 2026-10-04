import { defaultRangeExtractor, type Range, useVirtualizer } from "@tanstack/react-virtual";
import {
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * WINDOW_VIEWPORT marks the element that scrolls a windowed list: the tests give it the size of a
 * screen, since jsdom lays nothing out.
 */
export const WINDOW_VIEWPORT = "data-window-viewport";

/**
 * WINDOW_READY marks the element that scrolls once the window has mounted the rows that show: what
 * looks for a row by the DOM, like the focus of an arrival, waits for it.
 */
export const WINDOW_READY = "data-window-ready";

export interface WindowedRowsOptions {
  /** count is how many rows the list has. */
  count: number;
  /** keyOf names the row at an index; the measures are kept by it. */
  keyOf: (index: number) => string;
  /** estimate is the height of a row before it is measured, in whole pixels. */
  estimate: (index: number) => number;
  /** pinned are the rows mounted wherever the scroll is: the tab stop, the open card… */
  pinned: readonly number[];
  /** scrollRef is the element that scrolls: the viewport of the ScrollArea. */
  scrollRef: RefObject<HTMLElement | null>;
  /** listRef is the element that holds the rows and the spacers, inside what scrolls. */
  listRef: RefObject<HTMLElement | null>;
  /** stickyRef is what sticks to the top of the scroll over the list, like the FilterBar: a row brought into view lands below it and its fade. */
  stickyRef?: RefObject<HTMLElement | null>;
  /** overscan is how many rows are mounted past each end of what shows. */
  overscan: number;
  /**
   * keepEnd tells that the caller keeps the list at its end by itself, as the conversation follows
   * the end it is read at: while it holds, a row that changes height does not correct the scroll.
   */
  keepEnd?: (() => boolean) | undefined;
  /** startAtEnd opens the list at the end of what scrolls: the conversation. */
  startAtEnd?: boolean;
}

export type WindowPart =
  | { kind: "row"; index: number; key: string }
  | { kind: "spacer"; key: string; height: number };

export interface WindowedRows {
  /** parts are what the list draws, in order: the mounted rows and the spacers between them. */
  parts: readonly WindowPart[];
  /** measureRef goes on the element of each mounted row, with data-index={index}. */
  measureRef: (element: HTMLElement | null) => void;
  /** scrollToIndex brings a row into view, aligned to the nearest edge (or to "end" or "center"), never smoothly. */
  scrollToIndex: (index: number, align?: "auto" | "end" | "center") => void;
  /** mounted tells whether a row is in the DOM now. */
  mounted: (index: number) => boolean;
  /** attached tells that the element that scrolls is known: the rows the window mounts are the ones that show. */
  attached: boolean;
}

// pixels reads a computed length in pixels, 0 for a value that is not one ("normal", "auto").
function pixels(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

// offsetIn is the distance of the top of the list from the top of the content that scrolls.
function offsetIn(list: HTMLElement, scroll: HTMLElement): number {
  return Math.round(
    list.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop,
  );
}

// stickyHeight is the height of what sticks over the list plus its fade (the ::after), which a row
// brought into view must land below.
function stickyHeight(sticky: HTMLElement): number {
  return Math.round(
    sticky.getBoundingClientRect().height + pixels(getComputedStyle(sticky, "::after").height),
  );
}

/**
 * useWindowedRows keeps mounted only the rows of a long list that show, plus the pinned ones and an
 * overscan, and draws the rest as spacers of whole pixels: the rows stay in the flow of the list, with
 * no transform and no absolute position. The virtualizer of TanStack is only the calculation here
 * (what to mount, the measures, the scroll to an index, the correction when a row above the view
 * changes height); the DOM and the element that scrolls stay the caller's.
 */
export function useWindowedRows({
  count,
  keyOf,
  estimate,
  pinned,
  scrollRef,
  listRef,
  stickyRef,
  overscan,
  keepEnd,
  startAtEnd = false,
}: WindowedRowsOptions): WindowedRows {
  // The element that scrolls is attached after the rows that sit inside it first commit, so the
  // virtualizer learns it from the first layout effect.
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [gap, setGap] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [scrollPaddingStart, setScrollPaddingStart] = useState(0);

  // The ScrollArea attaches its viewport a little after the layout effects of the commit that
  // mounts it: the layout effect takes it when it is there, the effect when it is not.
  const learnScrollElement = useCallback(() => {
    const element = scrollRef.current;
    if (element !== null) {
      element.setAttribute(WINDOW_VIEWPORT, "");
    }
    setScrollElement(element);
  }, [scrollRef]);
  useLayoutEffect(learnScrollElement, [learnScrollElement]);
  useEffect(learnScrollElement, [learnScrollElement]);

  // What the list sits under moves it, and the sticky bar changes height with its wrapped lines.
  useLayoutEffect(() => {
    const scroll = scrollElement;
    const list = listRef.current;
    if (scroll === null || list === null) {
      return;
    }
    const measure = () => {
      setGap(pixels(getComputedStyle(list).rowGap));
      setScrollMargin(offsetIn(list, scroll));
      const sticky = stickyRef?.current;
      setScrollPaddingStart(sticky === null || sticky === undefined ? 0 : stickyHeight(sticky));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (scroll.firstElementChild !== null) {
      observer.observe(scroll.firstElementChild);
    }
    return () => observer.disconnect();
  }, [scrollElement, listRef, stickyRef]);

  const pinnedKey = pinned.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: pinnedKey is pinned, as a value
  const rangeExtractor = useCallback(
    (range: Range) =>
      [
        ...new Set([
          ...defaultRangeExtractor(range),
          ...pinned.filter((index) => index >= 0 && index < range.count),
        ]),
      ].sort((a, b) => a - b),
    [pinnedKey],
  );

  const virtualizer = useVirtualizer<HTMLElement, HTMLElement>({
    count,
    getScrollElement: () => scrollElement,
    estimateSize: estimate,
    getItemKey: keyOf,
    overscan,
    useFlushSync: false,
    rangeExtractor,
    measureElement: (element) => Math.round(element.getBoundingClientRect().height),
    gap,
    scrollMargin,
    scrollPaddingStart,
  });

  // Where the list is read away from the end, the correction is the virtualizer's own: a row above
  // the view that changes height moves the scroll by the difference, so what shows stays.
  const keepEndRef = useRef(keepEnd);
  keepEndRef.current = keepEnd;
  if (keepEnd !== undefined) {
    virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item, _delta, instance) => {
      // With every row mounted there is no estimate in the DOM to correct for: it is the truth.
      if (
        keepEndRef.current?.() === true ||
        instance.getVirtualItems().length >= instance.options.count
      ) {
        return false;
      }
      const offset = (instance.scrollOffset ?? 0) + instance.scrollAdjustments;
      return instance.itemSizeCache.has(item.key)
        ? item.end <= offset && instance.scrollDirection !== "backward"
        : item.start < offset;
    };
  }

  const started = useRef(false);
  // The list opens at the end in the layout effect of the commit that first has rows and the
  // element that scrolls, unless something already moved the scroll.
  useLayoutEffect(() => {
    if (!startAtEnd || started.current || count === 0 || scrollElement === null) {
      return;
    }
    started.current = true;
    if (scrollElement.scrollTop !== 0) {
      return;
    }
    // To the end of what scrolls, which can hold more after the list (the tail of the
    // conversation): scrollToIndex would stop at the end of the last row.
    const end = Math.max(scrollElement.scrollHeight, virtualizer.getTotalSize() + scrollMargin);
    scrollElement.scrollTo({ top: Math.max(0, end - scrollElement.clientHeight) });
  }, [startAtEnd, count, scrollElement, virtualizer, scrollMargin]);

  const items = virtualizer.getVirtualItems();
  const parts = useMemo((): WindowPart[] => {
    const first = items[0];
    const last = items.at(-1);
    if (first === undefined || last === undefined) {
      return [];
    }
    const totalEnd = virtualizer.measurementsCache[count - 1]?.end ?? last.end;
    const out: WindowPart[] = [];
    if (first.index > 0) {
      out.push({
        kind: "spacer",
        key: `spacer:${first.index}`,
        height: Math.max(0, Math.round(first.start - scrollMargin - gap)),
      });
    }
    items.forEach((item, at) => {
      const before = items[at - 1];
      if (before !== undefined && item.index > before.index + 1) {
        out.push({
          kind: "spacer",
          key: `spacer:${item.index}`,
          height: Math.max(0, Math.round(item.start - before.end - 2 * gap)),
        });
      }
      out.push({ kind: "row", index: item.index, key: String(item.key) });
    });
    if (last.index < count - 1) {
      out.push({
        kind: "spacer",
        key: "spacer:end",
        height: Math.max(0, Math.round(totalEnd - last.end - gap)),
      });
    }
    return out;
  }, [items, virtualizer, count, scrollMargin, gap]);

  // The window is ready once it holds the rows of a list that has some: the first commit, before
  // the element that scrolls is known, holds none.
  const ready = scrollElement !== null && (count === 0 || items.length > 0);
  useLayoutEffect(() => {
    if (ready) {
      scrollElement?.setAttribute(WINDOW_READY, "");
    }
  }, [ready, scrollElement]);

  const mountedIndexes = useMemo(() => new Set(items.map((item) => item.index)), [items]);

  const scrollToIndex = useCallback(
    (index: number, align: "auto" | "end" | "center" = "auto") =>
      virtualizer.scrollToIndex(index, { align, behavior: "auto" }),
    [virtualizer],
  );
  const mounted = useCallback((index: number) => mountedIndexes.has(index), [mountedIndexes]);

  return {
    parts,
    measureRef: virtualizer.measureElement,
    scrollToIndex,
    mounted,
    attached: scrollElement !== null,
  };
}
