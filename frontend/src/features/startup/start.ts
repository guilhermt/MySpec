import type { StartStepView } from "@/components/system/StartSteps";
import { displayPath, displayPaths } from "@/lib/paths";
import {
  asStartupCase,
  asStartupStepId,
  asStartupStepState,
  type Startup,
  type StartupFailure,
} from "@/lib/wails";
import { duration } from "@/lib/when";

/** MAIN_DELAY_MS is how long the main area waits without ready, so a normal start never flashes it. */
export const MAIN_DELAY_MS = 400;

/** SLOW_MS is how long a step runs before it shows its time. */
export const SLOW_MS = 3000;

function stepLabel(id: ReturnType<typeof asStartupStepId>, count: number): string {
  if (id === "data") {
    return "Opening your data";
  }
  return count === 1
    ? "Checking the clone of 1 repository"
    : `Checking the clones of ${count} repositories`;
}

/** stepViews are the steps of the start as the list shows them, the slow one with its time at now. */
export function stepViews(startup: Startup, now: number): StartStepView[] {
  return (startup.steps ?? []).map((step) => {
    const id = asStartupStepId(step.id);
    const state = asStartupStepState(step.state);
    const slow = state === "running" && now - Date.parse(step.startedAt) >= SLOW_MS;
    return {
      id,
      label: stepLabel(id, step.count),
      state,
      elapsed: slow ? duration(now - Date.parse(step.startedAt)) : "",
      reason:
        slow && id === "clones" && step.detail !== ""
          ? ` · ${displayPath(step.detail)} doesn't answer`
          : "",
    };
  });
}

/** failureText is what the start says of why it failed, by case, with the folders resolved. */
export function failureText(failure: StartupFailure): string {
  const data = displayPath(failure.dataDir);
  switch (asStartupCase(failure.case)) {
    case "permission":
      return `MySpec can't open its data. Nothing was changed: your tasks, documents and worktrees are as they were. Give your user back the folder ${data}, then try again.`;
    case "disk_full":
      return `MySpec can't open its data: the disk of ${data} is full. Free some space, then try again.`;
    case "other":
      return `MySpec couldn't finish starting. If trying again fails the same way, the log at ${displayPath(failure.logPath)} says what happened before it.`;
  }
}

/** failureError is the error as the log has it, with the home folder as a tilde. */
export function failureError(failure: StartupFailure): string {
  return displayPaths(failure.error);
}
