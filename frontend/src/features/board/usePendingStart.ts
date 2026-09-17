import { useEffect } from "react";
import { useAppStore, useRepository } from "@/store/app-store";

/**
 * usePendingStart opens the creation dialog for a card whose Start task waited
 * for a clone, once the clone is there. A failed clone only lets the card go:
 * its detail shows the error.
 */
export function usePendingStart(): void {
  const pending = useAppStore((state) => state.pendingStart);
  const repository = useRepository(pending?.repositoryId ?? "");
  const openNewTask = useAppStore((state) => state.openNewTask);
  const setPendingStart = useAppStore((state) => state.setPendingStart);

  useEffect(() => {
    if (pending === null || repository === null || repository.cloning) {
      return;
    }
    if (repository.cloned) {
      openNewTask({ boardId: pending.boardId, key: pending.key });
      setPendingStart(null);
    } else if (repository.cloneError !== "") {
      setPendingStart(null);
    }
  }, [pending, repository, openNewTask, setPendingStart]);
}
