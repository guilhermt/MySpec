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
}

export interface ListTree {
  /** tabStop is the entry the list's one tab stop sits on, as entryId names it. */
  tabStop: string | null;
  /** onEntryFocus records where the focus is: the tab stop follows it. */
  onEntryFocus: (id: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

/**
 * useListTree is the keyboard of a list as a tree, shared by the lists of the board and of Reviews:
 * one tab stop, the arrows, Home and End walking the entries, ← and → folding the sections, Enter on
 * a header folding it and on an item acting on it, and the focus of a row that leaves the list going
 * to the next item, the one before, or its header. The view handles the letters.
 */
export function useListTree<S extends string>({
  entries: flat,
  openKey,
  treeRef,
  onToggleSection,
  onActivateItem,
}: UseListTreeOptions<S>): ListTree {
  const [focused, setFocused] = useState<string | null>(null);
  const previous = useRef<readonly ListTreeEntry<S>[]>(flat);
  const entries = useMemo(() => flat.map(entryId), [flat]);

  // The tab stop: the entry the focus was last on, the open item, the first item, the first header.
  const tabStop = useMemo(() => {
    const visible = new Set(entries);
    return (
      [focused, openKey === null ? null : `item:${openKey}`].find(
        (id) => id !== null && visible.has(id),
      ) ??
      entries.find((id) => id.startsWith("item:")) ??
      entries[0] ??
      null
    );
  }, [entries, focused, openKey]);

  // An item that leaves takes the focus with it: it goes to the next item, the one before, or the header.
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
    const id = target !== undefined ? entryId(target) : `section:${lost.sectionId}`;
    const element = treeRef.current === null ? null : entryElement(treeRef.current, id);
    element?.focus();
  }, [flat, entries, focused, treeRef]);

  const focusEntry = (id: string | undefined) => {
    const element =
      id === undefined || treeRef.current === null ? null : entryElement(treeRef.current, id);
    element?.focus();
    element?.scrollIntoView?.({ block: "nearest" });
  };

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
        focusEntry(entries[Math.min(index + 1, entries.length - 1)]);
        break;
      case "ArrowUp":
        focusEntry(entries[Math.max(index - 1, 0)]);
        break;
      case "Home":
        focusEntry(entries[0]);
        break;
      case "End":
        focusEntry(entries.at(-1));
        break;
      case "ArrowLeft":
        if (header !== null) {
          if (!header.foldable || header.collapsed) {
            return;
          }
          onToggleSection(header.id);
        } else if (entry.kind === "item") {
          focusEntry(`section:${entry.sectionId}`);
          onToggleSection(entry.sectionId);
        }
        break;
      case "ArrowRight":
        if (header === null || !header.collapsed) {
          return;
        }
        onToggleSection(header.id);
        break;
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

  return { tabStop, onEntryFocus, onKeyDown };
}
