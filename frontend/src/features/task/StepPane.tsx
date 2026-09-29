import { tabId } from "@/components/system/Tabs";
import { Conversation } from "@/features/chat/Conversation";
import { AGENT_CONVERSATION } from "@/features/task/AgentTabs";
import { agentTabsOf } from "@/features/task/agent-tabs";
import { ChangedFilesCard } from "@/features/task/ChangedFilesCard";
import { PlaceColumn } from "@/features/task/PlaceColumn";
import { hasComposer, type PlaceView, stepFixedCardOf, stepPlaceOf } from "@/features/task/place";
import { screenSituationKindOf } from "@/features/task/request";
import { currentStepOf, stepStage } from "@/features/task/step-status";
import { TaskComposer } from "@/features/task/TaskComposer";
import { TaskRequest } from "@/features/task/TaskRequest";
import type { Step, TaskSummary } from "@/lib/wails";
import { useOpenStepTab } from "@/store/app-store";

interface StepConversationProps {
  task: TaskSummary;
  step: Step;
  view: PlaceView;
}

/**
 * StepConversation is the conversation of the tab on screen, with the changed files at its end while
 * they are the user's to read, what the step asks and the field to answer it.
 */
function StepConversation({ task, step, view }: StepConversationProps) {
  const tab = useOpenStepTab(task.id);
  const reviewer = tab === "reviewer" ? step.reviewer : null;
  const stage = reviewer === null ? stepStage(step.number) : reviewer.sessionStage;
  const session = reviewer ?? task;
  // The files are the step's, on both tabs.
  const fixed =
    stepFixedCardOf(step) === "files" ? (
      <ChangedFilesCard taskId={task.id} review={step.review} />
    ) : undefined;
  // A tab is a conversation of its own: the scroll of one never carries over
  // to the other.
  return (
    <>
      <Conversation
        key={`conversation:${stage}`}
        taskId={task.id}
        stage={stage}
        session={session}
        fixed={fixed}
        replyWaiting={screenSituationKindOf(task, tab) === "reply"}
      />
      <TaskRequest task={task} tab={tab} />
      {hasComposer(view) && (
        <TaskComposer
          key={`composer:${stage}`}
          task={task}
          tab={tab}
          stage={stage}
          session={session}
        />
      )}
    </>
  );
}

export interface StepPaneProps {
  task: TaskSummary;
}

/**
 * StepPane is what the implementation stage shows below the header: the conversation of the step, or
 * the place without one (what the app does, the step that could not start, the empty state).
 */
export function StepPane({ task }: StepPaneProps) {
  const chosen = useOpenStepTab(task.id);
  const view = stepPlaceOf(task);
  const step = currentStepOf(task);
  if (view.kind === "activity" || view.kind === "blocked" || view.kind === "empty") {
    return (
      <>
        <PlaceColumn view={view} />
        <TaskRequest task={task} tab={chosen} />
      </>
    );
  }
  if (step === null) {
    return null;
  }
  // The tabs of AgentTabs sit over the conversation when the step has them, so the panel names the
  // tab that chose it.
  const shown = agentTabsOf(task, step, chosen, 0) !== null;
  return shown ? (
    <div
      id={AGENT_CONVERSATION}
      role="tabpanel"
      aria-labelledby={tabId(AGENT_CONVERSATION, chosen)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <StepConversation task={task} step={step} view={view} />
    </div>
  ) : (
    <div id={AGENT_CONVERSATION} className="flex min-h-0 flex-1 flex-col">
      <StepConversation task={task} step={step} view={view} />
    </div>
  );
}
