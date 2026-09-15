import { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Step, TaskSummary } from "@/lib/wails";
import { discardStep } from "@/store/actions";

export interface DiscardStepDialogProps {
  task: TaskSummary;
  step: Step;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * DiscardStepDialog is the last stop before a step is run again from scratch.
 * Cleaning the worktree is the usual choice, so it comes checked.
 */
export function DiscardStepDialog({ task, step, open, onOpenChange }: DiscardStepDialogProps) {
  const [clean, setClean] = useState(true);
  // The review goes with the step: the conversation of the reviewer and its reports.
  const reviewed = step.reviewer !== null || (step.reports ?? []).length > 0;

  // Every opening starts from the default, whatever the last one settled on.
  useEffect(() => {
    if (open) {
      setClean(true);
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{`Discard step ${step.number} and start over?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {reviewed
              ? "This ends the sessions and deletes the conversations of the step and of its reviewer, with the reports of the agent review. The step starts again from scratch right away."
              : "This ends the session and deletes the conversation of the step. The step starts again from scratch right away."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Checkbox
              id="clean-worktree"
              checked={clean}
              onCheckedChange={(checked) => setClean(checked)}
            />
            <Label htmlFor="clean-worktree">Also clean the worktree</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Discards every uncommitted change in the worktree. Without this, the step starts blocked
            until the worktree is clean.
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              void discardStep(task.id, clean);
            }}
          >
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
