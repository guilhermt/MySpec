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
import { OrphanPRs } from "@/features/task/OrphanPRs";
import type { TaskSummary } from "@/lib/wails";
import { asTaskStage } from "@/lib/wails";
import { deleteTask } from "@/store/actions";

export interface DeleteTaskDialogProps {
  task: TaskSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * DeleteTaskDialog is the last stop before a task is gone. The screen closes on
 * its own: the next snapshot no longer has the task.
 */
export function DeleteTaskDialog({ task, open, onOpenChange }: DeleteTaskDialogProps) {
  // The worktrees outlive the implementation: the PR stage works in them too.
  const hasWorktrees = ["implementation", "pr"].includes(asTaskStage(task.stage));

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Delete "${task.name}"?`}</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the conversations, the documents, the steps and every record of the task.
            It can't be undone.
            {hasWorktrees &&
              " The worktrees and branches of the task are removed too, with any uncommitted work in them."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <OrphanPRs task={task} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              void deleteTask(task.id);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
