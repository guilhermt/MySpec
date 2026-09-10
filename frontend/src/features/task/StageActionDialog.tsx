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
import { OrphanPRs, openPRsOf } from "@/features/task/OrphanPRs";
import {
  backDescription,
  discardDescription,
  type StageAction,
} from "@/features/task/stage-actions";
import { stageLabel } from "@/lib/stages";
import { asTaskStage, type PRPreview, type TaskStage, type TaskSummary } from "@/lib/wails";
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
  const current = asTaskStage(task.stage);
  const back = action === "back";
  // The state of the task already says what the pull requests are; only the
  // deletion has to read them from git.
  const prs = openPRsOf(task).map(
    (repo): PRPreview => ({
      repository: repo.repository,
      repoPath: repo.repoPath,
      number: repo.prNumber,
      url: repo.prUrl,
      state: repo.prState,
    }),
  );
  const title = back
    ? `Back to the ${stageLabel(stage)}?`
    : `Discard the ${stageLabel(stage)} and start over?`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {back ? backDescription(stage, current) : discardDescription(stage, current)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <OrphanPRs prs={prs} />
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
