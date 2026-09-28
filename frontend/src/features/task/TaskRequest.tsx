import { useState } from "react";
import { Button } from "@/components/system/Button";
import { RequestBar } from "@/components/system/RequestBar";
import { Tooltip } from "@/components/system/Tooltip";
import { useNow } from "@/features/attention/useNow";
import { DiscardStepDialog } from "@/features/task/DiscardStepDialog";
import {
  type RequestKind,
  requestKindOf,
  type TaskRequestAction,
  taskRequestOf,
} from "@/features/task/request";
import { currentStepOf } from "@/features/task/step-status";
import type { TaskSummary } from "@/lib/wails";
import { approveStep, continueStage, openInEditor } from "@/store/actions";
import type { StepTab } from "@/store/app-store";

/** REQUEST_KINDS_ON_SCREEN are the bars the task screen draws: the step's and the planning stage's. */
const REQUEST_KINDS_ON_SCREEN: readonly RequestKind[] = [
  "step_review",
  "step_empty",
  "ready_to_continue",
];

// MINUTE is how often the wait on the chip is read again.
const MINUTE = 60_000;

// run starts what a button of the bar does; the ones that ask first open their dialog instead.
function run(action: TaskRequestAction, taskId: string): Promise<void> {
  switch (action) {
    case "openInEditor":
      return openInEditor(taskId);
    case "approveStep":
      return approveStep(taskId);
    case "continue":
      return continueStage(taskId);
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
  const now = useNow(MINUTE, true);

  const kind = requestKindOf(task);
  const request =
    kind !== null && REQUEST_KINDS_ON_SCREEN.includes(kind) ? taskRequestOf(task, tab, now) : null;
  if (request === null) {
    return null;
  }
  const step = currentStepOf(task);

  const press = async (action: TaskRequestAction) => {
    if (action === "discardStep") {
      setDiscarding(true);
      return;
    }
    setRunning(action);
    try {
      await run(action, task.id);
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
    </div>
  );
}
