import type { PreviewReading } from "@/features/task/deletion";
import { shortRef } from "@/lib/repositories";
import { counted } from "@/lib/situations";
import { stageLabel } from "@/lib/stages";
import {
  asStepStatus,
  asTaskMode,
  asTaskStage,
  type TaskMode,
  type TaskStage,
  type TaskSummary,
} from "@/lib/wails";

/** StageAction is what the stage track can do to a stage. */
export type StageAction = "back" | "discard";

// How a stage reads in the middle of a sentence, where the label of the track
// would carry a capital it should not.
const NOUNS: Record<TaskStage, string> = {
  prd: "PRD",
  tech_spec: "tech spec",
  plan: "plan",
  one_shot: "planning",
  implementation: "implementation",
  pr: "PR",
};

/** stageNoun names a stage inside a sentence. */
export function stageNoun(stage: TaskStage): string {
  return NOUNS[stage];
}

/** nextStage is the stage the task moves on to once this one is done. */
export function nextStage(stage: TaskStage): TaskStage {
  switch (stage) {
    case "prd":
      return "tech_spec";
    case "tech_spec":
      return "plan";
    default:
      return "implementation";
  }
}

// The stages a task passes through before its pull request, in order, for each mode.
const TRACKS: Record<TaskMode, readonly TaskStage[]> = {
  structured: ["prd", "tech_spec", "plan", "implementation", "pr"],
  one_shot: ["one_shot", "implementation", "pr"],
};

/** joinList reads a list out loud: "a", "a and b", "a, b and c". */
export function joinList(items: readonly string[]): string {
  if (items.length < 2) {
    return items[0] ?? "";
  }
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

// reportsOf is how many review reports the steps wrote.
function reportsOf(task: TaskSummary): number {
  return startedSteps(task).reduce((sum, step) => sum + (step.reports ?? []).length, 0);
}

// startedSteps are the steps that began, up to the one the task is on.
function startedSteps(task: TaskSummary) {
  return (task.steps ?? []).filter(
    (step) => asStepStatus(step.status) !== "not_started" && step.number <= task.currentStep,
  );
}

function withReports(lead: string, reports: number, pronoun: "its" | "their"): string {
  return reports === 0 ? lead : `${lead} and ${pronoun} ${counted(reports, "review report")}`;
}

function implementationItem(task: TaskSummary, mode: TaskMode): string | null {
  const reports = reportsOf(task);
  if (mode === "one_shot") {
    return withReports("the implementation conversations", reports, "their");
  }
  const started = startedSteps(task);
  const first = started[0];
  const last = started[started.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  if (started.length === 1) {
    return withReports(`the conversation of step ${first.number}`, reports, "its");
  }
  return withReports(
    `the conversations of steps ${first.number} to ${last.number}`,
    reports,
    "their",
  );
}

function pullRequestItem(task: TaskSummary): string | null {
  const pr = task.pr;
  if (pr === null) {
    return null;
  }
  const parts: string[] = [];
  if (pr.draft !== null) {
    parts.push("the pull request draft");
  }
  if (pr.sessionStage !== "" || (task.conversations ?? []).some((each) => each.stage === "pr")) {
    parts.push("the PR conversation");
  }
  if ((pr.reports ?? []).length > 0) {
    parts.push("the reports of its review");
  }
  return parts.length === 0 ? null : joinList(parts);
}

function worktreeItem(task: TaskSummary, reading: PreviewReading | null): string | null {
  if (task.worktreePath === "") {
    return null;
  }
  let uncommitted = ", with any uncommitted work in them";
  if (reading?.kind === "ready") {
    const worktree = reading.preview.worktree;
    uncommitted =
      worktree?.dirty && worktree.files > 0
        ? `, with ${counted(worktree.files, "uncommitted file")}`
        : "";
  }
  return `the worktree and the branch ${task.branch}${uncommitted}`;
}

function stageItem(task: TaskSummary, mode: TaskMode, stage: TaskStage): string | null {
  switch (stage) {
    case "prd":
      return "the PRD conversation and document";
    case "tech_spec":
      return "the tech spec conversation and document";
    case "plan": {
      const files = (task.steps ?? []).length;
      if (files === 0) {
        return "the plan conversation";
      }
      return `the plan conversation and the ${files === 1 ? "step file" : `${files} step files`}`;
    }
    case "one_shot":
      return "the planning conversation and the One-Shot document";
    case "implementation":
      return implementationItem(task, mode);
    case "pr":
      return pullRequestItem(task);
  }
}

/**
 * lostItems lists what going back to, or discarding, a stage takes with it: from the stage after
 * the target (going back) or the target itself (discarding) to the stage the task is in, and the
 * worktree and the branch last.
 */
export function lostItems(
  task: TaskSummary,
  action: StageAction,
  target: TaskStage,
  reading: PreviewReading | null,
): string[] {
  const mode = asTaskMode(task.mode);
  const track = TRACKS[mode];
  const from = track.indexOf(action === "back" ? nextStage(target) : target);
  const to = track.indexOf(asTaskStage(task.stage));
  const items = track
    .slice(from, to + 1)
    .map((stage) => stageItem(task, mode, stage))
    .filter((item): item is string => item !== null);
  const worktree = worktreeItem(task, reading);
  return worktree === null ? items : [...items, worktree];
}

/** stageActionTitle is the question that confirms an action on a stage. */
export function stageActionTitle(action: StageAction, mode: TaskMode, stage: TaskStage): string {
  if (mode === "one_shot") {
    return action === "back" ? "Back to planning?" : "Discard the planning and start over?";
  }
  return action === "back"
    ? `Back to the ${stageLabel(stage)}?`
    : `Discard the ${stageLabel(stage)} and start over?`;
}

/** stageActionConfirm is the button that confirms an action on a stage. */
export function stageActionConfirm(action: StageAction, mode: TaskMode, stage: TaskStage): string {
  if (mode === "one_shot") {
    return action === "back" ? "Back to planning" : "Discard the planning";
  }
  return action === "back"
    ? `Back to the ${stageLabel(stage)}`
    : `Discard the ${stageLabel(stage)}`;
}

/** stageActionLoading is what the confirmation says while the call runs. */
export function stageActionLoading(action: StageAction): string {
  return action === "back" ? "Going back…" : "Discarding…";
}

// sourceOf is what a new session of a stage starts from.
function sourceOf(task: TaskSummary, stage: TaskStage): string {
  switch (stage) {
    case "tech_spec":
      return "the PRD";
    case "plan":
      return "the tech spec";
    default:
      return task.card === null
        ? "your description"
        : `the card ${shortRef(`${task.card.repository}#${task.card.number}`)}`;
  }
}

/** whatStays says what the action keeps and what happens next. */
export function whatStays(task: TaskSummary, action: StageAction, target: TaskStage): string {
  const mode = asTaskMode(task.mode);
  if (action === "discard") {
    return `A new ${stageNoun(target)} session starts right away, from ${sourceOf(task, target)}.`;
  }
  if (mode === "one_shot") {
    return "The One-Shot document and its conversation stay, and the implementation starts again from scratch when you continue.";
  }
  return `The ${stageLabel(target)} stays, and the ${stageNoun(nextStage(target))} starts again from scratch when you continue.`;
}

/** openPR is the pull request of the task that stays open on GitHub, null when there is none. */
export function openPR(task: TaskSummary): { number: number; url: string } | null {
  const pr = task.pr;
  if (pr === null || pr.prNumber === 0 || pr.prState !== "open") {
    return null;
  }
  return { number: pr.prNumber, url: pr.prUrl };
}
