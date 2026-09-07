import { LoaderCircle } from "lucide-react";
import { Composer } from "@/features/chat/Composer";
import { Conversation } from "@/features/chat/Conversation";
import { StepBlocked } from "@/features/task/StepBlocked";
import { currentStepOf, stepPhaseLabel } from "@/features/task/step-status";
import { asStepStatus, type TaskSummary } from "@/lib/wails";

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

export interface StepPaneProps {
  task: TaskSummary;
}

/** StepPane is what the implementation stage shows below the bar of the step. */
export function StepPane({ task }: StepPaneProps) {
  const step = currentStepOf(task);
  if (step === null) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-[760px] flex-col gap-4">
          <p className="text-sm text-muted-foreground italic">No steps were found.</p>
        </div>
      </div>
    );
  }

  switch (asStepStatus(step.status)) {
    case "blocked":
      return <StepBlocked task={task} step={step} />;
    case "implementing":
    case "awaiting_review":
      return (
        <>
          <Conversation taskId={task.id} />
          <Composer task={task} />
        </>
      );
    case "preparing":
      return <Waiting text={stepPhaseLabel(step.phase)} />;
    case "not_started":
      return <Waiting text="Starting…" />;
  }
}
