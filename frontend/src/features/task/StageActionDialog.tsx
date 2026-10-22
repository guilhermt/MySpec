import { useState } from "react";
import { BackgroundWorkList } from "@/components/BackgroundWorkList";
import { endedBy } from "@/components/background-work";
import { Button } from "@/components/system/Button";
import { Dialog, DialogBody, DialogCancel, DialogFooter } from "@/components/system/Dialog";
import { ICONS } from "@/components/system/icons";
import { Link } from "@/components/system/Link";
import { SunkenLine } from "@/components/system/SunkenLine";
import { interruptedSentence, interruptedSessions } from "@/features/task/deletion";
import {
  lostItems,
  openPR,
  type StageAction,
  stageActionConfirm,
  stageActionLoading,
  stageActionTitle,
  whatStays,
} from "@/features/task/stage-actions";
import { usePreviewReading } from "@/features/task/usePreviewReading";
import { asTaskMode, type TaskStage, type TaskSummary } from "@/lib/wails";
import {
  backToStageInPlace,
  discardStageInPlace,
  focusRequestAfterRestart,
  openExternal,
  stopTasksOf,
} from "@/store/actions";

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
 * StageActionDialog is the last stop before a stage is reopened or restarted: it lists what the
 * task loses, with the uncommitted files of the worktree counted from git when it opens. A refusal
 * stays in its footer.
 */
export function StageActionDialog({
  task,
  action,
  stage,
  open,
  onOpenChange,
}: StageActionDialogProps) {
  const [working, setWorking] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const reading = usePreviewReading(task.id, open, task.worktreePath !== "");
  const mode = asTaskMode(task.mode);
  const confirm = stageActionConfirm(action, mode, stage);
  const pr = openPR(task);
  const ended = endedBy(
    action === "back" ? { kind: "back", target: stage } : { kind: "restart" },
    task,
  );
  const stops = ended.length > 0;

  const perform = async () => {
    if (working) {
      return;
    }
    setWorking(true);
    setRefusal(null);
    await stopTasksOf(task.id, ended);
    const message = await (action === "back" ? backToStageInPlace : discardStageInPlace)(
      task.id,
      stage,
    );
    setWorking(false);
    if (message === null) {
      onOpenChange(false);
      focusRequestAfterRestart();
    } else {
      const what =
        action === "back"
          ? `go back to ${confirm.replace(/^Back to /, "")}`
          : `discard ${confirm.replace(/^Discard /, "")}`;
      setRefusal(`Couldn't ${what}: ${message}`);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // While the call runs, the dialog stays: a refusal that comes back has its footer.
        if (!next && working) {
          return;
        }
        if (!next) {
          setRefusal(null);
        }
        onOpenChange(next);
      }}
      closeDisabled={working}
      title={stageActionTitle(action, mode, stage)}
      alert
    >
      <DialogBody>
        <p>This deletes:</p>
        <ul className="m-0 flex list-disc flex-col gap-(--space-1) pl-(--space-5)">
          {lostItems(task, action, stage, reading.kind === "reading" ? null : reading).map(
            (item) => (
              <li key={item}>{item}</li>
            ),
          )}
        </ul>
        {pr !== null && (
          <SunkenLine
            icon={ICONS.pullRequest}
            action={
              <Link
                href={pr.url}
                external
                onClick={(event) => {
                  event.preventDefault();
                  void openExternal(pr.url);
                }}
              >
                {`Open #${pr.number}`}
              </Link>
            }
          >
            <span className="font-medium text-ink-1">{`PR #${pr.number} stays open on GitHub.`}</span>{" "}
            Close it there if you don't need it.
          </SunkenLine>
        )}
        <p>{whatStays(task, action, stage)}</p>
        {interruptedSessions(task).map((role) => (
          <p key={role} className="text-ink-3">
            {interruptedSentence(role)}
          </p>
        ))}
        {stops && (
          <>
            <p>This also stops what runs in the background. It won't resume.</p>
            <BackgroundWorkList itemId={task.id} sessions={ended} />
          </>
        )}
      </DialogBody>
      <DialogFooter {...(refusal === null ? {} : { refusal })}>
        <DialogCancel disabled={working} />
        <Button
          variant="danger"
          loading={working}
          loadingLabel={stageActionLoading(action)}
          onClick={() => void perform()}
        >
          {stops ? (action === "back" ? "Stop and go back" : "Stop and restart") : confirm}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
