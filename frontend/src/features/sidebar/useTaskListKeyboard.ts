import { type KeyboardEvent, useCallback } from "react";
import type { SidebarRow } from "@/features/sidebar/legacy-sidebar-tree";
import { useAppStore } from "@/store/app-store";

/**
 * useTaskListKeyboard moves along the visible rows with selection following
 * focus: the row the focus lands on is the task or the discussion that opens.
 * Rows are addressed by index because the tree focuses them through the DOM
 * order of its `[data-task-row]` elements, which is the order of the visible
 * rows.
 */
export function useTaskListKeyboard(
  rows: readonly SidebarRow[],
  focusRowAt: (index: number) => void,
): (event: KeyboardEvent<HTMLElement>) => void {
  const openTask = useAppStore((state) => state.openTask);
  const openDiscussion = useAppStore((state) => state.openDiscussion);

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (rows.length === 0) {
        return;
      }
      const selected = rows.findIndex((row) => row.selected);

      const moveTo = (target: number) => {
        const row = rows[target];
        if (row === undefined) {
          return;
        }
        if (row.kind === "task") {
          openTask(row.task.id);
        } else {
          openDiscussion(row.discussion.id);
        }
        focusRowAt(target);
      };

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          // With nothing selected the first arrow lands on the first row.
          moveTo(selected === -1 ? 0 : Math.min(selected + 1, rows.length - 1));
          break;
        case "ArrowUp":
          event.preventDefault();
          moveTo(selected === -1 ? 0 : Math.max(selected - 1, 0));
          break;
        case "Home":
          event.preventDefault();
          moveTo(0);
          break;
        case "End":
          event.preventDefault();
          moveTo(rows.length - 1);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          // With nothing selected the key opens the row the focus starts on.
          moveTo(selected === -1 ? 0 : selected);
          break;
        default:
          break;
      }
    },
    [rows, focusRowAt, openTask, openDiscussion],
  );
}
