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
import { OrphanPR, openPROf } from "@/features/task/OrphanPRs";
import {
  backDescription,
  discardDescription,
  type StageAction,
  stageActionTitle,
} from "@/features/task/stage-actions";
import { asTaskMode, asTaskStage, type TaskStage, type TaskSummary } from "@/lib/wails";
import { backToStage, discardStage } from "@/store/actions";

export interface StageActionDialogProps {
  task: TaskSummary;
  /** action is which of the two destructive stage controls is being confirmed. */
  action: StageAction;
  /** stage is the stage the action is aimed at, not the one the task is in. */
  stage: TaskStage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * StageActionDialog is the last stop before a stage is reopened or restarted.
 * Both throw away everything the task did after the stage it names.
 */
export function StageActionDialog({
  task,
  action,
  stage,
  open,
  onOpenChange,
}: StageActionDialogProps) {
  const mode = asTaskMode(task.mode);
  const current = asTaskStage(task.stage);
  const back = action === "back";
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{stageActionTitle(action, stage)}</AlertDialogTitle>
          <AlertDialogDescription>
            {back
              ? backDescription(mode, stage, current)
              : discardDescription(mode, stage, current)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <OrphanPR pr={openPROf(task)} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              void (back ? backToStage(task.id, stage) : discardStage(task.id, stage));
            }}
          >
            {back ? "Back" : "Discard"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
