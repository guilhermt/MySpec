import { isOpen, isReviewed, prOf } from "@/lib/pull-requests";
import type { TaskMode, TaskStage, TaskSummary } from "@/lib/wails";
import { asTaskMode, asTaskStage } from "@/lib/wails";

/** LifecycleStage is every stage of the track of a task, including the thirds of the PR stage. */
export type LifecycleStage = TaskStage | "pr_review" | "closing";

const LABELS: Record<LifecycleStage, string> = {
  prd: "PRD",
  tech_spec: "Tech spec",
  plan: "Plan",
  one_shot: "Planning",
  implementation: "Implementation",
  pr: "PR",
  pr_review: "PR review",
  closing: "Closing",
};

const LIFECYCLES: Record<TaskMode, readonly LifecycleStage[]> = {
  structured: ["prd", "tech_spec", "plan", "implementation", "pr", "pr_review", "closing"],
  one_shot: ["one_shot", "implementation", "pr", "pr_review", "closing"],
};

/** lifecycleOf is the track of a task of a mode, in order. */
export function lifecycleOf(mode: TaskMode): readonly LifecycleStage[] {
  return LIFECYCLES[mode];
}

/** stageIndex is the position of a stage in the track of a mode, -1 outside of it. */
export function stageIndex(mode: TaskMode, id: LifecycleStage): number {
  return LIFECYCLES[mode].indexOf(id);
}

/** stageLabel is the name a stage carries in the interface. */
export function stageLabel(id: LifecycleStage): string {
  return LABELS[id];
}

/** StageState is where a stage sits relative to the one the task is in. */
export type StageState = "done" | "current" | "upcoming";

export function stageState(task: TaskSummary, id: LifecycleStage): StageState {
  const stage = asTaskStage(task.stage);
  // The PR stage covers three chips: the pull request is written first,
  // reviewed once it is open, and closed once its review is over.
  if (stage === "pr" && (id === "pr" || id === "pr_review" || id === "closing")) {
    const pr = prOf(task);
    const reviewed = pr !== null && isReviewed(pr);
    const reviewing = pr !== null && isOpen(pr);
    if (id === "closing") {
      return reviewed ? "current" : "upcoming";
    }
    if (id === "pr_review") {
      return reviewed ? "done" : reviewing ? "current" : "upcoming";
    }
    return reviewing || reviewed ? "done" : "current";
  }
  const mode = asTaskMode(task.mode);
  const current = stageIndex(mode, stage);
  const index = stageIndex(mode, id);
  if (index < current) {
    return "done";
  }
  return index === current ? "current" : "upcoming";
}
