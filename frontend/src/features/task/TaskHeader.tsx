import { FolderGit2, PanelRight, Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextGauge } from "@/features/task/ContextGauge";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { StatusBadge } from "@/features/task/StatusBadge";
import { hasArtifacts } from "@/features/task/status";
import { currentStepOf, hasStepSession, loopSession } from "@/features/task/step-status";
import { TaskCardBadge } from "@/features/task/TaskCardBadge";
import { TaskModelsButton } from "@/features/task/TaskModels";
import { TaskReviewModeButton } from "@/features/task/TaskReviewMode";
import { isOneShot } from "@/lib/task-modes";
import { asSessionStatus, asTaskStage, type TaskSummary } from "@/lib/wails";
import { pause, resume } from "@/store/actions";

export interface TaskHeaderProps {
  task: TaskSummary;
  /** artifactsOpen is whether the artifact panel is showing right now. */
  artifactsOpen: boolean;
  onToggleArtifacts: () => void;
}

/** TaskHeader names the task and holds everything the user can do to it. */
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
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <FolderGit2 aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate font-medium">{task.name}</span>
      {isOneShot(task) && <Badge variant="outline">One-Shot</Badge>}
      <Badge variant="secondary">{task.repository}</Badge>
      {task.card !== null && <TaskCardBadge card={task.card} />}
      <StatusBadge task={task} />

      <span className="flex-1" />

      <ContextGauge percent={loop?.contextPercent ?? task.contextPercent} />
      {running && (
        <Button
          variant="ghost"
          size="sm"
          disabled={!paused && status === "error"}
          onClick={() => void (paused ? resume(task.id, stage) : pause(task.id, stage))}
        >
          {paused ? <Play /> : <Pause />}
          {paused ? "Resume" : "Pause"}
        </Button>
      )}
      <TaskReviewModeButton task={task} />
      <TaskModelsButton task={task} />
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
    </header>
  );
}
