import { useCallback, useRef } from "react";
import { TreeRow } from "@/features/tree/TreeRow";
import { rowKey, type TreeRowModel, visibleRows } from "@/features/tree/tree-model";
import { useTreeKeyboard } from "@/features/tree/useTreeKeyboard";
import { type NodeId, useAppStore, useTreeUi } from "@/store/app-store";

const NO_ROWS: readonly TreeRowModel[] = [];

export function WorkspaceTree() {
  const app = useAppStore((state) => state.app);
  const selectNode = useAppStore((state) => state.selectNode);
  const toggleNode = useAppStore((state) => state.toggleNode);
  const openTask = useAppStore((state) => state.openTask);
  const closeTask = useAppStore((state) => state.closeTask);
  const closeHistory = useAppStore((state) => state.closeHistory);
  const ui = useTreeUi();
  const treeRef = useRef<HTMLDivElement>(null);

  const rows = app === null ? NO_ROWS : visibleRows(app, ui);

  // Selecting a node hands the main area back to it, so only one row is ever
  // selected: the open task or the node.
  const onSelect = useCallback(
    (id: NodeId) => {
      selectNode(id);
      closeTask();
      closeHistory();
    },
    [selectNode, closeTask, closeHistory],
  );

  const focusItemAt = useCallback((index: number) => {
    treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]').item(index)?.focus();
  }, []);

  const onKeyDown = useTreeKeyboard(rows, focusItemAt);

  return (
    <div
      role="tree"
      aria-label="Workspace"
      ref={treeRef}
      onKeyDown={onKeyDown}
      className="flex flex-col p-1"
    >
      {rows.map((row) => (
        <TreeRow
          key={rowKey(row)}
          row={row}
          onSelect={onSelect}
          onToggle={toggleNode}
          onOpenTask={openTask}
        />
      ))}
    </div>
  );
}
