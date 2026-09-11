import { useEffect, useRef, useState } from "react";

/** Presence is an item on screen, and whether it is on its way out. */
export interface Presence<T> {
  key: string;
  item: T;
  leaving: boolean;
}

/**
 * mergePresence is what is on screen after the items changed: every current
 * item in its order, and every item that left kept where it was, marked as
 * leaving.
 */
export function mergePresence<T>(
  current: readonly Presence<T>[],
  items: readonly T[],
  keyOf: (item: T) => string,
): Presence<T>[] {
  const next = items.map((item) => ({ key: keyOf(item), item, leaving: false }));
  const present = new Set(next.map((entry) => entry.key));
  for (const [index, entry] of current.entries()) {
    if (!present.has(entry.key)) {
      // Where it was, or at the end of a list that got shorter: it leaves from
      // about the place the user saw it in.
      next.splice(Math.min(index, next.length), 0, { ...entry, leaving: true });
    }
  }
  return next;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * usePresence keeps the items that left on screen for exitMs, so that they
 * can animate out before they go.
 */
export function usePresence<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  exitMs: number,
): readonly Presence<T>[] {
  const [mergedItems, setMergedItems] = useState(items);
  const [rendered, setRendered] = useState(() => mergePresence([], items, keyOf));
  const exits = useRef(new Map<string, Timer>());

  // The list follows the items in the very render they change in, not in an
  // effect after it, so an entry on screen never shows an outdated copy of its
  // item. State set during render makes React render again at once, before any
  // child, and the outdated pass is never committed.
  if (items !== mergedItems) {
    setMergedItems(items);
    setRendered((current) => mergePresence(current, items, keyOf));
  }

  // Every entry that left has a timer of its own, armed once when it starts
  // leaving and called off only when it comes back. The items change identity
  // with every snapshot, often faster than exitMs: a single timer armed again
  // on each change would never let an entry go.
  useEffect(() => {
    const armed = exits.current;
    const leaving = new Set(rendered.filter((entry) => entry.leaving).map((entry) => entry.key));
    for (const [key, timer] of armed) {
      if (!leaving.has(key)) {
        clearTimeout(timer);
        armed.delete(key);
      }
    }
    for (const key of leaving) {
      if (armed.has(key)) {
        continue;
      }
      const timer = setTimeout(() => {
        armed.delete(key);
        // Only the copy on its way out goes; had the item come back in the
        // meantime, the entry stays.
        setRendered((current) => current.filter((entry) => !(entry.leaving && entry.key === key)));
      }, exitMs);
      armed.set(key, timer);
    }
  }, [rendered, exitMs]);

  useEffect(() => {
    const armed = exits.current;
    return () => {
      for (const timer of armed.values()) {
        clearTimeout(timer);
      }
      armed.clear();
    };
  }, []);

  return rendered;
}
