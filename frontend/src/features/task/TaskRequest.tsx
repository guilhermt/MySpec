import { useEffect, useRef, useState } from "react";
import { OtherConversationBar, RequestBar } from "@/components/system/RequestBar";
import { CleanAndStartDialog } from "@/features/task/CleanAndStartDialog";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { DiscardStepDialog } from "@/features/task/DiscardStepDialog";
import { cardFindings } from "@/features/task/pr-findings";
import type { TaskRequestAction, TaskRequestButton } from "@/features/task/request";
import { RequestButtons } from "@/features/task/request-buttons";
import { currentStepOf } from "@/features/task/step-status";
import { useBornStatus } from "@/features/task/useBornStatus";
import { useTaskRequest } from "@/features/task/useTaskRequest";
import { focusFindingToDecide, focusRequest } from "@/lib/focus";
import type { TaskSummary } from "@/lib/wails";
import {
  applyPRFindings,
  approvePR,
  approveRestOfPRFindings,
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
    case "applyFindings":
      return applyPRFindings(taskId);
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

  // Once Approve the rest went through, the focus goes to the primary the bar has then: the button
  // that was pressed leaves with the findings it approved.
  const focusPrimaryNext = useRef(false);
  const offersApproveRest = request?.actions.some((button) => button.action === "approveRest");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the bar changing is what moves the focus
  useEffect(() => {
    if (focusPrimaryNext.current && !offersApproveRest) {
      focusPrimaryNext.current = false;
      focusRequest("primary");
    }
  }, [request?.label, offersApproveRest]);

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
      case "nextToDecide":
        focusFindingToDecide(cardFindings(task), 1);
        return;
    }
    setRunning(button.action);
    try {
      if (button.action === "approveRest" && task.pr !== null) {
        focusPrimaryNext.current = await approveRestOfPRFindings(task.id, task.pr.currentPass);
      } else {
        await run(button, task, edited);
      }
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
        actions={RequestButtons({
          buttons: request.actions,
          running,
          onPress: (button) => void press(button),
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
