import { useCallback, useRef } from "react";
import { TreeRow } from "@/features/tree/TreeRow";
import { rowKey, type TreeRowModel, visibleRows } from "@/features/tree/tree-model";
import { useTreeKeyboard } from "@/features/tree/useTreeKeyboard";
import { useAppStore, useTreeUi } from "@/store/app-store";

const NO_ROWS: readonly TreeRowModel[] = [];

export function WorkspaceTree() {
  const app = useAppStore((state) => state.app);
  const selectNode = useAppStore((state) => state.selectNode);
  const toggleNode = useAppStore((state) => state.toggleNode);
  const ui = useTreeUi();
  const treeRef = useRef<HTMLDivElement>(null);

  const rows = app === null ? NO_ROWS : visibleRows(app, ui);

  const focusNodeAt = useCallback((index: number) => {
    treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]').item(index)?.focus();
  }, []);

  const onKeyDown = useTreeKeyboard(rows, focusNodeAt);

  return (
    <div
      role="tree"
      aria-label="Workspace"
      ref={treeRef}
      onKeyDown={onKeyDown}
      className="flex flex-col p-1"
    >
      {rows.map((row) => (
        <TreeRow key={rowKey(row)} row={row} onSelect={selectNode} onToggle={toggleNode} />
      ))}
    </div>
  );
}
