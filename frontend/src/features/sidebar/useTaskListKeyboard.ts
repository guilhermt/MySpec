import { type KeyboardEvent, useCallback } from "react";
import type { TaskRow } from "@/features/sidebar/task-list";
import { useAppStore } from "@/store/app-store";

/**
 * useTaskListKeyboard implements the listbox pattern with selection following
 * focus: the row the focus lands on is the task that opens. Rows are addressed
 * by index because the list focuses them through the DOM order of its `option`
 * elements, which is the order of the tasks.
 */
export function useTaskListKeyboard(
  rows: readonly TaskRow[],
  focusRowAt: (index: number) => void,
): (event: KeyboardEvent<HTMLElement>) => void {
  const openTask = useAppStore((state) => state.openTask);

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
        openTask(row.task.id);
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
    [rows, focusRowAt, openTask],
  );
}
