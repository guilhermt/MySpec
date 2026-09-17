import { type Dispatch, type SetStateAction, useCallback, useEffect, useState } from "react";
import {
  type BoardFilters,
  type BoardViewMemory,
  defaultCollapsed,
  EMPTY_FILTERS,
  isBoardViewMemory,
} from "@/features/board/board-view";
import { findBoard } from "@/lib/boards";
import { boardViewKey, readStored, writeStored } from "@/lib/ui-storage";
import { useAppStore, useBoard } from "@/store/app-store";

interface ViewState {
  filters: BoardFilters;
  /** collapsed is null while the user has not chosen: the final statuses of the board then. */
  collapsed: string[] | null;
  selectedKey: string | null;
}

function collapsedOf(boardId: string, collapsed: string[] | null): string[] {
  if (collapsed !== null) {
    return collapsed;
  }
  const board = findBoard(useAppStore.getState().app, boardId);
  return board === null ? [] : defaultCollapsed(board);
}

/**
 * useBoardViewMemory is what a board view remembers, read once from the last
 * run and kept for the next one. The selected card is never kept, and the
 * collapsed sections only once the user chose them.
 */
export function useBoardViewMemory(
  boardId: string,
): [BoardViewMemory, Dispatch<SetStateAction<BoardViewMemory>>] {
  const [view, setView] = useState<ViewState>(() => {
    const stored = readStored(boardViewKey(boardId), { filters: EMPTY_FILTERS }, isBoardViewMemory);
    return { filters: stored.filters, collapsed: stored.collapsed ?? null, selectedKey: null };
  });
  // Subscribing to the board follows its statuses while the default applies.
  const board = useBoard(boardId);
  const collapsed = view.collapsed ?? (board === null ? [] : defaultCollapsed(board));

  const setMemory = useCallback<Dispatch<SetStateAction<BoardViewMemory>>>(
    (action) =>
      setView((current) => {
        const resolved = { ...current, collapsed: collapsedOf(boardId, current.collapsed) };
        const next = typeof action === "function" ? action(resolved) : action;
        // Collapsed sections left untouched keep following the board.
        const chosen = next.collapsed === resolved.collapsed ? current.collapsed : next.collapsed;
        return { ...next, collapsed: chosen };
      }),
    [boardId],
  );

  useEffect(() => {
    writeStored(
      boardViewKey(boardId),
      view.collapsed === null
        ? { filters: view.filters }
        : { filters: view.filters, collapsed: view.collapsed },
    );
  }, [boardId, view.filters, view.collapsed]);

  return [{ filters: view.filters, collapsed, selectedKey: view.selectedKey }, setMemory];
}
