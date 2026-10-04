import type { DeletionLine, DeletionPreviewProps } from "@/components/system/DeletionPreview";
import { ICONS } from "@/components/system/icons";
import { taskSessions } from "@/features/sidebar/sessions";
import { displayPath, displayPaths } from "@/lib/paths";
import { counted, lowerFirst } from "@/lib/situations";
import { asTaskMode, type DeletePreview, type Step, type TaskSummary } from "@/lib/wails";

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

// worktreeLines is the line of the worktree: removed, with the uncommitted files git counted, or
// unreadable, with what git said, in place of the count it couldn't make.
function worktreeLines(preview: DeletePreview): DeletionLine[] {
  const worktree = preview.worktree;
  if (worktree === null) {
    return [];
  }
  if (worktree.error !== "") {
    return [
      {
        icon: "blocked",
        text: "Couldn't read the worktree",
        detail: `${displayPaths(worktree.error)}. Deleting still removes it.`,
      },
    ];
  }
  return [
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

/** DiscardStepTexts are the words of the Discard step dialog, from what the step has and what the worktree holds. */
export interface DiscardStepTexts {
  title: string;
  body: string;
  confirm: string;
  /** checkboxDescription says what the Also clean the worktree box does, checked or not. */
  checkboxDescription: string;
  /** readError is why the uncommitted files could not be counted, null when they could or are being read. */
  readError: string | null;
}

/** checkboxDescription says what the Also clean the worktree box does, checked or not, from what the worktree holds. */
export function checkboxDescription(reading: PreviewReading, clean: boolean): string {
  if (reading.kind === "ready") {
    const worktree = reading.preview.worktree;
    const files = worktree?.dirty ? worktree.files : 0;
    if (files === 0) {
      return "The worktree has no uncommitted changes.";
    }
    const which = files === 1 ? "uncommitted file" : `${files} uncommitted files`;
    return clean
      ? `Discards the ${which} in the worktree.`
      : `The ${which} ${files === 1 ? "stays" : "stay"}, and the step starts blocked until the worktree is clean.`;
  }
  return clean
    ? "Discards every uncommitted change in the worktree."
    : "Uncommitted changes stay, and the step starts blocked until the worktree is clean.";
}

/** discardStepTexts are the title, the body, the confirmation and the worktree line of the Discard step dialog. */
export function discardStepTexts(
  task: TaskSummary,
  step: Step,
  reading: PreviewReading,
  clean: boolean,
): DiscardStepTexts {
  const oneShot = asTaskMode(task.mode) === "one_shot";
  const subject = oneShot ? "the implementation" : `step ${step.number}`;
  const reports = (step.reports ?? []).length;
  const reviewed = step.reviewer !== null || reports > 0;
  const restart = `${oneShot ? "The implementation" : "The step"} starts again from scratch right away.`;
  let body = `This ends the session and deletes the conversation of ${subject}. ${restart}`;
  if (reviewed) {
    const agentReview =
      reports === 0
        ? ""
        : `, with the ${reports === 1 ? "report" : `${reports} reports`} of the agent review`;
    body = `This ends the sessions and deletes the conversations of ${subject} and of its reviewer${agentReview}. ${restart}`;
  }
  return {
    title: `Discard ${subject} and start over?`,
    body,
    confirm: oneShot ? "Discard the implementation" : "Discard step",
    checkboxDescription: checkboxDescription(reading, clean),
    readError:
      reading.kind === "failed"
        ? `Couldn't count the uncommitted files: ${displayPaths(reading.error)}`
        : null,
  };
}
