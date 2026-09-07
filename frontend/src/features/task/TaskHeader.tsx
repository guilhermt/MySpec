import { FolderGit2, House, PanelRight, Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ContextGauge } from "@/features/task/ContextGauge";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { StatusBadge } from "@/features/task/StatusBadge";
import { hasArtifacts } from "@/features/task/status";
import { currentStepOf, hasStepSession } from "@/features/task/step-status";
import { findNode } from "@/features/tree/tree-model";
import { asSessionStatus, asTaskStage, type TaskSummary } from "@/lib/wails";
import { pause, resume } from "@/store/actions";
import { repoNodeId, useAppStore } from "@/store/app-store";

export interface TaskHeaderProps {
  task: TaskSummary;
  /** artifactsOpen is whether the artifact panel is showing right now. */
  artifactsOpen: boolean;
  onToggleArtifacts: () => void;
}

/** TaskHeader names the task and holds everything the user can do to it. */
export function TaskHeader({ task, artifactsOpen, onToggleArtifacts }: TaskHeaderProps) {
  const [deleting, setDeleting] = useState(false);
  const repoName = useAppStore((state) =>
    state.app === null || task.repoPath === ""
      ? ""
      : (findNode(state.app, repoNodeId(task.repoPath))?.label ?? ""),
  );

  const status = asSessionStatus(task.sessionStatus);
  const paused = status === "paused";
  const Icon = task.repoPath === "" ? House : FolderGit2;
  // The implementation stage holds the session of the step being run, and only
  // once the step got as far as opening one.
  const implementing = asTaskStage(task.stage) === "implementation";
  const running = !implementing || hasStepSession(currentStepOf(task));

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate font-medium">{task.name}</span>
      <Badge variant="secondary">{task.repoPath === "" ? "Root" : repoName}</Badge>
      <StatusBadge task={task} />

      <span className="flex-1" />

      <ContextGauge percent={task.contextPercent} />
      {running && (
        <Button
          variant="ghost"
          size="sm"
          disabled={!paused && status === "error"}
          onClick={() => void (paused ? resume(task.id) : pause(task.id))}
        >
          {paused ? <Play /> : <Pause />}
          {paused ? "Resume" : "Pause"}
        </Button>
      )}
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

      <DeleteTaskDialog task={task} open={deleting} onOpenChange={setDeleting} />
    </header>
  );
}
