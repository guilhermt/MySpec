import { type RefObject, useEffect, useRef } from "react";

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

const STOPS = `${ITEM}, ${ENTRY}, ${CONTROL}`;

/** UNIT marks the element of a unit of a windowed conversation, with its index. */
const UNIT = "[data-unit-index]";

/** WALK_KEYS are the keys that walk the entries of the feed beyond the arrows. */
const WALK_KEYS: readonly string[] = ["Home", "End", "PageUp", "PageDown"];

/** PAGE is how many entries Page Up and Page Down move. */
const PAGE = 10;

/**
 * FeedUnits is what a windowed feed tells the keyboard: its entries are drawn by units, and only
 * those that show are in the DOM.
 */
export interface FeedUnits {
  /** count is how many units the conversation has; the tail is not a unit. */
  count: number;
  /** reveal brings a unit into view; the feed focuses its first item (or its last, by -1) once it mounts. */
  reveal: (index: number) => void;
  /** onCurrent tells which unit holds the tab stop, -1 for the tail, so the window keeps it mounted. */
  onCurrent: (index: number) => void;
}

/** FeedControl is what stepFeed reaches of the feed it is called for. */
interface FeedControl {
  units: () => FeedUnits | undefined;
  move: (item: HTMLElement, by: -1 | 1) => void;
}

const controls = new WeakMap<HTMLElement, FeedControl>();

// unitOf is the index of the unit an element stands in, -1 for the tail after the units.
function unitOf(element: Element | null): number {
  const unit = element?.closest<HTMLElement>(UNIT) ?? null;
  return unit === null ? -1 : Number(unit.dataset.unitIndex);
}

// unitElement is the element of a unit, null while it is not mounted.
function unitElement(feed: HTMLElement, index: number): HTMLElement | null {
  return feed.querySelector<HTMLElement>(`[data-unit-index="${index}"]`);
}

// holeAfter is the index of the unit a move from item by one entry crosses into when it is not
// mounted, null when the next item in the DOM is the next one on the screen. An empty unit that is
// mounted is walked over.
function holeAfter(
  feed: HTMLElement,
  item: HTMLElement,
  next: HTMLElement | undefined,
  by: -1 | 1,
  units: FeedUnits,
): number | null {
  const from = unitOf(item);
  if (next !== undefined && unitOf(next) === from) {
    return null;
  }
  let index = from === -1 ? (by < 0 ? units.count - 1 : units.count) : from + by;
  while (index >= 0 && index < units.count) {
    const unit = unitElement(feed, index);
    if (unit === null) {
      return index;
    }
    if (unit.querySelector(ITEM) !== null) {
      return null;
    }
    index += by;
  }
  return null;
}

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
  controls.get(feed)?.units()?.onCurrent(unitOf(current));
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

function go(item: HTMLElement | undefined, items: readonly HTMLElement[], by: -1 | 1 = 1): void {
  if (item === undefined) {
    return;
  }
  // A card that takes the arrows in by its ends is told which one: below it, the first item;
  // above it, the last.
  if (item.hasAttribute("data-card-ends")) {
    item.dataset.enter = by < 0 ? "last" : "first";
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
  const control = controls.get(feed);
  if (control?.units() !== undefined) {
    control.move(entry, by);
    return;
  }
  const items = itemsOf(feed);
  const index = items.indexOf(entry);
  if (index !== -1) {
    go(items[index + by], items, by);
  }
}

/** leaveDecisionCard goes on along the conversation from the card of findings, by one entry up or down. */
export function leaveDecisionCard(by: -1 | 1): void {
  const card = document.querySelector<HTMLElement>("[data-decision-card]");
  if (card !== null) {
    stepFeed(card, by);
  }
}

// holdsStop reports whether a node is, or holds, an item, an entry or a control.
function holdsStop(node: Node): boolean {
  return node instanceof Element && (node.matches(STOPS) || node.querySelector(STOPS) !== null);
}

// changesStops reports whether the records touch what the feed keeps in Tab: an attribute, or a
// node that is or holds an item, an entry or a control. Text that grows touches none.
function changesStops(records: readonly MutationRecord[]): boolean {
  return records.some(
    (record) =>
      record.type === "attributes" ||
      [...record.addedNodes, ...record.removedNodes].some(holdsStop),
  );
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
export function useFeed(feedRef: RefObject<HTMLElement | null>, units?: FeedUnits): void {
  const unitsRef = useRef(units);
  unitsRef.current = units;
  const resyncRef = useRef<(() => void) | null>(null);
  // A new units value is the window moving: what it mounted is synced at once, without waiting for
  // the observer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: units is the signal, not a value read
  useEffect(() => resyncRef.current?.(), [units]);
  useEffect(() => {
    const feed = feedRef.current;
    if (feed === null) {
      return;
    }

    // pending is the unit the keyboard is going to, and which of its ends takes the focus: by 1 its
    // first item, by -1 its last. It is tried again each time the feed changes, while the unit mounts.
    let pending: { index: number; by: -1 | 1 } | null = null;

    // settle focuses the end of the pending unit once it is mounted, and walks over a mounted unit
    // that holds no item; false while it waits.
    const settle = (): boolean => {
      const units = unitsRef.current;
      if (pending === null || units === undefined) {
        pending = null;
        return true;
      }
      const unit = unitElement(feed, pending.index);
      if (unit === null) {
        return false;
      }
      const items = itemsOf(feed);
      const inside = items.filter((item) => unit.contains(item));
      const target = pending.by > 0 ? inside[0] : inside.at(-1);
      if (target !== undefined) {
        const by = pending.by;
        pending = null;
        go(target, items, by);
        return true;
      }
      const index = pending.index + pending.by;
      if (index < 0 || index >= units.count) {
        pending = null;
        return true;
      }
      pending = { index, by: pending.by };
      if (settle()) {
        return true;
      }
      units.reveal(index);
      return false;
    };

    // seek goes to an end of a unit: at once when it is mounted, else by bringing it into view.
    const seek = (index: number, by: -1 | 1) => {
      pending = { index, by };
      if (!settle()) {
        unitsRef.current?.reveal(pending?.index ?? index);
      }
    };

    // move goes one entry from item by the arrows, across a hole of unmounted units.
    const move = (item: HTMLElement, by: -1 | 1) => {
      const items = itemsOf(feed);
      const next = items[items.indexOf(item) + by];
      const current = unitsRef.current;
      const hole = current === undefined ? null : holeAfter(feed, item, next, by, current);
      if (hole === null) {
        go(next, items, by);
      } else {
        seek(hole, by);
      }
    };

    // walk is Page Up, Page Down, Home and End over units, true when the key is one of them.
    const walk = (key: string, item: HTMLElement, units: FeedUnits): boolean => {
      const items = itemsOf(feed);
      const from = unitOf(item) === -1 ? units.count - 1 : unitOf(item);
      switch (key) {
        case "Home":
          seek(0, 1);
          return true;
        case "End":
          go(items.at(-1), items, 1);
          return true;
        case "PageUp":
          seek(Math.max(from - PAGE, 0), 1);
          return true;
        case "PageDown":
          if (unitOf(item) === -1 || from + PAGE >= units.count) {
            go(items.at(-1), items, 1);
          } else {
            seek(from + PAGE, 1);
          }
          return true;
        default:
          return false;
      }
    };
    controls.set(feed, { units: () => unitsRef.current, move });

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
      const origin = event.target instanceof HTMLElement ? event.target : null;
      // An item of a decision card, a finding or a draft, walks the conversation from the card
      // around it.
      const item =
        origin?.matches("[data-card-item]") && WALK_KEYS.includes(event.key)
          ? origin.closest<HTMLElement>(ITEM)
          : origin;
      if (item === null || !item.matches(ITEM) || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (item.dataset.feedKeys === "own" && event.key.startsWith("Arrow")) {
        return;
      }
      pending = null;
      const units = unitsRef.current;
      if (units !== undefined && WALK_KEYS.includes(event.key)) {
        event.preventDefault();
        walk(event.key, item, units);
        return;
      }
      if (units !== undefined && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        move(item, event.key === "ArrowUp" ? -1 : 1);
        return;
      }
      const items = itemsOf(feed);
      const next = target(event.key, items.indexOf(item), items.length);
      if (next !== null) {
        event.preventDefault();
        go(items[next], items, next < items.indexOf(item) ? -1 : 1);
      } else if (toggle(event.key, item, items)) {
        event.preventDefault();
      }
    };

    sync();
    resyncRef.current = () => {
      sync();
      if (pending !== null) {
        settle();
      }
    };
    // What mounts, hides or rewrites a tabindex in the feed is synced: the new controls of an
    // entry that is not the current one leave Tab as they come.
    const observer = new MutationObserver((records) => {
      heldChanges(records);
      if (changesStops(records)) {
        sync();
        if (pending !== null) {
          settle();
        }
      }
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
      controls.delete(feed);
      resyncRef.current = null;
      observer.disconnect();
      feed.removeEventListener("focusin", onFocusIn);
      feed.removeEventListener("focusout", onFocusOut);
      feed.removeEventListener("keydown", onKeyDown);
    };
  }, [feedRef]);
}
