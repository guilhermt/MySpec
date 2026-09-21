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
import { archiveDiscussion } from "@/store/actions";

export interface ArchiveDiscussionDialogProps {
  discussion: { id: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ArchiveDiscussionDialog is the last stop before a discussion leaves the list:
 * it says what the history keeps of it.
 */
export function ArchiveDiscussionDialog({
  discussion,
  open,
  onOpenChange,
}: ArchiveDiscussionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Archive "${discussion.title}"?`}</AlertDialogTitle>
          <AlertDialogDescription>
            The conversation ends. The document, the drafts and what was published stay in the
            history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onOpenChange(false);
              void archiveDiscussion(discussion.id);
            }}
          >
            Archive
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
