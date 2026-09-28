import { LoaderCircle } from "lucide-react";
import { Composer } from "@/features/chat/Composer";
import { Conversation } from "@/features/chat/Conversation";
import { AGENT_CONVERSATION } from "@/features/task/AgentTabs";
import { ImplementationDone } from "@/features/task/ImplementationDone";
import { StepBlocked } from "@/features/task/StepBlocked";
import { currentStepOf, stepPhaseLabel, stepStage } from "@/features/task/step-status";
import { TaskRequest } from "@/features/task/TaskRequest";
import { asStepStatus, type Step, type TaskSummary } from "@/lib/wails";
import { useOpenStepTab } from "@/store/app-store";

/** Waiting is what the step shows while there is nothing to read yet. */
function Waiting({ text }: { text: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        {text}
      </p>
    </div>
  );
}

/** StepConversation is the conversation of the tab on screen, and the field to answer it. */
function StepConversation({ task, step }: { task: TaskSummary; step: Step }) {
  const tab = useOpenStepTab(task.id);
  const reviewer = tab === "reviewer" ? step.reviewer : null;
  const stage = reviewer === null ? stepStage(step.number) : reviewer.sessionStage;
  const session = reviewer ?? task;
  // A tab is a conversation of its own: the scroll of one never carries over
  // to the other.
  return (
    <>
      <Conversation
        key={`conversation:${stage}`}
        taskId={task.id}
        stage={stage}
        session={session}
      />
      <TaskRequest task={task} tab={tab} />
      <Composer key={`composer:${stage}`} taskId={task.id} stage={stage} session={session} />
    </>
  );
}

export interface StepPaneProps {
  task: TaskSummary;
}

/** StepPane is what the implementation stage shows below the bar of the step. */
export function StepPane({ task }: StepPaneProps) {
  const step = currentStepOf(task);
  if (step === null) {
    // No step to run with a plan behind it means every step is committed.
    if ((task.steps ?? []).length > 0) {
      return <ImplementationDone task={task} />;
    }
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-[58.5rem] flex-col gap-4">
          <p className="text-sm text-muted-foreground italic">No steps were found.</p>
        </div>
      </div>
    );
  }

  switch (asStepStatus(step.status)) {
    case "blocked":
      return <StepBlocked task={task} step={step} />;
    case "implementing":
    case "agent_review":
    case "addressing_review":
    case "awaiting_review":
    case "in_review":
    case "ready_to_approve":
    case "nothing_to_commit":
    case "review_failed":
    case "committing":
      return (
        <div id={AGENT_CONVERSATION} className="flex min-h-0 flex-1 flex-col">
          <StepConversation task={task} step={step} />
        </div>
      );
    case "preparing":
      return <Waiting text={stepPhaseLabel(step.phase)} />;
    case "not_started":
      return <Waiting text="Starting…" />;
    // The step is committed and the app is already moving on to the next one.
    case "done":
      return <Waiting text="Starting the next step…" />;
  }
}
