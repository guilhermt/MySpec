import { asRunningKind, type RunningKind, type RunningTask, type SessionTasks } from "@/lib/wails";

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
