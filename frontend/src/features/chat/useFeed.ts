import { type RefObject, useEffect } from "react";

const ITEM = "[data-feed-item]";
const TOGGLE = "[data-feed-toggle]";
const PENDING = "[data-pending-card]";

/** PAGE is how many entries Page Up and Page Down move. */
const PAGE = 10;

function itemsOf(feed: HTMLElement): HTMLElement[] {
  return [...feed.querySelectorAll<HTMLElement>(ITEM)].filter((item) => !item.closest("[hidden]"));
}

// entryOf is the item the element stands in, the element itself when it is one.
function entryOf(element: Element | null): HTMLElement | null {
  return element?.closest<HTMLElement>(ITEM) ?? null;
}

// makeCurrent leaves one stop of Tab in the feed: the item given.
function makeCurrent(items: readonly HTMLElement[], current: HTMLElement | null): void {
  for (const item of items) {
    item.tabIndex = item === current ? 0 : -1;
  }
}

// toggleOf is the control that opens and folds the item: the item itself, or its own toggle
// (not the one of an item inside it).
function toggleOf(item: HTMLElement): HTMLElement | null {
  if (item.matches(TOGGLE)) {
    return item;
  }
  const toggles = item.querySelectorAll<HTMLElement>(TOGGLE);
  return [...toggles].find((toggle) => entryOf(toggle) === item) ?? null;
}

function go(item: HTMLElement | undefined, items: readonly HTMLElement[]): void {
  if (item === undefined) {
    return;
  }
  makeCurrent(items, item);
  item.focus();
  item.scrollIntoView?.({ block: "nearest" });
}

// target is where a key moves from the item at index, null for a key the feed doesn't move with.
function target(key: string, index: number, count: number): number | null {
  switch (key) {
    case "ArrowUp":
      return Math.max(index - 1, 0);
    case "ArrowDown":
      return Math.min(index + 1, count - 1);
    case "PageUp":
      return Math.max(index - PAGE, 0);
    case "PageDown":
      return Math.min(index + PAGE, count - 1);
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

// toggle opens, folds or goes to the parent entry, for →, ←, Enter and Space; false for other keys.
function toggle(key: string, item: HTMLElement, items: readonly HTMLElement[]): boolean {
  const control = toggleOf(item);
  const expanded = control?.getAttribute("aria-expanded");
  switch (key) {
    case "ArrowRight":
      if (expanded === "false") {
        control?.click();
      }
      return true;
    case "ArrowLeft":
      if (expanded === "true") {
        control?.click();
      } else {
        const parent = entryOf(item.parentElement);
        if (parent !== null) {
          go(parent, items);
        }
      }
      return true;
    case "Enter":
    case " ":
      control?.click();
      return control !== null;
    default:
      return false;
  }
}

/**
 * useFeed makes the feed one stop of Tab over its entries, the elements with data-feed-item in the
 * order of the page: arriving, the pending card or the last entry; the arrows, Page Up and Down,
 * Home and End walk them; → and ← open and fold the data-feed-toggle of an entry, and ← goes from
 * a folded inner entry to the one around it. An entry with data-feed-keys="own" keeps the arrows.
 */
export function useFeed(feedRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const feed = feedRef.current;
    if (feed === null) {
      return;
    }

    // sync keeps one stop: the entry holding the focus, else the pending card or the last entry.
    const sync = () => {
      const items = itemsOf(feed);
      const focused = feed.contains(document.activeElement)
        ? entryOf(document.activeElement)
        : null;
      const pending = entryOf(feed.querySelector(PENDING));
      makeCurrent(items, focused ?? pending ?? items.at(-1) ?? null);
    };

    const onFocusIn = (event: FocusEvent) => {
      const item = entryOf(event.target instanceof Element ? event.target : null);
      if (item !== null) {
        makeCurrent(itemsOf(feed), item);
      }
    };

    const onFocusOut = (event: FocusEvent) => {
      if (!(event.relatedTarget instanceof Node && feed.contains(event.relatedTarget))) {
        sync();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const item = event.target instanceof HTMLElement ? event.target : null;
      if (item === null || !item.matches(ITEM) || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (item.dataset.feedKeys === "own" && event.key.startsWith("Arrow")) {
        return;
      }
      const items = itemsOf(feed);
      const next = target(event.key, items.indexOf(item), items.length);
      if (next !== null) {
        event.preventDefault();
        go(items[next], items);
      } else if (toggle(event.key, item, items)) {
        event.preventDefault();
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(feed, { childList: true, subtree: true });
    feed.addEventListener("focusin", onFocusIn);
    feed.addEventListener("focusout", onFocusOut);
    feed.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      feed.removeEventListener("focusin", onFocusIn);
      feed.removeEventListener("focusout", onFocusOut);
      feed.removeEventListener("keydown", onKeyDown);
    };
  }, [feedRef]);
}
