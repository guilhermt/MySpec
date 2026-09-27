import { type FocusEvent, type KeyboardEvent, useState } from "react";
import type { TreeEntry } from "@/features/sidebar/sidebar-tree";
import { useAppStore, useSidebarCollapsed } from "@/store/app-store";

export interface TreeKeyboard {
  /** tabIndexOf is 0 on the one Tab stop of the tree and -1 on every other line. */
  tabIndexOf: (id: string) => 0 | -1;
  /** onKeyDown walks the tree; it goes on the tree itself. */
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** onFocus follows the line holding the focus; it goes on the tree itself. */
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  /** onBlur lets the Tab stop go back to the open line when the focus leaves the tree. */
  onBlur: (event: FocusEvent<HTMLElement>) => void;
}

/** ENTRY_ATTRIBUTE marks each line of the tree with its entry id, which the keyboard focuses by. */
export const ENTRY_ATTRIBUTE = "data-entry-id";

function lineOf(tree: HTMLElement, id: string): HTMLElement | null {
  return tree.querySelector<HTMLElement>(`[${ENTRY_ATTRIBUTE}="${CSS.escape(id)}"]`);
}

/**
 * useTreeKeyboard is the roving tabindex of the tree: one Tab stop, on the line
 * with the focus, else the open row, else the first line. The arrows move the
 * focus and expand or collapse nodes, and never open anything; Enter does what
 * a click on the line does.
 */
export function useTreeKeyboard(
  entries: readonly TreeEntry[],
  openId: string | null,
): TreeKeyboard {
  const collapsed = useSidebarCollapsed();
  const toggleSidebarNode = useAppStore((state) => state.toggleSidebarNode);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const has = (id: string | null) => id !== null && entries.some((entry) => entry.id === id);
  const stop = has(focusedId) ? focusedId : has(openId) ? openId : (entries[0]?.id ?? null);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const tree = event.currentTarget;
    const line = (event.target as HTMLElement).closest<HTMLElement>(`[${ENTRY_ATTRIBUTE}]`);
    const index = entries.findIndex((entry) => entry.id === line?.getAttribute(ENTRY_ATTRIBUTE));
    const entry = entries[index];
    if (line === null || entry === undefined) {
      return;
    }
    const focus = (target: TreeEntry | undefined) => {
      if (target !== undefined) {
        setFocusedId(target.id);
        lineOf(tree, target.id)?.focus();
      }
    };
    const expanded = entry.kind === "node" && !collapsed.has(entry.id);
    const parent = () => entries.find((candidate) => candidate.id === entry.parentId);

    switch (event.key) {
      case "ArrowDown":
        focus(entries[index + 1]);
        break;
      case "ArrowUp":
        focus(entries[index - 1]);
        break;
      case "Home":
        focus(entries[0]);
        break;
      case "End":
        focus(entries.at(-1));
        break;
      case "ArrowRight":
        if (entry.kind !== "node") {
          return;
        }
        if (expanded) {
          const child = entries[index + 1];
          focus(child?.parentId === entry.id ? child : undefined);
        } else {
          toggleSidebarNode(entry.id);
        }
        break;
      case "ArrowLeft":
        if (expanded) {
          toggleSidebarNode(entry.id);
        } else {
          focus(parent());
        }
        break;
      case "Enter":
        // A node opens its place or toggles by its title; a row opens and a
        // notice changes the path by a click on the line.
        (entry.kind === "node"
          ? (line.querySelector<HTMLElement>("[data-node-title]") ?? line)
          : line
        ).click();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocusedId(null);
    }
  };

  return {
    tabIndexOf: (id) => (id === stop ? 0 : -1),
    onKeyDown,
    onFocus: (event) => {
      const line = (event.target as HTMLElement).closest(`[${ENTRY_ATTRIBUTE}]`);
      if (line !== null) {
        setFocusedId(line.getAttribute(ENTRY_ATTRIBUTE));
      }
    },
    onBlur,
  };
}
