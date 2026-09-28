import { useEffect } from "react";
import { AuxPanel, PanelLayout } from "@/components/system/AuxPanel";
import { Composer } from "@/features/chat/Composer";
import { Conversation } from "@/features/chat/Conversation";
import { AgentTabs } from "@/features/task/AgentTabs";
import { ArtifactPanel } from "@/features/task/ArtifactPanel";
import { agentTabsOf } from "@/features/task/agent-tabs";
import { PlanProblemsNotice } from "@/features/task/PlanProblemsNotice";
import { PRPane } from "@/features/task/PRPane";
import { ReviewStrip } from "@/features/task/ReviewStrip";
import { StepPane } from "@/features/task/StepPane";
import { currentStepOf, hasStepSession, stepStage } from "@/features/task/step-status";
import { TaskHeader } from "@/features/task/TaskHeader";
import { TaskRequest } from "@/features/task/TaskRequest";
import { prOf } from "@/lib/pull-requests";
import {
  asStepStatus,
  asTaskStage,
  type Step,
  type StepStatus,
  sessionKey,
  type TaskSummary,
} from "@/lib/wails";
import { loadTranscript } from "@/store/actions";
import { useAppStore, useOpenStepTab, usePanel, useTask } from "@/store/app-store";

/** COLUMN is the conversation column, centered on a whole pixel. */
const COLUMN =
  "w-full max-w-(--measure-conversation) ml-[max(0px,round(down,calc((100%_-_var(--measure-conversation))/2),1px))]";

/** CONVERSING are the states of a step whose conversation is on screen. */
const CONVERSING: ReadonlySet<StepStatus> = new Set<StepStatus>([
  "implementing",
  "agent_review",
  "addressing_review",
  "awaiting_review",
  "in_review",
  "ready_to_approve",
  "nothing_to_commit",
  "review_failed",
  "committing",
]);

/**
 * StepTop is what sits over the conversation of the step: the agent tabs and the review of the
 * step, in the conversation column.
 */
function StepTop({ task, step }: { task: TaskSummary; step: Step }) {
  const status = asStepStatus(step.status);
  const review = step.review !== null && CONVERSING.has(status) ? step.review : null;
  // Only whether there are tabs matters here: AgentTabs says which one is chosen.
  if (agentTabsOf(task, step, "implementer", 0) === null && review === null) {
    return null;
  }
  return (
    <div className="shrink-0 px-(--space-6) pt-(--space-1)">
      <div className={COLUMN}>
        <AgentTabs task={task} step={step} />
        {review !== null && <ReviewStrip taskId={task.id} subject="step" review={review} />}
      </div>
    </div>
  );
}

export interface TaskViewProps {
  taskId: string;
}

/** TaskView is the screen of one task: the conversation and what came out of it. */
export function TaskView({ taskId }: TaskViewProps) {
  const task = useTask(taskId);
  const stepTab = useOpenStepTab(taskId);
  const panel = usePanel();
  const openPanel = useAppStore((state) => state.openPanel);

  const implementing = task !== null && asTaskStage(task.stage) === "implementation";
  const opening = task !== null && asTaskStage(task.stage) === "pr";
  const step = task !== null && implementing ? currentStepOf(task) : null;
  const pr = task === null ? null : prOf(task);
  // The conversation on screen is the one of the stage the task is in: the tab
  // of the step that runs in the implementation stage, the pull request in the
  // PR one. Both open a session of their own only once they get that far.
  const stage = (() => {
    if (implementing) {
      if (step === null) {
        return "";
      }
      return stepTab === "reviewer" && step.reviewer !== null
        ? step.reviewer.sessionStage
        : stepStage(step.number);
    }
    if (opening) {
      return pr?.sessionStage ?? "";
    }
    return task?.stage ?? "";
  })();
  const hasConversation =
    task !== null && (implementing ? hasStepSession(step) : opening ? stage !== "" : true);

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
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <TaskHeader task={null} />
      </section>
    );
  }

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <TaskHeader task={task} />
      <PanelLayout
        panel={
          panel === "artifacts" && (
            <AuxPanel id="artifacts" title="Artifacts" onClose={() => openPanel(null)}>
              <ArtifactPanel task={task} />
            </AuxPanel>
          )
        }
      >
        {implementing ? (
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
            />
            <PlanProblemsNotice task={task} />
            <TaskRequest task={task} tab={stepTab} />
            <Composer taskId={task.id} stage={task.stage} session={task} />
          </>
        )}
      </PanelLayout>
    </section>
  );
}
