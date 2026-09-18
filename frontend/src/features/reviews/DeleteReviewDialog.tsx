import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { shortName } from "@/lib/repositories";
import type { ReviewSummary } from "@/lib/wails";
import { deleteReview } from "@/store/actions";

export interface DeleteReviewDialogProps {
  review: ReviewSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * DeleteReviewDialog is the last stop before a review is gone. The pull request
 * goes back to being one the Reviews view offers a review of.
 */
export function DeleteReviewDialog({ review, open, onOpenChange }: DeleteReviewDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {`Delete the review of ${shortName(review.repository)}#${review.number}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            The worktree, the conversation and the reports go away. What was published on GitHub
            stays.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              void deleteReview(review.id);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
