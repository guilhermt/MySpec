import { useState } from "react";
import { CardLink } from "@/components/CardLink";
import { PauseButton } from "@/components/PauseButton";
import { PanelGroup } from "@/components/system/AuxPanel";
import { IconButton } from "@/components/system/IconButton";
import { ICONS } from "@/components/system/icons";
import { LocationHeader } from "@/features/navigation/LocationHeader";
import { ContextGauge } from "@/features/task/ContextGauge";
import { DeleteTaskDialog } from "@/features/task/DeleteTaskDialog";
import { StatusBadge } from "@/features/task/StatusBadge";
import { currentStepOf, hasStepSession, loopSession } from "@/features/task/step-status";
import { TaskMenu } from "@/features/task/TaskMenu";
import { TaskModelsButton } from "@/features/task/TaskModels";
import { TaskReviewModeButton } from "@/features/task/TaskReviewMode";
import { asSessionStatus, asTaskStage, type TaskSummary } from "@/lib/wails";
import { pause, resume } from "@/store/actions";
import { useAppStore, usePanel } from "@/store/app-store";

export interface TaskHeaderProps {
  task: TaskSummary;
}

/**
 * TaskHeader is the header of the place of a task, with everything the user can do to it on the
 * right.
 */
export function TaskHeader({ task }: TaskHeaderProps) {
  const [deleting, setDeleting] = useState(false);
  const panel = usePanel();
  const openPanel = useAppStore((state) => state.openPanel);

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
      <PanelGroup
        panels={[
          {
            id: "artifacts",
            label: "Artifacts",
            tooltip: "PRD, tech spec, steps and reports",
            icon: ICONS.file,
          },
        ]}
        open={panel}
        onOpenChange={openPanel}
      />
      <IconButton
        label="Delete task"
        icon={ICONS.trash}
        size="sm"
        onClick={() => setDeleting(true)}
      />
      <TaskMenu task={task} />

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
