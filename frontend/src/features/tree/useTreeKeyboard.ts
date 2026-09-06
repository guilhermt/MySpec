import { type KeyboardEvent, useCallback } from "react";
import { isItemRow, type TreeRowModel } from "@/features/tree/tree-model";
import { useAppStore } from "@/store/app-store";

/**
 * useTreeKeyboard implements the tree pattern with selection following focus.
 * Rows are addressed by index because the tree focuses them through the DOM
 * order of its `treeitem` elements, which is the order of the node and task
 * rows. Moving onto a task opens it, so the tree and the main area agree.
 */
export function useTreeKeyboard(
  rows: readonly TreeRowModel[],
  focusItemAt: (index: number) => void,
): (event: KeyboardEvent<HTMLElement>) => void {
  const selectNode = useAppStore((state) => state.selectNode);
  const toggleNode = useAppStore((state) => state.toggleNode);
  const setNodeExpanded = useAppStore((state) => state.setNodeExpanded);
  const openTask = useAppStore((state) => state.openTask);
  const closeTask = useAppStore((state) => state.closeTask);

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const items = rows.filter(isItemRow);
      const index = items.findIndex((item) => item.selected);
      const current = items[index];
      if (current === undefined) {
        return;
      }

      const moveTo = (target: number) => {
        const item = items[target];
        if (item === undefined) {
          return;
        }
        if (item.kind === "task") {
          openTask(item.task.id);
        } else {
          selectNode(item.id);
          closeTask();
        }
        focusItemAt(target);
      };

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveTo(index + 1);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveTo(index - 1);
          break;
        case "ArrowRight":
          event.preventDefault();
          if (current.kind === "task") {
            break;
          }
          if (!current.expanded) {
            setNodeExpanded(current.id, true);
          } else if (current.isRoot) {
            moveTo(index + 1);
          }
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (current.kind === "task") {
            break;
          }
          if (current.expanded) {
            setNodeExpanded(current.id, false);
          } else if (!current.isRoot) {
            moveTo(0);
          }
          break;
        case "Home":
          event.preventDefault();
          moveTo(0);
          break;
        case "End":
          event.preventDefault();
          moveTo(items.length - 1);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          if (current.kind === "task") {
            openTask(current.task.id);
          } else {
            toggleNode(current.id);
          }
          break;
        default:
          break;
      }
    },
    [rows, focusItemAt, selectNode, toggleNode, setNodeExpanded, openTask, closeTask],
  );
}
