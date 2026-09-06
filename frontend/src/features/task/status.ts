import type { TaskSummary } from "@/lib/wails";
import { asSessionStatus, asTaskStage } from "@/lib/wails";

/** StatusTone is how urgent the status of a task looks. */
export type StatusTone = "working" | "attention" | "paused" | "error" | "done" | "idle";

/** taskStatusLabel is the one word the tree, the list and the header show. */
export function taskStatusLabel(task: TaskSummary): string {
  switch (asSessionStatus(task.sessionStatus)) {
    case "paused":
      return "Paused";
    case "error":
      return "Error";
    case "needs_permission":
      return "Permission";
    case "working":
      return "Working";
    case "waiting":
      return asTaskStage(task.stage) === "prd_done" ? "PRD done" : "Waiting";
  }
}

/** taskStatusTone maps a status to the colour that carries it. */
export function taskStatusTone(task: TaskSummary): StatusTone {
  switch (asSessionStatus(task.sessionStatus)) {
    case "paused":
      return "paused";
    case "error":
      return "error";
    case "needs_permission":
      return "attention";
    case "working":
      return "working";
    // A waiting session is waiting for the user, unless the stage is finished.
    case "waiting":
      return asTaskStage(task.stage) === "prd_done" ? "done" : "attention";
  }
}

/** isAttention reports whether a task needs the user before it can go on. */
export function isAttention(task: TaskSummary): boolean {
  const tone = taskStatusTone(task);
  return tone === "attention" || tone === "error";
}
