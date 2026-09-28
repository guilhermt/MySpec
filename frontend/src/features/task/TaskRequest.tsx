import { useState } from "react";
import { Button } from "@/components/system/Button";
import { RequestBar } from "@/components/system/RequestBar";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { DiscardStepDialog } from "@/features/task/DiscardStepDialog";
import { type TaskRequestAction, taskRequestOf } from "@/features/task/request";
import { currentStepOf } from "@/features/task/step-status";
import type { TaskSummary } from "@/lib/wails";
import {
  approvePR,
  approveStep,
  closeTask,
  continueStage,
  discardDraft,
  openExternal,
  openInEditor,
  openPR,
  reviewAgain,
} from "@/store/actions";
import { type PrDraft, type StepTab, usePrDraft, useRepository } from "@/store/app-store";

// MINUTE is how often the wait on the chip is read again.
const MINUTE = 60_000;

// run starts what a button of the bar does; the ones that ask first open their dialog instead.
function run(action: TaskRequestAction, task: TaskSummary, edited: PrDraft | null): Promise<void> {
  const taskId = task.id;
  const pr = task.pr;
  switch (action) {
    case "openInEditor":
      return openInEditor(taskId);
    case "approveStep":
      return approveStep(taskId);
    case "continue":
      return continueStage(taskId);
    case "approveDraft":
      // The draft sent is the one the user edited, or the agent's as it is on disk.
      return openPR(
        taskId,
        edited?.title ?? pr?.draft?.title ?? "",
        edited?.body ?? pr?.draft?.body ?? "",
      );
    case "discardDraft":
      return discardDraft(taskId);
    case "approvePR":
      return approvePR(taskId);
    case "openPR":
      return pr === null ? Promise.resolve() : openExternal(pr.prUrl);
    case "closeTask":
      return closeTask(taskId);
    case "reviewAgain":
      return reviewAgain(taskId);
    default:
      return Promise.resolve();
  }
}

export interface TaskRequestProps {
  task: TaskSummary;
  tab: StepTab;
}

/** TaskRequest is the request bar of the task screen: what the step or the stage asks of the user. */
export function TaskRequest({ task, tab }: TaskRequestProps) {
  const [running, setRunning] = useState<TaskRequestAction | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const edited = usePrDraft(task.id);
  const repository = useRepository(task.repositoryId);
  const now = useNow(MINUTE, true);

  const request = taskRequestOf(task, tab, now, repository);
  if (request === null) {
    return null;
  }
  const step = currentStepOf(task);

  const press = async (action: TaskRequestAction) => {
    if (action === "discardStep") {
      setDiscarding(true);
      return;
    }
    if (action === "deleteTask") {
      setDeleting(true);
      return;
    }
    setRunning(action);
    try {
      await run(action, task, edited);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="shrink-0 px-(--space-3) pt-(--space-2)">
      <RequestBar
        form={request.form}
        glyph={request.glyph}
        label={request.label}
        status={request.status}
        {...(request.place !== undefined ? { place: request.place } : {})}
        {...(request.time !== undefined ? { time: request.time } : {})}
        {...(request.progress !== undefined ? { progress: request.progress } : {})}
        actions={request.actions.map((button) => {
          const control = (
            <Button
              key={button.action}
              size="sm"
              variant={button.variant}
              {...(button.disabledReason !== undefined
                ? { disabled: true, disabledReason: button.disabledReason }
                : {})}
              {...(button.loadingLabel !== ""
                ? { loading: running === button.action, loadingLabel: button.loadingLabel }
                : {})}
              onClick={() => void press(button.action)}
            >
              {button.label}
            </Button>
          );
          // The key of the action is in its tooltip, not on the button.
          return button.shortcut === undefined ? (
            control
          ) : (
            <Tooltip key={button.action} content={button.label} shortcut={button.shortcut}>
              {control}
            </Tooltip>
          );
        })}
      />
      {step !== null && (
        <DiscardStepDialog task={task} step={step} open={discarding} onOpenChange={setDiscarding} />
      )}
      <DeleteTaskDialog
        taskId={task.id}
        name={task.name}
        archived={false}
        open={deleting}
        onOpenChange={setDeleting}
      />
    </div>
  );
}
