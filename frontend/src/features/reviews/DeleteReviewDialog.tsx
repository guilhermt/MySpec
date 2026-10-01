import { useState } from "react";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { shortName } from "@/lib/repositories";
import { deleteReview } from "@/store/actions";

export interface DeleteReviewDialogProps {
  /** review is the active or archived review to delete. */
  review: { id: string; repository: string; number: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * DeleteReviewDialog is the last stop before a review is gone: a minimal, destructive dialog that
 * opens on Cancel. The pull request goes back to being one the Reviews view offers a review of.
 */
export function DeleteReviewDialog({ review, open, onOpenChange }: DeleteReviewDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteReview(review.id);
    } finally {
      setDeleting(false);
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Delete the review of ${shortName(review.repository)}#${review.number}?`}
      alert
    >
      <DialogBody>
        <p>
          The worktree, the conversation and the reports go away. What was published on GitHub
          stays.
        </p>
      </DialogBody>
      <DialogFooter>
        <DialogCancel />
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
