import type { TaskStage, TaskSummary } from "@/lib/wails";
import { asTaskStage } from "@/lib/wails";

/**
 * LifecycleStage is every stage of a task, including the ones after the plan
 * that the product does not drive yet.
 */
export type LifecycleStage = TaskStage | "pr" | "pr_review" | "closing";

export const LIFECYCLE: readonly { id: LifecycleStage; label: string }[] = [
  { id: "prd", label: "PRD" },
  { id: "tech_spec", label: "Tech spec" },
  { id: "plan", label: "Plan" },
  { id: "implementation", label: "Implementation" },
  { id: "pr", label: "PR" },
  { id: "pr_review", label: "PR review" },
  { id: "closing", label: "Closing" },
];

/** stageIndex is the position of a stage in the lifecycle. */
export function stageIndex(id: LifecycleStage): number {
  return LIFECYCLE.findIndex((stage) => stage.id === id);
}

/** stageLabel is the name a stage carries in the interface. */
export function stageLabel(id: LifecycleStage): string {
  return LIFECYCLE[stageIndex(id)]?.label ?? "";
}

/** StageState is where a stage sits relative to the one the task is in. */
export type StageState = "done" | "current" | "upcoming";

export function stageState(task: TaskSummary, id: LifecycleStage): StageState {
  const current = stageIndex(asTaskStage(task.stage));
  const index = stageIndex(id);
  if (index < current) {
    return "done";
  }
  return index === current ? "current" : "upcoming";
}
