import { useEffect, useRef } from "react";
import { PanelLayout } from "@/components/system/AuxPanel";
import { Conversation } from "@/features/chat/Conversation";
import { COLUMN_CLASS } from "@/features/chat/ConversationColumn";
import { IDLE_SESSION } from "@/features/chat/session";
import { AgentTabs } from "@/features/task/AgentTabs";
import { ArtifactsPanel } from "@/features/task/ArtifactsPanel";
import { agentTabsOf } from "@/features/task/agent-tabs";
import { CardPanel } from "@/features/task/CardPanel";
import { DetailsPanel } from "@/features/task/DetailsPanel";
import { earlierPlace } from "@/features/task/details";
import { EarlierConversationFoot } from "@/features/task/EarlierConversationFoot";
import { PRPane } from "@/features/task/PRPane";
import { hasReviewConversation, prPlaceOf } from "@/features/task/place";
import { screenSituationKindOf, screenStageOf } from "@/features/task/request";
import { focusRequest, focusTitle, useFocusRescue } from "@/features/task/request-focus";
import { StepPane } from "@/features/task/StepPane";
import { currentStepOf, hasStepSession } from "@/features/task/step-status";
import { TaskComposer } from "@/features/task/TaskComposer";
import { TaskHeader } from "@/features/task/TaskHeader";
import { TaskRequest } from "@/features/task/TaskRequest";
import { useTaskRequest } from "@/features/task/useTaskRequest";
import { prOf } from "@/lib/pull-requests";
import { asTaskStage, type Step, sessionKey, type TaskSummary } from "@/lib/wails";
import { loadTranscript } from "@/store/actions";
import {
  type StepTab,
  useAppStore,
  useEarlierConversation,
  useOpenStepTab,
  usePanel,
  useTask,
} from "@/store/app-store";

/** StepTop is what sits over the conversation of the step: the agent tabs, in the conversation column. */
function StepTop({ task, step }: { task: TaskSummary; step: Step }) {
  // Only whether there are tabs matters here: AgentTabs says which one is chosen.
  if (agentTabsOf(task, step, "implementer", 0) === null) {
    return null;
  }
  return (
    <div className="shrink-0 px-(--space-6) pt-(--space-1)">
      <div className={COLUMN_CLASS}>
        <AgentTabs task={task} step={step} />
      </div>
    </div>
  );
}

/**
 * EarlierConversation is a conversation of the task read in place of the one of its place, from its
 * start and taking no message, with the strip that leads back. It takes the focus as it opens.
 */
function EarlierConversation({ task, stage }: { task: TaskSummary; stage: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <>
      <section
        ref={ref}
        aria-label={`${earlierPlace(task, stage)}, an earlier conversation`}
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col outline-none"
      >
        <Conversation taskId={task.id} stage={stage} session={IDLE_SESSION} readOnly />
      </section>
      <EarlierConversationFoot task={task} stage={stage} />
    </>
  );
}

/**
 * ArrivalFocus takes the focus, on arriving at a situation of the task, to what it asks once the
 * conversation and the bar are on screen: the pending card, the primary of the bar, the composer,
 * or the bar; the title when none is there.
 */
function ArrivalFocus({ task, tab, ready }: { task: TaskSummary; tab: StepTab; ready: boolean }) {
  const pendingFocus = useAppStore((state) => state.pendingFocus);
  const clearPendingFocus = useAppStore((state) => state.clearPendingFocus);
  const { request } = useTaskRequest(task, tab);
  const target = request?.focus ?? "composer";

  useEffect(() => {
    if (pendingFocus !== "request" || !ready) {
      return;
    }
    if (!focusRequest(target)) {
      focusTitle();
    }
    clearPendingFocus();
  }, [pendingFocus, ready, target, clearPendingFocus]);

  return null;
}

export interface TaskViewProps {
  taskId: string;
}

/**
 * TaskView is the screen of one task: the conversation and what came out of it. An earlier
 * conversation, once read, takes the place of all of it but the header and the panels.
 */
export function TaskView({ taskId }: TaskViewProps) {
  const task = useTask(taskId);
  const stepTab = useOpenStepTab(taskId);
  const panel = usePanel();
  const earlier = useEarlierConversation(taskId);
  const earlierReady = useAppStore(
    (state) =>
      earlier !== null && state.transcripts[sessionKey(taskId, earlier.stage)]?.status === "ready",
  );

  const implementing = task !== null && asTaskStage(task.stage) === "implementation";
  const opening = task !== null && asTaskStage(task.stage) === "pr";
  const step = task !== null && implementing ? currentStepOf(task) : null;
  const pr = task === null ? null : prOf(task);
  // The conversation on screen is the one of the stage the task is in: the tab
  // of the step that runs in the implementation stage, the pull request in the
  // PR one. Both open a session of their own only once they get that far. Past
  // its review, the pull request reads the conversation of the review, closed.
  const closedReview =
    task !== null &&
    opening &&
    pr !== null &&
    prPlaceOf(task, pr, hasReviewConversation(task)).kind === "closedReview";
  const stage = task === null ? "" : closedReview ? "pr_review" : screenStageOf(task, stepTab);
  const hasConversation =
    task !== null && (implementing ? hasStepSession(step) : opening ? stage !== "" : true);
  const conversationReady = useAppStore(
    (state) => state.transcripts[sessionKey(taskId, stage)]?.status === "ready",
  );
  const rescue = useRef<HTMLElement>(null);
  useFocusRescue(rescue);

  // The conversation is fetched once and then kept: leaving the task and coming
  // back costs nothing, and the events keep being applied while it is away. It
  // waits for the task to be in the snapshot, which a brand new one is not yet.
  useEffect(() => {
    const key = sessionKey(taskId, stage);
    if (hasConversation && useAppStore.getState().transcripts[key] === undefined) {
      void loadTranscript(taskId, stage);
    }
  }, [taskId, stage, hasConversation]);

  // A new task is on screen before the snapshot that brings it: the header shows it loading.
  if (task === null) {
    return (
      <section ref={rescue} className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <TaskHeader task={null} />
      </section>
    );
  }

  return (
    <section ref={rescue} className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <TaskHeader task={task} />
      <ArrivalFocus task={task} tab={stepTab} ready={!hasConversation || conversationReady} />
      <PanelLayout
        panel={
          panel === "details" ? (
            <DetailsPanel key="details" task={task} />
          ) : panel === "artifacts" ? (
            <ArtifactsPanel key="artifacts" task={task} />
          ) : panel === "card" && task.card !== null ? (
            <CardPanel key="card" task={task} />
          ) : null
        }
      >
        {earlier !== null && earlierReady ? (
          <EarlierConversation key={earlier.stage} task={task} stage={earlier.stage} />
        ) : implementing ? (
          <>
            {step !== null && <StepTop task={task} step={step} />}
            <StepPane task={task} />
          </>
        ) : opening ? (
          pr !== null && <PRPane task={task} pr={pr} tab={stepTab} />
        ) : (
          <>
            <Conversation
              key={`conversation:${task.stage}`}
              taskId={task.id}
              stage={task.stage}
              session={task}
              replyWaiting={screenSituationKindOf(task, stepTab) === "reply"}
            />
            <TaskRequest task={task} tab={stepTab} />
            <TaskComposer task={task} tab={stepTab} stage={task.stage} session={task} />
          </>
        )}
      </PanelLayout>
    </section>
  );
}
