import { useEffect } from "react";
import type { ArchivedDiscussion, ArchivedReview, ArchivedTask } from "@/lib/wails";
import { findArchived } from "@/store/actions";
import {
  useAppStore,
  useArchivedDiscussion,
  useArchivedReview,
  useArchivedTask,
} from "@/store/app-store";

/** ArchivedKind is the kind of an archived item. */
export type ArchivedKind = "task" | "review" | "discussion";

/** ArchivedItems maps each kind of archived item to what its page reads. */
interface ArchivedItems {
  task: ArchivedTask;
  review: ArchivedReview;
  discussion: ArchivedDiscussion;
}

/**
 * useArchivedItem is the archived item of a kind with the id, from the window or from what the
 * History brought; null while it is not there. An item that is nowhere asks the Go for it once,
 * and the page shows its skeleton meanwhile.
 */
export function useArchivedItem<K extends ArchivedKind>(
  kind: K,
  id: string,
): ArchivedItems[K] | null {
  const task = useArchivedTask(kind === "task" ? id : null);
  const review = useArchivedReview(kind === "review" ? id : null);
  const discussion = useArchivedDiscussion(kind === "discussion" ? id : null);
  const lookup = useAppStore((state) => state.archivedLookups[id]);
  const item = kind === "task" ? task : kind === "review" ? review : discussion;

  useEffect(() => {
    if (item === null && lookup === undefined) {
      void findArchived(id);
    }
  }, [item, lookup, id]);

  return item as ArchivedItems[K] | null;
}
