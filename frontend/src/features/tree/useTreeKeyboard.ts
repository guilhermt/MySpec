import { type KeyboardEvent, useCallback } from "react";
import { isNodeRow, type TreeRowModel } from "@/features/tree/tree-model";
import { useAppStore } from "@/store/app-store";

/**
 * useTreeKeyboard implements the tree pattern with selection following focus.
 * Rows are addressed by index because the tree focuses them through the DOM
 * order of its `treeitem` elements, which is the order of the node rows.
 */
export function useTreeKeyboard(
  rows: readonly TreeRowModel[],
  focusNodeAt: (index: number) => void,
): (event: KeyboardEvent<HTMLElement>) => void {
  const selectNode = useAppStore((state) => state.selectNode);
  const toggleNode = useAppStore((state) => state.toggleNode);
  const setNodeExpanded = useAppStore((state) => state.setNodeExpanded);

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const nodes = rows.filter(isNodeRow);
      const index = nodes.findIndex((node) => node.selected);
      const current = nodes[index];
      if (current === undefined) {
        return;
      }

      const moveTo = (target: number) => {
        const node = nodes[target];
        if (node === undefined) {
          return;
        }
        selectNode(node.id);
        focusNodeAt(target);
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
          if (!current.expanded) {
            setNodeExpanded(current.id, true);
          } else if (current.isRoot) {
            moveTo(index + 1);
          }
          break;
        case "ArrowLeft":
          event.preventDefault();
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
          moveTo(nodes.length - 1);
          break;
        case "Enter":
        case " ":
          event.preventDefault();
          toggleNode(current.id);
          break;
        default:
          break;
      }
    },
    [rows, focusNodeAt, selectNode, toggleNode, setNodeExpanded],
  );
}
