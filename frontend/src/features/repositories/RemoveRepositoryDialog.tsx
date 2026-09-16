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
import type { Repository } from "@/lib/wails";
import { removeRepository } from "@/store/actions";

export interface RemoveRepositoryDialogProps {
  repository: Repository;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** RemoveRepositoryDialog is the last stop before a repository leaves MySpec. */
export function RemoveRepositoryDialog({
  repository,
  open,
  onOpenChange,
}: RemoveRepositoryDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Remove ${repository.fullName}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            The repository leaves MySpec. Nothing is deleted on disk: the clone stays where it is.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              void removeRepository(repository.id);
            }}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
