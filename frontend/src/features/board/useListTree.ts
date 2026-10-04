import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/**
 * ListTreeEntry is one entry of a list as a tree, in the order the screen draws them: a section header,
 * or an item under its section. An item's element carries `data-row-key`, a header's `data-section-id`.
 */
export type ListTreeEntry<S extends string = string> =
  | {
      kind: "section";
      id: S;
      /** foldable is a section with items: an empty one has nothing to fold. */
      foldable: boolean;
      collapsed: boolean;
    }
  | { kind: "item"; key: string; sectionId: S };

/** entryId names an entry of the tree: `section:<id>` for a header, `item:<key>` for an item. */
export function entryId(entry: ListTreeEntry): string {
  return entry.kind === "section" ? `section:${entry.id}` : `item:${entry.key}`;
}

function entryOf(element: Element): string | null {
  const key = element.getAttribute("data-row-key");
  if (key !== null) {
    return `item:${key}`;
  }
  const section = element.getAttribute("data-section-id");
  return section === null ? null : `section:${section}`;
}

function entryElement(tree: HTMLElement, id: string): HTMLElement | null {
  const [kind, ...rest] = id.split(":");
  const name = rest.join(":");
  const attribute = kind === "item" ? "data-row-key" : "data-section-id";
  return (
    Array.from(tree.querySelectorAll<HTMLElement>(`[${attribute}]`)).find(
      (element) => element.getAttribute(attribute) === name,
    ) ?? null
  );
}

export interface UseListTreeOptions<S extends string> {
  entries: readonly ListTreeEntry<S>[];
  /** openKey is the item of the panel, which holds the tab stop when the focus has not been on the list. */
  openKey: string | null;
  treeRef: RefObject<HTMLDivElement | null>;
  onToggleSection: (id: S) => void;
  /** onActivateItem runs on Enter on an item. */
  onActivateItem: (key: string) => void;
  /** scrollToIndex brings an entry into view; absent, the entry's element scrolls itself into view. */
  scrollToIndex?: (index: number) => void;
}

export interface ListTree {
  /** tabStop is the entry the list's one tab stop sits on, as entryId names it. */
  tabStop: string | null;
  /** tabStopIndex is the index of the tab stop in the entries, -1 without one: a window pins it. */
  tabStopIndex: number;
  /** onEntryFocus records where the focus is: the tab stop follows it. */
  onEntryFocus: (id: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  /** focusIndex focuses an entry by its index, bringing it into view and waiting for it to mount. */
  focusIndex: (index: number) => void;
}

/**
 * useListTree is the keyboard of a list as a tree, shared by the lists of the board and of Reviews:
 * one tab stop, the arrows, Home and End walking the entries, ← and → folding the sections (on a
 * header that never folds, → goes to its first item), Enter on a header folding it and on an item
 * acting on it, and the focus of a row that leaves the list going
 * to the next item, the one before, or its header. It walks the entries by index, so a window that
 * mounts only some of them still gets the focus where the key goes. The view handles the letters.
 */
export function useListTree<S extends string>({
  entries: flat,
  openKey,
  treeRef,
  onToggleSection,
  onActivateItem,
  scrollToIndex,
}: UseListTreeOptions<S>): ListTree {
  const [focused, setFocused] = useState<string | null>(null);
  // pending is the entry the focus is going to, which may mount only after the scroll that shows it.
  const pending = useRef<string | null>(null);
  const previous = useRef<readonly ListTreeEntry<S>[]>(flat);
  const entries = useMemo(() => flat.map(entryId), [flat]);

  // The tab stop: the entry the focus was last on, the open item, the first item, the first header.
  // A list whose headers never fold has its first header, which the arrows walk down from.
  const tabStop = useMemo(() => {
    const visible = new Set(entries);
    const folds = flat.some((entry) => entry.kind === "section" && entry.foldable);
    return (
      [focused, openKey === null ? null : `item:${openKey}`].find(
        (id) => id !== null && visible.has(id),
      ) ??
      (folds ? entries.find((id) => id.startsWith("item:")) : undefined) ??
      entries[0] ??
      null
    );
  }, [entries, flat, focused, openKey]);
  const tabStopIndex = tabStop === null ? -1 : entries.indexOf(tabStop);

  const focusIndex = (index: number) => {
    const id = entries[index];
    if (id === undefined) {
      return;
    }
    pending.current = id;
    if (scrollToIndex !== undefined) {
      scrollToIndex(index);
    } else {
      const element = treeRef.current === null ? null : entryElement(treeRef.current, id);
      element?.scrollIntoView?.({ block: "nearest" });
    }
    focusPending();
  };

  // focusPending focuses the entry the focus is going to once its element is in the tree, and then
  // forgets it.
  const focusPending = () => {
    const id = pending.current;
    if (id !== null && !entries.includes(id)) {
      pending.current = null;
      return;
    }
    const element =
      id === null || treeRef.current === null ? null : entryElement(treeRef.current, id);
    if (element !== null) {
      pending.current = null;
      element.focus();
    }
  };
  // A row that mounts only after the scroll gets the focus in the commit that mounts it.
  useLayoutEffect(focusPending);

  // An item that leaves takes the focus with it: it goes to the next item, the one before, or the header.
  // biome-ignore lint/correctness/useExhaustiveDependencies: focusIndex reads the entries it runs with, which the dependencies name
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = flat;
    if (focused === null || entries.includes(focused)) {
      return;
    }
    const active = document.activeElement;
    if (active !== null && active !== document.body && document.contains(active)) {
      return;
    }
    const index = before.findIndex((entry) => entryId(entry) === focused);
    const lost = before[index];
    if (lost === undefined || lost.kind !== "item") {
      return;
    }
    const alive = new Set(entries);
    const isKept = (entry: ListTreeEntry<S>) => entry.kind === "item" && alive.has(entryId(entry));
    const target =
      before.slice(index + 1).find(isKept) ?? before.slice(0, index).reverse().find(isKept);
    const at =
      target !== undefined
        ? entries.indexOf(entryId(target))
        : entries.indexOf(`section:${lost.sectionId}`);
    focusIndex(at);
  }, [flat, entries, focused, treeRef]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const element = event.target.closest("[data-row-key],[data-section-id]");
    const id = element === null ? null : entryOf(element);
    if (id === null || !event.currentTarget.contains(element)) {
      return;
    }
    const index = entries.indexOf(id);
    const entry = flat[index];
    if (entry === undefined) {
      return;
    }
    const header = entry.kind === "section" ? entry : null;

    switch (event.key) {
      case "ArrowDown":
        focusIndex(Math.min(index + 1, entries.length - 1));
        break;
      case "ArrowUp":
        focusIndex(Math.max(index - 1, 0));
        break;
      case "Home":
        focusIndex(0);
        break;
      case "End":
        focusIndex(entries.length - 1);
        break;
      case "ArrowLeft":
        if (header !== null) {
          if (!header.foldable || header.collapsed) {
            return;
          }
          onToggleSection(header.id);
        } else if (entry.kind === "item") {
          focusIndex(entries.indexOf(`section:${entry.sectionId}`));
          onToggleSection(entry.sectionId);
        }
        break;
      case "ArrowRight": {
        if (header === null) {
          return;
        }
        if (header.collapsed) {
          onToggleSection(header.id);
          break;
        }
        // A header that never folds takes the focus to its first item.
        const next = flat[index + 1];
        if (header.foldable || next?.kind !== "item" || next.sectionId !== header.id) {
          return;
        }
        focusIndex(index + 1);
        break;
      }
      case "Enter":
        if (header !== null) {
          if (!header.foldable) {
            return;
          }
          onToggleSection(header.id);
        } else if (entry.kind === "item") {
          onActivateItem(entry.key);
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onEntryFocus = useCallback((id: string) => setFocused(id), []);

  return { tabStop, tabStopIndex, onEntryFocus, onKeyDown, focusIndex };
}
