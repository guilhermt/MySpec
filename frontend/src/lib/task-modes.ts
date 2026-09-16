import { asTaskMode, type TaskMode } from "@/lib/wails";

/** TASK_MODES are the modes of a task, in the order the creation dialog offers them. */
export const TASK_MODES: readonly TaskMode[] = ["structured", "one_shot"];

/** taskModeLabel is the name of a mode, the same wherever the app shows it. */
export function taskModeLabel(mode: TaskMode): string {
  return mode === "one_shot" ? "One-Shot" : "Structured";
}

/** taskModeHint is what a mode does to a task, as the creation dialog explains it. */
export function taskModeHint(mode: TaskMode): string {
  return mode === "one_shot"
    ? "One planning conversation writes a single document, implemented in one commit."
    : "A PRD, a tech spec and a plan of steps, each step its own commit.";
}

/** isOneShot reports whether a task, active or in the history, is One-Shot. */
export function isOneShot(task: { mode: string }): boolean {
  return asTaskMode(task.mode) === "one_shot";
}
