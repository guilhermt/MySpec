import { type RefObject, useEffect } from "react";

const ITEM = "[data-feed-item]";
const TOGGLE = "[data-feed-toggle]";
const PENDING = "[data-pending-card]";

/**
 * ENTRY marks an entry whose stop is its toggle, not itself: a group, a line or a command that
 * opens. The toggle is its first item, and what it opens into belongs to it.
 */
const ENTRY = "[data-feed-entry]";

// CONTROL is what takes the focus by Tab inside an entry: links, buttons, fields, anything with a
// tabindex.
const CONTROL =
  'a[href], button, input, select, textarea, summary, iframe, [tabindex], [contenteditable="true"], [contenteditable=""]';

/** PAGE is how many entries Page Up and Page Down move. */
const PAGE = 10;

function itemsOf(feed: HTMLElement): HTMLElement[] {
  return [...feed.querySelectorAll<HTMLElement>(ITEM)].filter((item) => !item.closest("[hidden]"));
}

// entryOf is the item the element stands in: the element itself when it is one, the item around
// it, or the toggle of the entry it is in.
function entryOf(element: Element | null): HTMLElement | null {
  const holder = element?.closest<HTMLElement>(`${ITEM}, ${ENTRY}`) ?? null;
  if (holder === null || holder.matches(ITEM)) {
    return holder;
  }
  return holder.querySelector<HTMLElement>(ITEM);
}

// parentOf is the item an item stands inside: the one around it, or around the entry it is the
// toggle of.
function parentOf(item: HTMLElement): HTMLElement | null {
  const entry = item.parentElement?.closest<HTMLElement>(ENTRY) ?? null;
  const own = entry !== null && entry.querySelector(ITEM) === item ? entry : item;
  return entryOf(own.parentElement);
}

// setTabIndex writes a tabindex only when it changes: the feed watches the attribute.
function setTabIndex(element: HTMLElement, value: number): void {
  if (element.getAttribute("tabindex") !== String(value)) {
    element.tabIndex = value;
  }
}

/**
 * held keeps the tabindex a control had, null for none, while the feed takes it out of Tab: its
 * entry is not the current one.
 */
const held = new WeakMap<HTMLElement, string | null>();

// makeCurrent leaves one stop of Tab in the feed, the item given, and in Tab only the controls of
// that item: the others' are taken out, and given back when their item becomes the current one.
// An item with data-feed-stop="inner" is never the stop itself: its stop is the line it keeps in
// Tab, one of its controls.
function makeCurrent(
  feed: HTMLElement,
  items: readonly HTMLElement[],
  current: HTMLElement | null,
) {
  for (const item of items) {
    setTabIndex(item, item === current && item.dataset.feedStop !== "inner" ? 0 : -1);
  }
  for (const control of feed.querySelectorAll<HTMLElement>(CONTROL)) {
    if (control.matches(ITEM)) {
      continue;
    }
    const owner = entryOf(control);
    if (owner === null) {
      continue;
    }
    if (owner !== current) {
      if (!held.has(control)) {
        held.set(control, control.getAttribute("tabindex"));
      }
      setTabIndex(control, -1);
    } else if (held.has(control)) {
      const tabIndex = held.get(control) ?? null;
      held.delete(control);
      if (tabIndex === null) {
        control.removeAttribute("tabindex");
      } else {
        control.setAttribute("tabindex", tabIndex);
      }
    }
  }
}

// heldChanges keeps what a component wrote in the tabindex of a control out of Tab: the value it
// gives back when its entry becomes the current one. The feed only writes to a control that is not
// already out of Tab, so a write over -1 is the component's.
function heldChanges(records: readonly MutationRecord[]): void {
  for (const record of records) {
    const target = record.target;
    if (
      record.type === "attributes" &&
      target instanceof HTMLElement &&
      held.has(target) &&
      record.oldValue === "-1"
    ) {
      held.set(target, target.getAttribute("tabindex"));
    }
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
  const feed = item.closest<HTMLElement>("[role=feed]");
  if (feed !== null) {
    makeCurrent(feed, items, item);
  }
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
        const parent = parentOf(item);
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
 * stepFeed moves from an entry of the feed to the one before it (-1) or after it (1): an entry with
 * data-feed-keys="own" walks its own lines with the arrows and hands over to the feed at its ends.
 */
export function stepFeed(entry: HTMLElement, by: -1 | 1): void {
  const feed = entry.closest<HTMLElement>("[role=feed]");
  if (feed === null) {
    return;
  }
  const items = itemsOf(feed);
  const index = items.indexOf(entry);
  if (index !== -1) {
    go(items[index + by], items);
  }
}

/**
 * useFeed makes the feed one stop of Tab over its entries, the elements with data-feed-item in the
 * order of the page: arriving, the pending card or the last entry; Tab goes through the controls
 * of the current entry only, and then out of the feed. The arrows, Page Up and Down, Home and End
 * walk the entries; → and ← open and fold the data-feed-toggle of an entry, and ← goes from a
 * folded inner entry to the one around it. An entry with data-feed-keys="own" keeps the arrows, and
 * one with data-feed-stop="inner" has its stop in a line of its own, never itself; a
 * data-feed-entry is an entry whose toggle is its stop.
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
      makeCurrent(feed, items, focused ?? pending ?? items.at(-1) ?? null);
    };

    const onFocusIn = (event: FocusEvent) => {
      const item = entryOf(event.target instanceof Element ? event.target : null);
      if (item !== null) {
        makeCurrent(feed, itemsOf(feed), item);
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
    // What mounts, hides or rewrites a tabindex in the feed is synced: the new controls of an
    // entry that is not the current one leave Tab as they come.
    const observer = new MutationObserver((records) => {
      heldChanges(records);
      sync();
    });
    observer.observe(feed, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["tabindex", "hidden"],
      attributeOldValue: true,
    });
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
