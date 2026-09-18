import { useEffect } from "react";
import { useAppStore, useRepository } from "@/store/app-store";

/**
 * usePendingReview opens the dialog that starts a review again for a pull
 * request whose repository was being cloned, once the clone is there. A failed
 * clone only lets the pull request go: its row shows the error.
 */
export function usePendingReview(): void {
  const pending = useAppStore((state) => state.pendingReview);
  const repository = useRepository(pending?.repositoryId ?? "");
  const openStartReview = useAppStore((state) => state.openStartReview);
  const setPendingReview = useAppStore((state) => state.setPendingReview);

  useEffect(() => {
    if (pending === null || repository === null || repository.cloning) {
      return;
    }
    if (repository.cloned) {
      openStartReview(pending);
      setPendingReview(null);
    } else if (repository.cloneError !== "") {
      setPendingReview(null);
    }
  }, [pending, repository, openStartReview, setPendingReview]);
}
