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
import { deleteDiscussion } from "@/store/actions";

export interface DeleteDiscussionDialogProps {
  /** discussion is the active or the archived discussion to delete. */
  discussion: { id: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** DeleteDiscussionDialog is the last stop before a discussion is gone. */
export function DeleteDiscussionDialog({
  discussion,
  open,
  onOpenChange,
}: DeleteDiscussionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Delete "${discussion.title}"?`}</AlertDialogTitle>
          <AlertDialogDescription>
            The conversation, the document and the drafts go away. What was published on GitHub
            stays.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              void deleteDiscussion(discussion.id);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
