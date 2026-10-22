import { useState } from "react";
import { BackgroundWorkList } from "@/components/BackgroundWorkList";
import { endedBy } from "@/components/background-work";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { shortName } from "@/lib/repositories";
import type { SessionTasks } from "@/lib/wails";
import { deleteArchivedInPlace, deleteReviewInPlace } from "@/store/actions";

export interface DeleteReviewDialogProps {
  /** review is the active or archived review to delete. */
  review: {
    id: string;
    repository: string;
    number: number;
    /** running is what runs in its conversation; an archived review has none. */
    running?: readonly SessionTasks[] | null;
  };
  /** archived says the review is in History: it has no worktree or conversation to speak of. */
  archived?: boolean;
  /** neighbor is the entry of History that takes the place of an archived review: the focus goes to its row. */
  neighbor?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * DeleteReviewDialog is the last stop before a review is gone: a minimal, destructive dialog that
 * opens on Cancel and stays open until the deletion is over. A refusal stays in its footer. The pull
 * request goes back to being one the Reviews view offers a review of.
 */
export function DeleteReviewDialog({
  review,
  archived = false,
  neighbor = null,
  open,
  onOpenChange,
}: DeleteReviewDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const ended = endedBy({ kind: "delete" }, review);

  const remove = async () => {
    if (deleting) {
      return;
    }
    setDeleting(true);
    setRefusal(null);
    const message = archived
      ? await deleteArchivedInPlace("review", review.id, neighbor)
      : await deleteReviewInPlace(review.id);
    setDeleting(false);
    if (message === null) {
      onOpenChange(false);
    } else {
      setRefusal(`Couldn't delete ${archived ? "it" : "the review"}: ${message}`);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // While the call runs, the dialog stays: a refusal that comes back has its footer.
        if (!next && deleting) {
          return;
        }
        if (!next) {
          setRefusal(null);
        }
        onOpenChange(next);
      }}
      closeDisabled={deleting}
      title={`Delete the review of ${shortName(review.repository)}#${review.number}?`}
      alert
    >
      <DialogBody>
        {archived ? (
          <>
            <p>
              This removes the archived review and its reports from History. It can't be undone.
            </p>
            <p className="text-ink-3">Nothing changes on GitHub: what was published stays.</p>
          </>
        ) : (
          <p>
            The worktree, the conversation and the reports go away. What was published on GitHub
            stays.
          </p>
        )}
        {ended.length > 0 && (
          <>
            <p>This stops what runs in the background.</p>
            <BackgroundWorkList itemId={review.id} sessions={ended} />
          </>
        )}
      </DialogBody>
      <DialogFooter {...(refusal === null ? {} : { refusal })}>
        <DialogCancel disabled={deleting} />
        <Button
          variant="danger"
          loading={deleting}
          loadingLabel="Deleting…"
          onClick={() => void remove()}
        >
          Delete review
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
