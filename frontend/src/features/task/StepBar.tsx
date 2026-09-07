import { Code, LoaderCircle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DiscardStepDialog } from "@/features/task/DiscardStepDialog";
import { ToneDot } from "@/features/task/StatusDot";
import { repoLabel } from "@/features/task/StepList";
import {
  currentStepDisplay,
  currentStepOf,
  hasStepSession,
  stepPhaseLabel,
} from "@/features/task/step-status";
import { asStepStatus, type TaskSummary } from "@/lib/wails";
import { openInEditor } from "@/store/actions";
import { useAppStore } from "@/store/app-store";

export interface StepBarProps {
  task: TaskSummary;
}

/** StepBar names the step being implemented and holds what can be done to it. */
export function StepBar({ task }: StepBarProps) {
  const app = useAppStore((state) => state.app);
  const [discarding, setDiscarding] = useState(false);

  const step = currentStepOf(task);
  if (step === null) {
    return null;
  }

  const label = repoLabel(app, step);
  const display = currentStepDisplay(task);
  const preparing = asStepStatus(step.status) === "preparing";
  // The worktree is only there once it has been created.
  const canOpen = step.worktreePath !== "";

  const openButton = (
    <Button
      variant="outline"
      size="sm"
      disabled={!canOpen}
      onClick={() => void openInEditor(task.id)}
    >
      <Code />
      Open in VS Code
    </Button>
  );

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <span className="text-xs text-muted-foreground tabular-nums">
        {`Step ${step.number} of ${(task.steps ?? []).length}`}
      </span>
      <span className="min-w-0 truncate font-medium">{step.title}</span>
      {label !== "" && <Badge variant="secondary">{label}</Badge>}
      <span
        role="status"
        aria-live="polite"
        className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      >
        {preparing ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
            {stepPhaseLabel(step.phase)}
          </>
        ) : (
          <>
            <ToneDot tone={display.tone} />
            {display.label}
          </>
        )}
      </span>

      <span className="flex-1" />

      {canOpen ? (
        openButton
      ) : (
        <Tooltip>
          <TooltipTrigger render={<span />}>{openButton}</TooltipTrigger>
          <TooltipContent>The worktree doesn't exist yet</TooltipContent>
        </Tooltip>
      )}
      {hasStepSession(step) && (
        <Button variant="ghost" size="sm" onClick={() => setDiscarding(true)}>
          <RotateCcw />
          Discard step
        </Button>
      )}

      <DiscardStepDialog task={task} step={step} open={discarding} onOpenChange={setDiscarding} />
    </div>
  );
}
