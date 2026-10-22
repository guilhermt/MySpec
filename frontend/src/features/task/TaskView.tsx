import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";
import { ArrivalFocus } from "@/components/ArrivalFocus";
import { BackgroundWork } from "@/components/BackgroundWork";
import { backgroundOf } from "@/components/background-work";
import { PanelLayout } from "@/components/system/AuxPanel";
import { useNow } from "@/features/attention/useNow";
import { Conversation } from "@/features/chat/Conversation";
import { COLUMN_CLASS } from "@/features/chat/ConversationColumn";
import { voiceOf } from "@/features/chat/markers";
import { SubagentConversation } from "@/features/chat/SubagentConversation";
import { IDLE_SESSION } from "@/features/chat/session";
import { AgentTabs, useStoredFirstTab } from "@/features/task/AgentTabs";
import { ArtifactsPanel } from "@/features/task/ArtifactsPanel";
import { agentTabsOf, firstTab, prAgentTabsOf } from "@/features/task/agent-tabs";
import { CardPanel } from "@/features/task/CardPanel";
import { DetailsPanel } from "@/features/task/DetailsPanel";
import { earlierPlace } from "@/features/task/details";
import { EarlierConversationFoot } from "@/features/task/EarlierConversationFoot";
import { PRPane } from "@/features/task/PRPane";
import {
  hasReviewConversation,
  type PlaceView,
  placeTitleOf,
  prPlaceOf,
  stepPlaceOf,
} from "@/features/task/place";
import { cardFindings } from "@/features/task/pr-findings";
import { screenSituationKindOf, screenStageOf } from "@/features/task/request";
import { useFocusRescue } from "@/features/task/request-focus";
import { StepPane } from "@/features/task/StepPane";
import { currentStepOf, hasStepSession } from "@/features/task/step-status";
import { TaskComposer } from "@/features/task/TaskComposer";
import { TaskHeader } from "@/features/task/TaskHeader";
import { TaskRequest } from "@/features/task/TaskRequest";
import { screenSession } from "@/features/task/task-session";
import { useTaskRequest } from "@/features/task/useTaskRequest";
import { focusFindingToDecide } from "@/lib/focus";
import { modalOpen } from "@/lib/layers";
import { prOf } from "@/lib/pull-requests";
import {
  asTaskStage,
  type PullRequest,
  type Step,
  sessionKey,
  type TaskSummary,
} from "@/lib/wails";
import { loadTranscript } from "@/store/actions";
import {
  PR_TAB_SLOT,
  type StepTab,
  useAppStore,
  useEarlierConversation,
  useOpenStepTab,
  usePanel,
  useSubagentConversation,
  useSubagentReturn,
  useTask,
} from "@/store/app-store";
import { firstPRTab, firstPRTabDecided, firstTabDecided } from "@/store/step-tab";

const MINUTE = 60_000;

/** TabsTop is the row of agent tabs over a conversation, in the conversation column. */
function TabsTop({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 px-(--space-6) pt-(--space-1)">
      <div className={COLUMN_CLASS}>{children}</div>
    </div>
  );
}

/** StepTop is what sits over the conversation of the step: the agent tabs, in the conversation column. */
export function StepTop({ task, step }: { task: TaskSummary; step: Step }) {
  const chosen = useOpenStepTab(task.id);
  const now = useNow(MINUTE, true);
  const selectStepTab = useAppStore((state) => state.selectStepTab);
  const tabs = agentTabsOf(task, step, chosen, now);
  useStoredFirstTab(
    task.id,
    step.number,
    tabs !== null && firstTabDecided(task, step),
    firstTab(task, step),
  );
  if (tabs === null) {
    return null;
  }
  return (
    <TabsTop>
      <AgentTabs
        task={task}
        tabs={tabs}
        chosen={chosen}
        onSelect={(tab) => selectStepTab(task.id, step.number, tab)}
      />
    </TabsTop>
  );
}

/** PRTop is what sits over the conversation of the review of the pull request: the agent tabs, in the conversation column. */
export function PRTop({ task, pr }: { task: TaskSummary; pr: PullRequest }) {
  const chosen = useOpenStepTab(task.id);
  const now = useNow(MINUTE, true);
  const selectStepTab = useAppStore((state) => state.selectStepTab);
  const tabs = prAgentTabsOf(task, pr, chosen, now);
  useStoredFirstTab(
    task.id,
    PR_TAB_SLOT,
    tabs !== null && firstPRTabDecided(task, pr),
    firstPRTab(task, pr),
  );
  if (tabs === null) {
    return null;
  }
  return (
    <TabsTop>
      <AgentTabs
        task={task}
        tabs={tabs}
        chosen={chosen}
        onSelect={(tab) => selectStepTab(task.id, PR_TAB_SLOT, tab)}
      />
    </TabsTop>
  );
}

// sessionOpenOf says the process of the conversation of a stage is alive, so a task of it can be stopped.
function sessionOpenOf(task: TaskSummary, tab: StepTab, stage: string): boolean {
  const session = screenSession(task, tab);
  return session?.stage === stage && session.processRunning;
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
 * usePlaceAnnouncement says the title of the place when it changes with the screen open: the live
 * region of the app hears what the eyes see change. Arriving on a place says nothing.
 */
function usePlaceAnnouncement(taskId: string, view: PlaceView | null) {
  const announce = useAppStore((state) => state.announce);
  const title = view === null ? null : placeTitleOf(view);
  const key = `${view?.kind ?? ""}:${title ?? ""}`;
  const seen = useRef<{ taskId: string; key: string } | null>(null);

  useEffect(() => {
    const before = seen.current;
    seen.current = { taskId, key };
    if (before !== null && before.taskId === taskId && before.key !== key && title !== null) {
      announce(title);
    }
  }, [taskId, key, title, announce]);
}

/**
 * TaskArrival is the focus on arriving at a situation of the task, apart from TaskView so only it
 * follows the clock of the request.
 */
function TaskArrival({ task, tab, ready }: { task: TaskSummary; tab: StepTab; ready: boolean }) {
  const { request } = useTaskRequest(task, tab);
  return <ArrivalFocus target={request?.focus ?? null} ready={ready} />;
}

export interface TaskViewProps {
  taskId: string;
}

/**
 * TaskView is the screen of one task: the conversation and what came out of it. An earlier
 * conversation or the conversation of a subagent, once read, takes the place of all of it but the
 * header and the panels.
 */
export function TaskView({ taskId }: TaskViewProps) {
  const task = useTask(taskId);
  const stepTab = useOpenStepTab(taskId);
  const panel = usePanel();
  const earlier = useEarlierConversation(taskId);
  const subagent = useSubagentConversation(taskId);
  const subagentReturn = useSubagentReturn(taskId);
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
  const stage = task === null ? "" : screenStageOf(task, stepTab);
  const hasConversation =
    task !== null && (implementing ? hasStepSession(step) : opening ? stage !== "" : true);
  // A conversation that couldn't be read is settled too: the focus lands without it.
  const conversationSettled = useAppStore((state) => {
    const status = state.transcripts[sessionKey(taskId, stage)]?.status;
    return status === "ready" || status === "error";
  });
  const placeView =
    task === null
      ? null
      : implementing
        ? stepPlaceOf(task)
        : opening && pr !== null
          ? prPlaceOf(task, pr, hasReviewConversation(task))
          : null;
  usePlaceAnnouncement(taskId, placeView);
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
      <section ref={rescue} className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1">
        <TaskHeader task={null} />
      </section>
    );
  }

  // Alt+↓ and Alt+↑ go to the next and the previous finding to decide from anywhere on the screen,
  // the composer included. The other keys of the findings belong to the card.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || modalOpen()) {
      return;
    }
    if (
      event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      (event.key === "ArrowDown" || event.key === "ArrowUp")
    ) {
      event.preventDefault();
      focusFindingToDecide(cardFindings(task), event.key === "ArrowDown" ? 1 : -1);
    }
  };

  return (
    <section
      ref={rescue}
      aria-label={task.name}
      onKeyDown={onKeyDown}
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-1"
    >
      <TaskHeader task={task} />
      <TaskArrival task={task} tab={stepTab} ready={!hasConversation || conversationSettled} />
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
        {subagent !== null ? (
          <SubagentConversation
            key={subagent.toolUseId}
            itemId={task.id}
            stage={subagent.stage}
            toolUseId={subagent.toolUseId}
            voice={voiceOf(subagent.stage)}
            sessionOpen={sessionOpenOf(task, stepTab, subagent.stage)}
          />
        ) : earlier !== null && earlierReady ? (
          <EarlierConversation key={earlier.stage} task={task} stage={earlier.stage} />
        ) : implementing ? (
          <>
            {step !== null && <StepTop task={task} step={step} />}
            <StepPane task={task} />
          </>
        ) : opening ? (
          pr !== null && (
            <>
              <PRTop task={task} pr={pr} />
              <PRPane task={task} pr={pr} tab={stepTab} />
            </>
          )
        ) : (
          <>
            <Conversation
              key={`conversation:${task.stage}`}
              taskId={task.id}
              stage={task.stage}
              session={task}
              anchor={subagentReturn}
              replyWaiting={screenSituationKindOf(task, stepTab) === "reply"}
            />
            <TaskRequest task={task} tab={stepTab} />
            <BackgroundWork
              itemId={task.id}
              stage={task.stage}
              tasks={backgroundOf(task.running, task.stage)}
            />
            <TaskComposer task={task} tab={stepTab} stage={task.stage} session={task} />
          </>
        )}
      </PanelLayout>
    </section>
  );
}
