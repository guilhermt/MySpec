import { PanelRight, Trash2 } from "lucide-react";
import { useState } from "react";
import { CardLink } from "@/components/CardLink";
import { PauseButton } from "@/components/PauseButton";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { ContextGauge } from "@/features/task/ContextGauge";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { StatusBadge } from "@/features/task/StatusBadge";
import { hasArtifacts } from "@/features/task/status";
import { currentStepOf, hasStepSession, loopSession } from "@/features/task/step-status";
import { TaskModelsButton } from "@/features/task/TaskModels";
import { TaskReviewModeButton } from "@/features/task/TaskReviewMode";
import { asSessionStatus, asTaskStage, type TaskSummary } from "@/lib/wails";
import { pause, resume } from "@/store/actions";

export interface TaskHeaderProps {
  task: TaskSummary;
  /** artifactsOpen is whether the artifact panel is showing right now. */
  artifactsOpen: boolean;
  onToggleArtifacts: () => void;
}

/**
 * TaskHeader is the header of the place of a task, with everything the user can do to it on the
 * right.
 */
export function TaskHeader({ task, artifactsOpen, onToggleArtifacts }: TaskHeaderProps) {
  const [deleting, setDeleting] = useState(false);

  // The implementation stage holds the session of the step being run, and only
  // once the step got as far as opening one. The PR stage holds none of its
  // own: its session is paused from the bar of the pull request.
  const implementing = asTaskStage(task.stage) === "implementation";
  const step = currentStepOf(task);
  const running = asTaskStage(task.stage) !== "pr" && (!implementing || hasStepSession(step));
  // In the implementation stage the header acts on the conversation the step
  // waits on: its reviewer during a pass, its implementer otherwise. Pausing it
  // is what stops the agent review.
  const loop = implementing && step !== null ? loopSession(task, step) : null;
  const stage = loop?.stage ?? task.stage;
  const status = asSessionStatus(loop?.sessionStatus ?? task.sessionStatus);
  const paused = status === "paused";

  return (
    <LocationHeader>
      <StatusBadge task={task} />
      <ContextGauge percent={loop?.contextPercent ?? task.contextPercent} />
      {running && (
        <PauseButton
          paused={paused}
          disabled={!paused && status === "error"}
          onClick={() => void (paused ? resume(task.id, stage) : pause(task.id, stage))}
        />
      )}
      <TaskReviewModeButton task={task} />
      <TaskModelsButton task={task} />
      {task.card !== null && <CardLink card={task.card} />}
      <Tooltip>
        <TooltipTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label="Artifacts"
          aria-pressed={artifactsOpen}
          onClick={onToggleArtifacts}
        >
          <PanelRight />
        </TooltipTrigger>
        <TooltipContent>{hasArtifacts(task) ? "Artifacts" : "No artifacts yet"}</TooltipContent>
      </Tooltip>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete task"
        onClick={() => setDeleting(true)}
      >
        <Trash2 />
      </Button>

      <DeleteTaskDialog
        taskId={task.id}
        name={task.name}
        archived={false}
        open={deleting}
        onOpenChange={setDeleting}
      />
    </LocationHeader>
  );
}
