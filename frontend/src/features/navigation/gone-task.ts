import type { CloseResultLine } from "@/components/system/CloseResult";
import type { GoneLocation } from "@/lib/locations";
import { displayPath, displayPaths } from "@/lib/paths";
import { isOneShot } from "@/lib/task-modes";
import { type ArchivedTask, asPRState, type Leftover } from "@/lib/wails";
import { atMoment } from "@/lib/when";

/**
 * closedTaskText is the text of the page of a task that was closed and archived: what became of its
 * pull request, when MySpec closed the task and where its records are.
 */
export function closedTaskText(archived: ArchivedTask, now: number): string {
  const records = isOneShot(archived)
    ? "its document and reports are in History"
    : "its documents, steps and reports are in History";
  const closed = `closed the task${atMoment(archived.close?.closedAt ?? archived.archivedAt, now)}`;
  const { pr } = archived;
  if (pr === null) {
    return `MySpec ${closed}; ${records}.`;
  }
  if (asPRState(pr.state) !== "merged") {
    return `MySpec couldn't confirm the merge of PR #${pr.number} and ${closed}; ${records}.`;
  }
  const into = pr.base === "" ? "" : ` into ${pr.base}`;
  return `PR #${pr.number} was merged${into}${atMoment(pr.mergedAt, now)}. MySpec ${closed}; ${records}.`;
}

const DELETED_TASK_TEXT = "The documents, the steps and every record of the task are gone.";

/** deletedTaskText is the text of the page of a task that was deleted, with what stayed of its pull request on GitHub. */
export function deletedTaskText(pr: GoneLocation["pr"]): string {
  if (pr === undefined || pr === null) {
    return DELETED_TASK_TEXT;
  }
  switch (pr.state) {
    case "open":
      return `${DELETED_TASK_TEXT} PR #${pr.number} stays open on GitHub.`;
    case "merged":
      return `${DELETED_TASK_TEXT} PR #${pr.number} stays on GitHub, merged.`;
    case "closed":
      return `${DELETED_TASK_TEXT} PR #${pr.number} stays on GitHub, closed.`;
  }
}

/** leftoverLines is what stayed on disk after a deletion, one line per part git was asked to remove. */
export function leftoverLines(leftover: Leftover): CloseResultLine[] {
  const lines: CloseResultLine[] = [];
  const { worktree, branch } = leftover;
  if (worktree !== null) {
    lines.push(
      worktree.kept
        ? {
            outcome: "failed",
            text: "The worktree stayed at",
            mono: displayPath(worktree.path),
            ...detailOf(worktree.error),
          }
        : { outcome: "done", text: "Worktree removed" },
    );
  }
  if (branch !== null) {
    lines.push(
      branch.kept
        ? { outcome: "failed", text: `The branch ${branch.name} stayed`, ...detailOf(branch.error) }
        : { outcome: "done", text: `Branch ${branch.name} deleted` },
    );
  }
  return lines;
}

// detailOf is what git said, with the home as a tilde; nothing when it said nothing.
function detailOf(error: string): Pick<CloseResultLine, "detail"> {
  return error === "" ? {} : { detail: displayPaths(error) };
}

/** leftoverCommands are the commands that remove what stayed, one per line, in the clone. */
export function leftoverCommands(leftover: Leftover): string {
  const commands: string[] = [];
  if (leftover.worktree?.kept === true) {
    commands.push(`git worktree remove --force ${displayPath(leftover.worktree.path)}`);
  }
  if (leftover.branch?.kept === true) {
    commands.push(`git branch -D ${leftover.branch.name}`);
  }
  return commands.join("\n");
}

/** leftoverHeading names where the commands run: the clone of the repository. */
export function leftoverHeading(leftover: Leftover): string {
  return leftover.repoPath === ""
    ? "To remove it yourself"
    : `To remove it yourself, in ${displayPath(leftover.repoPath)}`;
}

/** forceWarning says whether the commands carry --force over a worktree that may hold work: the worktree stayed. */
export function forceWarning(leftover: Leftover): boolean {
  return leftover.worktree?.kept === true;
}
