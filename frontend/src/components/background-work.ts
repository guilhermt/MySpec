import { formatDuration } from "@/features/chat/actions";
import { earlierPlace } from "@/features/task/details";
import {
  asRunningKind,
  type DiscussionSummary,
  type ReviewSummary,
  type RunningKind,
  type RunningTask,
  type SessionTasks,
  type TaskSummary,
} from "@/lib/wails";

// KIND_ORDER is the order the kinds are told in.
const KIND_ORDER: readonly RunningKind[] = ["agent", "command", "monitor"];

/**
 * backgroundOf is what runs in the background in one conversation of an item: the tasks of its
 * stage that the turn does not wait for.
 */
export function backgroundOf(
  running: readonly SessionTasks[] | null | undefined,
  stage: string,
): RunningTask[] {
  return (running ?? [])
    .filter((session) => session.stage === stage)
    .flatMap((session) => session.tasks ?? [])
    .filter((task) => task.background);
}

/** countOf is how many tasks run in the background in one conversation of an item. */
export function countOf(
  running: readonly SessionTasks[] | null | undefined,
  stage: string,
): number {
  return backgroundOf(running, stage).length;
}

/** summaryOfRunning is the tasks by kind, in the singular or the plural: "2 agents · 1 command". */
export function summaryOfRunning(tasks: readonly RunningTask[]): string {
  return KIND_ORDER.flatMap((kind) => {
    const count = tasks.filter((task) => asRunningKind(task.kind) === kind).length;
    return count === 0 ? [] : [`${count} ${kind}${count === 1 ? "" : "s"}`];
  }).join(" · ");
}

/** Gesture is what the user does to an item that ends conversations of it. */
export type Gesture =
  | { kind: "pause"; stage: string }
  | { kind: "closeTask" }
  | { kind: "back"; target: string }
  | { kind: "restart" }
  | { kind: "discardStep"; number: number }
  | { kind: "archive" }
  | { kind: "delete" };

// PR_STAGES are the conversations that Close task ends: the ones of the pull request.
const PR_STAGES: readonly string[] = ["pr", "pr_review", "pr_fix"];

// endsStage says whether a gesture ends the session of a stage.
function endsStage(gesture: Gesture, stage: string): boolean {
  switch (gesture.kind) {
    case "pause":
      return stage === gesture.stage;
    case "closeTask":
      return PR_STAGES.includes(stage);
    case "back":
      return stage !== gesture.target;
    case "discardStep":
      return stage === `step:${gesture.number}` || stage === `step_review:${gesture.number}`;
    case "restart":
    case "archive":
    case "delete":
      return true;
  }
}

/**
 * endedBy is the conversations of an item that run something and that a gesture ends, with what
 * runs in each; empty when the gesture ends nothing that runs.
 */
export function endedBy(
  gesture: Gesture,
  item: { running?: readonly SessionTasks[] | null | undefined },
): SessionTasks[] {
  return (item.running ?? []).filter(
    (session) => (session.tasks ?? []).length > 0 && endsStage(gesture, session.stage),
  );
}

/** hasSubagent says whether any of the conversations runs a subagent, in the background or not. */
export function hasSubagent(sessions: readonly SessionTasks[]): boolean {
  return sessions.some((session) =>
    (session.tasks ?? []).some((task) => asRunningKind(task.kind) === "agent"),
  );
}

/** ConversationOwner is an item that has conversations: a task, a review or a discussion. */
export type ConversationOwner = TaskSummary | ReviewSummary | DiscussionSummary;

/**
 * conversationName is who speaks in a conversation of an item, as the dialogs name it: Implementer,
 * Reviewer, PRD, PR review · Reviewer… A task names it as its earlier conversations are named.
 */
export function conversationName(item: ConversationOwner | null, stage: string): string {
  if (item !== null && "steps" in item) {
    return stage === "pr_review" ? "PR review · Reviewer" : earlierPlace(item, stage);
  }
  switch (stage) {
    case "review":
      return "Reviewer";
    case "discussion":
      return "Discussion agent";
    default:
      return stage;
  }
}

/** runningLine is a task as the dialogs list it: "agent · Survey the repository · 3m". */
export function runningLine(task: RunningTask, now: number): string {
  const started = Date.parse(task.startedAt);
  const kind = asRunningKind(task.kind) ?? "command";
  return Number.isNaN(started)
    ? `${kind} · ${task.name}`
    : `${kind} · ${task.name} · ${formatDuration(Math.max(now - started, 0))}`;
}
