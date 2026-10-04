import type { DeletionLine, DeletionPreviewProps } from "@/components/system/DeletionPreview";
import { ICONS } from "@/components/system/icons";
import { taskSessions } from "@/features/sidebar/sessions";
import { displayPath, displayPaths } from "@/lib/paths";
import { counted, lowerFirst } from "@/lib/situations";
import type { DeletePreview, TaskSummary } from "@/lib/wails";

/** PreviewReading is the reading of what a deletion destroys: under way, done or failed. */
export type PreviewReading =
  | { kind: "reading" }
  | { kind: "ready"; preview: DeletePreview }
  | { kind: "failed"; error: string };

/** interruptedSessions are the conversations of the task with a turn running, by the role that speaks in them. */
export function interruptedSessions(task: TaskSummary): string[] {
  return taskSessions(task)
    .filter((session) => session.working)
    .map((session) => lowerFirst(session.role));
}

/** interruptedSentence says that the answer a role is writing is lost. */
export function interruptedSentence(role: string): string {
  return `The ${role}'s answer in progress is interrupted.`;
}

function worktreeLines(preview: DeletePreview): DeletionLine[] {
  const worktree = preview.worktree;
  if (worktree === null) {
    return [];
  }
  const lines: DeletionLine[] = [
    {
      icon: ICONS.folder,
      text: "The worktree is removed",
      ...(worktree.dirty && worktree.files > 0
        ? { tag: `${counted(worktree.files, "uncommitted file")}` }
        : {}),
      detail: displayPath(worktree.path),
      detailMono: true,
    },
  ];
  if (worktree.error !== "") {
    lines.push({
      icon: "blocked",
      text: "Couldn't read the worktree",
      detail: `${displayPaths(worktree.error)}. Deleting still removes it.`,
    });
  }
  return lines;
}

function branchLine(preview: DeletePreview): DeletionLine[] {
  const branch = preview.branch;
  if (branch === null) {
    return [];
  }
  const line: DeletionLine = {
    icon: ICONS.branch,
    text: "The branch",
    mono: branch.name,
    after: " is deleted",
  };
  if (branch.error !== "") {
    line.detail = `Couldn't tell if it's merged: ${displayPaths(branch.error)}`;
  } else if (!branch.merged) {
    line.tag = branch.ahead > 0 ? `not merged · ${counted(branch.ahead, "commit")}` : "not merged";
  }
  return [line];
}

function pullRequestLine(preview: DeletePreview): DeletionLine[] {
  const pr = preview.pr;
  if (pr === null) {
    return [];
  }
  if (pr.state === "open") {
    return [
      {
        icon: ICONS.pullRequest,
        text: `PR #${pr.number} stays open on GitHub`,
        detail: "Close it there if you don't need it.",
        link: { label: `Open #${pr.number}`, href: pr.url },
      },
    ];
  }
  if (pr.state === "merged") {
    return [
      {
        icon: ICONS.merge,
        text: `PR #${pr.number} is merged`,
        detail: "Nothing changes on GitHub.",
      },
    ];
  }
  return [];
}

/** deletionLines are the lines of the preview of a task's deletion, in the order the dialog lists them. */
export function deletionLines(
  task: TaskSummary,
  reading: PreviewReading,
): DeletionPreviewProps["state"] {
  if (reading.kind === "reading") {
    return { kind: "reading" };
  }
  if (reading.kind === "failed") {
    return {
      kind: "lines",
      lines: [
        {
          icon: "blocked",
          text: "Couldn't read the worktree and the branch",
          detail: `${displayPaths(reading.error)}. Deleting still removes them.`,
        },
      ],
    };
  }
  const running: DeletionLine[] = interruptedSessions(task).map((role) => ({
    icon: "run",
    text: interruptedSentence(role).replace(/\.$/, ""),
  }));
  return {
    kind: "lines",
    lines: [
      ...running,
      ...worktreeLines(reading.preview),
      ...branchLine(reading.preview),
      ...pullRequestLine(reading.preview),
    ],
  };
}
