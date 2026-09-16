import { findRepository, shortName } from "@/lib/repositories";
import type { State, TaskSummary } from "@/lib/wails";

/** TaskRow is one task of the list, with what the row reads and how it looks. */
export interface TaskRow {
  task: TaskSummary;
  /** fullName is owner/name; shortName is the name part the row shows. */
  fullName: string;
  shortName: string;
  /** cardNumber is the issue number of the card of the task, null for a task without one. */
  cardNumber: number | null;
  /** selected is the task being the open one. */
  selected: boolean;
  /** flashing is a situation of the task having just started while it is not open. */
  flashing: boolean;
}

/** taskRows is the list of the sidebar, in the order the tasks come. */
export function taskRows(
  tasks: readonly TaskSummary[],
  openTaskId: string | null,
  flashing: ReadonlySet<string>,
): TaskRow[] {
  return tasks.map((task) => ({
    task,
    fullName: task.repository,
    shortName: shortName(task.repository),
    cardNumber: task.card?.number ?? null,
    selected: task.id === openTaskId,
    flashing:
      task.id !== openTaskId &&
      (task.situations ?? []).some((situation) => flashing.has(situation.id)),
  }));
}

/** emptyTasksText is what the list says with nothing in it. */
export function emptyTasksText(app: State, filter: string): string {
  const repository = findRepository(app, filter);
  if (filter !== "" && repository !== null) {
    return `No tasks in ${shortName(repository.fullName)}.`;
  }
  return "No tasks yet.";
}
