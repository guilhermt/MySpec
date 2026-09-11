import { repoStatusTone } from "@/features/task/repo-status";
import { currentStepDisplay } from "@/features/task/step-status";
import { closedCount, everyRepoHasPR, everyRepoReviewed, reposOf } from "@/lib/repos";
import { stageLabel } from "@/lib/stages";
import type { RepoPR, RepoStatus, TaskSummary } from "@/lib/wails";
import { asRepoStatus, asSessionStatus, asTaskStage } from "@/lib/wails";

/** StatusTone is how urgent the status of a task looks. */
export type StatusTone = "working" | "attention" | "paused" | "error" | "done" | "idle";

// The states of a repository, from the one that most needs the user down to
// the one that needs nothing. The task shows the first of these it can find.
const REPO_PRIORITY: readonly RepoStatus[] = [
  "blocked",
  "draft_ready",
  "awaiting_decision",
  "ready_to_approve",
  "in_review",
  "merged",
  "committing",
  "drafting",
  "reviewing",
  "opening",
  "closing",
  "preparing",
  "done",
  "pr_closed",
  "skipped",
  "closed",
];

function repoRank(repo: RepoPR): number {
  const rank = REPO_PRIORITY.indexOf(asRepoStatus(repo.status));
  return rank === -1 ? REPO_PRIORITY.length : rank;
}

/** urgentRepo is the repository that speaks for the task, null when it has none. */
function urgentRepo(repos: readonly RepoPR[]): RepoPR | null {
  return repos.reduce<RepoPR | null>(
    (chosen, repo) => (chosen === null || repoRank(repo) < repoRank(chosen) ? repo : chosen),
    null,
  );
}

// What the chosen repository is doing, in the few words the tree has room for.
function repoPhrase(repo: RepoPR): string {
  switch (asRepoStatus(repo.status)) {
    case "preparing":
      return "checking GitHub";
    case "blocked":
      return "blocked";
    case "drafting":
      return "writing the draft";
    case "draft_ready":
      return "draft to approve";
    case "awaiting_reply":
      return "waiting for your reply";
    case "opening":
      return "opening the pull request";
    case "reviewing":
      return "reviewing";
    case "awaiting_decision":
      return "decision needed";
    case "in_review":
      return `${repo.review?.percent ?? 0}% staged`;
    case "ready_to_approve":
      return "ready to approve";
    case "committing":
      return "committing";
    case "done":
      return repo.canClose ? "merge unconfirmed" : "waiting for the merge";
    case "merged":
      return "merged, ready to close";
    case "pr_closed":
      return "PR closed without merge";
    case "closing":
      return "closing";
    case "closed":
      return "closed";
    case "skipped":
      return "ready to close";
  }
}

/**
 * prStatusLabel reads the PR stage as one line: which third of it the task is
 * in, what the most urgent repository is doing, and how many repositories are
 * with it when the task has more than one.
 */
function prStatusLabel(task: TaskSummary): string {
  const repos = reposOf(task);
  const closing = everyRepoReviewed(repos);
  const stage = closing ? "Closing" : everyRepoHasPR(repos) ? "PR review" : "PR";
  const repo = urgentRepo(repos);
  if (repo === null) {
    return stage;
  }
  const phrase = repoPhrase(repo);
  // Once the reviews are over, what is left to count is how much of the task
  // has already left the workspace.
  if (closing) {
    return repos.length > 1
      ? `${stage} · ${phrase} (${closedCount(repos)} of ${repos.length} closed)`
      : `${stage} · ${phrase}`;
  }
  const status = asRepoStatus(repo.status);
  const sharing = repos.filter((other) => asRepoStatus(other.status) === status).length;
  return repos.length > 1
    ? `${stage} · ${phrase} (${sharing} of ${repos.length})`
    : `${stage} · ${phrase}`;
}

/** taskStatusLabel is the one word the tree, the list and the header show. */
export function taskStatusLabel(task: TaskSummary): string {
  // The implementation stage has no conversation of its own: the current step
  // carries the state, and its number places the task in the plan.
  if (asTaskStage(task.stage) === "implementation") {
    const { label } = currentStepDisplay(task);
    if (task.currentStep === 0) {
      return label;
    }
    return `Step ${task.currentStep} of ${(task.steps ?? []).length} · ${label}`;
  }
  // The PR stage has no conversation of its own either: each repository runs
  // its own, and the most urgent of them speaks for the task.
  if (asTaskStage(task.stage) === "pr") {
    return prStatusLabel(task);
  }
  switch (asSessionStatus(task.sessionStatus)) {
    case "paused":
      return "Paused";
    case "error":
      return "Error";
    case "needs_permission":
      return "Permission";
    case "needs_answer":
      return "Question";
    case "working":
      return "Working";
    case "waiting":
      return "Waiting";
  }
}

/** taskStatusTone maps a status to the colour that carries it. */
export function taskStatusTone(task: TaskSummary): StatusTone {
  if (asTaskStage(task.stage) === "implementation") {
    return currentStepDisplay(task).tone;
  }
  if (asTaskStage(task.stage) === "pr") {
    const repo = urgentRepo(reposOf(task));
    return repo === null ? "idle" : repoStatusTone(repo);
  }
  switch (asSessionStatus(task.sessionStatus)) {
    case "paused":
      return "paused";
    case "error":
      return "error";
    case "needs_permission":
    case "needs_answer":
      return "attention";
    case "working":
      return "working";
    // A waiting session is waiting for the user.
    case "waiting":
      return "attention";
  }
}

/** isAttention reports whether a task needs the user before it can go on. */
export function isAttention(task: TaskSummary): boolean {
  const tone = taskStatusTone(task);
  return tone === "attention" || tone === "error";
}

/** taskStageLabel names the stage a task is in, and says when it is reopened. */
export function taskStageLabel(task: TaskSummary): string {
  const label = stageLabel(asTaskStage(task.stage));
  return task.revisiting ? `${label} · revisiting` : label;
}

/** hasArtifacts reports whether the task has written anything to read yet. */
export function hasArtifacts(task: TaskSummary): boolean {
  return task.hasPrd || task.hasTechSpec || (task.steps ?? []).length > 0;
}
