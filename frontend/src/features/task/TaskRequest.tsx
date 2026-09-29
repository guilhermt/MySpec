import { useRef, useState } from "react";
import { Button } from "@/components/system/Button";
import { OtherConversationBar, RequestBar } from "@/components/system/RequestBar";
import { Tooltip } from "@/components/system/Tooltip";
import { CleanAndStartDialog } from "@/features/task/CleanAndStartDialog";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { DiscardStepDialog } from "@/features/task/DiscardStepDialog";
import type { TaskRequestAction, TaskRequestButton } from "@/features/task/request";
import { focusRequest } from "@/features/task/request-focus";
import { currentStepOf } from "@/features/task/step-status";
import { useTaskRequest } from "@/features/task/useTaskRequest";
import type { TaskSummary } from "@/lib/wails";
import {
  approvePR,
  approveStep,
  changeClonePath,
  closeTask,
  continueStage,
  discardDraft,
  openExternal,
  openInEditor,
  openPR,
  retry,
  retryPR,
  retryStep,
  reviewAgain,
} from "@/store/actions";
import {
  type PrDraft,
  type StepTab,
  useAppStore,
  useFlashing,
  usePrDraft,
} from "@/store/app-store";

// run starts what a button of the bar does; the ones that ask first open their dialog instead.
function run(button: TaskRequestButton, task: TaskSummary, edited: PrDraft | null): Promise<void> {
  const taskId = task.id;
  const pr = task.pr;
  switch (button.action) {
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
    case "retrySession":
      return retry(taskId, button.stage ?? "");
    case "retryStep":
      return retryStep(taskId);
    case "retryPR":
      return retryPR(taskId);
    case "changePath":
      return changeClonePath(task.repositoryId);
    default:
      return Promise.resolve();
  }
}

/**
 * useBornStatus is what the status of the bar announces: nothing for the situation already there
 * when the screen mounted, and for one born after, the status it was born with, frozen the first
 * time its id is seen so a later change to its form isn't announced again.
 */
function useBornStatus(situationId: string | null, status: string): string {
  const mounted = useRef<{ situationId: string | null } | null>(null);
  const born = useRef<{ situationId: string; status: string } | null>(null);
  mounted.current ??= { situationId };
  if (situationId === null || situationId === mounted.current.situationId) {
    return "";
  }
  if (born.current?.situationId !== situationId) {
    born.current = { situationId, status };
  }
  return born.current.status;
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
  const [cleaning, setCleaning] = useState(false);
  const edited = usePrDraft(task.id);
  const flashing = useFlashing();
  const selectStepTab = useAppStore((state) => state.selectStepTab);
  const requestMarkerOpen = useAppStore((state) => state.requestMarkerOpen);
  const { request, other } = useTaskRequest(task, tab);
  const situationId = request?.situationId ?? other?.situationId ?? null;
  const status = useBornStatus(situationId, request?.status ?? other?.status ?? "");
  const step = currentStepOf(task);

  if (request === null) {
    if (other === null || step === null) {
      return null;
    }
    return (
      <div className="shrink-0 px-(--space-6) pt-(--space-2)">
        <OtherConversationBar
          failed={other.failed}
          label={other.label}
          status={status}
          {...(other.time !== undefined ? { time: other.time } : {})}
          goLabel={other.goLabel}
          goTooltip={`Show the ${other.goTab}'s conversation`}
          onGo={() => selectStepTab(task.id, step.number, other.goTab)}
          {...(flashing.has(other.situationId) ? { flash: other.failed ? "error" : "wait" } : {})}
        />
      </div>
    );
  }

  const press = async (button: TaskRequestButton) => {
    switch (button.action) {
      case "discardStep":
        setDiscarding(true);
        return;
      case "deleteTask":
        setDeleting(true);
        return;
      case "cleanAndStart":
        setCleaning(true);
        return;
      case "show":
        focusRequest(request.focus);
        return;
      case "showProblems":
        requestMarkerOpen(task.id, "plan_invalid");
        return;
    }
    setRunning(button.action);
    try {
      await run(button, task, edited);
    } finally {
      setRunning(null);
    }
  };

  const flash =
    request.situationId !== null && flashing.has(request.situationId)
      ? request.glyph === "error"
        ? "error"
        : "wait"
      : undefined;

  return (
    <div className="shrink-0 px-(--space-6) pt-(--space-2)">
      <RequestBar
        form={request.form}
        glyph={request.glyph}
        label={request.label}
        status={status}
        {...(request.place !== undefined ? { place: request.place } : {})}
        {...(request.time !== undefined ? { time: request.time } : {})}
        {...(request.progress !== undefined ? { progress: request.progress } : {})}
        {...(request.progressTooltip !== undefined
          ? { progressTooltip: request.progressTooltip }
          : {})}
        {...(flash !== undefined ? { flash } : {})}
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
              onClick={() => void press(button)}
            >
              {button.label}
            </Button>
          );
          // The key of the action, or what it does when its label doesn't say, is in its tooltip.
          if (button.shortcut === undefined && button.tooltip === undefined) {
            return control;
          }
          return (
            <Tooltip
              key={button.action}
              content={button.tooltip ?? button.label}
              {...(button.shortcut !== undefined ? { shortcut: button.shortcut } : {})}
            >
              {control}
            </Tooltip>
          );
        })}
      />
      {step !== null && (
        <>
          <DiscardStepDialog
            task={task}
            step={step}
            open={discarding}
            onOpenChange={setDiscarding}
          />
          <CleanAndStartDialog task={task} step={step} open={cleaning} onOpenChange={setCleaning} />
        </>
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
